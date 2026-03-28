import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Content, Course, VideoItem, PDFItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Icons
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash,
  Edit,
  Save,
  RefreshCw,
  Video,
  CloudLightning,
  Film,
  Info,
  FileText,
  File,
  CheckCircle2,
  X,
  AlertTriangle,
  PenSquare,
  Loader2,
  MoveUp,
  MoveDown,
  Eye
} from "lucide-react";

/**
 * New Content Editor Component for Multi Land
 * 
 * This is a completely redesigned content editor optimized for:
 * 1. Admin-friendly interface with clear section organization
 * 2. Better lesson customization options
 * 3. Improved video uploading with custom naming
 * 4. Enhanced PDF uploading system
 */
export default function ContentEditor() {
  // Use full URL pattern to correctly extract parameters
  const params = useParams();
  const courseId = params.courseId;
  const contentId = params.contentId;
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Main content data state
  const [contentData, setContentData] = useState<Partial<Content>>({
    title: "",
    textContent: "",
    videoItems: [],
    pdfItems: [],
    type: "mixed",
    // Order will be automatically determined by the server
    display_order: '["video","text","pdf"]',
    content: "Content", // Adding required field
    youtubeUrl: "", // YouTube video URL support
  });
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  // Video upload states
  const [videoName, setVideoName] = useState("");
  const [videoPreviewing, setVideoPreviewing] = useState<VideoItem | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  
  // PDF upload states
  const [pdfName, setPdfName] = useState("");
  const [pdfPreviewing, setPdfPreviewing] = useState<PDFItem | null>(null);
  
  // Fetch course details
  const { data: course, isLoading: isLoadingCourse } = useQuery<Course>({
    queryKey: [`/api/courses/${courseId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${courseId}`);
      return res.json();
    },
    enabled: !!courseId,
  });
  
  // Fetch content details if editing existing content
  const { data: existingContent, isLoading: isLoadingContent } = useQuery<Content>({
    queryKey: [`/api/contents/${contentId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contents/${contentId}`);
      return res.json();
    },
    enabled: !!contentId,
  });
  
  // Set up content data from existing content
  useEffect(() => {
    if (existingContent) {
      setContentData({
        title: existingContent.title || "",
        textContent: existingContent.textContent || "",
        videoItems: existingContent.videoItems || [],
        pdfItems: existingContent.pdfItems || [],
        type: existingContent.type || "mixed",
        order: existingContent.order || 1,
        display_order: existingContent.display_order || '["video","text","pdf"]',
        thumbnailUrl: existingContent.thumbnailUrl || "",
        youtubeUrl: (existingContent as any).youtubeUrl || "",
        youtubeName: (existingContent as any).youtubeName || ""
      });
    }
  }, [existingContent]);
  
  // Create new content
  const createContentMutation = useMutation({
    mutationFn: async (data: Partial<Content>) => {
      // Ensure courseId is a valid number
      const numericCourseId = parseInt(courseId || "0");
      
      if (!numericCourseId || isNaN(numericCourseId)) {
        throw new Error("Invalid course ID");
      }
      
      // Ensure all required fields are present
      const contentToCreate = {
        ...data,
        courseId: numericCourseId,
        content: data.content || "Content", // Ensure content field is set
        type: data.type || "mixed",
      };
      
      console.log("Submitting content:", JSON.stringify(contentToCreate, null, 2));
      
      try {
        const res = await apiRequest("POST", "/api/contents", contentToCreate);
        const responseJson = await res.json();
        
        if (!res.ok) {
          console.error("Error response:", responseJson);
          throw new Error(responseJson.message || "Failed to create content");
        }
        
        return responseJson;
      } catch (err: any) {
        console.error("Content creation error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/contents`] });
      toast({
        title: t("Success"),
        description: t("Content created successfully"),
      });
      navigate(`/admin/content-manager/${courseId}`);
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast({
        title: t("Error Creating Lesson"),
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Update existing content
  const updateContentMutation = useMutation({
    mutationFn: async (data: Partial<Content>) => {
      if (!contentId) {
        throw new Error("Content ID is missing");
      }
      
      // Ensure all required fields are present
      const contentToUpdate = {
        ...data,
        content: data.content || "Content", // Ensure content field is set
        type: data.type || "mixed",
      };
      
      console.log("Updating content:", JSON.stringify(contentToUpdate, null, 2));
      
      try {
        const res = await apiRequest("PUT", `/api/contents/${contentId}`, contentToUpdate);
        const responseJson = await res.json();
        
        if (!res.ok) {
          console.error("Error response:", responseJson);
          throw new Error(responseJson.message || "Failed to update content");
        }
        
        return responseJson;
      } catch (err: any) {
        console.error("Content update error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/contents`] });
      toast({
        title: t("Success"),
        description: t("Content updated successfully"),
      });
      navigate(`/admin/content-manager/${courseId}`);
    },
    onError: (error: any) => {
      console.error("Update mutation error:", error);
      toast({
        title: t("Error Updating Lesson"),
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Completely redesigned video file upload with XMLHttpRequest for direct control
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Create a diagnostic element to show upload details
    const diagnosticId = `diagnostic-${Date.now()}`;
    let diagnosticElement = document.getElementById(diagnosticId);
    
    if (!diagnosticElement) {
      diagnosticElement = document.createElement('div');
      diagnosticElement.id = diagnosticId;
      diagnosticElement.style.position = 'fixed';
      diagnosticElement.style.bottom = '10px';
      diagnosticElement.style.right = '10px';
      diagnosticElement.style.backgroundColor = 'rgba(0,0,0,0.8)';
      diagnosticElement.style.color = '#00ff00';
      diagnosticElement.style.padding = '10px';
      diagnosticElement.style.borderRadius = '5px';
      diagnosticElement.style.fontSize = '12px';
      diagnosticElement.style.fontFamily = 'monospace';
      diagnosticElement.style.maxWidth = '400px';
      diagnosticElement.style.maxHeight = '300px';
      diagnosticElement.style.overflow = 'auto';
      diagnosticElement.style.zIndex = '9999';
      document.body.appendChild(diagnosticElement);
    }
    
    // Update diagnostic content
    const updateDiagnostic = (message: string) => {
      if (diagnosticElement) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
        diagnosticElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;
        diagnosticElement.scrollTop = diagnosticElement.scrollHeight;
      }
    };
    
    updateDiagnostic(`Starting upload of ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    updateDiagnostic(`Browser: ${navigator.userAgent}`);
    updateDiagnostic(`File type: ${file.type}`);
    updateDiagnostic(`CORS mode: ${window.location.protocol === 'https:' ? 'secure' : 'non-secure'}`);
    
    // Remove diagnostic after 60 seconds (or success)
    const removeDiagnostic = () => {
      if (diagnosticElement && diagnosticElement.parentNode) {
        document.body.removeChild(diagnosticElement);
      }
    };
    setTimeout(removeDiagnostic, 60000);
    
    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: t("Invalid File"),
        description: t("Please upload a valid video file"),
        variant: "destructive",
      });
      return;
    }
    
    // Updated file size restrictions to support larger videos
    const MAX_FILE_SIZE = 10000 * 1024 * 1024; // 10GB maximum limit
    const LARGE_FILE_SIZE = 2000 * 1024 * 1024; // 2GB warning threshold
    
    // Enforce hard limit on file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t("File Too Large"),
        description: t("The maximum upload size is 10GB. Please compress your video or split it into smaller parts."),
        variant: "destructive",
        duration: 6000,
      });
      removeDiagnostic();
      return;
    }
    
    // Show a warning for large files but allow the upload
    if (file.size > LARGE_FILE_SIZE) {
      toast({
        title: t("Large File Detected"),
        description: t("Files over 2GB may take a long time to upload. Please ensure you have a stable connection and don't refresh the page during upload."),
        duration: 6000,
      });
    }
    
    // Check if file size is zero
    if (file.size === 0) {
      toast({
        title: t("Invalid File"),
        description: t("Cannot upload empty file"),
        variant: "destructive",
      });
      return;
    }
    
    // Check if a name was provided, otherwise use filename
    const displayName = videoName.trim() || file.name.split('.')[0];
    
    // Function to determine upload method based on file size
    const getUploadMethod = () => {
      if (file.size <= 100 * 1024 * 1024) {
        // Small files (up to 100MB): Use standard server upload
        return 'standard';
      } else if (file.size <= 1024 * 1024 * 1024) {
        // Medium files (100MB to 1GB): Use direct S3 upload
        return 'direct-s3';
      } else {
        // Large files (over 1GB): Use chunked upload for reliability
        return 'chunked';
      }
    };
    
    // Function to attempt upload with retry
    const attemptUpload = async (retryCount = 0, maxRetries = 2) => {
      try {
        setIsUploading(true);
        setUploadProgress(0);
        
        // Safety timeout - if upload doesn't complete or fail within 20 minutes, reset the upload state
        const uploadSafetyTimeout = setTimeout(() => {
          console.log("Safety timeout triggered - clearing upload state after 20 minutes");
          updateDiagnostic("TIMEOUT: Upload safety timeout triggered after 20 minutes");
          setIsUploading(false);
          setUploadProgress(0);
        }, 20 * 60 * 1000); // 20 minutes for large files
        
        // Determine upload method based on file size
        const uploadMethod = getUploadMethod();
        
        console.log(`Starting upload for file: ${file.name}, size: ${file.size}, attempt: ${retryCount + 1}`);
        console.log(`Upload method: ${uploadMethod}`);
        updateDiagnostic(`Upload method: ${uploadMethod}`);
        
        // For backwards compatibility
        const useDirectS3 = uploadMethod === 'direct-s3';
        
        // Handle uploads based on method
        if (uploadMethod === 'chunked') {
          // CHUNKED UPLOAD FOR VERY LARGE FILES (over 1GB)
          try {
            // Import the chunked uploader dynamically to avoid loading it when not needed
            const { createChunkedUploader } = await import('@/lib/chunked-uploader');
            
            updateDiagnostic("Starting chunked upload for large file...");
            const startTime = Date.now();
            
            // Create a chunked uploader instance
            const uploader = createChunkedUploader({
              file,
              onProgress: (progress, uploadedBytes, totalBytes) => {
                // Ensure progress is always at least 1% for visual feedback
                const calculatedProgress = Math.max(1, Math.round(progress * 100));
                
                // Check for a significant change in progress to avoid excessive updates
                if (Math.abs(calculatedProgress - uploadProgress) >= 1 || calculatedProgress >= 99) {
                  console.log(`Setting overall upload progress to ${calculatedProgress}%`);
                  setUploadProgress(calculatedProgress);
                  
                  // Log progress at regular intervals
                  if (calculatedProgress % 5 === 0 || calculatedProgress >= 99) {
                    const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(2);
                    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
                    updateDiagnostic(`Chunked upload progress: ${calculatedProgress}% (${uploadedMB}MB / ${totalMB}MB)`);
                  }
                }
              },
              onChunkProgress: (chunkIndex, progress, uploaded, total) => {
                // Force overall progress update on every chunk progress
                if (progress > 0) {
                  // Calculate a partial progress based on this chunk and total chunks
                  const estimatedOverallProgress = Math.max(1, Math.min(99, Math.round(progress * 100 / 3))); // Estimate based on current batch
                  
                  // Only update for significant changes
                  if (Math.abs(estimatedOverallProgress - uploadProgress) >= 2) {
                    setUploadProgress(estimatedOverallProgress);
                  }
                  
                  // Log completion of chunks
                  if (Math.round(progress * 100) >= 99) {
                    updateDiagnostic(`Chunk ${chunkIndex + 1} completed`);
                  }
                }
              },
              onError: (error) => {
                updateDiagnostic(`Chunked upload error: ${error.message}`);
                toast({
                  title: t("Upload Error"),
                  description: t("Failed to upload video: ") + error.message,
                  variant: "destructive",
                });
              },
              maxRetries: 3,
              maxParallelUploads: 3,
            });
            
            // Start the upload
            const result = await uploader.upload();
            
            // Success!
            const uploadDuration = ((Date.now() - startTime) / 1000).toFixed(1);
            updateDiagnostic(`✅ CHUNKED UPLOAD SUCCESS in ${uploadDuration}s`);
            
            // Auto-dismiss diagnostic after successful upload
            setTimeout(removeDiagnostic, 5000);
            
            // Create a new video item with the result
            const newVideoItem: VideoItem = {
              name: displayName,
              url: result.fileUrl,
              quality: 'auto',
              isDefault: true,
              fileKey: result.fileKey
            };
            
            // Update content data with new video
            setContentData(prev => ({
              ...prev,
              videoItems: [...(prev.videoItems || []), newVideoItem]
            }));
            
            toast({
              title: t("Upload Complete"),
              description: t("Large video uploaded successfully using chunked upload"),
            });
            
            // Reset states
            setVideoName("");
            setUploadProgress(0);
            setIsUploading(false);
            clearTimeout(uploadSafetyTimeout);
            return true;
          } catch (chunkedError: any) {
            updateDiagnostic(`ERROR with chunked upload: ${chunkedError.message}`);
            throw chunkedError; // Let the retry handler deal with it
          }
        } else if (uploadMethod === 'direct-s3') {
          // DIRECT S3 UPLOAD FOR LARGE FILES
          try {
            // Step 1: Request a presigned URL from the server
            updateDiagnostic("Requesting presigned URL from server...");
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
            
            const { presignedUrl, fileUrl, fileKey, uploadMethod, contentType } = await presignedUrlResponse.json();
            
            updateDiagnostic(`Received presigned URL successfully`);
            updateDiagnostic(`Upload method: ${uploadMethod || 'PUT'}`);
            updateDiagnostic(`Content type: ${contentType || file.type}`);
            updateDiagnostic(`File key: ${fileKey}`);
            
            // Step 2: Upload directly to S3 using XMLHttpRequest for progress tracking
            updateDiagnostic("Starting direct upload to S3...");
            const uploadStartTime = Date.now();
            
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              
              // Set up progress tracking
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const percentComplete = Math.round((event.loaded / event.total) * 100);
                  setUploadProgress(percentComplete);
                  if (percentComplete % 10 === 0) {
                    updateDiagnostic(`Upload progress: ${percentComplete}%`);
                  }
                }
              };
              
              // Handle completion
              xhr.onload = () => {
                updateDiagnostic(`XHR ReadyState: ${xhr.readyState}`);
                updateDiagnostic(`Status: ${xhr.status}`);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                  updateDiagnostic(`Upload completed successfully with status: ${xhr.status}`);
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
                        
                        if (errorCode && errorCode[1]) updateDiagnostic(`S3 Error Code: ${errorCode[1]}`);
                        if (message && message[1]) errorMsg += `: ${message[1]}`;
                      }
                    } catch (parseError) {
                      updateDiagnostic(`Error parsing response: ${parseError}`);
                    }
                  }
                  
                  reject(new Error(errorMsg));
                }
              };
              
              // Handle network errors
              xhr.onerror = () => {
                updateDiagnostic("Network error occurred during upload");
                updateDiagnostic(`XHR ReadyState: ${xhr.readyState}`);
                
                if (xhr.readyState === 0) {
                  updateDiagnostic("ERROR: Network request was blocked, likely due to connection issue or browser limit");
                }
                
                // Show an appropriate error message to the user
                toast({
                  title: t("Upload Failed"),
                  description: t("Network error during upload. This could be due to connection issues or the file being too large for your browser."),
                  variant: "destructive",
                  duration: 6000,
                });
                
                // Always reset upload state on error
                setIsUploading(false);
                setUploadProgress(0);
                
                reject(new Error("Network error occurred during upload. This could be due to browser limitations for very large files."));
              };
              
              // Handle timeouts
              xhr.ontimeout = () => {
                updateDiagnostic("Upload timed out");
                reject(new Error("Upload timed out. Try with a smaller file or check your connection."));
              };
              
              // Open the connection to S3
              xhr.open(uploadMethod || 'PUT', presignedUrl, true);
              
              // Critical settings for S3 direct uploads
              xhr.withCredentials = false; // Must be false for CORS uploads to S3
              
              // Set content type header for S3
              xhr.setRequestHeader('Content-Type', file.type);
              
              // Set a very long timeout for extremely large files (10GB)
              xhr.timeout = 18000000; // 5 hours
              
              // Send the file directly (not as FormData)
              xhr.send(file);
              updateDiagnostic("File upload request sent to S3");
            });
            
            // Successfully uploaded to S3
            const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
            updateDiagnostic(`✅ UPLOAD SUCCESS in ${uploadDuration}s via S3 direct upload`);
            
            // Auto-dismiss diagnostic after successful upload
            setTimeout(removeDiagnostic, 5000);
            
            // Create a new video item with the S3 URL
            const newVideoItem: VideoItem = {
              name: displayName,
              url: fileUrl,
              quality: 'auto',
              isDefault: true,
              fileKey: fileKey
            };
            
            // Update content data with new video
            setContentData(prev => ({
              ...prev,
              videoItems: [...(prev.videoItems || []), newVideoItem]
            }));
            
            toast({
              title: t("Upload Complete"),
              description: t("Large video uploaded successfully using S3 direct upload"),
            });
            
            // Reset states
            setVideoName("");
            setUploadProgress(0);
            setIsUploading(false);
            clearTimeout(uploadSafetyTimeout);
            return true;
          } catch (s3Error: any) {
            updateDiagnostic(`ERROR with S3 direct upload: ${s3Error.message}`);
            throw s3Error; // Let the retry handler deal with it
          }
        }
        
        // For smaller files, use the standard server upload
        // Create a promise-based XMLHttpRequest that gives direct progress feedback
        const uploadFile = () => {
          return new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Setup progress event
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                console.log(`Upload progress: ${percentComplete}%`);
                setUploadProgress(percentComplete);
                // Update diagnostic display
                updateDiagnostic(`Progress: ${percentComplete}% (${(event.loaded / (1024 * 1024)).toFixed(2)}MB / ${(event.total / (1024 * 1024)).toFixed(2)}MB)`);
              } else {
                console.log('Upload progress event not computable', event);
                updateDiagnostic(`Progress event not computable - browser may not support detailed progress tracking`);
              }
            };
            
            // Setup completion event with improved error handling
            xhr.onload = function() {
              console.log("XMLHttpRequest load event fired, status:", xhr.status, xhr.statusText);
              updateDiagnostic(`Upload response received with status: ${xhr.status}`);
              
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  console.log("Upload response successfully parsed:", response);
                  updateDiagnostic(`Upload completed successfully: ${response.fileUrl ? 'file URL received' : 'no file URL'}`);
                  resolve(response);
                } catch (error) {
                  console.error("Failed to parse upload response:", xhr.responseText, error);
                  updateDiagnostic(`ERROR: Failed to parse successful response`);
                  // Even though parsing failed, clear the upload state to avoid stuck progress
                  setIsUploading(false);
                  setUploadProgress(0);
                  reject(new Error("Invalid response format"));
                }
              } else {
                let errorMessage = `Error ${xhr.status}: ${xhr.statusText}`;
                let errorDetails = "";
                
                try {
                  const errorResponse = JSON.parse(xhr.responseText);
                  if (errorResponse.message) {
                    errorMessage = errorResponse.message;
                  }
                  if (errorResponse.details) {
                    errorDetails = errorResponse.details;
                  }
                } catch (parseError) {
                  console.error("Failed to parse error response:", xhr.responseText, parseError);
                  // If we can't parse the error, use the raw response text if available
                  if (xhr.responseText) {
                    errorDetails = `Raw response: ${xhr.responseText}`;
                  }
                }
                
                const fullError = `${errorMessage}${errorDetails ? `\n${errorDetails}` : ''}`;
                console.error("Upload failed with HTTP error:", fullError);
                updateDiagnostic(`ERROR: Upload failed with HTTP error: ${errorMessage}`);
                
                // Always clear upload state on error to prevent stuck progress
                setIsUploading(false);
                setUploadProgress(0);
                reject(new Error(fullError));
              }
            };
            
            // Setup error handling with better logging
            xhr.onerror = function(e) {
              console.error("XMLHttpRequest error event fired:", e);
              const errorMsg = "Upload failed due to network error - check your connection and try again";
              updateDiagnostic(`ERROR: Network error during upload - possible CORS issue or connection problem`);
              updateDiagnostic(`Browser: ${navigator.userAgent}`);
              updateDiagnostic(`Protocol: ${window.location.protocol}`);
              
              // Always clear upload state on error to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error(errorMsg));
            };
            
            // Setup abort handling
            xhr.onabort = function() {
              console.error("XMLHttpRequest aborted");
              updateDiagnostic(`ERROR: Upload was aborted`);
              
              // Always clear upload state on abort to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error("Upload was aborted"));
            };
            
            // Setup timeout - use a larger timeout for larger files
            // 3 minutes base + extra time based on file size (40 secs per 10MB)
            const timeoutDuration = 180000 + (file.size / (10 * 1024 * 1024)) * 40000;
            xhr.timeout = timeoutDuration;
            console.log(`Setting XMLHttpRequest timeout to ${timeoutDuration/1000} seconds`);
            
            xhr.ontimeout = function() {
              console.error(`XMLHttpRequest timed out after ${Math.round(timeoutDuration/1000)} seconds`);
              updateDiagnostic(`ERROR: Upload timed out after ${Math.round(timeoutDuration/1000)} seconds`);
              
              // Always clear upload state on timeout to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error(`Upload timed out after ${Math.round(timeoutDuration/1000)} seconds - try a smaller file or check your connection`));
            };
            
            // Prepare form data with browser compatibility in mind
            const formData = new FormData();
            
            // Add the file with correct filename (some browsers have issues with file names containing special characters)
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            
            // Create a new File object with a safe name if needed
            let safeFile = file;
            if (file.name !== safeFileName) {
              try {
                // Use Blob with File constructor for cross-browser compatibility
                const blob = new Blob([file], { type: file.type });
                // @ts-ignore - Some browsers might have different File constructor signatures
                safeFile = new File([blob], safeFileName, { type: file.type });
                console.log("Created file with safe filename:", safeFileName);
              } catch (fileError) {
                console.warn("Could not create file with safe name, using original:", fileError);
              }
            }
            
            // Append to form with careful error handling
            try {
              formData.append('file', safeFile);
              formData.append('type', 'video');
              formData.append('name', displayName);
              
              // Add browser info to help with server-side debugging
              formData.append('browser', navigator.userAgent);
            } catch (formDataError) {
              console.error("Error creating FormData:", formDataError);
              // Fall back to simpler approach if needed
              const fallbackFormData = new FormData();
              fallbackFormData.append('file', file);
              fallbackFormData.append('type', 'video');
              fallbackFormData.append('name', displayName);
              return fallbackFormData; // Return the fallback instead of reassigning formData
            }
            
            // Add detailed debugging
            console.log("Preparing to send XMLHttpRequest for video upload");
            console.log("File information:", {
              name: file.name,
              type: file.type,
              size: file.size,
              lastModified: new Date(file.lastModified).toISOString()
            });
            
            // Send request with additional logging and cross-browser compatibility
            xhr.open('POST', '/api/upload', true);
            console.log("XMLHttpRequest opened, sending form data...");
            
            // Set headers for better cross-browser compatibility
            // Note: Do not set Content-Type header manually with FormData, browsers will set it with boundary
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Cache-Control', 'no-cache');
            
            // Make sure there's no timeout from the browser side either
            xhr.timeout = Math.max(xhr.timeout, 300000); // At least 5 minutes
            
            try {
              // Update diagnostic before sending
              updateDiagnostic(`Sending request with ${(file.size / (1024 * 1024)).toFixed(2)}MB file...`);
              updateDiagnostic(`Headers: X-Requested-With, Accept, Cache-Control`);
              
              // For Opera and Chrome, add additional compatibility attributes
              if (navigator.userAgent.includes('OPR') || navigator.userAgent.includes('Opera')) {
                updateDiagnostic(`Opera detected - applying special handling`);
                xhr.withCredentials = false; // Disable credentials for Opera's CORS handling
              } else if (navigator.userAgent.includes('Chrome')) {
                updateDiagnostic(`Chrome detected - applying special handling`);
              }
              
              xhr.send(formData);
              console.log("XMLHttpRequest sent - form data is being uploaded");
              updateDiagnostic(`Request sent at ${new Date().toISOString().split('T')[1].slice(0, 8)}`);
              
              // Start a progress ping for browsers that don't properly support progress events
              let lastProgress = 0;
              let noProgressCount = 0;
              
              const progressCheckInterval = setInterval(() => {
                if (xhr.readyState === 4) {
                  clearInterval(progressCheckInterval);
                  updateDiagnostic(`Request completed with readyState 4`);
                } else {
                  console.log("Upload still in progress...");
                  updateDiagnostic(`Still uploading - readyState: ${xhr.readyState}`);
                  
                  // Check if progress is stalled
                  if (uploadProgress > 0 && uploadProgress === lastProgress) {
                    noProgressCount++;
                    console.log(`No progress detected for ${noProgressCount * 5} seconds (still at ${uploadProgress}%)`);
                    
                    // If no progress for more than 30 seconds and we're not at 100%, assume it's stuck
                    if (noProgressCount >= 6 && uploadProgress < 100) {
                      console.error("Upload appears to be stuck - progress hasn't changed in 30 seconds");
                      updateDiagnostic(`WARNING: Upload may be stuck at ${uploadProgress}% (no progress for 30+ seconds)`);
                      
                      // After 60 seconds of no progress, abort
                      if (noProgressCount >= 12) {
                        updateDiagnostic(`ERROR: Aborting upload - no progress for 60+ seconds`);
                        console.error("Aborting upload due to lack of progress for 60+ seconds");
                        clearInterval(progressCheckInterval);
                        xhr.abort();
                        
                        // Ensure upload state is reset
                        setIsUploading(false);
                        setUploadProgress(0);
                      }
                    }
                  } else {
                    noProgressCount = 0;
                    lastProgress = uploadProgress;
                  }
                }
              }, 5000);
            } catch (sendError) {
              console.error("Error sending XMLHttpRequest:", sendError);
              reject(new Error(`Failed to start upload: ${sendError}`));
            }
          });
        };
        
        try {
          // Execute the upload
          console.log("Starting XMLHttpRequest upload");
          const uploadStartTime = Date.now();
          const result = await uploadFile();
          const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
          console.log("Upload successful, server response:", result);
          
          // Clear the safety timeout since upload completed successfully
          clearTimeout(uploadSafetyTimeout);
          
          // Add diagnostic information about successful upload
          updateDiagnostic(`✅ UPLOAD SUCCESS in ${uploadDuration}s`);
          updateDiagnostic(`File stored: ${result.s3Stored ? 'S3 cloud storage' : 'Local storage'}`);
          updateDiagnostic(`File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
          if (result.fileKey) {
            updateDiagnostic(`S3 fileKey: ${result.fileKey.substring(0, 20)}...`);
          }
          
          // Auto-dismiss diagnostic after successful upload
          setTimeout(removeDiagnostic, 5000);
          
          // Create a new video item
          const newVideoItem: VideoItem = {
            name: displayName,
            url: result.fileUrl,
            quality: 'auto',
            isDefault: true,
            fileKey: result.fileKey || undefined
          };
          
          // Update content data with new video
          setContentData(prev => ({
            ...prev,
            videoItems: [...(prev.videoItems || []), newVideoItem]
          }));
          
          toast({
            title: t("Upload Complete"),
            description: t("Video uploaded successfully"),
          });
          
          // Reset states
          setVideoName("");
          setUploadProgress(0);
          setIsUploading(false);
          return true; // Upload succeeded
        } catch (uploadError: any) {
          console.error("Upload error:", uploadError.message || uploadError);
          
          // Determine if we should retry
          if (retryCount < maxRetries) {
            console.log(`Retrying upload (${retryCount + 1}/${maxRetries})...`);
            toast({
              title: t("Retrying Upload"),
              description: t("Upload failed, retrying..."),
            });
            setUploadProgress(0);
            
            // Wait a moment before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await attemptUpload(retryCount + 1, maxRetries);
          } else {
            toast({
              title: t("Upload Failed"),
              description: uploadError.message || "Upload failed after multiple attempts",
              variant: "destructive",
            });
            setIsUploading(false);
            return false;
          }
        }
      } catch (error: any) {
        console.error("General upload error:", error);
        toast({
          title: t("Upload Error"),
          description: error.message || String(error),
          variant: "destructive",
        });
        setIsUploading(false);
        return false;
      }
    };
    
    // Start the upload process with retry
    await attemptUpload();
  };
  
  // Redesigned PDF file upload with XMLHttpRequest for consistent handling with video upload
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: t("Invalid File"),
        description: t("Please upload a PDF file"),
        variant: "destructive",
      });
      return;
    }
    
    // Check if file size is too large (over 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: t("File Too Large"),
        description: t("PDF files must be smaller than 50MB"),
        variant: "destructive",
      });
      return;
    }
    
    // Check if file size is zero
    if (file.size === 0) {
      toast({
        title: t("Invalid File"),
        description: t("Cannot upload empty file"),
        variant: "destructive",
      });
      return;
    }
    
    // Check if a name was provided, otherwise use filename
    const displayName = pdfName.trim() || file.name.split('.')[0];
    
    // Function to attempt upload with retry using XMLHttpRequest
    const attemptUpload = async (retryCount = 0, maxRetries = 2) => {
      try {
        setIsUploading(true);
        setUploadProgress(0);
        
        // Safety timeout - if upload doesn't complete or fail within 10 minutes, reset the upload state
        const uploadSafetyTimeout = setTimeout(() => {
          console.log("Safety timeout triggered - clearing PDF upload state after 10 minutes");
          setIsUploading(false);
          setUploadProgress(0);
        }, 10 * 60 * 1000); // 10 minutes
        
        console.log(`Starting PDF upload for file: ${file.name}, size: ${file.size}, attempt: ${retryCount + 1}`);
        
        // Create a promise-based XMLHttpRequest that gives direct progress feedback
        const uploadFile = () => {
          return new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Setup progress event with better logging
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                console.log(`PDF upload progress: ${percentComplete}%`);
                setUploadProgress(percentComplete);
              } else {
                console.log('PDF upload progress event not computable', event);
              }
            };
            
            // Setup completion event with improved error handling
            xhr.onload = function() {
              console.log("PDF XMLHttpRequest load event fired, status:", xhr.status, xhr.statusText);
              
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  console.log("PDF upload response successfully parsed:", response);
                  resolve(response);
                } catch (error) {
                  console.error("Failed to parse PDF upload response:", xhr.responseText, error);
                  // Even though parsing failed, clear the upload state to avoid stuck progress
                  setIsUploading(false);
                  setUploadProgress(0);
                  reject(new Error("Invalid response format"));
                }
              } else {
                let errorMessage = `Error ${xhr.status}: ${xhr.statusText}`;
                let errorDetails = "";
                
                try {
                  const errorResponse = JSON.parse(xhr.responseText);
                  if (errorResponse.message) {
                    errorMessage = errorResponse.message;
                  }
                  if (errorResponse.details) {
                    errorDetails = errorResponse.details;
                  }
                } catch (parseError) {
                  console.error("Failed to parse PDF error response:", xhr.responseText, parseError);
                  // If we can't parse the error, use the raw response text if available
                  if (xhr.responseText) {
                    errorDetails = `Raw response: ${xhr.responseText}`;
                  }
                }
                
                const fullError = `${errorMessage}${errorDetails ? `\n${errorDetails}` : ''}`;
                console.error("PDF upload failed with HTTP error:", fullError);
                
                // Always clear upload state on error to prevent stuck progress
                setIsUploading(false);
                setUploadProgress(0);
                reject(new Error(fullError));
              }
            };
            
            // Setup error handling with better logging
            xhr.onerror = function(e) {
              console.error("PDF XMLHttpRequest error event fired:", e);
              
              // Always clear upload state on error to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error("Upload failed due to network error - check your connection and try again"));
            };
            
            // Setup abort handling
            xhr.onabort = function() {
              console.error("PDF XMLHttpRequest aborted");
              
              // Always clear upload state on abort to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error("Upload was aborted"));
            };
            
            // Setup timeout - 90 seconds base + extra time based on file size (15 secs per 10MB)
            const timeoutDuration = 90000 + (file.size / (10 * 1024 * 1024)) * 15000;
            xhr.timeout = timeoutDuration;
            console.log(`Setting PDF XMLHttpRequest timeout to ${timeoutDuration/1000} seconds`);
            
            xhr.ontimeout = function() {
              console.error(`PDF XMLHttpRequest timed out after ${Math.round(timeoutDuration/1000)} seconds`);
              
              // Always clear upload state on timeout to prevent stuck progress
              setIsUploading(false);
              setUploadProgress(0);
              reject(new Error(`Upload timed out after ${Math.round(timeoutDuration/1000)} seconds - try a smaller file or check your connection`));
            };
            
            // Prepare form data with browser compatibility in mind
            const formData = new FormData();
            
            // Add the file with correct filename (some browsers have issues with file names containing special characters)
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            
            // Create a new File object with a safe name if needed
            let safeFile = file;
            if (file.name !== safeFileName) {
              try {
                // Use Blob with File constructor for cross-browser compatibility
                const blob = new Blob([file], { type: file.type });
                // @ts-ignore - Some browsers might have different File constructor signatures
                safeFile = new File([blob], safeFileName, { type: file.type });
                console.log("Created PDF file with safe filename:", safeFileName);
              } catch (fileError) {
                console.warn("Could not create PDF file with safe name, using original:", fileError);
              }
            }
            
            // Append to form with careful error handling
            try {
              formData.append('file', safeFile);
              formData.append('type', 'pdf');
              formData.append('name', displayName);
              
              // Add browser info to help with server-side debugging
              formData.append('browser', navigator.userAgent);
            } catch (formDataError) {
              console.error("Error creating PDF FormData:", formDataError);
              // Fall back to simpler approach if needed
              const fallbackFormData = new FormData();
              fallbackFormData.append('file', file);
              fallbackFormData.append('type', 'pdf');
              fallbackFormData.append('name', displayName);
              return fallbackFormData;
            }
            
            // Add detailed debugging
            console.log("Preparing to send XMLHttpRequest for PDF upload");
            console.log("PDF file information:", {
              name: file.name,
              type: file.type,
              size: file.size,
              lastModified: new Date(file.lastModified).toISOString()
            });
            
            // Send request with additional logging and cross-browser compatibility
            xhr.open('POST', '/api/upload', true);
            console.log("PDF XMLHttpRequest opened, sending form data...");
            
            // Set headers for better cross-browser compatibility
            // Note: Do not set Content-Type header manually with FormData, browsers will set it with boundary
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Cache-Control', 'no-cache');
            
            // Make sure there's no timeout from the browser side either
            xhr.timeout = Math.max(xhr.timeout, 300000); // At least 5 minutes
            
            try {
              xhr.send(formData);
              console.log("PDF XMLHttpRequest sent - form data is being uploaded");
              
              // Start a progress ping for browsers that don't properly support progress events
              let lastProgress = 0;
              let noProgressCount = 0;
              
              const progressCheckInterval = setInterval(() => {
                if (xhr.readyState === 4) {
                  clearInterval(progressCheckInterval);
                } else {
                  console.log("PDF upload still in progress...");
                  
                  // Check if progress is stalled
                  if (uploadProgress > 0 && uploadProgress === lastProgress) {
                    noProgressCount++;
                    console.log(`No PDF upload progress detected for ${noProgressCount * 5} seconds (still at ${uploadProgress}%)`);
                    
                    // If no progress for more than 30 seconds and we're not at 100%, assume it's stuck
                    if (noProgressCount >= 6 && uploadProgress < 100) {
                      console.error("PDF upload appears to be stuck - progress hasn't changed in 30 seconds");
                      
                      // After 60 seconds of no progress, abort
                      if (noProgressCount >= 12) {
                        console.error("Aborting PDF upload due to lack of progress for 60+ seconds");
                        clearInterval(progressCheckInterval);
                        xhr.abort();
                        
                        // Ensure upload state is reset
                        setIsUploading(false);
                        setUploadProgress(0);
                      }
                    }
                  } else {
                    noProgressCount = 0;
                    lastProgress = uploadProgress;
                  }
                }
              }, 5000);
            } catch (sendError) {
              console.error("Error sending PDF XMLHttpRequest:", sendError);
              reject(new Error(`Failed to start PDF upload: ${sendError}`));
            }
          });
        };
        
        try {
          // Execute the upload
          console.log("Starting PDF XMLHttpRequest upload");
          const result = await uploadFile();
          console.log("PDF upload successful, server response:", result);
          
          // Clear the safety timeout since upload completed successfully
          clearTimeout(uploadSafetyTimeout);
          
          // Create a new PDF item
          const newPDFItem: PDFItem = {
            name: displayName,
            url: result.fileUrl
          };
          
          // Update content data with new PDF
          setContentData(prev => ({
            ...prev,
            pdfItems: [...(prev.pdfItems || []), newPDFItem]
          }));
          
          toast({
            title: t("Upload Complete"),
            description: t("PDF uploaded successfully"),
          });
          
          // Reset states
          setPdfName("");
          setUploadProgress(0);
          setIsUploading(false);
          return true; // Upload succeeded
        } catch (uploadError: any) {
          console.error("PDF upload error:", uploadError.message || uploadError);
          
          // Determine if we should retry
          if (retryCount < maxRetries) {
            console.log(`Retrying PDF upload (${retryCount + 1}/${maxRetries})...`);
            toast({
              title: t("Retrying Upload"),
              description: t("Upload failed, retrying..."),
            });
            setUploadProgress(0);
            
            // Wait a moment before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await attemptUpload(retryCount + 1, maxRetries);
          } else {
            toast({
              title: t("Upload Failed"),
              description: uploadError.message || "Upload failed after multiple attempts",
              variant: "destructive",
            });
            setIsUploading(false);
            return false;
          }
        }
      } catch (error: any) {
        console.error("General PDF upload error:", error);
        toast({
          title: t("Upload Error"),
          description: error.message || String(error),
          variant: "destructive",
        });
        setIsUploading(false);
        return false;
      }
    };
    
    // Start the upload process with retry
    await attemptUpload();
  };
  
  // Remove a video from the list
  const removeVideo = (index: number) => {
    setContentData(prev => ({
      ...prev,
      videoItems: prev.videoItems?.filter((_, i) => i !== index)
    }));
  };
  
  // Remove a PDF from the list
  const removePDF = (index: number) => {
    setContentData(prev => ({
      ...prev,
      pdfItems: prev.pdfItems?.filter((_, i) => i !== index)
    }));
  };
  
  // Preview a video
  const previewVideo = (video: VideoItem) => {
    setVideoPreviewing(video);
    setVideoPreviewUrl(video.url);
  };
  
  // Preview a PDF
  const previewPDF = (pdf: PDFItem) => {
    setPdfPreviewing(pdf);
  };
  
  // Handle save action
  const handleSave = () => {
    if (!contentData.title) {
      toast({
        title: t("Missing Information"),
        description: t("Please provide a title for the content"),
        variant: "destructive",
      });
      return;
    }
    
    // Prepare data with all required fields
    const data = {
      ...contentData,
      title: contentData.title,
      content: contentData.content || "Content", // Ensure content field is present
      type: contentData.type || "mixed",
      order: contentData.order || 1,
      thumbnailUrl: contentData.thumbnailUrl || null,
      textContent: contentData.textContent || null,
      videoUrl: null, // This is now replaced by videoItems array
      videoItems: contentData.videoItems || [],
      pdfItems: contentData.pdfItems || [],
      youtubeUrl: (contentData as any).youtubeUrl || null, // YouTube video URL
    };
    
    console.log("Saving content data:", JSON.stringify(data, null, 2));
    
    if (contentId) {
      updateContentMutation.mutate(data);
    } else {
      createContentMutation.mutate(data);
    }
  };
  
  // Back navigation handling
  const handleBack = () => {
    if (hasContentChanged()) {
      setIsConfirmDialogOpen(true);
    } else {
      navigate(`/admin/content-manager/${courseId}`);
    }
  };
  
  // Check if content has changed and needs saving
  const hasContentChanged = () => {
    if (!existingContent) return contentData.title !== "";
    
    return (
      contentData.title !== existingContent.title ||
      contentData.textContent !== existingContent.textContent ||
      JSON.stringify(contentData.videoItems) !== JSON.stringify(existingContent.videoItems) ||
      JSON.stringify(contentData.pdfItems) !== JSON.stringify(existingContent.pdfItems) ||
      (contentData as any).youtubeUrl !== (existingContent as any).youtubeUrl
    );
  };
  
  // Move a video up or down in the list
  const moveVideo = (index: number, direction: 'up' | 'down') => {
    if (!contentData.videoItems) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contentData.videoItems.length) return;
    
    const newVideos = [...contentData.videoItems];
    const temp = newVideos[index];
    newVideos[index] = newVideos[newIndex];
    newVideos[newIndex] = temp;
    
    setContentData(prev => ({
      ...prev,
      videoItems: newVideos
    }));
  };
  
  // Move a PDF up or down in the list
  const movePDF = (index: number, direction: 'up' | 'down') => {
    if (!contentData.pdfItems) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contentData.pdfItems.length) return;
    
    const newPDFs = [...contentData.pdfItems];
    const temp = newPDFs[index];
    newPDFs[index] = newPDFs[newIndex];
    newPDFs[newIndex] = temp;
    
    setContentData(prev => ({
      ...prev,
      pdfItems: newPDFs
    }));
  };
  
  // Loading states
  if (isLoadingCourse) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!course) {
    return (
      <div className="container p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">
              <AlertTriangle className="h-6 w-6 inline-block mr-2" />
              {t("Course Not Found")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("The requested course could not be found")}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate("/admin/courses")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {t("Back to Courses")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container p-6">
      {/* Fixed header with shadow */}
      <div className="sticky top-0 z-50 bg-white p-4 shadow-md rounded-md mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("Back")}
            </Button>
            <h1 className="text-xl md:text-2xl font-bold truncate max-w-[300px] md:max-w-full">
              {contentId ? t("Edit Lesson") : t("New Lesson")} - {course.title}
            </h1>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isUploading || createContentMutation.isPending || updateContentMutation.isPending}
            className="bg-black text-white hover:bg-gray-800"
          >
            {(createContentMutation.isPending || updateContentMutation.isPending) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("Save Lesson")}
          </Button>
        </div>
      </div>
      
      {/* Main editor tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="general" className="flex items-center">
            <PenSquare className="h-4 w-4 mr-2" />
            {t("General")}
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center">
            <Video className="h-4 w-4 mr-2" />
            {t("Videos")} {contentData.videoItems?.length ? 
              <Badge variant="outline" className="ml-2">{contentData.videoItems.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="pdfs" className="flex items-center">
            <File className="h-4 w-4 mr-2" />
            {t("Documents")} {contentData.pdfItems?.length ? 
              <Badge variant="outline" className="ml-2">{contentData.pdfItems.length}</Badge> : null}
          </TabsTrigger>
        </TabsList>
        
        {/* General tab content */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("Lesson Details")}</CardTitle>
              <CardDescription>
                {t("Set the basic information for this lesson")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("Lesson Title")} *</Label>
                  <Input
                    id="title"
                    placeholder={t("Enter lesson title")}
                    value={contentData.title || ""}
                    onChange={(e) => setContentData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="textContent">{t("Text Content")}</Label>
                  <Textarea
                    id="textContent"
                    placeholder={t("Enter text content (supports HTML)")}
                    value={contentData.textContent || ""}
                    onChange={(e) => setContentData(prev => ({ ...prev, textContent: e.target.value }))}
                    className="min-h-[200px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Videos tab content */}
        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>{t("Video Uploads")}</CardTitle>
              <CardDescription>
                {t("Add videos to this lesson with custom names")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* YouTube Video URL Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium mb-2 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  {t("YouTube Video")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="youtubeUrl">{t("YouTube Video URL")}</Label>
                    <Input
                      id="youtubeUrl"
                      placeholder="https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
                      value={(contentData as any).youtubeUrl || ""}
                      onChange={(e) => setContentData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="youtubeName">{t("YouTube Video Name")}</Label>
                    <Input
                      id="youtubeName"
                      placeholder="Enter a display name for this YouTube video"
                      value={(contentData as any).youtubeName || ""}
                      onChange={(e) => setContentData(prev => ({ ...prev, youtubeName: e.target.value }))}
                    />
                    <p className="text-sm text-blue-600 mt-1">
                      {t("Add a YouTube video with restricted visibility (only accessible by link). This will be embedded for your students.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 font-medium">
                {t("OR")}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-medium mb-2">{t("Upload New Video")}</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="videoName">{t("Video Name (Optional)")}</Label>
                    <Input
                      id="videoName"
                      placeholder={t("Enter a descriptive name for this video")}
                      value={videoName}
                      onChange={(e) => setVideoName(e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {t("If left blank, the filename will be used")}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="videoFile">{t("Video File")}</Label>
                    <div className="flex">
                      <input
                        id="videoFile"
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById("videoFile")?.click()}
                        disabled={isUploading}
                        className="flex-1"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {uploadProgress}% {t("Uploading...")}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {t("Select Video File")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {isUploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Video List */}
              <div>
                <h3 className="font-medium mb-2">{t("Current Videos")}</h3>
                
                {/* YouTube Video Display */}
                {(contentData as any).youtubeUrl && (
                  <div className="mb-4 p-3 border rounded-md bg-blue-50 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <div>
                          <p className="font-medium text-blue-900">
                            {(contentData as any).youtubeName || t("YouTube Video")}
                          </p>
                          <p className="text-sm text-blue-600 truncate max-w-[300px]">
                            {(contentData as any).youtubeUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => window.open((contentData as any).youtubeUrl, '_blank')}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setContentData(prev => ({ ...prev, youtubeUrl: "", youtubeName: "" }))}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {contentData.videoItems && contentData.videoItems.length > 0 ? (
                  <div className="space-y-3">
                    {contentData.videoItems.map((video, index) => (
                      <div 
                        key={`video-${index}`} 
                        className="flex items-center justify-between p-3 border rounded-md bg-white"
                      >
                        <div className="flex items-center space-x-3">
                          <Video className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium">{video.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[300px]">
                              {video.url.split('/').pop()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => moveVideo(index, 'up')}
                            disabled={index === 0}
                            className="h-8 w-8 p-0"
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => moveVideo(index, 'down')}
                            disabled={index === (contentData.videoItems?.length || 0) - 1}
                            className="h-8 w-8 p-0"
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => previewVideo(video)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => removeVideo(index)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !(contentData as any).youtubeUrl ? (
                  <div className="text-center py-8 border rounded-md bg-gray-50">
                    <Video className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-gray-500">{t("No videos added yet")}</p>
                    <p className="text-sm text-gray-400">{t("Add a YouTube URL or upload a video file")}</p>
                  </div>
                ) : null}
                
                {/* Adaptive Streaming Controls (only visible when editing existing content with videos) */}
                {contentId && contentData.videoItems && contentData.videoItems.length > 0 && (
                  <div className="mt-6 p-4 bg-black/5 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                      <CloudLightning className="h-4 w-4 mr-1" />
                      {t("Adaptive Streaming")}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {t("Generate streaming manifests for improved playback across devices")}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            toast({
                              title: t("Processing"),
                              description: t("Starting HLS manifest generation..."),
                            });
                            
                            const res = await fetch(`/api/content/${contentId}/regenerate-streaming-hls`, {
                              method: 'POST'
                            });
                            
                            if (!res.ok) {
                              const errorData = await res.json();
                              throw new Error(errorData.message || 'Failed to generate streaming manifest');
                            }
                            
                            toast({
                              title: t("Success"),
                              description: t("HLS streaming manifest generation started. This may take several minutes to complete."),
                            });
                          } catch (error) {
                            toast({
                              title: t("Error"),
                              description: t("Failed to generate streaming manifest: ") + (error as Error).message,
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Film className="h-4 w-4 mr-1" />
                        {t("Generate HLS Manifest")}
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/content/${contentId}/streaming-status`);
                            
                            if (!res.ok) {
                              throw new Error('Failed to check streaming status');
                            }
                            
                            const data = await res.json();
                            
                            if (data.status) {
                              toast({
                                title: t("Streaming Status"),
                                description: data.status,
                              });
                            } else {
                              toast({
                                title: t("Streaming Status"),
                                description: t("No streaming information available"),
                              });
                            }
                          } catch (error) {
                            toast({
                              title: t("Error"),
                              description: t("Failed to check streaming status: ") + (error as Error).message,
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Info className="h-4 w-4 mr-1" />
                        {t("Check Status")}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {t("HLS streaming enables smooth playback at different quality levels based on network conditions")}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Video Preview Dialog */}
              {videoPreviewing && videoPreviewUrl && (
                <AlertDialog open={!!videoPreviewing} onOpenChange={() => setVideoPreviewing(null)}>
                  <AlertDialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{videoPreviewing.name}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="aspect-w-16 aspect-h-9 mt-4">
                      <video 
                        src={videoPreviewUrl} 
                        controls 
                        className="w-full rounded-md"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogAction>{t("Close")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* PDFs tab content */}
        <TabsContent value="pdfs">
          <Card>
            <CardHeader>
              <CardTitle>{t("PDF Documents")}</CardTitle>
              <CardDescription>
                {t("Add PDF documents to this lesson with custom names")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-medium mb-2">{t("Upload New PDF")}</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pdfName">{t("Document Name (Optional)")}</Label>
                    <Input
                      id="pdfName"
                      placeholder={t("Enter a descriptive name for this document")}
                      value={pdfName}
                      onChange={(e) => setPdfName(e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {t("If left blank, the filename will be used")}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="pdfFile">{t("PDF File")}</Label>
                    <div className="flex">
                      <input
                        id="pdfFile"
                        type="file"
                        accept="application/pdf"
                        onChange={handlePDFUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById("pdfFile")?.click()}
                        disabled={isUploading}
                        className="flex-1"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {uploadProgress}% {t("Uploading...")}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {t("Select PDF File")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {isUploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* PDF List */}
              <div>
                <h3 className="font-medium mb-2">{t("Current Documents")}</h3>
                {contentData.pdfItems && contentData.pdfItems.length > 0 ? (
                  <div className="space-y-3">
                    {contentData.pdfItems.map((pdf, index) => (
                      <div 
                        key={`pdf-${index}`} 
                        className="flex items-center justify-between p-3 border rounded-md bg-white"
                      >
                        <div className="flex items-center space-x-3">
                          <File className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="font-medium">{pdf.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[300px]">
                              {pdf.url.split('/').pop()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => movePDF(index, 'up')}
                            disabled={index === 0}
                            className="h-8 w-8 p-0"
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => movePDF(index, 'down')}
                            disabled={index === (contentData.pdfItems?.length || 0) - 1}
                            className="h-8 w-8 p-0"
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.open(pdf.url, '_blank')}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => removePDF(index)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-md bg-gray-50">
                    <File className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-gray-500">{t("No documents uploaded yet")}</p>
                  </div>
                )}
              </div>
              
              {/* PDF Preview Dialog */}
              {pdfPreviewing && (
                <AlertDialog open={!!pdfPreviewing} onOpenChange={() => setPdfPreviewing(null)}>
                  <AlertDialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{pdfPreviewing.name}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="mt-4 h-[500px]">
                      <iframe 
                        src={pdfPreviewing.url} 
                        className="w-full h-full rounded-md"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogAction>{t("Close")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Confirmation Dialog for Unsaved Changes */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Unsaved Changes")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("You have unsaved changes. Are you sure you want to leave without saving?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => navigate(`/admin/content-manager/${courseId}`)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t("Leave Without Saving")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}