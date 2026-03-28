import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileCheck, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * S3 Upload Test Page
 * 
 * This page provides a simplified interface to test direct uploads to S3
 * using presigned URLs. It includes real-time progress tracking and detailed
 * error reporting for diagnosing upload issues.
 */
export default function S3UploadTestPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Add a log message with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
    console.log(`[S3 Test] ${message}`);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      addLog(`File selected: ${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB) type: ${selectedFile.type}`);
    }
  };

  // Direct S3 upload implementation using presigned URLs
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      setUploadedUrl(null);
      
      addLog("Starting direct S3 upload process");
      addLog(`File: ${file.name}, Type: ${file.type}, Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
      
      // Step 1: Request a presigned URL from the server
      addLog("Requesting presigned URL from server...");
      const presignedUrlResponse = await fetch("/api/s3-presigned-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size
        }),
      });
      
      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get upload URL: ${presignedUrlResponse.status}`);
      }
      
      const { presignedUrl, fileUrl, fileKey, uploadMethod, contentType, bucketName, region } = await presignedUrlResponse.json();
      
      addLog(`Received presigned URL successfully`);
      addLog(`Upload method: ${uploadMethod || 'PUT'}`);
      addLog(`Content type: ${contentType || file.type}`);
      addLog(`S3 bucket: ${bucketName || 'unknown'}`);
      addLog(`AWS region: ${region || 'unknown'}`);
      addLog(`File key: ${fileKey}`);
      
      // Step 2: Upload directly to S3 using XMLHttpRequest for progress tracking
      addLog("Starting direct upload to S3...");
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Set up progress tracking
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
            if (percentComplete % 10 === 0) {
              addLog(`Upload progress: ${percentComplete}%`);
            }
          }
        };
        
        // Handle completion with detailed response information
        xhr.onload = () => {
          addLog(`XHR ReadyState: ${xhr.readyState}`);
          addLog(`Status: ${xhr.status}`);
          addLog(`Status Text: ${xhr.statusText}`);
          
          // Log response headers
          const allHeaders = xhr.getAllResponseHeaders();
          addLog(`Response headers: ${allHeaders || 'None'}`);
          
          if (xhr.status === 200) {
            addLog(`Upload completed successfully with status: ${xhr.status}`);
            resolve();
          } else {
            let errorMsg = `Upload failed with status ${xhr.status} (${xhr.statusText})`;
            
            // Try to parse S3 error response
            if (xhr.responseText) {
              try {
                if (xhr.responseText.includes('<?xml')) {
                  // Parse XML error response from S3
                  const errorCode = xhr.responseText.match(/<Code>(.*?)<\/Code>/);
                  const message = xhr.responseText.match(/<Message>(.*?)<\/Message>/);
                  const resource = xhr.responseText.match(/<Resource>(.*?)<\/Resource>/);
                  
                  if (errorCode && errorCode[1]) addLog(`S3 Error Code: ${errorCode[1]}`);
                  if (message && message[1]) errorMsg += `: ${message[1]}`;
                  if (resource && resource[1]) addLog(`Resource: ${resource[1]}`);
                } else if (xhr.getResponseHeader('content-type')?.includes('application/json')) {
                  // Try to parse JSON response
                  const jsonResponse = JSON.parse(xhr.responseText);
                  addLog(`JSON Error: ${JSON.stringify(jsonResponse)}`);
                  if (jsonResponse.message) errorMsg += `: ${jsonResponse.message}`;
                }
              } catch (parseError) {
                addLog(`Error parsing response: ${parseError}`);
              }
              
              // Log a sample of the response
              addLog(`Response text: ${xhr.responseText.substring(0, 200)}...`);
            }
            
            reject(new Error(errorMsg));
          }
        };
        
        // Handle network errors with more detailed diagnostics
        xhr.onerror = () => {
          addLog("Network error occurred during upload");
          
          // Add CORS diagnostics
          addLog("Checking for CORS issues...");
          addLog(`Origin: ${window.location.origin}`);
          
          // Check readyState to diagnose which stage it failed
          addLog(`XHR ReadyState: ${xhr.readyState}`);
          if (xhr.readyState === 0) {
            addLog("ERROR: Network request was blocked, likely due to CORS policy");
          } else if (xhr.readyState === 1) {
            addLog("ERROR: Connection established but request was not sent properly");
          } else if (xhr.readyState === 2) {
            addLog("ERROR: Request was sent but no response was received");
          } else if (xhr.readyState === 3) {
            addLog("ERROR: Response headers received but body not complete");
          }
          
          reject(new Error("Network error occurred during upload. This could be due to CORS configuration issues. See logs for details."));
        };
        
        // Handle timeouts
        xhr.ontimeout = () => {
          addLog("Upload timed out");
          reject(new Error("Upload timed out. Try with a smaller file or check your connection."));
        };
        
        // Open the connection to S3
        xhr.open(uploadMethod || 'PUT', presignedUrl, true);
        
        // Critical settings for S3 direct uploads
        xhr.withCredentials = false; // Must be false for CORS uploads to S3
        
        // IMPORTANT: Only set these headers, nothing else
        xhr.setRequestHeader('Content-Type', file.type);
        
        // Avoid using these headers for S3 uploads
        // Do NOT use: xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        // Do NOT use: xhr.setRequestHeader('Authorization', '...');
        // Do NOT use: xhr.setRequestHeader('Cache-Control', '...');
        
        // Add debugging headers
        addLog(`Browser: ${navigator.userAgent}`);
        addLog(`Protocol: ${window.location.protocol}`);
        
        // Send the file directly (not as FormData)
        xhr.send(file);
        addLog("File upload request sent to S3");
      });
      
      // Success! Store the file URL
      setUploadedUrl(fileUrl);
      addLog(`Upload completed successfully!`);
      addLog(`File available at: ${fileUrl}`);
      
      toast({
        title: "Upload Successful",
        description: "File has been uploaded to S3",
      });
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred";
      setError(errorMessage);
      addLog(`ERROR: ${errorMessage}`);
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">S3 Upload Test</h1>
        <Link href="/admin">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>
      
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>S3 Direct Upload Test</CardTitle>
          <CardDescription>
            Test direct file uploads to Amazon S3 using presigned URLs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <Input 
              id="file-upload" 
              type="file" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {file && (
              <p className="text-sm text-green-600">
                <FileCheck className="inline-block mr-1 h-4 w-4" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          
          {/* Upload Button */}
          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload to S3
              </>
            )}
          </Button>
          
          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          
          {/* Success Message */}
          {uploadedUrl && (
            <Alert className="bg-green-50 border-green-200">
              <FileCheck className="h-4 w-4" />
              <AlertTitle>Upload Successful</AlertTitle>
              <AlertDescription>
                <p>Your file has been uploaded successfully.</p>
                <a 
                  href={uploadedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline block mt-2 break-all"
                >
                  {uploadedUrl}
                </a>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Debug Logs */}
          <div className="space-y-2 mt-4">
            <h3 className="text-lg font-medium">Debug Logs</h3>
            <div className="bg-gray-100 p-3 rounded-md text-xs font-mono h-48 overflow-auto">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="pb-1">{log}</div>
                ))
              ) : (
                <p className="text-gray-500">Logs will appear here during upload...</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}