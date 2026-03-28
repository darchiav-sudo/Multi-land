import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import crypto from "crypto";
import { registerS3Routes } from "./s3-routes";
import storageStrategy, { s3Enabled } from "./s3";
import { getPresignedUploadUrl } from "./s3-direct-upload";
import { 
  initiateMultipartUpload, 
  getPresignedChunkUploadUrls, 
  completeMultipartUpload, 
  abortMultipartUpload,
  s3ChunkedEnabled
} from "./s3-chunked-upload";
import { registerWebinarRoutes } from "./webinar-routes";
import { 
  insertCourseSchema,
  insertContentSchema,
  insertEnrollmentSchema,
  insertProgressSchema,
  insertCategorySchema,
  insertCommentSchema
} from "@shared/schema";
import { ZodError } from "zod";
import "express-session"; // Import for declaration merging

// Extend the session type to include our uploads tracking
declare module "express-session" {
  interface SessionData {
    uploads?: {
      [uploadId: string]: {
        fileKey: string;
        fileName: string;
        contentType: string;
        fileSize: number;
        chunkSize: number;
        partCount: number;
        initiated: number;
        userId: number;
        parts: any[];
      }
    }
  }
}

// Helper function to ensure directories exist
async function ensureDirectoryExists(dirPath: string) {
  try {
    await fsPromises.access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_yourkey";
const stripe = new Stripe(stripeSecretKey);

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Register S3 routes for cloud storage
  registerS3Routes(app);
  
  // Note: We'll register webinar routes after creating the HTTP server below
  
  // Serve privacy policy directly for Google Play Store requirements
  app.get('/privacy-policy.html', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'client', 'public', 'privacy-policy.html'));
  });
  
  // Version endpoint for app update checks
  app.get('/api/app-version', (req, res) => {
    // This should be updated on each deployment to match client version
    res.json({ version: '2.0.5', released: new Date().toISOString() });
  });
  
  // VS Dating review endpoint - gets a random unshown review
  app.get('/api/vs-dating-review', async (req, res) => {
    try {
      const review = await storage.getRandomUnshownReview();
      
      if (!review) {
        // All reviews have been shown, reset and try again
        await storage.resetAllReviews();
        const newReview = await storage.getRandomUnshownReview();
        
        if (!newReview) {
          return res.status(404).json({ message: "No reviews available" });
        }
        
        res.json(newReview);
      } else {
        res.json(review);
      }
    } catch (error: any) {
      console.error("Error fetching VS Dating review:", error);
      res.status(500).json({ 
        message: "Error fetching review", 
        error: error.message 
      });
    }
  });
  
  // Generate a presigned URL for S3 content
  app.get('/api/s3-content/:fileKey(*)', async (req, res) => {
    try {
      if (!s3Enabled) {
        return res.status(404).json({ message: "S3 integration is not configured" });
      }
      
      const fileKey = decodeURIComponent(req.params.fileKey);
      
      // Generate a presigned URL with 1 hour expiration
      const signedUrl = await storageStrategy.getFileUrl(fileKey);
      
      res.json({ signedUrl });
    } catch (error: any) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({ 
        message: "Error generating presigned URL", 
        error: error.message 
      });
    }
  });
  
  // Network testing endpoint for video player test page
  app.get('/api/network-test', (req, res) => {
    const sizeKB = parseInt(req.query.size as string || '100', 10);
    const size = Math.min(Math.max(sizeKB, 1), 1000) * 1024; // Limit between 1KB and 1MB
    
    // Generate random data of specified size
    const buffer = crypto.randomBytes(size);
    
    // Set headers for optimal testing
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    });
    
    res.send(buffer);
  });
  
  // One-time utility endpoint to fix the admin password
  app.get('/api/fix-admin-password', async (req, res) => {
    try {
      // Only allow this to be run in development environments
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'This utility is disabled in production' });
      }
      
      // Get the admin user
      const admin = await storage.getUserByEmail('darchiav@gmail.com');
      
      if (!admin) {
        return res.status(404).json({ message: 'Admin user not found' });
      }
      
      // Use the imported hashPassword function
      
      // Hash the admin password
      const hashedPassword = await hashPassword('Jimbo2345');
      
      // Update the admin user with the hashed password
      const updated = await storage.updateUser(admin.id, { 
        password: hashedPassword,
        isAdmin: true  // Ensure admin flag is set
      });
      
      return res.json({ 
        message: 'Admin password updated successfully',
        success: true,
        user: { id: updated?.id, email: updated?.email, isAdmin: updated?.isAdmin }
      });
    } catch (error) {
      console.error('Error fixing admin password:', error);
      return res.status(500).json({ message: 'Error updating admin password', error: String(error) });
    }
  });
  
  // Setup file upload directories
  const courseUploadDir = path.join(process.cwd(), 'uploads/course-images');
  const categoryUploadDir = path.join(process.cwd(), 'uploads/category-images');
  const contentUploadDir = path.join(process.cwd(), 'uploads/content-files');
  const thumbnailUploadDir = path.join(process.cwd(), 'uploads/thumbnails');
  
  // Ensure upload directories exist
  if (!fs.existsSync(courseUploadDir)) {
    fs.mkdirSync(courseUploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(categoryUploadDir)) {
    fs.mkdirSync(categoryUploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(contentUploadDir)) {
    fs.mkdirSync(contentUploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(thumbnailUploadDir)) {
    fs.mkdirSync(thumbnailUploadDir, { recursive: true });
  }
  
  // Configure multer storage for course images
  const courseStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, courseUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'course-' + uniqueSuffix + ext);
    }
  });
  
  // Configure multer storage for category images
  const categoryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, categoryUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'category-' + uniqueSuffix + ext);
    }
  });
  
  // Configure multer storage for content files (PDFs, videos)
  const contentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, contentUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'content-' + uniqueSuffix + ext);
    }
  });
  
  // Configure multer storage for content thumbnails
  const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, thumbnailUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'thumbnail-' + uniqueSuffix + ext);
    }
  });
  
  // Setup multer upload instances
  const uploadCourseImage = multer({ 
    storage: courseStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow only image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  }).single('image');
  
  const uploadCategoryImage = multer({ 
    storage: categoryStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow only image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  }).single('image');
  
  // Setup multer upload for content files (PDFs, videos) with relaxed size limits and better error handling
  const uploadContentFile = multer({
    storage: contentStorage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit - increased for larger videos (adjust as needed)
    },
    fileFilter: (req, file, cb) => {
      console.log("Multer file filter checking file:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size // This may be undefined as multer doesn't have size yet at filter stage
      });
      
      // Validate content type from both file extension and mimetype
      const ext = path.extname(file.originalname).toLowerCase();
      const isPDF = file.mimetype === 'application/pdf' || ext === '.pdf';
      const isVideo = file.mimetype.startsWith('video/') || 
                     ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'].includes(ext);
      
      if (isPDF || isVideo) {
        console.log(`File passed validation: ${isPDF ? 'PDF' : 'Video'} file detected`);
        cb(null, true);
      } else {
        const errorMsg = `File rejected: Invalid file type "${file.mimetype}" with extension "${ext}"`;
        console.error(errorMsg);
        cb(new Error('Only PDF and video files are allowed. Supported video formats include MP4, MOV, AVI, WEBM, MKV.'));
      }
    }
  }).single('file');
  
  // Setup multer upload for content thumbnails
  const uploadThumbnail = multer({
    storage: thumbnailStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow only image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  }).single('file');
  
  // Direct file access route for debugging and testing
  app.get('/direct-video/:file', (req, res) => {
    const filename = req.params.file;
    const filePath = path.join(process.cwd(), 'uploads', 'content-files', filename);
    
    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`Direct video access error: File not found ${filename}`);
        return res.status(404).send(`Video not found: ${filename}`);
      }
      
      // Get file stats for streaming
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Direct video access error while getting stats: ${err.message}`);
          return res.status(500).send('Error accessing video file');
        }
        
        const fileSize = stats.size;
        
        // Handle range requests for seeking
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          
          console.log(`Direct video streaming: ${filename}, range: ${start}-${end}/${fileSize}`);
          
          // Set streaming headers
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Resource-Policy': 'cross-origin'
          });
          
          // Create file stream
          const stream = fs.createReadStream(filePath, { start, end });
          stream.pipe(res);
        } else {
          // Set headers for full file response
          console.log(`Direct video serving: ${filename}, size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
          
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Resource-Policy': 'cross-origin'
          });
          
          // Stream the entire file
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
        }
      });
    });
  });
  
  // Serve a known working test video for debugging purposes
  app.get('/test-video', (req, res) => {
    // This is a known-working MP4 video path
    const filename = 'content-1744050896708-353731143.mp4'; // Known working video
    const filePath = path.join(process.cwd(), 'uploads', 'content-files', filename);
    
    console.log(`Serving test video from: ${filePath}`);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`Test video not found: ${filePath}`);
        return res.status(404).send('Test video file not found');
      }
      
      // Set comprehensive video headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'no-cache'); // Disable caching for testing
      
      // Send file directly without range handling (simpler approach)
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`Test video error: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).send('Error serving test video');
          }
        }
      });
    });
  });
  
  // Special route just for content 14
  app.get('/lesson-14-video', async (req, res) => {
    try {
      // Get content 14 from database
      const content = await storage.getContent(14);
      if (!content || !content.videoUrl) {
        return res.status(404).send('Lesson 14 video not found');
      }
      
      // Extract filename from video URL
      const videoUrl = content.videoUrl;
      const filename = videoUrl.split('/').pop();
      if (!filename) {
        return res.status(404).send('Invalid video URL');
      }
      
      const filePath = path.join(process.cwd(), 'uploads', 'content-files', filename);
      console.log(`Serving lesson 14 video from: ${filePath}`);
      
      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error(`Lesson 14 video not found: ${filePath}`);
          return res.status(404).send('Video file not found');
        }
        
        // Set video headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        
        // Send file directly without range handling (simpler approach)
        res.sendFile(filePath, (err) => {
          if (err) {
            console.error(`Lesson 14 video error: ${err.message}`);
            if (!res.headersSent) {
              res.status(500).send('Error serving video');
            }
          }
        });
      });
    } catch (error) {
      console.error('Lesson 14 video server error:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Serve uploaded files statically with enhanced video handling
  app.use('/uploads', (req, res, next) => {
    // Add specific headers for video content
    const urlPath = req.path.toLowerCase();
    if (urlPath.endsWith('.mp4') || urlPath.endsWith('.mov') || urlPath.endsWith('.webm')) {
      // Set MIME type based on extension
      const ext = path.extname(urlPath).toLowerCase();
      const mimeType = mimeLookup[ext] || 'video/mp4'; // Default to mp4 if unknown
      
      res.set({
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Accept-Ranges': 'bytes', // Crucial for mobile streaming
        'Cache-Control': 'public, max-age=31536000', // Cache for a year
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      });
    }
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));
  
  // In-memory cache for video file stats to avoid repeated disk access
  const videoStatsCache = new Map<string, { contentType: string, size: number, mtime: Date }>();
  const mimeLookup: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/mp2t',
    '.3gp': 'video/3gpp'
  };

  // Enhanced video serving route with robust error handling and efficient streaming
  app.get('/api/video/:file', (req, res) => {
    const filename = decodeURIComponent(req.params.file);
    if (!filename) {
      console.error('Video API: No filename provided');
      return res.status(400).send('Filename is required');
    }
    
    // Sanitize the filename to prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const videoPath = path.join(process.cwd(), 'uploads/content-files', sanitizedFilename);
    
    console.log(`Video API request: ${sanitizedFilename}`);
    
    // Determine content type from extension
    const ext = path.extname(sanitizedFilename).toLowerCase();
    const contentType = mimeLookup[ext] || 'video/mp4';
    
    // Try to get file stats (either from cache or fresh)
    let stats;
    try {
      // Check if we have cached stats
      if (videoStatsCache.has(videoPath)) {
        const cachedStats = videoStatsCache.get(videoPath)!;
        
        try {
          // Check if file has been modified since we cached the stats
          const currentStat = fs.statSync(videoPath);
          if (cachedStats.mtime.getTime() === currentStat.mtime.getTime()) {
            stats = cachedStats;
          } else {
            // Update cache with new stats
            stats = { 
              contentType, 
              size: currentStat.size, 
              mtime: currentStat.mtime 
            };
            videoStatsCache.set(videoPath, stats);
          }
        } catch (statErr) {
          // If file no longer exists, remove from cache
          videoStatsCache.delete(videoPath);
          throw statErr; // Re-throw to be caught by outer catch
        }
      } else {
        // Not in cache, get fresh stats and cache them
        try {
          const fileStat = fs.statSync(videoPath);
          stats = { 
            contentType, 
            size: fileStat.size, 
            mtime: fileStat.mtime 
          };
          videoStatsCache.set(videoPath, stats);
        } catch (err) {
          console.error(`Video API: Error accessing file ${sanitizedFilename}:`, err);
          return res.status(404).send('Video not found or inaccessible');
        }
      }
    } catch (err) {
      console.error(`Video API: Error retrieving stats for ${sanitizedFilename}:`, err);
      return res.status(404).send('Video not found or inaccessible');
    }
    
    const fileSize = stats.size;
    
    // Default headers with appropriate caching
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Accept-Ranges': 'bytes'
    };
    
    // Check if the request has a Range header (used by browsers for seeking)
    const range = req.headers.range;
    if (range) {
      try {
        const parts = range.replace(/bytes=/, '').split('-');
        let start = parseInt(parts[0], 10);
        
        // Handle range format issues
        if (isNaN(start)) {
          start = 0;
        }
        
        // Parse end value with fallback
        let end: number = parts[1] ? parseInt(parts[1], 10) : -1;
        
        // Handle invalid or missing end parameter
        if (isNaN(end) || end < 0 || end >= fileSize) {
          end = fileSize - 1;
        }
        
        // For large files and mobile, use smaller chunks
        // At this point end is always a valid number
        if ((end - start) > 2 * 1024 * 1024) { // If chunk size > 2MB
          end = Math.min(start + 1024 * 1024, fileSize - 1); // 1MB chunk for mobile
        }
        
        // Validate range is still valid
        if (start >= fileSize) {
          return res.status(416).set({
            'Content-Range': `bytes */${fileSize}`
          }).end();
        }
        
        // Stream the requested range
        const chunksize = (end - start) + 1;
        res.status(206).set({
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize
        });
        
        // Create read stream with error handling
        const stream = fs.createReadStream(videoPath, { 
          start, 
          end,
          highWaterMark: 64 * 1024 // 64KB buffer for better performance
        });
        
        // Handle potential streaming errors
        stream.on('error', (streamErr) => {
          console.error(`Video API: Streaming error for ${sanitizedFilename}:`, streamErr);
          // Only send error if headers weren't sent yet
          if (!res.headersSent) {
            res.status(500).send('Error streaming video');
          } else {
            res.end();
          }
        });
        
        stream.pipe(res);
      } catch (rangeErr) {
        console.error(`Video API: Range error for ${sanitizedFilename}:`, rangeErr);
        return res.status(416).send('Invalid range request');
      }
    } else {
      // For requests without Range header (initial requests)
      // For mobile or large files, suggest using range requests by responding with 206
      if (fileSize > 2 * 1024 * 1024) { // 2MB
        console.log(`Video API: Suggesting range request for ${sanitizedFilename}`);
        return res.status(206).set({
          ...headers,
          'Content-Range': `bytes */${fileSize}`
        }).end();
      } else {
        // For smaller files, send directly
        console.log(`Video API: Sending full file for ${sanitizedFilename} (${Math.round(fileSize/1024)}KB)`);
        res.set({
          ...headers,
          'Content-Length': fileSize
        });
        
        const stream = fs.createReadStream(videoPath, {
          highWaterMark: 64 * 1024 // 64KB buffer for better performance
        });
        
        // Handle potential streaming errors
        stream.on('error', (streamErr) => {
          console.error(`Video API: Streaming error for ${sanitizedFilename}:`, streamErr);
          if (!res.headersSent) {
            res.status(500).send('Error streaming video');
          } else {
            res.end();
          }
        });
        
        stream.pipe(res);
      }
    }
  });
  
  // Improved API endpoint for downloading videos directly with error handling
  app.get('/api/video-download/:file', (req, res) => {
    const filename = decodeURIComponent(req.params.file);
    if (!filename) {
      console.error('Video Download API: No filename provided');
      return res.status(400).send('Filename is required');
    }
    
    // Sanitize the filename to prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const videoPath = path.join(process.cwd(), 'uploads/content-files', sanitizedFilename);
    
    console.log(`Video Download API request: ${sanitizedFilename}`);
    
    // Check if file exists
    try {
      const stats = fs.statSync(videoPath);
      
      // Set disposition and content type for download
      res.set({
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size
      });
      
      // Create and pipe read stream with error handling
      const stream = fs.createReadStream(videoPath, {
        highWaterMark: 64 * 1024 // 64KB buffer for better performance
      });
      
      // Handle potential streaming errors
      stream.on('error', (streamErr) => {
        console.error(`Video Download API: Streaming error for ${sanitizedFilename}:`, streamErr);
        if (!res.headersSent) {
          res.status(500).send('Error downloading video');
        } else {
          res.end();
        }
      });
      
      stream.pipe(res);
    } catch (err) {
      console.error(`Video Download API: Error accessing file ${sanitizedFilename}:`, err);
      return res.status(404).send('Video not found or inaccessible');
    }
  });
  
  // Error handler for Zod validation
  const validateBody = (schema: any) => (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors
        });
      }
      next(error);
    }
  };

  // Admin middleware
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };
  
  // Enhanced endpoint for generating presigned PUT URLs for direct S3 uploads
  app.post("/api/s3-presigned-upload", isAdmin, async (req, res) => {
    try {
      if (!s3Enabled) {
        return res.status(400).json({ 
          message: "S3 not configured",
          details: "Direct S3 uploads are not available. S3 integration must be configured."
        });
      }
      
      const { fileName, contentType, fileSize } = req.body;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ 
          message: "Missing required fields",
          details: "fileName and contentType are required" 
        });
      }
      
      // Check if the request is from the test page or the regular upload flow
      const isTestUpload = req.get('Referer')?.includes('/admin/s3-test');
      
      // Log file information
      console.log(`Generating presigned URL for direct S3 upload: ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)}MB)`);
      console.log(`Content type: ${contentType}`);
      console.log(`User agent: ${req.get('User-Agent') || 'unknown'}`);
      console.log(`Referer: ${req.get('Referer') || 'unknown'}`);
      
      // Also log request body for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('Request body:', req.body);
      }
      
      // Create a unique file key including original filename for better organization
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      
      // Use a different folder for test uploads
      const fileKey = isTestUpload 
        ? `test-uploads/${timestamp}-${safeFileName}`
        : `content-files/videos/${timestamp}-${safeFileName}`;
      
      console.log(`Generating presigned URL for ${fileKey} with content type ${contentType}`);
      console.log(`Upload source: ${isTestUpload ? 'S3 Test Page' : 'Regular Upload Flow'}`);
      
      // Generate presigned URL with the correct content type
      const { presignedUrl, fileUrl, uploadMethod } = await getPresignedUploadUrl(fileKey, contentType);
      
      // Return a comprehensive response with all needed information for direct S3 uploads
      res.json({
        presignedUrl,
        fileUrl,
        fileKey,
        expiresIn: 3600, // 1 hour in seconds
        uploadMethod: 'PUT',
        contentType: contentType,
        bucketName: process.env.AWS_S3_BUCKET || 'unknown-bucket',
        region: process.env.AWS_REGION
      });
      
    } catch (error: any) {
      console.error("Error generating presigned upload URL:", error);
      res.status(500).json({ 
        message: "Error generating upload URL", 
        details: error.message 
      });
    }
  });

  // Authentication check middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // File Upload Endpoints
  // Upload course image
  app.post("/api/upload/course-image", isAdmin, (req, res) => {
    uploadCourseImage(req, res, (err) => {
      if (err) {
        console.error("Error uploading course image:", err);
        return res.status(400).json({ message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Return the path that can be used to access the file
      const filePath = `/uploads/course-images/${req.file.filename}`;
      res.json({ imageUrl: filePath });
    });
  });
  
  // Upload category image
  app.post("/api/upload/category-image", isAdmin, (req, res) => {
    uploadCategoryImage(req, res, (err) => {
      if (err) {
        console.error("Error uploading category image:", err);
        return res.status(400).json({ message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Return the path that can be used to access the file
      const filePath = `/uploads/category-images/${req.file.filename}`;
      res.json({ imageUrl: filePath });
    });
  });
  
  // Upload content file (PDF, video) - with S3 support for videos
  app.post("/api/upload/content-file", isAdmin, (req, res) => {
    console.log("Content file upload request received from:", req.get('User-Agent') || 'unknown browser');
    
    uploadContentFile(req, res, async (err) => {
      if (err) {
        console.error("Error uploading content file:", err);
        return res.status(400).json({ message: err.message });
      }
      
      if (!req.file) {
        console.error("No file received in the request");
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'pdf';
      const isVideo = fileType === 'video';
      
      // For videos, use S3 storage if enabled
      if (isVideo) {
        try {
          // Create a unique file key for S3 with proper folder structure
          const timestamp = Date.now();
          const fileExtension = path.extname(req.file.originalname);
          const fileKey = `content-files/videos/${timestamp}-${req.file.filename}`;
          
          // Use storageStrategy to determine the right upload method
          const fileUrl = await storageStrategy.uploadFile(
            req.file.path, 
            fileKey,
            req.file.mimetype
          );
          
          // Return S3 URL or local path depending on which storage was used
          res.json({
            fileUrl: fileUrl,
            fileType: fileType,
            fileName: req.file.originalname,
            s3Stored: true
          });
          
          // Clean up local file if uploaded to S3
          if (s3Enabled) {
            try {
              fs.unlinkSync(req.file.path);
              console.log(`Removed temporary local file: ${req.file.path}`);
            } catch (cleanupErr) {
              console.error("Error cleaning up temp file:", cleanupErr);
            }
          }
        } catch (s3Error: any) {
          console.error("Error uploading to S3:", s3Error);
          return res.status(500).json({ 
            message: "Failed to upload to cloud storage",
            details: s3Error.message
          });
        }
      } else {
        // For PDFs and other non-video files, use local storage for now
        const filePath = `/uploads/content-files/${req.file.filename}`;
        res.json({ 
          fileUrl: filePath,
          fileType: fileType,
          fileName: req.file.originalname,
          s3Stored: false
        });
      }
    });
  });
  
  // Unified upload endpoint for new content editor with enhanced error handling and logging
  app.post("/api/upload", isAdmin, (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log(`[${requestId}] Upload request received to /api/upload from ${req.get('User-Agent') || 'unknown browser'}`);
    
    // Using global CORS middleware now - adding only request-specific headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Request-ID', requestId);
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Cross-Origin-Embedder-Policy', 'credentialless');
    
    // Extract browser info for debugging
    const browser = req.get('User-Agent');
    if (browser) {
      console.log(`[${requestId}] Browser detected: ${browser}`);
      // Log if this is Opera or Chrome which might have specific requirements
      if (browser.includes('OPR') || browser.includes('Opera')) {
        console.log(`[${requestId}] Opera browser detected, applying special handling`);
      } else if (browser.includes('Chrome')) {
        console.log(`[${requestId}] Chrome browser detected, applying special handling`);
      }
    }
    
    // Preflight requests are now handled by the cors middleware
    
    // Check if the content type is set correctly for multipart form data
    if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
      console.error(`[${requestId}] Invalid content type: ${req.headers['content-type']}`);
      return res.status(400).json({
        message: "Invalid request content type",
        details: "Uploads must use multipart/form-data content type"
      });
    }
    
    // Debugging request info
    console.log(`[${requestId}] Upload request info:`, {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      userAgent: req.headers['user-agent']
    });
    
    // First check if uploads directory exists, create if not
    const contentFilesDir = path.join(process.cwd(), 'uploads/content-files');
    try {
      if (!fs.existsSync(contentFilesDir)) {
        console.log(`[${requestId}] Creating uploads directory:`, contentFilesDir);
        fs.mkdirSync(contentFilesDir, { recursive: true });
      }
      
      // Verify the directory is writable
      const testFile = path.join(contentFilesDir, `.test_write_${requestId}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`[${requestId}] Upload directory is writable`);
    } catch (dirError: any) {
      console.error(`[${requestId}] Error with uploads directory:`, dirError);
      return res.status(500).json({ 
        message: "Server configuration error - upload directory not available or not writable",
        details: dirError.message 
      });
    }
    
    // Process the upload with improved error handling
    uploadContentFile(req, res, async (err) => {
      if (err) {
        // Determine the specific error type for better client feedback
        console.error(`[${requestId}] Error uploading file:`, err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            message: "File too large",
            details: `Maximum file size is ${(500 * 1024 * 1024) / (1024 * 1024)}MB. Please compress your file or use a smaller file.`
          });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            message: "Unexpected file field",
            details: "The file must be uploaded with the field name 'file'"
          });
        } else if (err.message.includes('Only PDF and video files')) {
          return res.status(415).json({
            message: "Unsupported file type",
            details: "Only PDF and video files (MP4, MOV, AVI, WEBM, MKV) are supported"
          });
        } else {
          return res.status(400).json({ 
            message: err.message || "Unknown upload error",
            details: "File upload failed. Please try again with a different file or format."
          });
        }
      }
      
      console.log(`[${requestId}] Multer successfully processed the file upload`);
      
      if (!req.file) {
        console.error(`[${requestId}] No file found in the processed request`);
        return res.status(400).json({ 
          message: "No file uploaded",
          details: "The upload request didn't contain a file. Make sure the file field is named 'file'."
        });
      }
      
      console.log(`[${requestId}] File received:`, {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        filename: req.file.filename
      });
      
      try {
        // Verify the file was actually saved
        const physicalPath = path.join(process.cwd(), 'uploads/content-files', req.file.filename);
        fs.accessSync(physicalPath, fs.constants.F_OK);
        
        // Get file size to verify it's not empty
        const stats = fs.statSync(physicalPath);
        if (stats.size === 0) {
          console.error("Uploaded file is empty");
          fs.unlinkSync(physicalPath); // Remove empty file
          return res.status(400).json({ 
            message: "Upload failed - file is empty",
            details: "The uploaded file has zero bytes. Please select a valid file."
          });
        }
        
        console.log("File successfully saved at:", physicalPath, "Size:", stats.size, "bytes");
        
        // Determine file type
        const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'pdf';
        const isVideo = fileType === 'video';
        
        // For videos, use S3 storage if enabled
        if (isVideo && s3Enabled) {
          try {
            // Create a unique file key for S3 with proper folder structure
            const timestamp = Date.now();
            const fileExtension = path.extname(req.file.originalname);
            const fileKey = `content-files/videos/${timestamp}-${req.file.filename}`;
            
            console.log("Uploading video to S3 with fileKey:", fileKey);
            
            // Use storageStrategy to determine the right upload method
            const fileUrl = await storageStrategy.uploadFile(
              req.file.path, 
              fileKey,
              req.file.mimetype
            );
            
            console.log("S3 upload successful, direct URL:", fileUrl);
            
            // Generate a presigned URL for immediate access
            try {
              const signedUrl = await storageStrategy.getFileUrl(fileKey);
              console.log("Generated presigned URL for immediate access");
              
              const response = { 
                fileUrl: fileUrl,           // Original URL for storage in database
                fileType: fileType,
                fileName: req.file.originalname,
                size: stats.size,
                s3Stored: true,
                signedUrl: signedUrl,       // Presigned URL for immediate access
                fileKey: fileKey            // Store file key for future presigned URL generation
              };
              
              console.log("Sending S3 response with presigned URL");
              res.json(response);
            } catch (presignError) {
              console.error("Failed to generate presigned URL, returning direct URL:", presignError);
              
              const response = { 
                fileUrl: fileUrl,
                fileType: fileType,
                fileName: req.file.originalname,
                size: stats.size,
                s3Stored: true
              };
              
              res.json(response);
            }
            
            // Clean up local file if uploaded to S3
            try {
              fs.unlinkSync(req.file.path);
              console.log(`Removed temporary local file: ${req.file.path}`);
            } catch (cleanupErr) {
              console.error("Error cleaning up temp file:", cleanupErr);
            }
          } catch (s3Error: any) {
            console.error("Error uploading to S3:", s3Error);
            return res.status(500).json({ 
              message: "Failed to upload to cloud storage",
              details: s3Error.message
            });
          }
        } else {
          // For PDFs and other non-video files, or if S3 is disabled, use local storage
          const filePath = `/uploads/content-files/${req.file.filename}`;
          
          const response = { 
            fileUrl: filePath,
            fileType: fileType,
            fileName: req.file.originalname,
            size: stats.size,
            s3Stored: false
          };
          
          console.log("Sending local storage response:", response);
          res.json(response);
        }
      } catch (fsError: any) {
        console.error("File not saved properly:", fsError);
        return res.status(500).json({ 
          message: "File upload failed - could not save file",
          details: fsError.message
        });
      }
    });
  });
  
  // Upload content thumbnail image with enhanced error handling
  app.post("/api/upload/thumbnail", isAdmin, (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log(`[${requestId}] Thumbnail upload request received from ${req.get('User-Agent') || 'unknown browser'}`);
    
    // Using global CORS middleware now - no need for individual header settings
    // Adding only request-specific headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Request-ID', requestId);
    
    // First check if uploads directory exists, create if not
    const thumbnailsDir = path.join(process.cwd(), 'uploads/thumbnails');
    try {
      if (!fs.existsSync(thumbnailsDir)) {
        console.log("Creating thumbnails directory:", thumbnailsDir);
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }
    } catch (dirError: any) {
      console.error("Error creating thumbnails directory:", dirError);
      return res.status(500).json({ 
        message: "Server configuration error - upload directory not available",
        details: dirError.message 
      });
    }
    
    uploadThumbnail(req, res, (err) => {
      if (err) {
        console.error("Error uploading thumbnail:", err);
        return res.status(400).json({ 
          message: err.message,
          details: "File upload error - the file may be too large or of an unsupported type"
        });
      }
      
      if (!req.file) {
        console.error("No thumbnail file in request");
        return res.status(400).json({ 
          message: "No file uploaded",
          details: "The upload request didn't contain a file. Make sure the file field is named 'file'."
        });
      }
      
      console.log("Thumbnail received:", {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        filename: req.file.filename
      });
      
      try {
        // Verify the file was actually saved
        const physicalPath = path.join(process.cwd(), 'uploads/thumbnails', req.file.filename);
        fs.accessSync(physicalPath, fs.constants.F_OK);
        
        // Get file size to verify it's not empty
        const stats = fs.statSync(physicalPath);
        if (stats.size === 0) {
          console.error("Uploaded thumbnail is empty");
          fs.unlinkSync(physicalPath); // Remove empty file
          return res.status(400).json({ 
            message: "Upload failed - file is empty",
            details: "The uploaded file has zero bytes. Please select a valid file."
          });
        }
        
        console.log("Thumbnail successfully saved at:", physicalPath, "Size:", stats.size, "bytes");
        
        // Return the path that can be used to access the file
        const filePath = `/uploads/thumbnails/${req.file.filename}`;
        
        const response = { 
          fileUrl: filePath,
          fileType: 'image',
          fileName: req.file.originalname,
          size: stats.size
        };
        
        console.log("Sending thumbnail response:", response);
        res.json(response);
      } catch (fsError: any) {
        console.error("Thumbnail not saved properly:", fsError);
        return res.status(500).json({ 
          message: "File upload failed - could not save thumbnail",
          details: fsError.message
        });
      }
    });
  });

  // Course routes
  app.get("/api/courses", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const courses = category 
        ? await storage.getCoursesByCategory(category)
        : await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(parseInt(req.params.id));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", isAdmin, validateBody(insertCourseSchema), async (req, res) => {
    try {
      const course = await storage.createCourse(req.body);
      
      // Broadcast course creation to connected clients
      if ((global as any).broadcastUpdate) {
        (global as any).broadcastUpdate('course_created', { course });
      }
      
      res.status(201).json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.put("/api/courses/:id", isAdmin, validateBody(insertCourseSchema), async (req, res) => {
    try {
      const course = await storage.updateCourse(parseInt(req.params.id), req.body);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Broadcast course update to connected clients
      if ((global as any).broadcastUpdate) {
        (global as any).broadcastUpdate('course_updated', { course });
      }
      
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  app.delete("/api/courses/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCourse(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Categories API error:", error.message, error.stack);
      res.status(500).json({ message: "Failed to fetch categories", error: error.message });
    }
  });

  app.post("/api/categories", isAdmin, validateBody(insertCategorySchema), async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  
  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(parseInt(req.params.id));
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });
  
  app.put("/api/categories/:id", isAdmin, validateBody(insertCategorySchema), async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const category = await storage.updateCategory(categoryId, req.body);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });
  
  app.delete("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const result = await storage.deleteCategory(categoryId);
      if (!result) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Content routes  
  app.get("/api/courses/:courseId/contents", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      console.log(`Fetching contents for course ID: ${courseId}`);
      
      // First check if the course exists
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.log(`Course with ID ${courseId} not found`);
        return res.status(404).json({ message: "Course not found" });
      }
      
      const contents = await storage.getContentsByCourse(courseId);
      console.log(`Retrieved ${contents.length} content items for course ${courseId}`);
      res.json(contents);
    } catch (error: any) {
      console.error("Error fetching course contents:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        message: "Failed to fetch course contents", 
        error: error.message,
        details: error.stack
      });
    }
  });
  
  app.get("/api/contents/:id", async (req, res) => {
    try {
      const content = await storage.getContent(parseInt(req.params.id));
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.post("/api/contents", isAdmin, validateBody(insertContentSchema), async (req, res) => {
    try {
      console.log("Content creation request:", JSON.stringify(req.body, null, 2));
      
      // Get all existing content for this course to calculate the next order value
      const existingContents = await storage.getContentsByCourse(req.body.courseId);
      
      // Find the highest order value and add 1 for automatic ordering
      let nextOrder = 1; // Default to 1 if no content exists
      if (existingContents && existingContents.length > 0) {
        // Using reduce to find the highest order value
        const highestOrder = existingContents.reduce(
          (max, content) => (content.order > max ? content.order : max), 
          0
        );
        nextOrder = highestOrder + 1;
      }
      
      console.log(`Automatically assigning order ${nextOrder} for new content in course ${req.body.courseId}`);
      
      // Ensure all required fields are present
      const contentData = {
        courseId: req.body.courseId,
        title: req.body.title,
        type: req.body.type || 'mixed',
        content: req.body.content || 'Content',
        // Always use the automatically calculated order to ensure new content is placed at the end
        order: nextOrder,
        // Handle optional fields by setting them to null if undefined
        thumbnailUrl: req.body.thumbnailUrl || null,
        textContent: req.body.textContent || null,
        videoUrl: req.body.videoUrl || null,
        videoItems: req.body.videoItems || [],
        youtubeUrl: req.body.youtubeUrl || null,
        youtubeName: req.body.youtubeName || null,
        pdfUrl: req.body.pdfUrl || null,
        pdfItems: req.body.pdfItems || [],
        quizContent: req.body.quizContent || null,
        display_order: req.body.display_order || null
      };
      
      console.log("Processed content data:", JSON.stringify(contentData, null, 2));
      const content = await storage.createContent(contentData);
      console.log("Content created successfully:", content.id);
      
      // WebSocket broadcasting temporarily disabled
      // Broadcasting will be re-enabled after connection stability improvements
      
      res.status(201).json(content);
    } catch (error: any) {
      console.error("Content creation error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        message: "Failed to create content", 
        error: error.message,
        details: error.stack
      });
    }
  });
  
  // New route for updating content order
  app.patch("/api/contents/:id/order", isAdmin, async (req, res) => {
    try {
      const { order } = req.body;
      if (typeof order !== 'number') {
        return res.status(400).json({ message: "Invalid order value" });
      }
      
      const content = await storage.updateContent(parseInt(req.params.id), { order });
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content order" });
    }
  });
  
  // Endpoint for updating the display order of elements within a content item
  app.patch("/api/contents/:id/display-order", isAdmin, async (req, res) => {
    try {
      const { display_order } = req.body;
      if (typeof display_order !== 'string') {
        return res.status(400).json({ message: "Invalid display_order value" });
      }
      
      const content = await storage.updateContent(parseInt(req.params.id), { display_order });
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      res.json(content);
    } catch (error) {
      console.error("Error updating content display order:", error);
      res.status(500).json({ message: "Failed to update content display order" });
    }
  });
  
  // PUT endpoint for updating full content
  app.put("/api/contents/:id", isAdmin, async (req, res) => {
    try {
      console.log("Content update request:", JSON.stringify(req.body, null, 2));
      
      const contentId = parseInt(req.params.id);
      
      // First get existing content
      const existingContent = await storage.getContent(contentId);
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Preserve existing fields unless explicitly updated
      // This ensures we don't overwrite fields with null values accidentally
      const contentData = {
        // Only update fields that are explicitly provided in the request
        ...(req.body.title !== undefined && { title: req.body.title }),
        ...(req.body.type !== undefined && { type: req.body.type }),
        ...(req.body.content !== undefined && { content: req.body.content }),
        ...(req.body.order !== undefined && { order: req.body.order }),
        
        // For textContent and other content fields, only update if explicitly provided
        // This preserves existing content when just reordering
        ...(req.body.thumbnailUrl !== undefined && { thumbnailUrl: req.body.thumbnailUrl }),
        ...(req.body.textContent !== undefined && { textContent: req.body.textContent }),
        ...(req.body.videoUrl !== undefined && { videoUrl: req.body.videoUrl }),
        ...(req.body.videoItems !== undefined && { videoItems: req.body.videoItems }),
        ...(req.body.youtubeUrl !== undefined && { youtubeUrl: req.body.youtubeUrl }),
        ...(req.body.youtubeName !== undefined && { youtubeName: req.body.youtubeName }),
        ...(req.body.pdfUrl !== undefined && { pdfUrl: req.body.pdfUrl }),
        ...(req.body.pdfItems !== undefined && { pdfItems: req.body.pdfItems }),
        ...(req.body.quizContent !== undefined && { quizContent: req.body.quizContent }),
        ...(req.body.display_order !== undefined && { display_order: req.body.display_order })
      };
      
      console.log("Processed update data:", JSON.stringify(contentData, null, 2));
      const content = await storage.updateContent(contentId, contentData);
      
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // WebSocket broadcasting temporarily disabled
      
      console.log("Content updated successfully:", content.id);
      res.json(content);
    } catch (error: any) {
      console.error("Content update error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        message: "Failed to update content", 
        error: error.message,
        details: error.stack
      });
    }
  });
  
  // Delete content
  app.delete("/api/contents/:id", isAdmin, async (req, res) => {
    try {
      console.log(`DELETE request received for content ID: ${req.params.id}`);
      const contentId = parseInt(req.params.id);
      
      const result = await storage.deleteContent(contentId);
      
      if (result) {
        console.log(`Successfully deleted content ID: ${contentId}`);
        
        // WebSocket broadcasting temporarily disabled
        
        res.status(200).json({ message: "Content deleted successfully" });
      } else {
        console.log(`Failed to delete content ID: ${contentId}`);
        res.status(404).json({ message: "Content not found or deletion failed" });
      }
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ 
        message: "Failed to delete content", 
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Enrollment routes
  app.get("/api/users/:userId/enrollments", isAuthenticated, async (req, res) => {
    try {
      // We can safely assert req.user exists because of the isAuthenticated middleware
      if (parseInt(req.params.userId) !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const enrollments = await storage.getEnrollmentsByUser(parseInt(req.params.userId));
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  app.post("/api/enrollments", isAuthenticated, validateBody(insertEnrollmentSchema), async (req, res) => {
    try {
      // We can safely assert req.user exists because of the isAuthenticated middleware
      if (req.body.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const enrollment = await storage.createEnrollment(req.body);
      res.status(201).json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create enrollment" });
    }
  });

  // Progress routes
  app.get("/api/users/:userId/progress", isAuthenticated, async (req, res) => {
    try {
      // We can safely assert req.user exists because of the isAuthenticated middleware
      if (parseInt(req.params.userId) !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const userProgress = await storage.getProgressByUser(parseInt(req.params.userId));
      res.json(userProgress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post("/api/progress", isAuthenticated, validateBody(insertProgressSchema), async (req, res) => {
    try {
      // We can safely assert req.user exists because of the isAuthenticated middleware
      if (req.body.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const progress = await storage.createOrUpdateProgress(req.body);
      res.status(201).json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });
  
  // Comment routes
  app.get("/api/contents/:contentId/comments", async (req, res) => {
    try {
      const contentId = parseInt(req.params.contentId);
      
      // First check if the content exists
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      const comments = await storage.getCommentsByContent(contentId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ 
        message: "Failed to fetch comments", 
        error: error.message
      });
    }
  });
  
  app.post("/api/comments", isAuthenticated, validateBody(insertCommentSchema), async (req, res) => {
    try {
      // Add the current user's ID to the comment data
      const commentData = {
        ...req.body,
        userId: req.user!.id
      };
      
      const comment = await storage.createComment(commentData);
      
      // Get user info to send with the comment
      const user = await storage.getUser(req.user!.id);
      const commentWithUser = {
        ...comment,
        userEmail: user?.email,
        username: user?.username
      };
      
      // Broadcast new comment to all connected clients
      if ((global as any).broadcastUpdate) {
        (global as any).broadcastUpdate('comment_created', { 
          comment: commentWithUser,
          contentId: comment.contentId
        });
      }
      
      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating comment:", error);
      res.status(500).json({ 
        message: "Failed to create comment", 
        error: error.message
      });
    }
  });
  
  app.delete("/api/comments/:id", isAuthenticated, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      
      // Get the comment to check ownership
      const comment = await storage.getComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      
      // Check if the user is the owner of the comment or an admin
      const isOwner = comment.userId === req.user!.id;
      const isAdmin = req.user!.isAdmin;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "You don't have permission to delete this comment" });
      }
      
      const result = await storage.deleteComment(commentId);
      if (!result) {
        return res.status(404).json({ message: "Comment not found" });
      }
      
      // Broadcast comment deletion to all connected clients
      if ((global as any).broadcastUpdate) {
        (global as any).broadcastUpdate('comment_deleted', { 
          commentId,
          contentId: comment.contentId
        });
      }
      
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ 
        message: "Failed to delete comment", 
        error: error.message
      });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      // If the user is admin, return all user details
      if (req.isAuthenticated() && req.user.isAdmin) {
        const users = await storage.getAllUsers();
        res.json(users);
      } 
      // If non-admin authenticated, return limited user info (id, email, username)
      else if (req.isAuthenticated()) {
        const users = await storage.getAllUsers();
        const limitedUsers = users.map(user => ({
          id: user.id,
          email: user.email,
          username: user.username
        }));
        res.json(limitedUsers);
      }
      // Not authenticated
      else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAdmin, async (req, res) => {
    try {
      const { email, username, isAdmin: userIsAdmin = false, courseEnrollments = [] } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Create a new user with default password (null since we're using email-only auth for non-admins)
      const newUser = await storage.createUser({
        email,
        username: username || email.split('@')[0],
        password: null,
        isAdmin: userIsAdmin
      });
      
      // Handle course enrollments if provided
      if (Array.isArray(courseEnrollments) && courseEnrollments.length > 0) {
        console.log(`Creating course enrollments for new user ${newUser.id}:`, courseEnrollments);
        
        for (const enrollmentRequest of courseEnrollments) {
          try {
            const courseId = Number(enrollmentRequest.courseId);
            const accessDuration = Number(enrollmentRequest.accessDuration) || 12; // Default to 12 months
            
            // Calculate expiration date based on access duration
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + accessDuration);
            
            console.log(`Creating enrollment for new user ${newUser.id} and course ${courseId} with duration ${accessDuration} months`);
            
            // Create new enrollment
            const newEnrollment = {
              userId: newUser.id,
              courseId,
              completed: false,
              progress: 0,
              accessDuration,
              expiresAt,
              paymentType: "full", // Default to full payment type
              paymentStatus: "completed", // Default to completed payment status
              installmentsPaid: 1,
              totalInstallments: 1
            };
            
            await storage.createEnrollment(newEnrollment);
          } catch (enrollmentError) {
            console.error("Error creating enrollment during user creation:", enrollmentError, "Request:", enrollmentRequest);
            // Continue with other enrollments even if one fails
          }
        }
      }
      
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Manage user course enrollments with access durations
  app.post("/api/users/:id/manage-enrollments", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { courseEnrollments } = req.body;
      
      console.log(`Managing enrollments for user ${userId}, requested enrollments:`, courseEnrollments);
      
      if (!Array.isArray(courseEnrollments)) {
        return res.status(400).json({ message: "courseEnrollments must be an array" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get current enrollments for the user
      const currentEnrollments = await storage.getEnrollmentsByUser(userId);
      
      // Extract course IDs from the requested enrollments
      const courseIds = courseEnrollments.map(e => Number(e.courseId));
      const currentCourseIds = currentEnrollments.map(e => Number(e.courseId));
      
      console.log(`User ${userId} current course IDs:`, currentCourseIds);
      console.log(`User ${userId} requested course IDs:`, courseIds);
      
      // Determine which courses to add/update and which to remove
      const coursesToRemove = currentEnrollments.filter(e => !courseIds.includes(Number(e.courseId)));
      
      console.log(`Enrollments to remove:`, coursesToRemove.map(e => e.id));
      
      // Remove enrollments that are no longer needed
      for (const enrollment of coursesToRemove) {
        try {
          console.log(`Removing enrollment ${enrollment.id} for user ${userId} and course ${enrollment.courseId}`);
          const result = await storage.deleteEnrollment(enrollment.id);
          console.log(`Deletion result:`, result);
        } catch (deleteError) {
          console.error(`Error deleting enrollment ${enrollment.id}:`, deleteError);
          // Continue with other deletions even if one fails
        }
      }
      
      // Process each enrollment request
      for (const enrollmentRequest of courseEnrollments) {
        try {
          if (!enrollmentRequest.courseId) {
            console.error("Skipping invalid enrollment request missing courseId:", enrollmentRequest);
            continue;
          }
          
          const courseId = Number(enrollmentRequest.courseId);
          
          // Validate courseId
          if (isNaN(courseId) || courseId <= 0) {
            console.error("Invalid courseId in enrollment request:", enrollmentRequest);
            continue;
          }
          
          // Ensure accessDuration is a valid number or use default
          let accessDuration = 12; // Default to 12 months
          if (enrollmentRequest.accessDuration !== undefined) {
            accessDuration = Number(enrollmentRequest.accessDuration);
            if (isNaN(accessDuration) || accessDuration <= 0) {
              console.warn(`Invalid accessDuration (${enrollmentRequest.accessDuration}), using default of 12 months`);
              accessDuration = 12;
            }
          }
          
          // Calculate expiration date based on access duration
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + accessDuration);
          
          console.log(`Processing enrollment for course ${courseId} with duration ${accessDuration} months, expires ${expiresAt}`);
          
          // Check if this course is already enrolled
          const existingEnrollment = currentEnrollments.find(e => Number(e.courseId) === courseId);
          
          if (existingEnrollment) {
            // Update existing enrollment with new duration
            console.log(`Updating existing enrollment ${existingEnrollment.id} with new duration`);
            const updateData = {
              accessDuration,
              expiresAt,
              // Ensure payment fields are present if they weren't before
              paymentType: existingEnrollment.paymentType || "full",
              paymentStatus: existingEnrollment.paymentStatus || "completed"
            };
            console.log("Updating enrollment with data:", updateData);
            await storage.updateEnrollment(existingEnrollment.id, updateData);
          } else {
            // Create new enrollment with duration
            console.log(`Creating new enrollment for user ${userId} and course ${courseId}`);
            const newEnrollment = {
              userId,
              courseId,
              completed: false,
              progress: 0,
              accessDuration,
              expiresAt,
              paymentType: "full", // Default to full payment type
              paymentStatus: "completed", // Default to completed payment status
              installmentsPaid: 1,
              totalInstallments: 1
            };
            
            console.log("Creating new enrollment:", newEnrollment);
            await storage.createEnrollment(newEnrollment);
          }
        } catch (enrollmentError) {
          console.error("Error processing enrollment:", enrollmentError, "Request:", enrollmentRequest);
          // Continue with other enrollments even if one fails
        }
      }
      
      // Get updated enrollments
      const updatedEnrollments = await storage.getEnrollmentsByUser(userId);
      console.log(`User ${userId} updated enrollments:`, updatedEnrollments.map(e => ({
        courseId: e.courseId,
        expiresAt: e.expiresAt,
        accessDuration: e.accessDuration
      })));
      
      res.json(updatedEnrollments);
    } catch (error) {
      console.error("Error managing user enrollments:", error);
      res.status(500).json({ 
        message: "Failed to manage user enrollments",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deleting the main admin account
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.email === "Darchiav@gmail.com") {
        return res.status(403).json({ message: "Cannot delete the main administrator account" });
      }
      
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or could not be deleted" });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Analytics for admin
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });
  
  // Adaptive streaming API to get streaming URL for a video content
  app.get("/api/content/:id/streaming", async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      if (content.type !== "video") {
        return res.status(400).json({ error: "Content is not a video" });
      }
      
      // Initialize streaming url
      let streamingData = { url: content.videoUrl, isAdaptive: false, format: 'direct' };

      // Check if video exists
      if (!content.videoUrl) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      // If this has video items, use the first one
      let videoFileKey = content.videoUrl;
      
      if (content.videoItems && content.videoItems.length > 0) {
        // Find the default item, or use the first one
        const defaultItem = content.videoItems.find(item => item.isDefault) || content.videoItems[0];
        videoFileKey = defaultItem.url;
        
        // If this has a file key, use that instead
        if (defaultItem.fileKey) {
          videoFileKey = defaultItem.fileKey;
        }
      }
      
      // Try to get the streaming manifest if adaptive streaming is available
      const { getStreamingUrl } = await import('./streaming');
      
      // Check if a specific streaming format is requested
      const preferHLS = req.query.hls === 'true' || req.query.format === 'hls';
      streamingData = await getStreamingUrl(videoFileKey, contentId, preferHLS);
      
      // Add the streaming information to the response object without modifying the original content
      const contentWithStreaming = {
        ...content,
        streamingUrl: streamingData.url,
        isAdaptiveStreaming: streamingData.isAdaptive,
        streamingFormat: streamingData.format
      };
      
      // Return the content with streaming information
      res.json(contentWithStreaming);
    } catch (error) {
      console.error("Error getting streaming content:", error);
      res.status(500).json({ error: "Failed to get streaming content" });
    }
  });
  
  // Public endpoints for content streaming
  
  // Get streaming status for a content
  app.get("/api/content/:id/streaming-status", async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      // Only check videos
      if (content.type !== "video") {
        return res.status(400).json({ error: "Content is not a video" });
      }
      
      // If this has video items, use the first one
      let videoFileKey = "";
      
      if (content.videoItems && content.videoItems.length > 0) {
        // Find the default item, or use the first one
        const defaultItem = content.videoItems.find(item => item.isDefault) || content.videoItems[0];
        videoFileKey = defaultItem.url;
        
        // If this has a file key, use that instead
        if (defaultItem.fileKey) {
          videoFileKey = defaultItem.fileKey;
        }
      } else if (content.videoUrl) {
        videoFileKey = content.videoUrl;
      } else {
        return res.status(404).json({ error: "No video found for this content" });
      }
      
      // Check if we have a streaming manifest
      const manifest = await storage.getStreamingManifest(contentId, videoFileKey);
      
      if (manifest) {
        return res.json({
          status: `${manifest.format.toUpperCase()} streaming manifest available (created ${new Date(manifest.created).toLocaleString()}, last accessed ${manifest.lastAccessed ? new Date(manifest.lastAccessed).toLocaleString() : 'never'})`,
          contentId,
          format: manifest.format,
          created: manifest.created,
          lastAccessed: manifest.lastAccessed
        });
      } else {
        return res.json({
          status: "No streaming manifest available for this content. Use the Generate button to create one.",
          contentId
        });
      }
    } catch (error) {
      console.error("Error checking streaming status:", error);
      res.status(500).json({ error: "Failed to check streaming status" });
    }
  });
  
  // Content editor endpoint to regenerate HLS streaming manifest
  app.post("/api/content/:id/regenerate-streaming-hls", isAuthenticated, async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      
      // Only admins can regenerate streaming manifests
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: "Only administrators can regenerate streaming manifests" });
      }
      
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      // Check if this is a video content type
      if (content.type !== "video") {
        return res.status(400).json({ error: "Content is not a video" });
      }
      
      // Check if video exists
      if (!content.videoUrl && (!content.videoItems || content.videoItems.length === 0)) {
        return res.status(404).json({ error: "No video found for this content" });
      }
      
      // If this has video items, use the first one
      let videoFileKey = content.videoUrl || "";
      
      if (content.videoItems && content.videoItems.length > 0) {
        // Find the default item, or use the first one
        const defaultItem = content.videoItems.find(item => item.isDefault) || content.videoItems[0];
        videoFileKey = defaultItem.url;
        
        // If this has a file key, use that instead
        if (defaultItem.fileKey) {
          videoFileKey = defaultItem.fileKey;
        }
      }
      
      if (!videoFileKey) {
        return res.status(404).json({ error: "No video file key found" });
      }
      
      // Delete any existing manifests for this content/video
      const { streamingManifests } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { db } = await import('./db');
      
      await db.delete(streamingManifests).where(
        and(
          eq(streamingManifests.contentId, contentId),
          eq(streamingManifests.videoFileKey, videoFileKey)
        )
      );
      
      // Trigger immediate generation of the streaming manifest with HLS format
      const { getStreamingUrl } = await import('./streaming');
      const streamingData = await getStreamingUrl(videoFileKey, contentId, true);
      
      res.json({
        contentId,
        videoFileKey,
        streamingUrl: streamingData.url,
        isAdaptiveStreaming: streamingData.isAdaptive,
        format: streamingData.format,
        message: `${streamingData.isAdaptive ? 'Adaptive' : 'Direct'} streaming ${streamingData.format} manifest ${streamingData.isAdaptive ? 'generated' : 'in progress'}`
      });
    } catch (error) {
      console.error("Error generating HLS streaming manifest:", error);
      res.status(500).json({ error: "Failed to generate HLS streaming manifest" });
    }
  });

  // Admin route to force regeneration of a streaming manifest
  app.post("/api/admin/content/:id/generateStreaming", isAdmin, async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      // Check if this is a video content type
      if (content.type !== "video") {
        return res.status(400).json({ error: "Content is not a video" });
      }
      
      // Check if video exists
      if (!content.videoUrl) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      // If this has video items, use the first one
      let videoFileKey = content.videoUrl;
      
      if (content.videoItems && content.videoItems.length > 0) {
        // Find the default item, or use the first one
        const defaultItem = content.videoItems.find(item => item.isDefault) || content.videoItems[0];
        videoFileKey = defaultItem.url;
        
        // If this has a file key, use that instead
        if (defaultItem.fileKey) {
          videoFileKey = defaultItem.fileKey;
        }
      }
      
      // Get the format preference
      const format = req.body.format || 'hls';
      const preferHLS = format === 'hls';
      
      // Delete any existing manifests for this content/video
      const { streamingManifests } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { db } = await import('./db');
      
      await db.delete(streamingManifests).where(
        and(
          eq(streamingManifests.contentId, contentId),
          eq(streamingManifests.videoFileKey, videoFileKey)
        )
      );
      
      // Trigger immediate generation of the streaming manifest
      const { getStreamingUrl } = await import('./streaming');
      const streamingData = await getStreamingUrl(videoFileKey, contentId, preferHLS);
      
      res.json({
        contentId,
        videoFileKey,
        streamingUrl: streamingData.url,
        isAdaptiveStreaming: streamingData.isAdaptive,
        format: streamingData.format,
        message: `${streamingData.isAdaptive ? 'Adaptive' : 'Direct'} streaming ${streamingData.format} manifest ${streamingData.isAdaptive ? 'generated' : 'in progress'}`
      });
    } catch (error) {
      console.error("Error generating streaming manifest:", error);
      res.status(500).json({ error: "Failed to generate streaming manifest" });
    }
  });
  
  // Admin migration endpoints for database updates
  app.post("/api/run-db-migration", isAdmin, async (req, res) => {
    try {
      // Perform data migration or DB updates
      console.log(`Running DB migration requested by admin: ${req.user?.username}`);
      
      // Check which migrations to run
      const migrationType = req.body;
      
      // Handle video items quality migration specifically
      if (migrationType.videoItems) {
        // Fetch all content
        const allContents = await storage.getAllContents();
        let updatedCount = 0;
        
        // Process each content that has videoItems
        for (const content of allContents) {
          if (content.videoItems && Array.isArray(content.videoItems)) {
            const updatedVideoItems = content.videoItems.map((item: any) => {
              // Ensure all items follow the updated schema
              const quality = extractQualityFromFilename(item.url);
              return {
                ...item,
                quality: item.quality || quality || 'Default',
                isDefault: item.isDefault || false,
              };
            });
            
            // Update content with enhanced video items
            await storage.updateContent(content.id, {
              ...content,
              videoItems: updatedVideoItems
            });
            updatedCount++;
          }
        }
        
        console.log(`Completed videoItems quality migration for ${updatedCount} contents`);
        return res.status(200).json({ 
          success: true, 
          message: `Migration completed successfully. Updated ${updatedCount} contents.` 
        });
      }
      
      res.status(200).json({ success: true, message: "No migrations performed" });
    } catch (error: any) {
      console.error("Error running migration:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // Helper function to extract quality information from filenames
  function extractQualityFromFilename(url: string): string | null {
    if (!url) return null;
    
    const filename = path.basename(url.split('?')[0]); // Remove any query params
    
    const qualityPatterns = [
      { regex: /[-_](4k|2160p)/i, quality: '4K' },
      { regex: /[-_](1080p)/i, quality: '1080p' },
      { regex: /[-_](720p)/i, quality: '720p' },
      { regex: /[-_](480p)/i, quality: '480p' },
      { regex: /[-_](360p)/i, quality: '360p' },
      { regex: /[-_](240p)/i, quality: '240p' },
      { regex: /[-_](144p)/i, quality: '144p' },
      { regex: /[-_](hd)/i, quality: 'HD' },
      { regex: /[-_](sd)/i, quality: 'SD' },
      { regex: /[-_](high)/i, quality: 'High' },
      { regex: /[-_](medium)/i, quality: 'Medium' },
      { regex: /[-_](low)/i, quality: 'Low' },
    ];
    
    for (const pattern of qualityPatterns) {
      if (pattern.regex.test(filename)) {
        return pattern.quality;
      }
    }
    
    return null;
  }

  // Payment integration with Stripe
  app.post("/api/create-payment-intent", isAuthenticated, async (req, res) => {
    try {
      const { courseId, paymentType = "full", paymentPlanId } = req.body;
      
      if (!courseId) {
        return res.status(400).json({ message: "Missing courseId" });
      }
      
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // For full payments, create a PaymentIntent with the course price
      if (paymentType === "full") {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: course.price, // In cents
          currency: "usd",
          // Enable Apple Pay and Google Pay through automatic payment methods
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            courseId: courseId.toString(),
            userId: req.user!.id.toString(),
            paymentType: "full"
          },
        });
        
        res.json({ 
          clientSecret: paymentIntent.client_secret,
          paymentType: "full"
        });
      } 
      // For installment payments, handle differently
      else if (paymentType === "installment" && paymentPlanId) {
        const paymentPlan = await storage.getPaymentPlan(Number(paymentPlanId));
        if (!paymentPlan) {
          return res.status(404).json({ message: "Payment plan not found" });
        }
        
        // Create a PaymentIntent for the first installment
        const paymentIntent = await stripe.paymentIntents.create({
          amount: paymentPlan.installmentAmount, // First installment amount
          currency: "usd",
          // Enable Apple Pay and Google Pay through automatic payment methods
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            courseId: courseId.toString(),
            userId: req.user!.id.toString(),
            paymentType: "installment",
            paymentPlanId: paymentPlanId.toString(),
            installmentNumber: "1",
            totalInstallments: paymentPlan.installments.toString()
          },
        });
        
        res.json({ 
          clientSecret: paymentIntent.client_secret,
          paymentType: "installment",
          installmentAmount: paymentPlan.installmentAmount,
          totalInstallments: paymentPlan.installments
        });
      } else {
        return res.status(400).json({ message: "Invalid payment type or missing payment plan ID" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });
  
  // Create subscription for installment plans
  app.post("/api/create-subscription", isAuthenticated, async (req, res) => {
    try {
      const { courseId, paymentPlanId, paymentMethodId } = req.body;
      
      if (!courseId || !paymentPlanId || !paymentMethodId) {
        return res.status(400).json({ 
          message: "Missing required parameters. Need courseId, paymentPlanId, and paymentMethodId" 
        });
      }
      
      const course = await storage.getCourse(Number(courseId));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      const paymentPlan = await storage.getPaymentPlan(Number(paymentPlanId));
      if (!paymentPlan) {
        return res.status(404).json({ message: "Payment plan not found" });
      }
      
      // Get or create customer
      let customer;
      const user = req.user!;
      
      // Search for existing customer for this user
      const existingEnrollments = await storage.getEnrollmentsByUser(user.id);
      const enrollmentWithStripeCustomer = existingEnrollments.find(
        e => e.stripeCustomerId !== null
      );
      
      if (enrollmentWithStripeCustomer && enrollmentWithStripeCustomer.stripeCustomerId) {
        // Use existing customer
        customer = { id: enrollmentWithStripeCustomer.stripeCustomerId };
      } else {
        // Create a new customer
        customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          payment_method: paymentMethodId,
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      }
      
      // Calculate how many months the subscription should run
      const installments = paymentPlan.installments;
      
      // Create a product for this course if it doesn't exist
      let product;
      try {
        product = await stripe.products.retrieve(`course_${courseId}`);
      } catch (error) {
        product = await stripe.products.create({
          id: `course_${courseId}`,
          name: course.title,
          description: `Payment plan for ${course.title}`,
          metadata: {
            courseId: courseId.toString()
          }
        });
      }
      
      // Create a price for the installment
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: paymentPlan.installmentAmount,
        currency: 'usd',
        recurring: {
          interval: 'month',
          interval_count: 1
        },
        metadata: {
          courseId: courseId.toString(),
          paymentPlanId: paymentPlanId.toString()
        }
      });
      
      // Create the subscription with a fixed billing cycle
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        metadata: {
          courseId: courseId.toString(),
          userId: user.id.toString(),
          paymentPlanId: paymentPlanId.toString()
        },
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        },

        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        cancel_at_period_end: false,
        // Automatically cancel after N months (total installments - 1, since first payment is immediate)
        cancel_at: Math.floor(Date.now() / 1000) + ((installments - 1) * 30 * 24 * 60 * 60)
      });
      
      // Calculate access duration based on installments
      const accessDuration = paymentPlan.installments;
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + accessDuration);
      
      // Create an enrollment with the installment info and duration
      const enrollment = await storage.createEnrollment({
        userId: user.id,
        courseId: Number(courseId),
        paymentType: "installment",
        paymentPlanId: Number(paymentPlanId),
        paymentStatus: "active",
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        accessDuration,
        expiresAt
      });
      
      // Return client secret for confirming the first payment
      // Safely access the payment intent client secret
      let clientSecret = null;
      if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
        const invoice = subscription.latest_invoice;
        // TypeScript thinks payment_intent could be string | PaymentIntent, but we've verified it's PaymentIntent
        const paymentIntent = invoice.payment_intent as any;
        if (paymentIntent && typeof paymentIntent !== 'string' && paymentIntent.client_secret) {
          clientSecret = paymentIntent.client_secret;
        }
      }
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret,
        enrollment
      });
    } catch (error: unknown) {
      console.error('Subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        message: "Failed to create subscription",
        error: errorMessage
      });
    }
  });

  // Handle successful payment
  app.post("/api/payment-success", isAuthenticated, async (req, res) => {
    try {
      const { paymentIntentId, courseId, paymentType, paymentPlanId, subscriptionId } = req.body;
      
      if (!paymentIntentId || !courseId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Verify the payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ message: "Payment not successful" });
      }
      
      // If this is a subscription payment, the enrollment is already created
      if (paymentType === "installment" && subscriptionId) {
        // Find the existing enrollment by subscriptionId
        const userEnrollments = await storage.getEnrollmentsByUser(req.user!.id);
        const enrollment = userEnrollments.find(e => e.stripeSubscriptionId === subscriptionId);
        
        if (enrollment) {
          return res.json(enrollment);
        }
        
        // If not found, create a new enrollment (should not normally happen)
        if (!paymentPlanId) {
          return res.status(400).json({ message: "Missing payment plan ID for installment payment" });
        }
        
        const paymentPlan = await storage.getPaymentPlan(Number(paymentPlanId));
        if (!paymentPlan) {
          return res.status(404).json({ message: "Payment plan not found" });
        }
        
        // Calculate an access duration based on the payment plan
        // Set duration to installments * 1 month (or 12 if not found)
        const accessDuration = paymentPlan.installments;
        
        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + accessDuration);
        
        const newEnrollment = await storage.createEnrollment({
          userId: req.user!.id,
          courseId: parseInt(courseId),
          progress: 0,
          completed: false,
          paymentType: "installment",
          paymentPlanId: Number(paymentPlanId),
          paymentStatus: "active",
          stripeSubscriptionId: subscriptionId,
          // We don't have customer ID here, but it's less important at this point
          stripeCustomerId: null,
          accessDuration,
          expiresAt
        });
        
        return res.json(newEnrollment);
      }
      
      // For one-time payments, create a new enrollment with standard 12-month access
      const accessDuration = 12; // Default to 12 months for one-time payments
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + accessDuration);
      
      const enrollment = await storage.createEnrollment({
        userId: req.user!.id,
        courseId: parseInt(courseId),
        progress: 0,
        completed: false,
        paymentType: "full",
        paymentPlanId: null,
        paymentStatus: "completed",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        accessDuration,
        expiresAt
      });
      
      res.json(enrollment);
    } catch (error: unknown) {
      console.error("Payment success error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        message: "Failed to process payment success",
        error: errorMessage
      });
    }
  });
  
  // Webhook for Stripe events (payment updates, subscription changes)
  app.post("/api/webhook", async (req, res) => {
    let event: any;
    
    try {
      // Verify and parse the webhook
      const signature = req.headers['stripe-signature'];
      
      // In a production environment, we would verify with a secret
      // but for our demo we'll accept the webhook without verification
      event = req.body;
      
      // Handle different event types
      switch (event.type) {
        case 'invoice.payment_succeeded':
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          
          if (subscriptionId) {
            // Find enrollment by subscription ID
            const enrollments = Array.from(storage.getEnrollments().values());
            const enrollment = enrollments.find(e => e.stripeSubscriptionId === subscriptionId);
            
            if (enrollment) {
              // Increment installments paid
              await storage.updateEnrollment(enrollment.id, {
                installmentsPaid: (enrollment.installmentsPaid || 0) + 1
              });
              
              // Check if all installments are paid
              if (enrollment.installmentsPaid === enrollment.totalInstallments) {
                await storage.updateEnrollment(enrollment.id, {
                  paymentStatus: "completed"
                });
              }
            }
          }
          break;
          
        case 'customer.subscription.deleted':
          const subscription = event.data.object;
          
          // Find enrollment by subscription ID
          const enrollments = Array.from(storage.getEnrollments().values());
          const enrollment = enrollments.find(e => e.stripeSubscriptionId === subscription.id);
          
          if (enrollment && enrollment.paymentStatus !== "completed") {
            // Mark as canceled if not completed
            await storage.updateEnrollment(enrollment.id, {
              paymentStatus: "canceled"
            });
          }
          break;
      }
      
      res.json({received: true});
    } catch (error: unknown) {
      console.error('Webhook error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).send(`Webhook Error: ${errorMessage}`);
    }
  });

  // VAPID keys for push notifications
  // In production, these would be stored in environment variables
  const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  const VAPID_PRIVATE_KEY = 'gvEMIrnUH1ZdCXmjtxA1MqDYJX42mQOUOOYNC9FXhXc';

  // Store push subscriptions (in production, these would be stored in the database)
  const pushSubscriptions = new Map<string, any>();

  // Push Notification Routes
  app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/register', isAuthenticated, async (req, res) => {
    try {
      const { subscription } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ message: 'Subscription data is required' });
      }
      
      // In a real app, save this to the database
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      pushSubscriptions.set(userId.toString(), subscription);
      
      console.log('Push subscription saved for user:', userId);
      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error('Error saving push subscription:', error);
      res.status(500).json({ message: "Failed to save push subscription", error: error.message });
    }
  });

  app.post('/api/push/unregister', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Remove from our storage
      pushSubscriptions.delete(userId.toString());
      
      console.log('Push subscription removed for user:', userId);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error removing push subscription:', error);
      res.status(500).json({ message: "Failed to remove push subscription", error: error.message });
    }
  });

  // Send a test notification to a specific user
  app.post('/api/push/send-notification', isAdmin, async (req, res) => {
    try {
      const { userId, title, body, url } = req.body;
      
      if (!userId || !title || !body) {
        return res.status(400).json({ message: 'User ID, title, and body are required' });
      }
      
      const subscription = pushSubscriptions.get(userId.toString());
      
      if (!subscription) {
        return res.status(404).json({ message: 'No subscription found for this user' });
      }
      
      // Send the notification
      // In a real app, you would use web-push library
      // For demo purposes, let's just log it
      console.log('Sending push notification to user:', userId);
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('URL:', url || '/');
      
      // Simulate sending a notification
      res.status(200).json({ 
        success: true, 
        message: 'Notification sent successfully',
        details: {
          recipient: userId,
          notification: { title, body, url }
        }
      });
    } catch (error: any) {
      console.error('Error sending push notification:', error);
      res.status(500).json({ message: "Failed to send push notification", error: error.message });
    }
  });

  // Broadcast a notification to all subscribed users
  app.post('/api/push/broadcast', isAdmin, async (req, res) => {
    try {
      const { title, body, url } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ message: 'Title and body are required' });
      }
      
      // Count of users to send to
      const userCount = pushSubscriptions.size;
      
      if (userCount === 0) {
        return res.status(404).json({ message: 'No subscriptions found' });
      }
      
      // In a real app, you would send to all subscriptions
      console.log(`Broadcasting push notification to ${userCount} users`);
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('URL:', url || '/');
      
      // Simulate broadcasting
      res.status(200).json({ 
        success: true, 
        message: `Broadcast sent to ${userCount} users`,
        details: {
          recipients: userCount,
          notification: { title, body, url }
        }
      });
    } catch (error: any) {
      console.error('Error broadcasting push notification:', error);
      res.status(500).json({ message: "Failed to broadcast push notification", error: error.message });
    }
  });

  // CHUNKED UPLOAD ROUTES FOR LARGE FILES
  // These endpoints support uploading large files (up to 10GB) in chunks
  // which is essential for stable uploads on mobile devices with unreliable connections

  // Step 1: Initialize a multipart chunked upload
  app.post('/api/uploads/chunked/init', isAuthenticated, async (req, res) => {
    try {
      if (!s3ChunkedEnabled) {
        return res.status(400).json({ 
          message: "Chunked uploads are not available. S3 chunked upload is not configured."
        });
      }

      const { fileName, contentType, fileSize } = req.body;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ 
          message: "Missing required fields",
          details: "fileName and contentType are required"
        });
      }

      // Validate file size
      const fileSizeNumber = parseInt(fileSize, 10);
      if (isNaN(fileSizeNumber)) {
        return res.status(400).json({ 
          message: "Invalid file size provided"
        });
      }

      const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB max
      if (fileSizeNumber > maxFileSize) {
        return res.status(400).json({ 
          message: `File too large. Maximum size is 10GB. Your file is ${(fileSizeNumber / (1024 * 1024 * 1024)).toFixed(2)}GB`
        });
      }

      // Create a unique file key for S3
      const timestamp = Date.now();
      const fileExtension = path.extname(fileName);
      const cleanFileName = path.basename(fileName, fileExtension).replace(/[^a-zA-Z0-9_-]/g, '');
      const fileKey = `content-files/videos/${timestamp}-${cleanFileName}${fileExtension}`;
      
      console.log(`Initializing chunked upload for ${fileName} (${contentType}) with key ${fileKey}`);
      
      // Initiate the multipart upload in S3
      const { uploadId, fileUrl } = await initiateMultipartUpload(fileKey, contentType);
      
      // Calculate appropriate number of chunks based on file size
      // Each chunk should be between 5MB (min for S3) and 100MB
      const minChunkSize = 5 * 1024 * 1024; // 5MB minimum (S3 requirement)
      const targetChunkSize = 50 * 1024 * 1024; // 50MB target chunk size
      
      let chunkSize = targetChunkSize;
      let partCount = Math.ceil(fileSizeNumber / chunkSize);
      
      // Adjust if we're creating too many parts (S3 has 10,000 part limit)
      if (partCount > 10000) {
        chunkSize = Math.ceil(fileSizeNumber / 10000);
        partCount = Math.ceil(fileSizeNumber / chunkSize);
      }
      
      // Ensure chunk size is at least 5MB (S3 requirement except final chunk)
      if (chunkSize < minChunkSize) {
        chunkSize = minChunkSize;
        partCount = Math.ceil(fileSizeNumber / chunkSize);
      }
      
      console.log(`File will be uploaded in ${partCount} chunks of ~${(chunkSize / (1024 * 1024)).toFixed(2)}MB each`);
      
      // Store upload details in session for verification in subsequent requests
      if (!req.session.uploads) {
        req.session.uploads = {};
      }
      
      req.session.uploads[uploadId] = {
        fileKey,
        fileName,
        contentType,
        fileSize: fileSizeNumber,
        chunkSize,
        partCount,
        initiated: Date.now(),
        userId: req.user?.id || 0,
        parts: []
      };
      
      res.json({
        uploadId,
        fileKey,
        fileUrl,
        partCount,
        chunkSize
      });
    } catch (error: any) {
      console.error("Error initializing chunked upload:", error);
      res.status(500).json({ 
        message: "Failed to initialize chunked upload", 
        error: error.message 
      });
    }
  });

  // Step 2: Get presigned URLs for each chunk
  app.get('/api/uploads/chunked/presigned-urls', isAuthenticated, async (req, res) => {
    try {
      if (!s3ChunkedEnabled) {
        return res.status(400).json({ 
          message: "Chunked uploads are not available. S3 chunked upload is not configured."
        });
      }
      
      const { uploadId, partNumbers } = req.query;
      
      if (!uploadId) {
        return res.status(400).json({ 
          message: "Missing uploadId parameter"
        });
      }
      
      // Get upload details from session
      if (!req.session.uploads || !req.session.uploads[uploadId as string]) {
        return res.status(404).json({ 
          message: "Upload session not found. Please initialize the upload again."
        });
      }
      
      const uploadDetails = req.session.uploads[uploadId as string];
      
      // For security, verify this user initiated the upload
      if (!req.user || uploadDetails.userId !== req.user.id) {
        return res.status(403).json({ 
          message: "You don't have permission to access this upload"
        });
      }
      
      // Parse part numbers (if specified) or generate for all parts
      let parts: number[] = [];
      
      if (partNumbers) {
        // Handle comma-separated list of part numbers
        parts = (partNumbers as string).split(',').map(Number).filter(n => !isNaN(n));
        
        // Validate part numbers are within range
        const invalidParts = parts.filter(p => p < 1 || p > uploadDetails.partCount);
        if (invalidParts.length > 0) {
          return res.status(400).json({ 
            message: `Invalid part numbers: ${invalidParts.join(', ')}. Valid range is 1-${uploadDetails.partCount}`
          });
        }
      } else {
        // Generate all part numbers if none specified
        parts = Array.from({ length: uploadDetails.partCount }, (_, i) => i + 1);
      }
      
      console.log(`Generating presigned URLs for upload ${uploadId}, parts: ${parts.join(', ')}`);
      
      // Generate presigned URLs for the requested parts
      const presignedUrls = await getPresignedChunkUploadUrls(
        uploadDetails.fileKey,
        uploadId as string,
        parts.length > 0 ? Math.max(...parts) : uploadDetails.partCount
      );
      
      // Filter to only the requested parts if needed
      const filteredUrls = parts.length > 0 
        ? presignedUrls.filter(url => parts.includes(url.partNumber))
        : presignedUrls;
      
      res.json({
        presignedUrls: filteredUrls,
        uploadDetails: {
          fileKey: uploadDetails.fileKey,
          partCount: uploadDetails.partCount,
          chunkSize: uploadDetails.chunkSize
        }
      });
    } catch (error: any) {
      console.error("Error generating presigned URLs for chunks:", error);
      res.status(500).json({ 
        message: "Failed to generate presigned URLs", 
        error: error.message 
      });
    }
  });

  // Step 3: Complete the multipart upload
  app.post('/api/uploads/chunked/complete', isAuthenticated, async (req, res) => {
    try {
      if (!s3ChunkedEnabled) {
        return res.status(400).json({ 
          message: "Chunked uploads are not available. S3 chunked upload is not configured."
        });
      }
      
      const { uploadId, parts } = req.body;
      
      if (!uploadId || !Array.isArray(parts)) {
        return res.status(400).json({ 
          message: "Missing required fields",
          details: "uploadId and parts array are required"
        });
      }
      
      // Ensure session exists
      if (!req.session) {
        console.error("Session not available - session middleware may be misconfigured");
        return res.status(500).json({
          message: "Server configuration error: session not available"
        });
      }
      
      // Initialize uploads object if it doesn't exist
      if (!req.session.uploads) {
        req.session.uploads = {};
      }
      
      // Get upload details from session
      if (!req.session.uploads[uploadId]) {
        // If upload details are missing but we have valid parts, try to proceed anyway
        // This helps with scenarios where session data might have been lost but the upload exists
        if (parts.length > 0 && parts[0].PartNumber && parts[0].ETag) {
          console.warn(`Upload ${uploadId} session data not found, but attempting to complete with ${parts.length} parts`);
          
          // Create a temporary upload details object
          req.session.uploads[uploadId] = {
            fileKey: `recovered-upload-${uploadId}`, // Use upload ID as part of key
            fileName: "recovered-file", // Generic name
            contentType: "application/octet-stream", // Generic content type
            fileSize: 0, // Unknown size
            chunkSize: 0, // Unknown chunk size
            partCount: parts.length, // Use received parts count
            initiated: Date.now(),
            userId: req.user?.id || 0, // Fallback to 0 if user is somehow not defined
            parts: []
          };
        } else {
          return res.status(404).json({ 
            message: "Upload session not found. Please initialize the upload again."
          });
        }
      }
      
      const uploadDetails = req.session.uploads[uploadId];
      
      // For security, verify this user initiated the upload
      if (!req.user || uploadDetails.userId !== req.user.id) {
        return res.status(403).json({ 
          message: "You don't have permission to access this upload"
        });
      }
      
      // Validate parts array format
      const invalidParts = parts.filter(p => !p.PartNumber || !p.ETag);
      if (invalidParts.length > 0) {
        return res.status(400).json({ 
          message: "Invalid parts format",
          details: "Each part must have PartNumber and ETag properties"
        });
      }
      
      // Validate we have a reasonable number of parts
      // Instead of strict equality, ensure we have at least one part
      // and not dramatically more than expected (which could indicate an error)
      if (parts.length === 0) {
        return res.status(400).json({ 
          message: `No parts received for upload completion`
        });
      }
      
      // Allow for some flexibility in part count
      // This handles the case where some empty chunks might be skipped or merged
      const maxAllowedParts = uploadDetails.partCount * 1.1; // 10% tolerance
      if (parts.length > maxAllowedParts) {
        console.warn(`Unexpected part count: received ${parts.length}, expected around ${uploadDetails.partCount}`);
        return res.status(400).json({ 
          message: `Too many parts received: ${parts.length} exceeds expected maximum of ${Math.ceil(maxAllowedParts)}`
        });
      }
      
      console.log(`Completing chunked upload for ${uploadDetails.fileKey} with ${parts.length} parts (expected ~${uploadDetails.partCount})`);
      
      // Complete the multipart upload
      const fileUrl = await completeMultipartUpload(
        uploadDetails.fileKey,
        uploadId,
        parts
      );
      
      console.log(`Chunked upload completed. File URL: ${fileUrl}`);
      
      // Clean up the session
      delete req.session.uploads[uploadId];
      
      // Generate a presigned URL for immediate access if needed
      const signedUrl = await storageStrategy.getFileUrl(uploadDetails.fileKey);
      
      res.json({
        fileUrl,
        signedUrl,
        fileKey: uploadDetails.fileKey,
        fileType: uploadDetails.contentType.startsWith('video/') ? 'video' : 'file',
        fileName: uploadDetails.fileName,
        size: uploadDetails.fileSize,
        s3Stored: true,
        message: "File successfully uploaded"
      });
    } catch (error: any) {
      console.error("Error completing chunked upload:", error);
      res.status(500).json({ 
        message: "Failed to complete chunked upload", 
        error: error.message 
      });
    }
  });
  
  // Step 4: Abort a multipart upload if needed
  app.post('/api/uploads/chunked/abort', isAuthenticated, async (req, res) => {
    try {
      if (!s3ChunkedEnabled) {
        return res.status(400).json({ 
          message: "Chunked uploads are not available. S3 chunked upload is not configured."
        });
      }
      
      const { uploadId } = req.body;
      
      if (!uploadId) {
        return res.status(400).json({ 
          message: "Missing uploadId parameter"
        });
      }
      
      // Get upload details from session
      if (!req.session.uploads || !req.session.uploads[uploadId]) {
        return res.status(404).json({ 
          message: "Upload session not found or already completed"
        });
      }
      
      const uploadDetails = req.session.uploads[uploadId];
      
      // For security, verify this user initiated the upload
      if (!req.user || uploadDetails.userId !== req.user.id) {
        return res.status(403).json({ 
          message: "You don't have permission to access this upload"
        });
      }
      
      console.log(`Aborting chunked upload for ${uploadDetails.fileKey}`);
      
      // Abort the multipart upload
      await abortMultipartUpload(
        uploadDetails.fileKey,
        uploadId
      );
      
      // Clean up the session
      delete req.session.uploads[uploadId];
      
      res.json({
        message: "Upload aborted successfully"
      });
    } catch (error: any) {
      console.error("Error aborting chunked upload:", error);
      res.status(500).json({ 
        message: "Failed to abort chunked upload", 
        error: error.message 
      });
    }
  });

  // Create the HTTP server first (moved here to fix TypeScript error)
  const httpServer = createServer(app);
  
  // Temporarily disable WebSocket server to fix app access issues
  // We'll re-enable this once the database and authentication issues are resolved
  
  // Re-register webinar routes without WebSocket server for now
  registerWebinarRoutes(app, httpServer);
  
  // Add a stub function to prevent errors
  (global as any).broadcastUpdate = (type: string, data: any) => {
    // Temporarily disabled - will be re-enabled once WebSocket issues are fixed
    console.log(`Broadcast disabled: ${type}`, data);
  };
  
  return httpServer;
}
