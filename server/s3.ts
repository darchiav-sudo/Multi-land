import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream } from "fs";
import path from "path";
import { log } from "./vite";

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Bucket name from environment variable
const bucketName = process.env.AWS_S3_BUCKET!;

// Check if all required AWS environment variables are set
const isS3Configured = () => {
  const requiredVars = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_S3_BUCKET"
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`S3 integration is missing required environment variables: ${missingVars.join(", ")}`, "s3");
    return false;
  }
  
  return true;
};

// Check if CloudFront CDN is configured
const isCdnConfigured = !!process.env.CLOUDFRONT_DOMAIN;

// Initialize and log S3 status
const s3Enabled = isS3Configured();
const cdnEnabled = isCdnConfigured;

if (s3Enabled) {
  log(`S3 integration enabled with bucket: ${bucketName} in region: ${process.env.AWS_REGION}`, "s3");
  
  if (cdnEnabled) {
    log(`CDN integration enabled with CloudFront domain: ${process.env.CLOUDFRONT_DOMAIN}`, "cdn");
  } else {
    log(`CDN integration not configured. Using direct S3 URLs.`, "cdn");
  }
} else {
  log("S3 integration disabled due to missing configuration. Using local storage.", "s3");
}

/**
 * Upload a file to S3 using multipart upload for larger files
 */
export const uploadToS3 = async (
  filePath: string,
  fileKey: string,
  contentType?: string
): Promise<string> => {
  if (!s3Enabled) {
    throw new Error("S3 is not properly configured");
  }

  try {
    log(`Starting S3 upload for ${fileKey}`, "s3");
    
    const fileStream = createReadStream(filePath);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: fileKey,
        Body: fileStream,
        ContentType: contentType || undefined,
      },
    });

    // Add event listener for upload progress
    upload.on("httpUploadProgress", (progress) => {
      const loaded = progress.loaded || 0;
      const total = progress.total || 1;
      const percentage = Math.round((loaded / total) * 100);
      log(`S3 upload progress for ${fileKey}: ${percentage}%`, "s3");
    });

    // Wait for upload to complete
    await upload.done();
    
    log(`S3 upload completed for ${fileKey}`, "s3");
    
    // Generate a URL for the uploaded file (using CDN if configured)
    let fileUrl;
    if (cdnEnabled) {
      // Use CloudFront CDN URL
      fileUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${encodeURIComponent(fileKey)}`;
      log(`Generated CDN URL for ${fileKey}`, "cdn");
    } else {
      // Use direct S3 URL
      fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileKey)}`;
    }
    return fileUrl;
  } catch (error) {
    log(`S3 upload failed for ${fileKey}: ${error}`, "s3");
    throw new Error(`Failed to upload file to S3: ${error}`);
  }
};

/**
 * Generate a presigned URL for downloading a file from S3
 * The URL will expire after the specified time
 */
export const getSignedDownloadUrl = async (
  fileKey: string,
  expiresIn = 3600 // Default expiration of 1 hour
): Promise<string> => {
  if (!s3Enabled) {
    throw new Error("S3 is not properly configured");
  }
  
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    log(`Failed to generate presigned URL for ${fileKey}: ${error}`, "s3");
    throw new Error(`Failed to generate download URL: ${error}`);
  }
};

/**
 * Delete a file from S3
 */
export const deleteFromS3 = async (fileKey: string): Promise<void> => {
  if (!s3Enabled) {
    throw new Error("S3 is not properly configured");
  }
  
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    await s3Client.send(command);
    log(`Deleted file ${fileKey} from S3`, "s3");
  } catch (error) {
    log(`Failed to delete file ${fileKey} from S3: ${error}`, "s3");
    throw new Error(`Failed to delete file from S3: ${error}`);
  }
};

/**
 * Helper to get appropriate storage strategy (S3 or local)
 * This makes it easier to implement a fallback mechanism
 */
export const storageStrategy = {
  isS3Enabled: s3Enabled,
  
  // Upload file to either S3 or return local path
  async uploadFile(filePath: string, fileKey: string, contentType?: string): Promise<string> {
    if (s3Enabled) {
      return await uploadToS3(filePath, fileKey, contentType);
    } else {
      // For local storage, just return the local path
      return `/uploads/${fileKey}`;
    }
  },
  
  // Get access URL for a file
  async getFileUrl(fileKey: string): Promise<string> {
    if (s3Enabled) {
      if (cdnEnabled && fileKey.startsWith('content-files/')) {
        // For videos and other large media through CloudFront CDN
        // CloudFront must be properly configured with correct origin access identity or origin access control
        // and proper cache behaviors to ensure optimal delivery
        const cdnUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${encodeURIComponent(fileKey)}`;
        log(`Serving ${fileKey} through CDN`, "cdn");
        return cdnUrl;
      } else {
        // For S3 files that don't need CDN or when CDN is not configured, generate a presigned URL
        return await getSignedDownloadUrl(fileKey);
      }
    } else {
      // For local storage, just return the local path
      return `/uploads/${fileKey}`;
    }
  },
  
  // Delete a file
  async deleteFile(fileKey: string): Promise<void> {
    if (s3Enabled) {
      await deleteFromS3(fileKey);
    } else {
      // Delete from local storage would be handled elsewhere
      log(`Would delete local file: ${fileKey}`, "storage");
    }
  }
};

export default storageStrategy;
export { s3Enabled, cdnEnabled };