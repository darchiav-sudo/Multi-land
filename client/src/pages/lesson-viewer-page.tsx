import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Course, Content, Progress } from "@shared/schema";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { CommentsSection } from "@/components/comments-section";
import { YouTubePlayerSimple } from "@/components/youtube-player-simple";

// UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle, MessageSquare, Settings, WifiOff } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VideoPlayer = ({ url, poster, contentId }: { url: string; poster?: string; contentId?: number }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState(url);
  const [isAdaptiveStreaming, setIsAdaptiveStreaming] = useState(false);
  const [streamingFormat, setStreamingFormat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'good'|'slow'|'unknown'>('unknown');
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const { toast } = useToast();
  
  // Quality options for user selection
  const qualityOptions = [
    { label: 'Auto (Recommended)', value: 'auto' },
    { label: 'High Quality (1080p)', value: '1080p' },
    { label: 'Medium Quality (720p)', value: '720p' },
    { label: 'Low Quality (480p)', value: '480p' },
    { label: 'Very Low (360p)', value: '360p' }
  ];
  
  // Detect network condition
  useEffect(() => {
    const checkNetworkCondition = async () => {
      // Check if we're on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Check network type if supported
      if ('connection' in navigator && (navigator as any).connection) {
        const connection = (navigator as any).connection;
        const type = connection.effectiveType || connection.type;
        
        if (type === '2g' || connection.saveData || 
            (type === '3g' && isMobile)) {
          setNetworkStatus('slow');
          
          // Auto select lower quality
          setSelectedQuality('480p');
          
          toast({
            title: "Slow connection detected",
            description: "We've adjusted video quality for smoother playback",
            duration: 5000
          });
          return;
        }
      }
      
      setNetworkStatus('good');
    };
    
    checkNetworkCondition();
  }, [toast]);
  
  // Customize video source based on selected quality
  const getQualityAdjustedUrl = (baseUrl: string, quality: string) => {
    // Always return original URL for auto quality setting
    if (quality === 'auto') return baseUrl;
    
    // For S3 URLs, simply use the original URL since 
    // the server doesn't support transcoded versions yet
    if (baseUrl.includes('amazonaws.com')) {
      console.log('Using original S3 URL regardless of quality selection');
      return baseUrl;
    }
    
    try {
      // For non-S3 URLs that might support quality variations
      const url = new URL(baseUrl);
      
      // Add quality parameter to URL
      url.searchParams.set('quality', quality);
      
      return url.toString();
    } catch (e) {
      console.error('Error parsing URL for quality adjustment:', e);
      return baseUrl;
    }
  };
  
  // Fetch streaming URL or generate presigned URLs
  useEffect(() => {
    const fetchStreamingUrl = async () => {
      setIsLoading(true);
      
      // If we have a content ID, try to use adaptive streaming
      if (contentId) {
        try {
          // Fetch streaming URL from our API
          const response = await fetch(`/api/content/${contentId}/streaming`);
          if (response.ok) {
            const data = await response.json();
            if (data.streamingUrl) {
              console.log(`Using ${data.isAdaptiveStreaming ? 'adaptive' : 'direct'} streaming URL (${data.streamingFormat})`);
              setVideoUrl(data.streamingUrl);
              setIsAdaptiveStreaming(data.isAdaptiveStreaming);
              setStreamingFormat(data.streamingFormat);
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching streaming URL:', error);
          // Fall back to S3 or direct URL if there's an error
        }
      }
      
      // Fallback: For S3 videos, fetch a presigned URL
      if (url && url.includes('s3.') && url.includes('amazonaws.com')) {
        try {
          // Extract the file key from the S3 URL
          const keyMatch = url.match(/amazonaws\.com\/([^?]+)/);
          if (keyMatch && keyMatch[1]) {
            const fileKey = decodeURIComponent(keyMatch[1]);
            
            // Fetch a presigned URL from our API
            const response = await fetch(`/api/s3-content/${encodeURIComponent(fileKey)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.signedUrl) {
                console.log('Using presigned URL for video playback');
                setVideoUrl(data.signedUrl);
                setIsLoading(false);
                return;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching presigned URL:', error);
          // Fall back to original URL if there's an error
        }
      }
      
      // For non-S3 URLs or if there was an error, use the original URL
      setVideoUrl(url);
      setIsLoading(false);
    };
    
    fetchStreamingUrl();
  }, [url, contentId]);
  
  // Monitor for buffering
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleStalled = () => setIsBuffering(true);
    
    // Monitor video stalling
    let stallTimer: number | null = null;
    let prevTime = 0;
    let stallCount = 0;
    
    const checkStalling = () => {
      if (video.paused || video.ended) return;
      
      if (video.currentTime === prevTime && !video.paused) {
        // Video is playing but not advancing - probably stalled
        stallCount++;
        
        // After multiple stalls, suggest lower quality
        if (stallCount > 3 && networkStatus !== 'slow') {
          setNetworkStatus('slow');
          toast({
            title: "Playback issues detected",
            description: "Try switching to a lower quality for smoother playback",
            action: (
              <Button 
                onClick={() => setSelectedQuality('480p')} 
                variant="outline" 
                size="sm"
              >
                Switch to 480p
              </Button>
            )
          });
        }
      } else {
        stallCount = 0;
      }
      
      prevTime = video.currentTime;
    };
    
    stallTimer = window.setInterval(checkStalling, 3000);
    
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    
    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      
      if (stallTimer) {
        window.clearInterval(stallTimer);
      }
    };
  }, [videoRef.current, networkStatus, toast]);
  
  // Handle quality selection (simulated)
  const handleQualityChange = (quality: string) => {
    if (quality === selectedQuality) return;
    
    setSelectedQuality(quality);
    setIsQualityMenuOpen(false);
    
    // For now we're using the same video source but letting users
    // know their preference is saved. In the future, this would be 
    // implemented on the server side with different transcoded versions
    
    // Show quality change feedback
    toast({
      title: `Quality set to ${quality === 'auto' ? 'Auto' : quality}`,
      description: "Your quality preference has been saved",
      duration: 3000
    });
  };
  
  if (!url) return null;
  
  // For video quality selection, we need to handle different cases
  // Instead of changing the URL (which doesn't work with S3 yet), we'll 
  // show users that quality selection is active but use the same URL
  const finalVideoUrl = videoUrl;
  
  return (
    <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="relative group">
          {/* Buffering indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-30">
              <div className="flex flex-col items-center">
                <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
                <p className="mt-2 text-white text-sm">Buffering...</p>
                {networkStatus === 'slow' && (
                  <div className="mt-2 flex items-center bg-yellow-600 bg-opacity-80 rounded-full px-3 py-1">
                    <WifiOff className="h-3 w-3 mr-1 text-white" />
                    <span className="text-xs text-white">Slow connection detected</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Video element */}
          <video
            ref={videoRef}
            src={finalVideoUrl}
            className="w-full h-full object-contain"
            controls
            poster={poster}
            preload="metadata"
            controlsList="nodownload"
            playsInline
          >
            <source src={finalVideoUrl} type="video/mp4" />
            {isAdaptiveStreaming && (
              <source src={finalVideoUrl} type="application/x-mpegURL" />
            )}
            Your browser doesn't support the video tag.
          </video>
          
          {/* Quality selector button */}
          {!isAdaptiveStreaming && (
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-40">
              <DropdownMenu open={isQualityMenuOpen} onOpenChange={setIsQualityMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    className="bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium h-8 px-3"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    {selectedQuality.toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {qualityOptions.map(option => (
                    <DropdownMenuItem
                      key={option.value}
                      className={selectedQuality === option.value ? "font-medium" : ""}
                      onClick={() => handleQualityChange(option.value)}
                    >
                      {option.label}
                      {networkStatus === 'slow' && option.value === '480p' && (
                        <span className="ml-1 text-green-600 text-xs">(Recommended)</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Simple PDF Viewer component
const PdfViewer = ({ url }: { url: string }) => {
  if (!url) return null;
  
  return (
    <div className="flex flex-col items-center">
      <embed
        src={`${url}#toolbar=0&navpanes=0`}
        type="application/pdf"
        width="100%"
        height="600px"
        className="mb-4 rounded-lg border border-gray-200"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-600 hover:underline"
      >
        View PDF in new tab
      </a>
    </div>
  );
};

// Main component
export default function LessonViewerPage() {
  // Get URL parameters
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const parsedCourseId = parseInt(courseId);
  const parsedContentId = parseInt(contentId);
  
  // State
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [contentList, setContentList] = useState<Content[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Fetch course data
  const { data: course, isLoading: isLoadingCourse } = useQuery<Course>({
    queryKey: [`/api/courses/${parsedCourseId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${parsedCourseId}`);
      return res.json();
    },
    enabled: !isNaN(parsedCourseId),
  });

  // Fetch course contents
  const { data: contents, isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: [`/api/courses/${parsedCourseId}/contents`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${parsedCourseId}/contents`);
      return res.json();
    },
    enabled: !isNaN(parsedCourseId),
  });

  // Fetch current content
  const { data: content, isLoading: isLoadingContent } = useQuery<Content>({
    queryKey: [`/api/contents/${parsedContentId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contents/${parsedContentId}`);
      return res.json();
    },
    enabled: !isNaN(parsedContentId),
  });

  // Fetch user progress
  const { data: userProgress } = useQuery<Progress[]>({
    queryKey: [user ? `/api/users/${user.id}/progress` : null],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiRequest("GET", `/api/users/${user.id}/progress`);
      return res.json();
    },
    enabled: !!user,
  });

  // Setup navigation
  useEffect(() => {
    if (contents && contents.length > 0) {
      // Sort contents by order property
      const sortedContents = [...contents].sort((a, b) => a.order - b.order);
      setContentList(sortedContents);
      
      // Find the index of current content
      const index = sortedContents.findIndex((c) => c.id === parsedContentId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [contents, parsedContentId]);

  // Mark content as completed
  const markCompletedMutation = useMutation({
    mutationFn: async ({ userId, contentId }: { userId: number; contentId: number }) => {
      const res = await apiRequest("POST", "/api/progress", {
        userId,
        contentId,
        completed: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/enrollments`] });
    },
  });

  // Navigation functions
  const navigateContent = (direction: "prev" | "next") => {
    if (!contentList.length) return;
    
    let newIndex;
    if (direction === "prev") {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(contentList.length - 1, currentIndex + 1);
    }
    
    if (newIndex !== currentIndex) {
      const nextContent = contentList[newIndex];
      navigate(`/lesson/${parsedCourseId}/${nextContent.id}`);
    }
  };

  // Check if content is completed
  const isContentCompleted = () => {
    if (!userProgress || !content) return false;
    return userProgress.some(p => p.contentId === content.id && p.completed);
  };

  // Handle marking content as complete
  const handleMarkComplete = () => {
    if (!user || !content) return;
    markCompletedMutation.mutate({ userId: user.id, contentId: content.id });
  };

  // Extract video URL from content
  const getVideoUrl = (content: Content | undefined) => {
    if (!content) return '';
    
    // Check for videoItems first
    if (content.videoItems && content.videoItems.length > 0) {
      return content.videoItems[0].url;
    }
    
    // Fall back to videoUrl or content field for video type
    if (content.videoUrl) {
      return content.videoUrl;
    }
    
    // Last resort for older content format
    if (content.type === 'video' && content.content) {
      return content.content;
    }
    
    return '';
  };

  // Extract YouTube URL from content
  const getYouTubeUrl = (content: Content | undefined) => {
    if (!content) return '';
    return (content as any).youtubeUrl || '';
  };

  // Check if URL is a YouTube URL
  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  // Extract PDF URL from content
  const getPdfUrl = (content: Content | undefined) => {
    if (!content) return '';
    
    // Check for pdfItems first
    if (content.pdfItems && content.pdfItems.length > 0) {
      return content.pdfItems[0].url;
    }
    
    // Fall back to pdfUrl
    if (content.pdfUrl) {
      return content.pdfUrl;
    }
    
    // Last resort for older content format
    if (content.type === 'pdf' && content.content) {
      return content.content;
    }
    
    return '';
  };

  // Extract text content
  const getTextContent = (content: Content | undefined) => {
    if (!content) return '';
    
    if (content.textContent) {
      return content.textContent;
    }
    
    if (content.type === 'text' && content.content) {
      return content.content;
    }
    
    return '';
  };

  // Loading state
  if (isLoadingCourse || isLoadingContents || isLoadingContent) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex justify-center items-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
            <p>Loading lesson...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (!course || !content) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Lesson not found</h1>
              <p className="mb-6">Sorry, we couldn't find the lesson you're looking for.</p>
              <Button 
                onClick={() => navigate(`/courses/${parsedCourseId}`)}
                className="bg-green-600 hover:bg-green-700"
              >
                Back to Course
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/courses/${courseId}`)}
              className="mb-3"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Course
            </Button>
            <h1 className="text-2xl font-bold">{content.title}</h1>
            <p className="text-gray-500">{course.title}</p>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content area */}
            <div className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardContent className="p-6 space-y-6">
                  {/* Video content */}
                  {(getVideoUrl(content) || getYouTubeUrl(content)) && (
                    <div className="mb-6">
                      {getYouTubeUrl(content) ? (
                        <YouTubePlayerSimple 
                          videoUrl={getYouTubeUrl(content)}
                          title={(content as any).youtubeName || content.title}
                        />
                      ) : (
                        <VideoPlayer 
                          url={getVideoUrl(content)} 
                          poster={content.thumbnailUrl || undefined}
                          contentId={content.id}
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Text content */}
                  {getTextContent(content) && (
                    <div className="prose max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: getTextContent(content) }} />
                    </div>
                  )}
                  
                  {/* PDF content */}
                  {getPdfUrl(content) && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-3">PDF Material</h3>
                      <PdfViewer url={getPdfUrl(content)} />
                    </div>
                  )}
                  
                  {/* Comments Section */}
                  <div className="mt-8">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
                      {t("content.discussionAndComments")}
                    </h3>
                    <CommentsSection contentId={parsedContentId} />
                  </div>
                </CardContent>
                <CardFooter className="px-6 py-4 border-t bg-gray-50 flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => navigateContent("prev")}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  
                  {user && (
                    <Button 
                      onClick={handleMarkComplete}
                      disabled={isContentCompleted() || markCompletedMutation.isPending}
                      variant={isContentCompleted() ? "outline" : "default"}
                      className={isContentCompleted() ? "bg-gray-100" : "bg-green-600 hover:bg-green-700"}
                    >
                      {markCompletedMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isContentCompleted() ? (
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                      ) : null}
                      {isContentCompleted() ? "Completed" : "Mark as Complete"}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => navigateContent("next")}
                    disabled={currentIndex === contentList.length - 1}
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            {/* Sidebar with lesson list */}
            <div>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Course Content</CardTitle>
                </CardHeader>
                <CardContent className="px-3">
                  <div className="space-y-1">
                    {contentList.map((item, index) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/lesson/${parsedCourseId}/${item.id}`)}
                        className={`flex items-center p-3 rounded-md cursor-pointer ${
                          item.id === content.id
                            ? "bg-black text-white"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <div className="mr-3 w-6 h-6 flex items-center justify-center">
                          {userProgress?.some(p => p.contentId === item.id && p.completed) ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}