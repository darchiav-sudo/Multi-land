import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

// Initialize and log S3 status
const s3Enabled = isS3Configured();
if (s3Enabled) {
  log(`S3 direct upload integration enabled with bucket: ${bucketName} in region: ${process.env.AWS_REGION}`, "s3");
} else {
  log("S3 direct upload integration disabled due to missing configuration.", "s3");
}

/**
 * Generate a presigned URL for uploading a file directly to S3
 * This method generates a PUT URL that the client can use to upload directly to S3
 * without going through our server, making uploads faster and reducing server load
 */
export const getPresignedUploadUrl = async (
  fileKey: string,
  contentType: string,
  expiresIn = 3600 // Default expiration of 1 hour
): Promise<{presignedUrl: string, fileUrl: string, uploadMethod: string}> => {
  if (!s3Enabled) {
    throw new Error("S3 is not properly configured");
  }
  
  try {
    log(`Generating presigned PUT URL for ${fileKey} with content type ${contentType}`, "s3");
    
    // Make sure we have the proper content type specified
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: contentType,
    });
    
    // Generate the presigned URL for PUT operation
    const presignedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn,
    });
    
    // Generate the URL that will be used to access the file once uploaded
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileKey)}`;
    
    log(`Successfully generated presigned URL for direct upload`, "s3");
    log(`Content type: ${contentType}`, "s3");
    log(`Upload method: PUT`, "s3");
    
    return {
      presignedUrl,
      fileUrl,
      uploadMethod: 'PUT'
    };
  } catch (error) {
    log(`Failed to generate presigned upload URL for ${fileKey}: ${error}`, "s3");
    throw new Error(`Failed to generate upload URL: ${error}`);
  }
};

export { s3Enabled };
export default { getPresignedUploadUrl, s3Enabled };