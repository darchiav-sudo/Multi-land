import { useState, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { createChunkedUploader, UploadCompleteResult } from "@/lib/chunked-uploader";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function UploadTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadCompleteResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(file.size);
      setUploadResult(null);

      // Create an uploader with larger chunk size for testing
      const uploader = createChunkedUploader({
        file,
        onProgress: (progress, uploaded, total) => {
          setUploadProgress(Math.floor(progress * 100));
          setUploadedBytes(uploaded);
          setTotalBytes(total);
        },
        onChunkProgress: (chunkIndex, progress, uploaded, total) => {
          console.log(`Chunk ${chunkIndex + 1} progress: ${Math.floor(progress * 100)}%`);
        },
        onComplete: (result) => {
          console.log('Upload complete:', result);
          setUploadResult(result);
          setIsUploading(false);
          
          toast({
            title: "Upload successful",
            description: `File uploaded: ${result.fileName} (${formatBytes(result.size)})`,
          });
        },
        onError: (error) => {
          console.error('Upload error:', error);
          setIsUploading(false);
          
          toast({
            title: "Upload failed",
            description: error.message,
            variant: "destructive",
          });
        },
        // Use 5MB chunks and limit parallel uploads
        // This makes testing easier on slower connections
        maxRetries: 3,
        maxParallelUploads: 3
      });

      // Start the upload
      await uploader.upload();
      
    } catch (error: any) {
      console.error('Unexpected error during upload:', error);
      setIsUploading(false);
      
      toast({
        title: "Upload failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You need to log in to access this page.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/auth">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Test Chunked Upload</CardTitle>
          <CardDescription>Upload a large file to test the chunked upload system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Uploading...' : 'Select File'}
            </Button>
            
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {uploadProgress}% • {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
                </div>
              </div>
            )}
            
            {uploadResult && (
              <div className="mt-4 text-sm">
                <div className="font-medium">Upload completed:</div>
                <div>File: {uploadResult.fileName}</div>
                <div>Size: {formatBytes(uploadResult.size)}</div>
                <div>Type: {uploadResult.fileType}</div>
                {uploadResult.fileUrl && (
                  <div className="mt-2">
                    <a 
                      href={uploadResult.signedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View File
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}