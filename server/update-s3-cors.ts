import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
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
if (!s3Enabled) {
  log("S3 integration disabled due to missing configuration. Cannot update CORS.", "s3");
  process.exit(1);
}

const corsConfig = {
  CORSRules: [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "POST", "GET", "DELETE", "HEAD"],
      AllowedOrigins: ["https://my-frontend-domain.com"],
      ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
      MaxAgeSeconds: 3600
    },
    // For direct uploads from the browser, we need to include the Replit domain
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "POST", "GET", "DELETE", "HEAD"],
      AllowedOrigins: [
        "https://*.replit.app", 
        "https://*.repl.co",
        "https://*.replit.dev"
      ],
      ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
      MaxAgeSeconds: 3600
    },
    // Development fallback
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "POST", "GET", "DELETE", "HEAD"],
      AllowedOrigins: ["*"],
      ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
      MaxAgeSeconds: 3600
    }
  ]
};

// Function to get current CORS configuration
async function getCorsConfiguration() {
  try {
    const command = new GetBucketCorsCommand({
      Bucket: bucketName
    });
    
    const response = await s3Client.send(command);
    log(`Current CORS configuration: ${JSON.stringify(response.CORSRules)}`, "s3");
    return response.CORSRules;
  } catch (error) {
    log(`Error retrieving CORS configuration: ${error}`, "s3");
    return null;
  }
}

// Function to update CORS configuration
async function updateCorsConfiguration() {
  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfig
    });
    
    await s3Client.send(command);
    log(`S3 CORS configuration updated successfully`, "s3");
    log(`New CORS rules: ${JSON.stringify(corsConfig.CORSRules)}`, "s3");
  } catch (error) {
    log(`Error updating CORS configuration: ${error}`, "s3");
    throw error;
  }
}

// Execute the functions
async function run() {
  try {
    log(`Checking CORS configuration for bucket: ${bucketName}`, "s3");
    
    const currentCors = await getCorsConfiguration();
    if (!currentCors) {
      log("No existing CORS configuration found or error retrieving it. Will try to add new configuration.", "s3");
    }
    
    await updateCorsConfiguration();
    log("S3 CORS update process completed", "s3");
  } catch (error) {
    log(`Error in CORS update process: ${error}`, "s3");
  }
}

run();