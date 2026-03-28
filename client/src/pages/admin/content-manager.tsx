import { useState, useEffect } from "react";

import { Course, Content, VideoItem, PDFItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AccessibleFileUpload } from "@/components/ui/accessible-file-upload";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription, 
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Video, 
  FileQuestion, 
  File, 
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Layers,
  ChevronLeft,
  Eye
} from "lucide-react";

export default function ContentManager() {
  const { courseId } = useParams();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentType, setContentType] = useState<string>("text");
  const [isFileUploading, setIsFileUploading] = useState(false);
  
  // Video items state for multiple videos
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  
  // Form data states
  const [contentData, setContentData] = useState({
    title: "",
    thumbnailUrl: "",
    textContent: "",
    videoUrl: "",
    videoItems: [] as VideoItem[],
    pdfUrl: "",
    pdfItems: [] as PDFItem[],
    quizContent: "",
    // Legacy fields for compatibility
    type: "mixed", // Now using "mixed" as default
    content: "",
    order: 1,
    display_order: '["video","text","pdf","quiz"]', // Default display order
  });
  
  // File upload states
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    fileType: string;
    fileName: string;
  } | null>(null);
  
  const [uploadedThumbnail, setUploadedThumbnail] = useState<{
    fileUrl: string;
    fileType: string;
    fileName: string;
  } | null>(null);
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Get course details
  const { data: course, isLoading: isLoadingCourse } = useQuery<Course>({
    queryKey: ["/api/courses", courseId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${courseId}`);
      return res.json();
    },
    enabled: !!courseId,
  });

  // Get contents for the course
  const { data: contents, isLoading: isLoadingContents, refetch: refetchContents } = useQuery<Content[]>({
    queryKey: ["/api/courses", courseId, "contents"],
    queryFn: async () => {
      if (!courseId) return [];
      const res = await apiRequest("GET", `/api/courses/${courseId}/contents`);
      return res.json();
    },
    enabled: !!courseId,
  });
  
  // WebSocket handler for real-time updates
  useEffect(() => {
    if (!courseId) return;
    
    // Handler for WebSocket messages
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Listen for content events related to this course
        if (
          (data.type === 'content-created' || 
           data.type === 'content-updated' || 
           data.type === 'content-deleted') && 
          data.courseId === parseInt(courseId)
        ) {
          console.log(`Received WebSocket event: ${data.type} for courseId: ${data.courseId}`);
          // Refetch contents to get the latest data with updated order
          refetchContents();
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
    
    // Add event listener for WebSocket messages
    window.addEventListener('websocket-message', (e: any) => {
      handleWebSocketMessage(e.detail);
    });
    
    // Cleanup
    return () => {
      window.removeEventListener('websocket-message', (e: any) => {
        handleWebSocketMessage(e.detail);
      });
    };
  }, [courseId, refetchContents]);

  // Create content mutation
  const createContentMutation = useMutation({
    mutationFn: async (data: { 
      courseId: number;
      title: string; 
      thumbnailUrl?: string;
      textContent?: string;
      videoUrl?: string;
      videoItems?: VideoItem[];
      pdfUrl?: string;
      pdfItems?: PDFItem[];
      quizContent?: string;
      type: string; 
      content: string; 
      order: number;
      display_order: string;
    }) => {
      console.log("Creating content with data:", JSON.stringify(data, null, 2));
      
      try {
        const res = await apiRequest("POST", "/api/contents", data);
        console.log("Content creation response status:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Error response from server:", errorText);
          throw new Error(`Failed to create content: ${res.statusText}`);
        }
        
        const responseData = await res.json();
        console.log("Content creation successful, response:", responseData);
        return responseData;
      } catch (error) {
        console.error("Content creation exception:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Content creation mutation succeeded:", data);
      setContentDialogOpen(false);
      setContentData({ 
        title: "", 
        thumbnailUrl: "",
        textContent: "",
        videoUrl: "",
        videoItems: [],
        pdfUrl: "",
        pdfItems: [],
        quizContent: "",
        type: "mixed", 
        content: "", 
        order: 1,
        display_order: '["video","text","pdf","quiz"]',
      });
      setUploadedFile(null);
      setUploadedThumbnail(null);
      
      // Invalidate relevant query
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "contents"] });
    },
    onError: (error: Error) => {
      console.error("Content creation mutation failed:", error.message);
      alert(`Failed to add content: ${error.message}`);
    },
  });

  // Update content order mutation
  const updateContentOrderMutation = useMutation({
    mutationFn: async ({ contentId, newOrder }: { contentId: number; newOrder: number }) => {
      const res = await apiRequest("PATCH", `/api/contents/${contentId}/order`, { order: newOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "contents"] });
    },
    onError: (error: Error) => {
      console.error("Failed to update content order:", error.message);
    },
  });
  
  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: async (data: { 
      id: number;
      title: string; 
      thumbnailUrl?: string;
      textContent?: string;
      videoUrl?: string;
      videoItems?: VideoItem[];
      pdfUrl?: string;
      pdfItems?: PDFItem[];
      quizContent?: string;
      type: string; 
      content: string; 
      order: number;
      display_order: string;
    }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PUT", `/api/contents/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "contents"] });
      setSelectedContent(null);
      setContentDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error("Failed to update content:", error.message);
    },
  });
  
  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: number) => {
      await apiRequest("DELETE", `/api/contents/${contentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "contents"] });
      setSelectedContent(null);
    },
    onError: (error: Error) => {
      console.error("Failed to delete content:", error.message);
    },
  });

  // Handle file uploads
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    // Show diagnostic toast for videos
    if (fileType === 'video') {
      toast({
        title: "Video upload starting",
        description: `Name: ${file.name}, Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        duration: 4000,
      });
    }

    console.log(`Starting upload for ${fileType} file: ${file.name}, size: ${file.size} bytes`);

    // Import browser compatibility functions
    const { detectBrowser, checkUploadCapability, logBrowserInfo } = await import('@/lib/browser-compatibility');
    
    // Log browser info for diagnostics
    logBrowserInfo();
    
    // Create form data and append file
    const formData = new FormData();
    formData.append("file", file);

    // Add diagnostic information to help with debugging
    formData.append("originalFilename", file.name);
    formData.append("fileSize", file.size.toString());
    formData.append("fileType", file.type);
    formData.append("browser", detectBrowser().name);

    setIsFileUploading(true);
    setUploadProgress(0);

    try {
      // Use different endpoints based on file type
      const endpointUrl = fileType === 'thumbnail' 
        ? "/api/upload/thumbnail" 
        : "/api/upload/content-file";
      
      console.log(`Using endpoint: ${endpointUrl}`);
      
      // Create a unique request ID for tracking this upload in logs
      const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      formData.append("requestId", requestId);
      
      // Use XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      
      // Set longer timeout for larger files (10 minutes base + 1 minute per 10MB)
      const baseTimeout = 10 * 60 * 1000; // 10 minutes base
      const additionalTimeout = Math.floor(file.size / (10 * 1024 * 1024)) * 60 * 1000; // 1 min per 10MB
      xhr.timeout = baseTimeout + additionalTimeout;
      
      console.log(`Setting XMLHttpRequest timeout to ${xhr.timeout}ms for ${file.size} bytes`);
      
      // Create a progress tracking variable to detect stalled uploads
      let lastProgress = { time: Date.now(), loaded: 0 };
      const progressCheckInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastProgress = now - lastProgress.time;
        // If no progress for more than 30 seconds, show a warning
        if (timeSinceLastProgress > 30000 && lastProgress.loaded > 0) {
          console.warn(`Upload appears stalled. No progress in ${Math.round(timeSinceLastProgress/1000)}s`);
          toast({
            title: "Upload Warning",
            description: `Upload appears slow. No progress in ${Math.round(timeSinceLastProgress/1000)} seconds.`,
            variant: "destructive",
          });
        }
      }, 10000);
      
      // Create a promise to handle the async XHR
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.open('POST', endpointUrl, true);
        
        // Include credentials (cookies) - this is critical for authentication to work
        xhr.withCredentials = true;
        
        // Set necessary headers for authenticated cross-origin requests
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            console.log(`Upload progress: ${percentComplete}%, ${event.loaded}/${event.total} bytes`);
            setUploadProgress(percentComplete);
            
            // Update the last progress tracker
            lastProgress = { time: Date.now(), loaded: event.loaded };
          }
        };
        
        // Handle completion
        xhr.onload = () => {
          clearInterval(progressCheckInterval);
          console.log(`Upload complete with status: ${xhr.status}, response: ${xhr.responseText.substring(0, 100)}...`);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              console.log("Upload result:", result);
              resolve(result);
            } catch (e) {
              console.error("Failed to parse response:", e);
              toast({
                title: "Upload Error",
                description: "Failed to parse server response.",
                variant: "destructive",
              });
              reject(new Error('Invalid response format'));
            }
          } else {
            console.error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`);
            toast({
              title: "Upload Failed",
              description: `Server responded with status ${xhr.status}: ${xhr.statusText}`,
              variant: "destructive",
            });
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        
        // Handle timeout
        xhr.ontimeout = () => {
          clearInterval(progressCheckInterval);
          console.error(`Upload timed out after ${xhr.timeout}ms`);
          toast({
            title: "Upload Timeout",
            description: `Upload timed out after ${Math.round(xhr.timeout/1000)} seconds.`,
            variant: "destructive",
          });
          reject(new Error(`Upload timed out after ${xhr.timeout}ms`));
        };
        
        // Handle errors
        xhr.onerror = (e) => {
          clearInterval(progressCheckInterval);
          console.error("Network error during upload:", e);
          toast({
            title: "Network Error",
            description: "Connection problem while uploading. Check your internet connection.",
            variant: "destructive",
          });
          reject(new Error('Network error during upload'));
        };
        
        console.log("Starting upload now...");
        // Send the form data
        xhr.send(formData);
      });
      
      // Wait for upload completion
      console.log("Awaiting upload completion...");
      const result = await uploadPromise;
      console.log("Upload completed successfully:", result);
      
      // Update appropriate field based on file type
      if (fileType === 'thumbnail') {
        setUploadedThumbnail(result);
        setContentData({
          ...contentData,
          thumbnailUrl: result.fileUrl,
        });
      } else if (fileType === 'video') {
        setUploadedFile(result);
        
        // Default video name based on file name
        const fileName = result.fileName || 'Untitled Video';
        const videoName = fileName.split('.')[0]; // Remove extension
        
        // Create a new video item
        const newVideoItem: VideoItem = {
          name: videoName,
          url: result.fileUrl
        };
        
        // Update state with new video using functional update to ensure we have latest state
        setContentData(current => {
          // Make a deep copy of current videoItems, defaulting to empty array if undefined
          const updatedVideoItems = [...(current.videoItems || []), newVideoItem];
          console.log("Updated video items array:", updatedVideoItems);
          
          return {
            ...current,
            videoUrl: result.fileUrl, // Keep for backward compatibility
            videoItems: updatedVideoItems,
            content: result.fileUrl, // For backward compatibility
          };
        });
        
        // Log the state after update to verify
        setTimeout(() => {
          console.log("Content data state after video upload:", contentData);
        }, 0);
      } else if (fileType === 'pdf') {
        setUploadedFile(result);
        
        // Default PDF name based on file name
        const fileName = result.fileName || 'Untitled PDF';
        const pdfName = fileName.split('.')[0]; // Remove extension
        
        // Create a new PDF item
        const newPDFItem: PDFItem = {
          name: pdfName,
          url: result.fileUrl
        };
        
        // Update state with new PDF using functional update to ensure we have latest state
        setContentData(current => {
          // Make a deep copy of current pdfItems, defaulting to empty array if undefined
          const updatedPdfItems = [...(current.pdfItems || []), newPDFItem];
          console.log("Updated PDF items array:", updatedPdfItems);
          
          return {
            ...current,
            pdfUrl: result.fileUrl, // Keep for backward compatibility
            pdfItems: updatedPdfItems,
            content: result.fileUrl, // For backward compatibility
          };
        });
        
        // Log the state after update to verify
        setTimeout(() => {
          console.log("Content data state after PDF upload:", contentData);
        }, 0);
      }

      console.log("File uploaded successfully:", fileType);
    } catch (error) {
      console.error("File upload failed:", error instanceof Error ? error.message : String(error));
    } finally {
      setIsFileUploading(false);
    }
  };

  // Handle content form submission
  const handleContentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    console.log("Form submit - content data:", JSON.stringify(contentData, null, 2));

    // Check if videoItems is properly populated
    if (contentData.videoItems && contentData.videoItems.length > 0) {
      console.log("Video items count:", contentData.videoItems.length);
      console.log("First video item:", JSON.stringify(contentData.videoItems[0], null, 2));
    } else {
      console.log("No video items to include");
    }

    // Prepare content summary for legacy compatibility
    const contentSummary = `Mixed content: ${contentData.textContent ? 'Text, ' : ''}${
      contentData.videoItems?.length > 0 ? `${contentData.videoItems.length} Video(s), ` : 
      contentData.videoUrl ? 'Video, ' : ''
    }${
      contentData.pdfItems?.length > 0 ? `${contentData.pdfItems.length} PDF(s), ` : 
      contentData.pdfUrl ? 'PDF, ' : ''
    }${contentData.quizContent ? 'Quiz' : ''}`.replace(/, $/, '');

    // Create content payload (ensure title is never empty)
    const contentPayload = {
      courseId: parseInt(courseId),
      title: contentData.title.trim() || "Untitled Content", // Prevent empty titles
      thumbnailUrl: contentData.thumbnailUrl,
      textContent: contentData.textContent,
      videoUrl: contentData.videoUrl,
      videoItems: contentData.videoItems || [], // Ensure we always send an array even if empty
      pdfUrl: contentData.pdfUrl,
      pdfItems: contentData.pdfItems || [], // Ensure we always send an array even if empty
      quizContent: contentData.quizContent,
      type: "mixed",
      content: contentSummary || contentData.content, // For backward compatibility
      order: contentData.order,
      display_order: contentData.display_order, // Include display order for video playback mode
    };

    console.log("Submitting content payload:", JSON.stringify(contentPayload, null, 2));

    try {
      if (selectedContent) {
        // Update existing content
        console.log("Updating content ID:", selectedContent.id);
        updateContentMutation.mutate({
          id: selectedContent.id,
          ...contentPayload
        });
      } else {
        // Create new content
        console.log("Creating new content");
        createContentMutation.mutate(contentPayload);
      }
    } catch (error) {
      console.error("Error submitting content:", error);
    }
  };

  // Get toast function for notifications
  const { toast } = useToast();
  
  // Handle content reordering
  const handleMoveContent = async (content: Content, direction: 'up' | 'down') => {
    if (!contents) return;
    
    const currentIndex = contents.findIndex(c => c.id === content.id);
    let newOrder: number;
    
    if (direction === 'up' && currentIndex > 0) {
      // Moving up - take the order of the previous item minus 1
      newOrder = contents[currentIndex - 1].order - 1;
    } else if (direction === 'down' && currentIndex < contents.length - 1) {
      // Moving down - take the order of the next item plus 1
      newOrder = contents[currentIndex + 1].order + 1;
    } else {
      return; // Can't move further up or down
    }
    
    try {
      // Show a loading toast
      toast({
        title: "Updating order...",
        description: `Moving ${content.title} ${direction}`,
      });
      
      // Use await to make sure we wait for the mutation to complete
      await updateContentOrderMutation.mutateAsync({ contentId: content.id, newOrder });
      
      console.log(`Content '${content.title}' moved ${direction} to order ${newOrder}`);
      
      // Force a complete reload of the page
      if (courseId) {
        // Force reload the current page
        window.location.reload();
      }
    } catch (error) {
      console.error(`Error moving content ${direction}:`, error);
      toast({
        title: "Error updating order",
        description: `Could not move ${content.title} ${direction}`,
        variant: "destructive",
      });
    }
  };

  // No need to manually set the order for new content anymore
  // The server will automatically place new content at the end of the list
  // This removes any chance of order conflicts between client and server

  if (isLoadingCourse) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">Error</h3>
        <p className="text-sm mt-1">Course not found</p>
      </div>
    );
  }

  return (
    <div className="container py-3 px-4">
      {/* Compact sticky header */}
      <div className="sticky top-0 z-40 bg-white py-2 px-3 mb-3 rounded-md shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/admin/courses")}
            className="h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">{t("Back to Courses")}</span>
          </Button>
          <h1 className="text-lg sm:text-xl font-medium truncate max-w-[180px] sm:max-w-md">
            {course.title}
          </h1>
        </div>
        <Button 
          onClick={() => {
            setContentData({
              title: "",
              thumbnailUrl: "",
              textContent: "",
              videoUrl: "",
              videoItems: [],
              pdfUrl: "",
              pdfItems: [],
              quizContent: "",
              type: "mixed",
              content: "",
              order: 0, // The server will automatically set the correct order
              display_order: '["video","text","pdf","quiz"]',
            });
            setContentDialogOpen(true);
          }}
          className="bg-black text-white hover:bg-gray-800 h-8 px-3"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">{t("Add Content")}</span>
        </Button>
      </div>
      
      {/* More compact card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="py-3 px-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-base">{t("Course Content")}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {t("Manage content for this course")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          {isLoadingContents ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : contents && contents.length > 0 ? (
            <div className="space-y-2">
              {contents
                .sort((a, b) => a.order - b.order)
                .map((content) => (
                  <div 
                    key={content.id} 
                    className="flex justify-between items-center border rounded-md py-2 px-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="flex-shrink-0">
                        {content.thumbnailUrl ? (
                          <img 
                            src={content.thumbnailUrl} 
                            alt={content.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            {getContentTypeIcon(content.type)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-normal bg-gray-50 text-xs h-5 px-1">
                            #{content.order}
                          </Badge>
                          <h3 className="font-medium text-sm truncate w-[180px] sm:w-auto">
                            {content.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {((content.videoItems && content.videoItems.length > 0) || (content as any).youtubeUrl) && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs py-0 px-1.5">
                              <Video className="h-2.5 w-2.5 mr-0.5" />
                              {(content as any).youtubeUrl ? "YouTube" : content.videoItems?.length || 0}
                            </Badge>
                          )}
                          {content.pdfItems && content.pdfItems.length > 0 && (
                            <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 text-xs py-0 px-1.5">
                              <File className="h-2.5 w-2.5 mr-0.5" />
                              {content.pdfItems.length}
                            </Badge>
                          )}
                          {content.textContent && (
                            <Badge variant="secondary" className="bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs py-0 px-1.5">
                              <FileText className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                          {content.quizContent && (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 text-xs py-0 px-1.5">
                              <FileQuestion className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedContent(content);
                          setContentData({
                            title: content.title,
                            thumbnailUrl: content.thumbnailUrl || "",
                            textContent: content.textContent || "",
                            videoUrl: content.videoUrl || "",
                            videoItems: content.videoItems || [],
                            pdfUrl: content.pdfUrl || "",
                            pdfItems: content.pdfItems || [],
                            quizContent: content.quizContent || "",
                            type: content.type,
                            content: content.content,
                            order: content.order,
                            display_order: content.display_order || '["video","text","pdf","quiz"]',
                          });
                          setContentDialogOpen(true);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveContent(content, 'up')}
                        disabled={contents.indexOf(content) === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveContent(content, 'down')}
                        disabled={contents.indexOf(content) === contents.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("Are you sure you want to delete this content?"))) {
                            deleteContentMutation.mutate(content.id);
                          }
                        }}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <Layers className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <h3 className="text-base font-medium mb-1">{t("No content yet")}</h3>
              <p className="text-xs">{t("Add your first lesson to this course.")}</p>
            </div>
          )}
          
          {/* Duplicate Add Content button at the bottom of the page */}
          <div className="flex justify-center mt-4">
            <Button 
              onClick={() => {
                setContentData({
                  title: "",
                  thumbnailUrl: "",
                  textContent: "",
                  videoUrl: "",
                  videoItems: [],
                  pdfUrl: "",
                  pdfItems: [],
                  quizContent: "",
                  type: "mixed",
                  content: "",
                  order: 0, // The server will automatically set the correct order
                  display_order: '["video","text","pdf","quiz"]',
                });
                setContentDialogOpen(true);
              }}
              className="bg-black text-white hover:bg-gray-800 w-full md:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("Add Content")}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Content Creation/Edit Dialog */}
      <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContent ? t("Edit Content") : t("Add Content")}
            </DialogTitle>
            <DialogDescription>
              {t("Create or modify content for this course")}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleContentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="title">{t("Title")}</Label>
                <Input
                  id="title"
                  value={contentData.title}
                  onChange={(e) => setContentData({ ...contentData, title: e.target.value })}
                  placeholder={t("Enter content title")}
                  required
                />
              </div>
              
              {/* Order field removed - ordering is now handled automatically */}
              
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="thumbnail">{t("Thumbnail")}</Label>
                <div className="flex gap-2 items-start">
                  <Input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'thumbnail')}
                    className="flex-1"
                  />
                  {contentData.thumbnailUrl && (
                    <div className="w-16 h-16 rounded overflow-hidden border border-gray-200">
                      <img 
                        src={contentData.thumbnailUrl} 
                        alt="Thumbnail" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                {isFileUploading && (
                  <Progress value={uploadProgress} className="w-full h-2" />
                )}
              </div>
              
              <Tabs defaultValue="video" className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="video">
                    <Video className="h-4 w-4 mr-2" />
                    {t("Video")}
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <FileText className="h-4 w-4 mr-2" />
                    {t("Text")}
                  </TabsTrigger>
                  <TabsTrigger value="pdf">
                    <File className="h-4 w-4 mr-2" />
                    {t("PDF")}
                  </TabsTrigger>
                  <TabsTrigger value="quiz">
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {t("Quiz")}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="video" className="mt-3">
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t("Video Upload")}</AlertTitle>
                      <AlertDescription>
                        {t("Upload video files directly. Supported formats: MP4, WEBM.")}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="video">{t("Upload Video")}</Label>
                      <Input
                        id="video"
                        type="file"
                        accept="video/mp4,video/webm,video/ogg"
                        onChange={(e) => {
                          console.log("Video file selected, starting upload...");
                          handleFileUpload(e, 'video');
                        }}
                      />
                      {isFileUploading && (
                        <div>
                          <Progress value={uploadProgress} className="w-full h-2" />
                          <p className="text-sm text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Display list of added videos */}
                    {contentData.videoItems && contentData.videoItems.length > 0 ? (
                      <div className="space-y-3 mt-4">
                        <Label>{t("Added Videos")}</Label>
                        <div className="space-y-2">
                          {contentData.videoItems.map((video, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-2 border rounded-md"
                            >
                              <div className="flex items-center">
                                <Video className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{video.name}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(video.url, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  onClick={() => {
                                    // Use functional update to avoid race conditions
                                    setContentData(current => ({
                                      ...current,
                                      videoItems: current.videoItems.filter((_, i) => i !== index)
                                    }));
                                    console.log("Video removed at index:", index);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
                
                <TabsContent value="text" className="mt-3">
                  <div className="space-y-3">
                    <Label htmlFor="textContent">{t("Text Content")}</Label>
                    <Textarea
                      id="textContent"
                      value={contentData.textContent || ""}
                      onChange={(e) => setContentData({ ...contentData, textContent: e.target.value })}
                      placeholder={t("Enter text content (supports HTML)")}
                      rows={8}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="pdf" className="mt-3">
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t("PDF Upload")}</AlertTitle>
                      <AlertDescription>
                        {t("Upload PDF documents. These will be available for students to read or download.")}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="pdf">{t("Upload PDF")}</Label>
                      <Input
                        id="pdf"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          console.log("PDF file selected, starting upload...");
                          handleFileUpload(e, 'pdf');
                        }}
                      />
                      {isFileUploading && (
                        <div>
                          <Progress value={uploadProgress} className="w-full h-2" />
                          <p className="text-sm text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Display list of added PDFs */}
                    {contentData.pdfItems && contentData.pdfItems.length > 0 ? (
                      <div className="space-y-3 mt-4">
                        <Label>{t("Added PDFs")}</Label>
                        <div className="space-y-2">
                          {contentData.pdfItems.map((pdf, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-2 border rounded-md"
                            >
                              <div className="flex items-center">
                                <File className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{pdf.name}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(pdf.url, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  onClick={() => {
                                    // Use functional update to avoid race conditions
                                    setContentData(current => ({
                                      ...current,
                                      pdfItems: current.pdfItems.filter((_, i) => i !== index)
                                    }));
                                    console.log("PDF removed at index:", index);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
                
                <TabsContent value="quiz" className="mt-3">
                  <div className="space-y-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t("Quiz Creation")}</AlertTitle>
                      <AlertDescription>
                        {t("Create a quiz in JSON format with questions and answers.")}
                      </AlertDescription>
                    </Alert>
                    
                    <Label htmlFor="quizContent">{t("Quiz Content (JSON format)")}</Label>
                    <Textarea
                      id="quizContent"
                      value={contentData.quizContent || ""}
                      onChange={(e) => setContentData({ ...contentData, quizContent: e.target.value })}
                      placeholder={`[
  {
    "question": "What is your question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0
  }
]`}
                      rows={8}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContentDialogOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button 
                type="button" 
                className="bg-black text-white hover:bg-gray-800"
                onClick={(e) => {
                  e.preventDefault();
                  handleContentSubmit(e as React.FormEvent);
                }}
              >
                {selectedContent ? t("Update Content") : t("Add Content")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}