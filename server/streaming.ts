import { log } from "./vite";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { storage } from "./storage";
import { cdnEnabled } from "./s3";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

// Check if FFmpeg is available on the system
const checkFFmpegAvailability = async (): Promise<boolean> => {
  try {
    const { stdout, stderr } = await execAsync('ffmpeg -version');
    if (stdout.includes('ffmpeg version')) {
      log('FFmpeg is available', 'streaming');
      return true;
    }
    return false;
  } catch (error) {
    log('FFmpeg is not available: ' + error, 'streaming');
    return false;
  }
};

// Variable to store the FFmpeg availability status
let ffmpegAvailable: boolean | null = null;

// Initialize and check FFmpeg availability
export const initializeFFmpeg = async (): Promise<boolean> => {
  if (ffmpegAvailable === null) {
    ffmpegAvailable = await checkFFmpegAvailability();
    
    if (ffmpegAvailable) {
      log('Adaptive bitrate streaming enabled with FFmpeg', 'streaming');
    } else {
      log('Adaptive bitrate streaming disabled - FFmpeg not available', 'streaming');
    }
  }
  
  return ffmpegAvailable;
};

// Initialize streaming directories
export const initializeStreamingDirectories = async (): Promise<void> => {
  const streamingDir = path.join(process.cwd(), 'uploads', 'streaming');
  
  try {
    await fsPromises.access(streamingDir);
  } catch (error) {
    // Directory doesn't exist, create it
    await fsPromises.mkdir(streamingDir, { recursive: true });
    log(`Created streaming directory: ${streamingDir}`, 'streaming');
  }
};

/**
 * Generate a DASH manifest for a video file
 * This creates multiple bitrate versions of the video for adaptive streaming
 */
export const generateDASH = async (
  videoPath: string, 
  outputDir: string,
  videoId: string | number
): Promise<string> => {
  const ffmpegAvailable = await initializeFFmpeg();
  if (!ffmpegAvailable) {
    throw new Error('FFmpeg is not available. Cannot generate DASH manifest.');
  }
  
  // Create a unique manifest ID
  const manifestId = `${videoId}-${uuidv4().slice(0, 8)}`;
  const dashDir = path.join(outputDir, `dash-${manifestId}`);
  
  try {
    // Create output directory
    await fsPromises.mkdir(dashDir, { recursive: true });
    
    const manifestPath = path.join(dashDir, 'manifest.mpd');
    
    // Execute FFmpeg to generate DASH manifest with multiple bitrates
    const ffmpegCmd = `ffmpeg -i "${videoPath}" \
      -map 0:v:0 -map 0:a:0 \
      -b:v:0 4M -c:v:0 libx264 -filter:v:0 "scale=1920:-2" \
      -b:v:1 2M -c:v:1 libx264 -filter:v:1 "scale=1280:-2" \
      -b:v:2 1M -c:v:2 libx264 -filter:v:2 "scale=854:-2" \
      -b:v:3 500k -c:v:3 libx264 -filter:v:3 "scale=640:-2" \
      -use_timeline 1 -use_template 1 -window_size 5 -adaptation_sets "id=0,streams=v id=1,streams=a" \
      -f dash "${manifestPath}"`;
    
    log(`Generating DASH manifest with FFmpeg: ${manifestId}`, 'streaming');
    await execAsync(ffmpegCmd);
    
    log(`Successfully generated DASH manifest: ${manifestPath}`, 'streaming');
    return `dash-${manifestId}/manifest.mpd`;
  } catch (error) {
    log(`Error generating DASH manifest: ${error}`, 'streaming');
    throw new Error(`Failed to generate DASH manifest: ${error}`);
  }
};

/**
 * Generate an HLS manifest for a video file
 * This creates multiple bitrate versions of the video for adaptive streaming
 */
export const generateHLS = async (
  videoPath: string, 
  outputDir: string,
  videoId: string | number
): Promise<string> => {
  const ffmpegAvailable = await initializeFFmpeg();
  if (!ffmpegAvailable) {
    throw new Error('FFmpeg is not available. Cannot generate HLS manifest.');
  }
  
  // Create a unique manifest ID
  const manifestId = `${videoId}-${uuidv4().slice(0, 8)}`;
  const hlsDir = path.join(outputDir, `hls-${manifestId}`);
  
  try {
    // Create output directory
    await fsPromises.mkdir(hlsDir, { recursive: true });
    
    const manifestPath = path.join(hlsDir, 'master.m3u8');
    
    // Execute FFmpeg to generate HLS manifest with multiple bitrates
    const ffmpegCmd = `ffmpeg -i "${videoPath}" \
      -map 0:v:0 -map 0:a:0 \
      -c:v h264 -c:a aac \
      -b:v:0 4M -s:v:0 1920x1080 \
      -b:v:1 2M -s:v:1 1280x720 \
      -b:v:2 1M -s:v:2 854x480 \
      -b:v:3 500k -s:v:3 640x360 \
      -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0 v:3,a:0" \
      -master_pl_name master.m3u8 \
      -f hls -hls_time 6 -hls_list_size 0 \
      -hls_segment_filename "${hlsDir}/stream_%v_segment_%d.ts" \
      "${hlsDir}/stream_%v.m3u8"`;
    
    log(`Generating HLS manifest with FFmpeg: ${manifestId}`, 'streaming');
    await execAsync(ffmpegCmd);
    
    log(`Successfully generated HLS manifest: ${manifestPath}`, 'streaming');
    return `hls-${manifestId}/master.m3u8`;
  } catch (error) {
    log(`Error generating HLS manifest: ${error}`, 'streaming');
    throw new Error(`Failed to generate HLS manifest: ${error}`);
  }
};

/**
 * Get the streaming URL for a video file
 * This function checks if the video already has a streaming manifest
 * If not, it generates one asynchronously
 */
export const getStreamingUrl = async (
  videoFileKey: string,
  contentId: number,
  preferHLS: boolean = true
): Promise<{url: string, isAdaptive: boolean, format: string}> => {
  // Check for FFmpeg availability
  const ffmpegAvailable = await initializeFFmpeg();
  
  // If FFmpeg is not available, return direct URL
  if (!ffmpegAvailable) {
    const url = await storage.getMediaUrl(videoFileKey);
    return { url, isAdaptive: false, format: 'direct' };
  }
  
  try {
    // Check if we already have a streaming manifest for this video
    const existingManifest = await storage.getStreamingManifest(contentId, videoFileKey);
    
    if (existingManifest) {
      const format = existingManifest.path.includes('/hls-') ? 'hls' : 'dash';
      
      // If CDN is enabled, use CDN URL for the manifest
      let manifestUrl;
      if (cdnEnabled && existingManifest.s3Key) {
        manifestUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${encodeURIComponent(existingManifest.s3Key)}`;
      } else {
        manifestUrl = existingManifest.url;
      }
      
      return { 
        url: manifestUrl, 
        isAdaptive: true, 
        format 
      };
    }
    
    // No manifest exists yet, initiate asynchronous generation
    // For now, return the direct video URL
    const directUrl = await storage.getMediaUrl(videoFileKey);
    
    // Start async process to generate the manifest
    setTimeout(async () => {
      try {
        // Download the video if it's in S3
        let localVideoPath;
        if (videoFileKey.startsWith('http')) {
          // Need to download from S3 first
          const tempDir = path.join(process.cwd(), 'uploads', 'temp');
          await fsPromises.mkdir(tempDir, { recursive: true });
          
          const filename = path.basename(videoFileKey).split('?')[0]; // Remove query parameters
          localVideoPath = path.join(tempDir, filename);
          
          // Check if file already exists to avoid duplicate downloads
          try {
            await fsPromises.access(localVideoPath);
            log(`Using existing downloaded video: ${filename}`, 'streaming');
          } catch (e) {
            // File doesn't exist, download it
            log(`Downloading video from S3: ${filename}`, 'streaming');
            
            // Import fetch to download the file
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(videoFileKey);
            
            if (!response.ok) {
              throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
            }
            
            // Ensure response.body is not null
            if (!response.body) {
              throw new Error('Response body is null');
            }
            
            const fileStream = fs.createWriteStream(localVideoPath);
            
            await new Promise((resolve, reject) => {
              response.body!.pipe(fileStream);
              response.body!.on('error', (err: Error) => {
                reject(err);
              });
              fileStream.on('finish', () => {
                resolve(null);
              });
            });
            
            log(`Downloaded video for streaming conversion: ${filename}`, 'streaming');
          }
        } else {
          // Local file
          localVideoPath = path.join(process.cwd(), 'uploads', videoFileKey);
        }
        
        // Create streaming directory if it doesn't exist
        const streamingDir = path.join(process.cwd(), 'uploads', 'streaming');
        await fsPromises.mkdir(streamingDir, { recursive: true });
        
        // Generate the appropriate manifest
        let manifestRelativePath;
        if (preferHLS) {
          manifestRelativePath = await generateHLS(localVideoPath, streamingDir, contentId);
        } else {
          manifestRelativePath = await generateDASH(localVideoPath, streamingDir, contentId);
        }
        
        // Store manifest information in database
        const manifestPath = path.join(streamingDir, manifestRelativePath);
        const format = preferHLS ? 'hls' : 'dash';
        
        // Upload the manifest and segments to S3 if configured
        let s3Key = null;
        let manifestUrl = `/uploads/streaming/${manifestRelativePath}`;
        
        if (cdnEnabled) {
          try {
            // Import S3 upload functions at runtime to avoid circular dependencies
            const { uploadToS3, getSignedDownloadUrl } = await import('./s3');
            
            // The manifest file path
            const manifestFilePath = path.join(streamingDir, manifestRelativePath);
            
            // For HLS we need to upload all the segment files too
            if (format === 'hls') {
              // Get the directory containing the manifest and segments
              const hlsDir = path.dirname(manifestFilePath);
              
              // Get all segment files (they typically end with .ts)
              const segmentFiles = fs.readdirSync(hlsDir)
                .filter(file => file.endsWith('.ts') || file.endsWith('.m3u8'));
              
              // Upload each segment file
              for (const segmentFile of segmentFiles) {
                const segmentPath = path.join(hlsDir, segmentFile);
                const segmentKey = `streaming/${path.basename(hlsDir)}/${segmentFile}`;
                
                log(`Uploading HLS segment to S3: ${segmentFile}`, 'streaming');
                await uploadToS3(segmentPath, segmentKey);
              }
              
              // Set the main manifest key
              s3Key = `streaming/${manifestRelativePath}`;
            } else if (format === 'dash') {
              // For DASH we need to upload the manifest and init segments
              const dashDir = path.dirname(manifestFilePath);
              
              // Get all DASH files (they typically end with .mp4 or .mpd)
              const dashFiles = fs.readdirSync(dashDir)
                .filter(file => file.endsWith('.mp4') || file.endsWith('.mpd'));
              
              // Upload each DASH file
              for (const dashFile of dashFiles) {
                const dashPath = path.join(dashDir, dashFile);
                const dashKey = `streaming/${path.basename(dashDir)}/${dashFile}`;
                
                log(`Uploading DASH segment to S3: ${dashFile}`, 'streaming');
                await uploadToS3(dashPath, dashKey);
              }
              
              // Set the main manifest key
              s3Key = `streaming/${manifestRelativePath}`;
            }
            
            // Generate a CDN URL for the manifest if CloudFront is configured
            if (process.env.CLOUDFRONT_DOMAIN && s3Key) {
              manifestUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${encodeURIComponent(s3Key)}`;
              log(`Using CloudFront URL for streaming manifest: ${manifestUrl}`, 'streaming');
            } else if (s3Key) {
              // Fall back to a presigned S3 URL with type assertion to handle potential null
              manifestUrl = await getSignedDownloadUrl(s3Key as string, 7 * 24 * 60 * 60); // 7 days expiry
              log(`Using presigned S3 URL for streaming manifest: ${manifestUrl}`, 'streaming');
            }
          } catch (error) {
            log(`Error uploading streaming manifest to S3: ${error}`, 'streaming');
            // Fall back to local URL
            manifestUrl = `/uploads/streaming/${manifestRelativePath}`;
          }
        }
        
        // Save manifest information to database
        await storage.saveStreamingManifest({
          contentId,
          videoFileKey,
          path: manifestPath,
          url: manifestUrl,
          s3Key,
          format
        });
        
        log(`Completed async generation of ${format.toUpperCase()} manifest for content ${contentId}`, 'streaming');
      } catch (error) {
        log(`Error in async manifest generation: ${error}`, 'streaming');
      }
    }, 100); // Start almost immediately after returning direct URL
    
    return { url: directUrl, isAdaptive: false, format: 'direct' };
  } catch (error) {
    log(`Error getting streaming URL: ${error}`, 'streaming');
    
    // Fallback to direct URL in case of error
    const url = await storage.getMediaUrl(videoFileKey);
    return { url, isAdaptive: false, format: 'direct' };
  }
};