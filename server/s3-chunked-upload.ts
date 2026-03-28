import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// Check if all required AWS environment variables are set (reusing from s3-direct-upload.ts)
const isS3Configured = () => {
  const requiredVars = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "AWS_S3_BUCKET"
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`S3 chunked upload integration is missing required environment variables: ${missingVars.join(", ")}`, "s3-chunked");
    return false;
  }
  
  return true;
};

// Initialize and log S3 status
const s3ChunkedEnabled = isS3Configured();
if (s3ChunkedEnabled) {
  log(`S3 chunked upload integration enabled with bucket: ${bucketName} in region: ${process.env.AWS_REGION}`, "s3-chunked");
} else {
  log("S3 chunked upload integration disabled due to missing configuration.", "s3-chunked");
}

/**
 * Initiates a multipart upload for chunked file uploads
 * Returns the uploadId needed for subsequent part uploads
 */
export const initiateMultipartUpload = async (
  fileKey: string,
  contentType: string
): Promise<{ uploadId: string, fileUrl: string }> => {
  if (!s3ChunkedEnabled) {
    throw new Error("S3 is not properly configured for chunked uploads");
  }
  
  try {
    log(`Initiating multipart upload for ${fileKey} with content type ${contentType}`, "s3-chunked");
    
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: contentType,
    });
    
    const response = await s3Client.send(command);
    const uploadId = response.UploadId;
    
    if (!uploadId) {
      throw new Error("Failed to get uploadId from S3");
    }
    
    // Generate the URL that will be used to access the file once uploaded
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileKey)}`;
    
    log(`Successfully initiated multipart upload with ID: ${uploadId}`, "s3-chunked");
    
    return { uploadId, fileUrl };
  } catch (error) {
    log(`Failed to initiate multipart upload for ${fileKey}: ${error}`, "s3-chunked");
    throw new Error(`Failed to initiate multipart upload: ${error}`);
  }
};

/**
 * Generates presigned URLs for each chunk that needs to be uploaded
 * Each chunk requires its own presigned URL with a specific partNumber
 */
export const getPresignedChunkUploadUrls = async (
  fileKey: string,
  uploadId: string,
  partCount: number,
  expiresIn = 3600 // Default expiration of 1 hour
): Promise<{ partNumber: number, presignedUrl: string }[]> => {
  if (!s3ChunkedEnabled) {
    throw new Error("S3 is not properly configured for chunked uploads");
  }
  
  try {
    log(`Generating ${partCount} presigned URLs for chunks of ${fileKey}`, "s3-chunked");
    
    const presignedUrls = [];
    
    // Generate presigned URL for each part
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: fileKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      presignedUrls.push({
        partNumber,
        presignedUrl,
      });
    }
    
    log(`Successfully generated ${partCount} presigned URLs for chunked upload`, "s3-chunked");
    
    return presignedUrls;
  } catch (error) {
    log(`Failed to generate presigned URLs for chunks: ${error}`, "s3-chunked");
    throw new Error(`Failed to generate presigned URLs for chunks: ${error}`);
  }
};

/**
 * Completes a multipart upload after all parts have been uploaded
 * Must provide the ETags returned by S3 when each part was uploaded
 */
export const completeMultipartUpload = async (
  fileKey: string,
  uploadId: string,
  parts: { PartNumber: number, ETag: string }[]
): Promise<string> => {
  if (!s3ChunkedEnabled) {
    throw new Error("S3 is not properly configured for chunked uploads");
  }
  
  try {
    log(`Completing multipart upload for ${fileKey} with ${parts.length} parts`, "s3-chunked");
    
    // Sort parts by part number to ensure correct order
    parts.sort((a, b) => a.PartNumber - b.PartNumber);
    
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });
    
    const response = await s3Client.send(command);
    
    // Generate the final file URL
    const fileUrl = response.Location || `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileKey)}`;
    
    log(`Successfully completed multipart upload for ${fileKey}`, "s3-chunked");
    
    return fileUrl;
  } catch (error) {
    log(`Failed to complete multipart upload for ${fileKey}: ${error}`, "s3-chunked");
    throw new Error(`Failed to complete multipart upload: ${error}`);
  }
};

/**
 * Aborts a multipart upload if something goes wrong
 * This is important to avoid incomplete uploads lingering in S3 and incurring charges
 */
export const abortMultipartUpload = async (
  fileKey: string,
  uploadId: string
): Promise<void> => {
  if (!s3ChunkedEnabled) {
    throw new Error("S3 is not properly configured for chunked uploads");
  }
  
  try {
    log(`Aborting multipart upload for ${fileKey}`, "s3-chunked");
    
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileKey,
      UploadId: uploadId,
    });
    
    await s3Client.send(command);
    
    log(`Successfully aborted multipart upload for ${fileKey}`, "s3-chunked");
  } catch (error) {
    log(`Failed to abort multipart upload for ${fileKey}: ${error}`, "s3-chunked");
    throw new Error(`Failed to abort multipart upload: ${error}`);
  }
};

export { s3ChunkedEnabled };
export default { 
  initiateMultipartUpload,
  getPresignedChunkUploadUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  s3ChunkedEnabled
};