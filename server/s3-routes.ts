import { Express, Request, Response } from "express";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import fs from "fs";
import path from "path";
import { log } from "./vite";
import { v4 as uuidv4 } from "uuid";
import storageStrategy from "./s3";

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Bucket name from environment variable
const bucketName = process.env.AWS_S3_BUCKET!;

// Temporary upload directory for files
const tempDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'temp-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for S3 uploads
});

// Helper to group files into folders
interface Folder {
  name: string;
  path: string;
  count: number;
}

interface S3File {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
  contentType: string;
}

function extractFoldersFromKeys(keys: string[]): Folder[] {
  const folderMap = new Map<string, { name: string, count: number }>();
  
  keys.forEach(key => {
    // Skip if the key doesn't contain a slash (not in a folder)
    if (!key.includes('/')) return;
    
    // Get folder path (everything before the last slash)
    const parts = key.split('/');
    parts.pop(); // Remove the filename
    
    if (parts.length > 0) {
      const folderPath = parts.join('/');
      const folderName = parts[parts.length - 1];
      
      // Update folder count
      if (folderMap.has(folderPath)) {
        folderMap.get(folderPath)!.count++;
      } else {
        folderMap.set(folderPath, { name: folderName, count: 1 });
      }
      
      // Also count parent folders
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join('/');
        const parentName = parts[i - 1];
        
        if (!folderMap.has(parentPath)) {
          folderMap.set(parentPath, { name: parentName, count: 0 });
        }
      }
    }
  });
  
  // Convert map to array
  return Array.from(folderMap.entries()).map(([path, info]) => ({
    path,
    name: info.name,
    count: info.count
  }));
}

// Middleware to check if S3 is configured
function checkS3Configured(req: Request, res: Response, next: Function) {
  if (!storageStrategy.isS3Enabled) {
    return res.status(503).json({
      message: "S3 integration is not configured. Please set up the required environment variables."
    });
  }
  next();
}

// Helper to determine mime type from extension
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
  };
  
  return mimeMap[ext] || 'application/octet-stream';
}

export function registerS3Routes(app: Express) {
  // Helper middleware for admin access
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    if (!(req.user as any).isAdmin) {
      return res.sendStatus(403);
    }
    
    next();
  };

  // Check S3 status
  app.get('/api/cloud-storage/status', isAdmin, async (req, res) => {
    try {
      res.json({
        enabled: storageStrategy.isS3Enabled,
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION
      });
    } catch (error: any) {
      log(`Error checking S3 status: ${error.message}`, "s3");
      res.status(500).json({ message: "Error checking S3 status", error: error.message });
    }
  });
  
  // Get bucket statistics
  app.get('/api/cloud-storage/stats', isAdmin, checkS3Configured, async (req, res) => {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
      });
      
      let continuationToken: string | undefined;
      let totalSize = 0;
      let totalFiles = 0;
      const allKeys: string[] = [];
      
      // Paginate through all objects
      do {
        if (continuationToken) {
          command.input.ContinuationToken = continuationToken;
        }
        
        const response = await s3Client.send(command);
        
        // Process objects
        if (response.Contents) {
          totalFiles += response.Contents.length;
          
          for (const object of response.Contents) {
            if (object.Key) {
              allKeys.push(object.Key);
            }
            if (object.Size) {
              totalSize += object.Size;
            }
          }
        }
        
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
      
      // Extract folders
      const folders = extractFoldersFromKeys(allKeys);
      
      res.json({
        totalFiles,
        totalSize,
        folders
      });
    } catch (error: any) {
      log(`Error getting S3 stats: ${error.message}`, "s3");
      res.status(500).json({ message: "Error retrieving bucket statistics", error: error.message });
    }
  });
  
  // List files
  app.get('/api/cloud-storage/files', isAdmin, checkS3Configured, async (req, res) => {
    try {
      const folderPrefix = req.query.folder ? `${req.query.folder}/` : '';
      
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folderPrefix,
        // Don't include objects that start with the folder prefix but are in deeper folders
        Delimiter: '/'
      });
      
      const response = await s3Client.send(command);
      
      const files: S3File[] = [];
      
      // Process objects
      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key || object.Key === folderPrefix) continue;
          
          try {
            // Get content type
            const headCommand = new HeadObjectCommand({
              Bucket: bucketName,
              Key: object.Key
            });
            
            const headResponse = await s3Client.send(headCommand);
            
            // Generate a presigned URL
            const getUrlCommand = new HeadObjectCommand({
              Bucket: bucketName,
              Key: object.Key
            });
            
            const url = await getSignedUrl(s3Client, getUrlCommand, { expiresIn: 3600 });
            
            files.push({
              key: object.Key,
              size: object.Size || 0,
              lastModified: object.LastModified || new Date(),
              url,
              contentType: headResponse.ContentType || getMimeType(object.Key)
            });
          } catch (headError) {
            // If we can't get the file metadata, still include basic info
            files.push({
              key: object.Key,
              size: object.Size || 0,
              lastModified: object.LastModified || new Date(),
              url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(object.Key)}`,
              contentType: getMimeType(object.Key)
            });
          }
        }
      }
      
      // Include common prefixes (folders)
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            // We'll mark folders with a special content type
            files.push({
              key: prefix.Prefix,
              size: 0,
              lastModified: new Date(),
              url: '#',
              contentType: 'folder'
            });
          }
        }
      }
      
      res.json(files);
    } catch (error: any) {
      log(`Error listing S3 files: ${error.message}`, "s3");
      res.status(500).json({ message: "Error listing files", error: error.message });
    }
  });
  
  // Upload file
  app.post('/api/cloud-storage/upload', isAdmin, checkS3Configured, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    try {
      const { file } = req;
      const folder = req.body.folder ? `${req.body.folder}/` : '';
      
      // Generate a unique key with the original filename for better organization
      const originalName = path.basename(file.originalname);
      const randomId = uuidv4().substring(0, 8);
      const fileKey = `${folder}${randomId}-${originalName}`;
      
      // Determine content type
      const contentType = file.mimetype || getMimeType(file.originalname);
      
      // Upload file to S3
      const fileStream = fs.createReadStream(file.path);
      
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: fileKey,
          Body: fileStream,
          ContentType: contentType,
        },
      });
      
      const result = await upload.done();
      
      // Clean up temporary file
      fs.unlinkSync(file.path);
      
      // Generate a presigned URL
      const getUrlCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: fileKey
      });
      
      const url = await getSignedUrl(s3Client, getUrlCommand, { expiresIn: 3600 });
      
      res.json({
        message: "File uploaded successfully",
        key: fileKey,
        url,
        contentType
      });
    } catch (error: any) {
      // Clean up temporary file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      log(`Error uploading to S3: ${error.message}`, "s3");
      res.status(500).json({ message: "Error uploading file", error: error.message });
    }
  });
  
  // Delete file
  app.delete('/api/cloud-storage/files/:key(*)', isAdmin, checkS3Configured, async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key);
      
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      
      await s3Client.send(command);
      
      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      log(`Error deleting S3 file: ${error.message}`, "s3");
      res.status(500).json({ message: "Error deleting file", error: error.message });
    }
  });
}