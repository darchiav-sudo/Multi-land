/**
 * Video quality selection and optimization helper
 * Provides functions for quality detection, selection, and adaptation
 */
import { memoize } from './utils';

export interface VideoQualityOption {
  label: string;
  value: string;
  resolution: number;
  bitrate?: number;
}

export const VIDEO_QUALITY_LEVELS = {
  AUTO: 'auto',
  HD: '1080p',
  HIGH: '720p',
  MEDIUM: '480p',
  LOW: '360p'
};

/**
 * Detects optimal video quality based on device and network conditions
 * @returns The recommended video quality level
 */
export async function detectOptimalQuality(): Promise<string> {
  // Check if user is on a mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Check connection type if available
  let connectionSpeed = 'unknown';
  if ('connection' in navigator && navigator.connection) {
    const connection = navigator.connection as any;
    connectionSpeed = connection.effectiveType || connection.type || 'unknown';
    
    // If data saver is enabled, use lower quality
    if (connection.saveData) {
      return isMobile ? VIDEO_QUALITY_LEVELS.LOW : VIDEO_QUALITY_LEVELS.MEDIUM;
    }
  }
  
  // Based on connection and device type
  if (connectionSpeed === '4g' || connectionSpeed === 'wifi') {
    return isMobile ? VIDEO_QUALITY_LEVELS.HIGH : VIDEO_QUALITY_LEVELS.HD;
  } else if (connectionSpeed === '3g') {
    return isMobile ? VIDEO_QUALITY_LEVELS.LOW : VIDEO_QUALITY_LEVELS.MEDIUM;
  } else if (connectionSpeed === '2g' || connectionSpeed === 'slow-2g') {
    return VIDEO_QUALITY_LEVELS.LOW;
  }
  
  // Default based on device type
  return isMobile ? VIDEO_QUALITY_LEVELS.MEDIUM : VIDEO_QUALITY_LEVELS.HIGH;
}

/**
 * Extracts quality information from filename
 * Supports formats like video_720p.mp4, video-1080p.mp4, etc.
 */
export const extractQualityFromFilename = memoize((url: string): string | null => {
  if (!url) return null;
  
  // Match quality patterns in filenames
  const qualityMatch = url.match(/_(\d+)p\.|\-(\d+)p\.|\[(\d+)p\]|\((\d+)p\)/i);
  if (!qualityMatch) return null;
  
  // Find the first capturing group that matched
  const resolution = qualityMatch.slice(1).find(match => match !== undefined);
  if (!resolution) return null;
  
  // Map to standardized quality level
  const resNumber = parseInt(resolution, 10);
  if (resNumber >= 1080) return VIDEO_QUALITY_LEVELS.HD;
  if (resNumber >= 720) return VIDEO_QUALITY_LEVELS.HIGH;
  if (resNumber >= 480) return VIDEO_QUALITY_LEVELS.MEDIUM;
  return VIDEO_QUALITY_LEVELS.LOW;
});

/**
 * Generates quality options based on a base URL pattern
 * @param baseUrl The base URL without quality suffix
 * @param extension File extension (default: mp4)
 * @returns Object with quality options
 */
export function generateQualityVersions(
  baseUrl: string, 
  extension: string = 'mp4'
): Record<string, string> {
  if (!baseUrl) return {};
  
  // Remove any existing quality suffix and extension
  let cleanBaseUrl = baseUrl;
  const qualitySuffixMatch = baseUrl.match(/_(1080|720|480|360)p\.[^.]+$/);
  
  if (qualitySuffixMatch) {
    cleanBaseUrl = baseUrl.slice(0, qualitySuffixMatch.index);
  } else {
    // Otherwise just remove the extension
    cleanBaseUrl = baseUrl.replace(/\.[^.]+$/, '');
  }
  
  return {
    [VIDEO_QUALITY_LEVELS.HD]: `${cleanBaseUrl}_1080p.${extension}`,
    [VIDEO_QUALITY_LEVELS.HIGH]: `${cleanBaseUrl}_720p.${extension}`,
    [VIDEO_QUALITY_LEVELS.MEDIUM]: `${cleanBaseUrl}_480p.${extension}`,
    [VIDEO_QUALITY_LEVELS.LOW]: `${cleanBaseUrl}_360p.${extension}`
  };
}

/**
 * Creates a set of standard quality options for a video
 * @param src The source URL of the video
 * @returns Array of quality options
 */
export function createQualityOptions(src: string): VideoQualityOption[] {
  return [
    {
      label: 'Auto (Recommended)',
      value: VIDEO_QUALITY_LEVELS.AUTO,
      resolution: 0
    },
    {
      label: 'High Definition (1080p)',
      value: VIDEO_QUALITY_LEVELS.HD,
      resolution: 1080,
      bitrate: 6000
    },
    {
      label: 'High Quality (720p)',
      value: VIDEO_QUALITY_LEVELS.HIGH,
      resolution: 720,
      bitrate: 2500
    },
    {
      label: 'Medium Quality (480p)',
      value: VIDEO_QUALITY_LEVELS.MEDIUM,
      resolution: 480,
      bitrate: 1000
    },
    {
      label: 'Low Quality (360p)',
      value: VIDEO_QUALITY_LEVELS.LOW,
      resolution: 360,
      bitrate: 600
    }
  ];
}

/**
 * Monitors playback performance and suggests quality changes if needed
 * @param videoElement The HTML video element to monitor
 * @param onQualitySuggestion Callback when quality change is suggested
 * @returns Function to stop monitoring
 */
export function monitorPlaybackQuality(
  videoElement: HTMLVideoElement,
  onQualitySuggestion: (suggestedQuality: string) => void
): () => void {
  let consecutiveStalls = 0;
  let lastBufferingTime = 0;
  let monitoring = true;
  
  const checkInterval = setInterval(() => {
    if (!monitoring || !videoElement) return;
    
    // Check if video is stalled
    if (videoElement.readyState < 3 && videoElement.currentTime > 0) {
      const now = Date.now();
      
      // If this is a new stall
      if (lastBufferingTime === 0) {
        lastBufferingTime = now;
      }
      
      // If stalled for more than 3 seconds
      else if (now - lastBufferingTime > 3000) {
        consecutiveStalls++;
        lastBufferingTime = 0; // Reset for next stall
        
        // After 2 consecutive stalls, suggest lower quality
        if (consecutiveStalls >= 2) {
          // Get current quality from source URL
          const currentSrc = videoElement.currentSrc;
          const currentQuality = extractQualityFromFilename(currentSrc) || VIDEO_QUALITY_LEVELS.AUTO;
          
          // Suggest a lower quality
          if (currentQuality === VIDEO_QUALITY_LEVELS.HD) {
            onQualitySuggestion(VIDEO_QUALITY_LEVELS.HIGH);
          } else if (currentQuality === VIDEO_QUALITY_LEVELS.HIGH) {
            onQualitySuggestion(VIDEO_QUALITY_LEVELS.MEDIUM);
          } else if (currentQuality === VIDEO_QUALITY_LEVELS.MEDIUM) {
            onQualitySuggestion(VIDEO_QUALITY_LEVELS.LOW);
          }
          
          consecutiveStalls = 0;
        }
      }
    } else {
      // Video is playing fine, reset buffering time
      lastBufferingTime = 0;
    }
  }, 1000);
  
  // Return function to stop monitoring
  return () => {
    monitoring = false;
    clearInterval(checkInterval);
  };
}