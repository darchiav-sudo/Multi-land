
import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { isNative } from "@/lib/capacitor";
import { Loader2, Video, RefreshCw, Settings, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface MobileAwareVideoProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  useLegacyMode?: boolean;
  displayOrder?: string; // JSON string of content display order
  alternateQualities?: VideoQuality[]; // Optional array of alternative qualities
}

// Video quality definition
export interface VideoQuality {
  src: string;
  label: string;
  width?: number;
  height?: number;
  bitrate?: number;
  default?: boolean;
}

// Auto-detected network quality types
type NetworkQualityType = 'slow' | 'medium' | 'fast' | 'unknown';

// Simplified to focus on HTML5 player that works consistently on mobile
type PlayerType = 'html5';

// Cache video src to avoid duplicate network requests
const videoCache = new Map<string, string>();

// Store user quality preferences
const getUserQualityPreference = (): string | null => {
  return localStorage.getItem('video-quality-preference');
};

const setUserQualityPreference = (quality: string): void => {
  localStorage.setItem('video-quality-preference', quality);
};

// Network speed detection for automatic quality selection
const detectNetworkQuality = async (): Promise<NetworkQualityType> => {
  // This is a small file we'll use to test download speed
  const testUrl = '/assets/speed-test.json';
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(testUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return 'unknown';
    }
    
    await response.json(); // Ensure we download the full content
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Simple heuristic based on download time
    if (duration < 300) { // Less than 300ms is fast
      return 'fast';
    } else if (duration < 1000) { // Less than 1s is medium
      return 'medium';
    } else {
      return 'slow';
    }
  } catch (error) {
    console.error('Error detecting network quality:', error);
    return 'unknown';
  }
};

// Prefetch optimization for videos
const prefetchVideo = (src: string) => {
  if (!src || videoCache.has(src)) return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = src;
  link.as = 'video';
  document.head.appendChild(link);
  
  videoCache.set(src, src);
};

// Memoize the component for better performance
const MobileAwareVideo = memo(({ 
  src, 
  poster, 
  className, 
  title,
  useLegacyMode = false, // Default to modern mode for better performance
  displayOrder,
  alternateQualities = []
}: MobileAwareVideoProps) => {
  // Optimize state management
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [showQualitySelector, setShowQualitySelector] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQualityType>('unknown');
  const [isLoadingNetworkQuality, setIsLoadingNetworkQuality] = useState<boolean>(false);
  const [qualityOptions, setQualityOptions] = useState<VideoQuality[]>([]);
  const [activeQualitySrc, setActiveQualitySrc] = useState<string>(src);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [bufferingDuration, setBufferingDuration] = useState<number>(0);
  const [stalledVideo, setStalledVideo] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const qualitySelectorRef = useRef<HTMLDivElement>(null);
  const bufferingTimerRef = useRef<number | null>(null);
  const lastPlayPositionRef = useRef<number>(0);
  const lastPlayTimeRef = useRef<number>(Date.now());
  const positionCheckIntervalRef = useRef<number | null>(null);
  const isNativeApp = isNative();
  const { toast } = useToast();
  
  // Handle clicks outside the quality selector menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        qualitySelectorRef.current && 
        !qualitySelectorRef.current.contains(event.target as Node) &&
        showQualitySelector
      ) {
        setShowQualitySelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQualitySelector]);
  
  // Initialize quality options combining the default source with alternatives
  useEffect(() => {
    if (!src) return;
    
    // Determine quality label from the URL
    const getQualityLabelFromSrc = (sourceSrc: string): string => {
      if (sourceSrc.includes('720p')) return '720p';
      if (sourceSrc.includes('480p')) return '480p';
      if (sourceSrc.includes('360p')) return '360p';
      if (sourceSrc.includes('1080p')) return '1080p';
      if (sourceSrc.includes('2160p') || sourceSrc.includes('4k')) return '4K';
      return 'Auto';
    };
    
    // Create default quality option
    const mainQuality: VideoQuality = {
      src,
      label: getQualityLabelFromSrc(src),
      default: true
    };
    
    // Build complete quality options
    const allOptions = [mainQuality, ...alternateQualities].filter(
      // Filter out duplicates by source
      (option, index, self) => index === self.findIndex(t => t.src === option.src)
    );
    
    // Sort by resolution (assuming label has resolution info)
    const sortedOptions = allOptions.sort((a, b) => {
      // Custom sort based on common resolutions
      const qualityOrder: { [key: string]: number } = {
        '4K': 5,
        '2160p': 5,
        '1080p': 4,
        '720p': 3,
        '480p': 2,
        '360p': 1,
        'Auto': 0
      };
      
      const aValue = qualityOrder[a.label] ?? 0;
      const bValue = qualityOrder[b.label] ?? 0;
      
      return bValue - aValue; // Higher resolution first
    });
    
    setQualityOptions(sortedOptions);
    
    // Try to restore user preference
    const savedQuality = getUserQualityPreference();
    if (savedQuality) {
      const matchedQuality = sortedOptions.find(q => q.label === savedQuality);
      if (matchedQuality) {
        setSelectedQuality(matchedQuality.label);
        setActiveQualitySrc(matchedQuality.src);
      } else {
        // Default to the first option if saved preference isn't available
        const defaultQuality = sortedOptions.find(q => q.default) || sortedOptions[0];
        setSelectedQuality(defaultQuality.label);
        setActiveQualitySrc(defaultQuality.src);
      }
    } else {
      // No saved preference, use default or first
      const defaultQuality = sortedOptions.find(q => q.default) || sortedOptions[0];
      setSelectedQuality(defaultQuality.label);
      setActiveQualitySrc(defaultQuality.src);
    }
  }, [src, alternateQualities]);
  
  // Measure network quality on mount or when retrying
  useEffect(() => {
    const measureNetworkQuality = async () => {
      if (isLoadingNetworkQuality) return;
      
      setIsLoadingNetworkQuality(true);
      const quality = await detectNetworkQuality();
      setNetworkQuality(quality);
      setIsLoadingNetworkQuality(false);
      
      // Auto-adjust quality based on network if user hasn't manually selected
      if (!getUserQualityPreference() && qualityOptions.length > 1) {
        let targetQuality: VideoQuality | undefined;
        
        if (quality === 'slow') {
          // Find lowest quality
          targetQuality = [...qualityOptions].sort((a, b) => {
            const getResValue = (label: string): number => {
              if (label.includes('360p')) return 1;
              if (label.includes('480p')) return 2;
              if (label.includes('720p')) return 3;
              if (label.includes('1080p')) return 4;
              if (label.includes('4K') || label.includes('2160p')) return 5;
              return 0;
            };
            return getResValue(a.label) - getResValue(b.label);
          })[0];
        } else if (quality === 'medium') {
          // Find medium quality (like 720p)
          targetQuality = qualityOptions.find(q => q.label.includes('720p'));
        } else if (quality === 'fast') {
          // Use highest quality
          targetQuality = qualityOptions[0]; // Already sorted high to low
        }
        
        if (targetQuality && targetQuality.src !== activeQualitySrc) {
          setSelectedQuality(targetQuality.label);
          setActiveQualitySrc(targetQuality.src);
          console.log(`Auto-selected quality ${targetQuality.label} based on network speed: ${quality}`);
        }
      }
    };
    
    measureNetworkQuality();
  }, [retryCount, qualityOptions, isLoadingNetworkQuality, activeQualitySrc]);
  
  // Ensure we use absolute URL for any relative paths
  let videoUrl = activeQualitySrc;
  if (videoUrl.startsWith('/uploads/content-files/')) {
    // Extract just the filename for the direct video route
    const filename = videoUrl.split('/').pop();
    videoUrl = `${window.location.origin}/direct-video/${filename}`;
    console.log('Using direct video access URL:', videoUrl);
  } else if (videoUrl.startsWith('/')) {
    videoUrl = `${window.location.origin}${videoUrl}`;
  }

  // Create a stable cache busting URL with client-specific randomness
  // This helps ensure videos don't constantly reload while still enabling cache busting when needed
  const getStableId = useCallback(() => {
    // Try to get an existing stable ID from localStorage
    let stableId = localStorage.getItem('video-player-stable-id');
    if (!stableId) {
      // Create a new stable ID based on timestamp and a random value
      stableId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      localStorage.setItem('video-player-stable-id', stableId);
    }
    return stableId;
  }, []);

  // Cache bust only when retrying or based on stable ID
  const cacheBustedUrl = useMemo(() => {
    if (retryCount > 0) {
      // Use a dynamic cache bust for retries
      return `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}_t=${Date.now()}-${retryCount}`;
    }
    // Use a stable cache bust for initial loads
    return `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}_sid=${getStableId()}`;
  }, [videoUrl, retryCount, getStableId]);

  // Function to handle retrying video playback
  const handleRetry = useCallback(() => {
    if (retryCount >= 3) {
      // After 3 retries, suggest trying alternate format
      toast({
        title: "Video loading issues",
        description: "We've tried several times to load this video. Please check your internet connection or try a different device.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    
    // Force the video element to reload
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [retryCount, toast]);
  
  // Handle quality selection
  const handleQualitySelect = useCallback((quality: VideoQuality) => {
    if (quality.src === activeQualitySrc) {
      setShowQualitySelector(false);
      return;
    }
    
    // Save preference
    setUserQualityPreference(quality.label);
    
    // Update state
    setSelectedQuality(quality.label);
    setActiveQualitySrc(quality.src);
    setLoading(true);
    setError(null);
    setShowQualitySelector(false);
    
    // Remember current playback position
    const currentTime = videoRef.current?.currentTime || 0;
    const wasPlaying = videoRef.current && !videoRef.current.paused;
    
    // Listen for metadata loaded to restore position
    const handleMetadataLoaded = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {
            console.log('Auto-play after quality change was prevented');
          });
        }
      }
    };
    
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded, { once: true });
    }
    
    toast({
      title: "Quality changed",
      description: `Video quality set to ${quality.label}`,
    });
  }, [activeQualitySrc]);

  // Handle video load events
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Use more efficient event handlers with detailed error information
    const handleLoadedMetadata = () => {
      setLoading(false);
      setError(null);
      setFailedSource(null);
      setErrorCode(null);
      
      // Start position checking for stalled video detection once video starts playing
      if (positionCheckIntervalRef.current === null) {
        positionCheckIntervalRef.current = window.setInterval(() => {
          if (videoElement && !videoElement.paused) {
            const currentPosition = videoElement.currentTime;
            const currentTime = Date.now();
            const timeDiff = currentTime - lastPlayTimeRef.current;
            
            // If position hasn't changed in 3+ seconds during playback, video might be stalled
            if (currentPosition === lastPlayPositionRef.current && timeDiff > 3000) {
              console.log('Stalled video detected - position not advancing', {
                currentPosition,
                lastPosition: lastPlayPositionRef.current,
                timeSinceLastUpdate: timeDiff
              });
              
              // Mark as stalled if it wasn't buffering
              if (!isBuffering) {
                setStalledVideo(true);
                
                // Try recovery - seek forward slightly
                try {
                  const newPosition = currentPosition + 0.5; // Skip ahead 0.5 seconds
                  if (newPosition < videoElement.duration) {
                    console.log(`Attempting recovery by seeking to ${newPosition}`);
                    videoElement.currentTime = newPosition;
                    
                    // Force a play attempt
                    videoElement.play().catch(e => {
                      console.warn('Could not restart after seek recovery:', e);
                    });
                  }
                } catch (e) {
                  console.error('Error recovering from stalled video:', e);
                }
              }
            } else if (currentPosition !== lastPlayPositionRef.current) {
              // Position changed, reset stalled state if it was stalled
              if (stalledVideo) {
                console.log('Video recovered from stalled state');
                setStalledVideo(false);
              }
              
              // Update the last position and time
              lastPlayPositionRef.current = currentPosition;
              lastPlayTimeRef.current = currentTime;
            }
          }
        }, 1000); // Check every second
      }
    };
    
    // Handle buffering detection
    const handleWaiting = () => {
      console.log('Video buffering detected');
      setIsBuffering(true);
      
      // Set up a timer to measure buffering duration
      if (bufferingTimerRef.current === null) {
        const startTime = Date.now();
        bufferingTimerRef.current = window.setInterval(() => {
          const currentDuration = Math.floor((Date.now() - startTime) / 1000);
          setBufferingDuration(currentDuration);
          
          // If buffering for more than 10 seconds, suggest lower quality
          if (currentDuration > 10 && qualityOptions.length > 1) {
            const currentQualityIndex = qualityOptions.findIndex(q => q.src === activeQualitySrc);
            if (currentQualityIndex < qualityOptions.length - 1) {
              clearInterval(bufferingTimerRef.current!);
              bufferingTimerRef.current = null;
              
              // Suggest lower quality
              toast({
                title: "Slow network detected",
                description: `Video has been buffering for ${currentDuration} seconds. Try a lower quality.`,
                variant: "destructive",
                action: (
                  <Button 
                    onClick={() => handleQualitySelect(qualityOptions[currentQualityIndex + 1])} 
                    variant="outline" 
                    size="sm"
                  >
                    Switch to {qualityOptions[currentQualityIndex + 1].label}
                  </Button>
                ),
              });
            }
          }
        }, 1000);
      }
    };
    
    // Handle when buffering ends
    const handlePlaying = () => {
      console.log('Video buffering ended, playback resumed');
      setIsBuffering(false);
      setStalledVideo(false);
      setBufferingDuration(0);
      
      // Clear buffering timer
      if (bufferingTimerRef.current !== null) {
        clearInterval(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };

    const handleError = (e: Event) => {
      setLoading(false);
      
      // Extract detailed error information
      const mediaError = videoElement.error;
      const errorMessages = {
        1: "Video playback was aborted. This is usually temporary.",
        2: "Network error occurred while loading the video.",
        3: "Video decoding error or the video is corrupted.",
        4: "The video format is not supported by your browser."
      };
      
      const code = mediaError ? mediaError.code : 0;
      setErrorCode(code);
      
      const errorMessage = code > 0 && code <= 4 
        ? errorMessages[code as 1|2|3|4] 
        : "Couldn't load the video. Please try again.";
      
      setError(errorMessage);
      setFailedSource(videoElement.currentSrc || activeQualitySrc);
      
      console.error("Video error details:", {
        code: mediaError?.code,
        message: mediaError?.message,
        currentSrc: videoElement.currentSrc,
        videoUrl: videoUrl
      });
      
      // If this quality failed and we have alternatives, try a lower quality
      if (code === 2 && qualityOptions.length > 1) {
        const currentQualityIndex = qualityOptions.findIndex(q => q.src === activeQualitySrc);
        if (currentQualityIndex < qualityOptions.length - 1) {
          // There's a lower quality available, suggest it
          toast({
            title: "Network issues detected",
            description: "Try switching to a lower video quality for smoother playback",
            variant: "destructive",
            action: (
              <Button 
                onClick={() => handleQualitySelect(qualityOptions[currentQualityIndex + 1])} 
                variant="outline" 
                size="sm"
              >
                Switch to {qualityOptions[currentQualityIndex + 1].label}
              </Button>
            ),
          });
        }
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('stalled', handleWaiting);

    return () => {
      // Clean up event listeners
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('stalled', handleWaiting);
      
      // Clear all intervals and timers
      if (positionCheckIntervalRef.current !== null) {
        clearInterval(positionCheckIntervalRef.current);
        positionCheckIntervalRef.current = null;
      }
      
      if (bufferingTimerRef.current !== null) {
        clearInterval(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };
  }, [activeQualitySrc, videoUrl, retryCount, qualityOptions, handleQualitySelect]);

  return (
    <div className={cn("relative", className)}>
      {/* Header with player type and quality selector */}
      <div className="flex justify-between items-center mb-1">
        <Button 
          size="sm"
          variant="default"
          className="text-xs px-2 py-1 h-6"
        >
          <Video className="h-3 w-3 mr-1" />
          HTML5 Player
        </Button>
        
        {qualityOptions.length > 1 && (
          <div className="relative" ref={qualitySelectorRef}>
            <Button
              size="sm"
              variant="outline"
              className="text-xs px-2 py-1 h-6"
              onClick={() => setShowQualitySelector(!showQualitySelector)}
            >
              <Settings className="h-3 w-3 mr-1" />
              {selectedQuality || 'Auto'}
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showQualitySelector ? 'rotate-180' : ''}`} />
            </Button>
            
            {showQualitySelector && (
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg overflow-hidden z-50 border border-gray-200">
                <div className="py-1">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">Quality</div>
                  {qualityOptions.map((quality) => (
                    <button
                      key={quality.label}
                      className={`block w-full text-left px-3 py-2 text-xs ${
                        quality.label === selectedQuality
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => handleQualitySelect(quality)}
                    >
                      <div className="flex items-center justify-between">
                        <span>{quality.label}</span>
                        {quality.label === selectedQuality && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                    </button>
                  ))}
                  {networkQuality !== 'unknown' && (
                    <div className="px-3 py-1 text-xxs text-gray-500 border-t">
                      {networkQuality === 'fast' && 'Fast connection detected'}
                      {networkQuality === 'medium' && 'Medium connection detected'}
                      {networkQuality === 'slow' && 'Slow connection detected'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Video container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10 rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        
        {/* Buffering indicator */}
        {isBuffering && !loading && !error && (
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-2 bg-black/70 text-white text-xs flex items-center rounded-b-lg">
            <Loader2 className="w-4 h-4 animate-spin text-white mr-2" />
            <span>
              Buffering{bufferingDuration > 0 ? ` (${bufferingDuration}s)` : ''}...
              {bufferingDuration > 5 && networkQuality === 'slow' && ' Network is slow'}
            </span>
          </div>
        )}
        
        {/* Stalled video indicator with auto-recovery */}
        {stalledVideo && !isBuffering && !loading && !error && (
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-2 bg-yellow-600/90 text-white text-xs flex items-center rounded-b-lg">
            <RefreshCw className="w-4 h-4 animate-spin text-white mr-2" />
            <span>Recovering from playback issue...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-800 p-2 text-xs z-20 rounded-t-lg">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 p-1 text-red-800 hover:text-red-900 hover:bg-red-200"
                onClick={handleRetry}
                disabled={retryCount >= 3}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
            {errorCode === 2 && (
              <div className="text-xs mt-1 text-red-700">
                Network error - Please check your internet connection
              </div>
            )}
            {errorCode === 3 && (
              <div className="text-xs mt-1 text-red-700">
                This video may be corrupted. Please contact support if the issue persists.
              </div>
            )}
          </div>
        )}
        
        <video
          ref={videoRef}
          controls
          controlsList="nodownload"
          preload="auto"
          playsInline
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          autoPlay={false}
          muted={false}
          className="w-full h-auto rounded-lg"
          poster={poster || "/video-placeholder.jpg"}
          title={title}
          onError={(e) => console.error("Video error event:", e)}
          onLoadStart={() => console.log("Video loadstart event triggered")}
          onLoadedMetadata={() => console.log("Video metadata loaded successfully")}
          onCanPlay={() => console.log("Video can play event triggered")}
        >
          <source 
            src={cacheBustedUrl} 
            type="video/mp4" 
          />
          <p>Your browser does not support HTML5 video playback. Please try a different browser.</p>
        </video>
      </div>
    </div>
  );
});

// Add display name for better debugging
MobileAwareVideo.displayName = "MobileAwareVideo";

export default MobileAwareVideo;