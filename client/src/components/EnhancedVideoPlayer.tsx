import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Settings, Check, WifiOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { memoize, debounce } from '@/lib/utils';

// Define quality levels
export const QUALITY_LEVELS = {
  AUTO: 'auto',
  HD: '1080p',
  HIGH: '720p',
  MEDIUM: '480p',
  LOW: '360p'
};

// Define quality option type
interface QualityOption {
  label: string;
  value: string;
  resolution?: number;
  bitrate?: number;
}

interface EnhancedVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

/**
 * EnhancedVideoPlayer - A performance-optimized video player with quality selection,
 * network-aware playback, and improved mobile experience
 */
const EnhancedVideoPlayer = ({
  src,
  poster,
  className = '',
  title = 'Video',
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
  onPlay,
  onPause,
  onEnded,
  onProgress
}: EnhancedVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentQuality, setCurrentQuality] = useState(QUALITY_LEVELS.AUTO);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [showQualityTip, setShowQualityTip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  
  // Generate quality options
  const qualityOptions = [
    { label: 'Auto (Recommended)', value: QUALITY_LEVELS.AUTO, resolution: 0 },
    { label: 'High Definition (1080p)', value: QUALITY_LEVELS.HD, resolution: 1080 },
    { label: 'High Quality (720p)', value: QUALITY_LEVELS.HIGH, resolution: 720 },
    { label: 'Medium Quality (480p)', value: QUALITY_LEVELS.MEDIUM, resolution: 480 },
    { label: 'Low Quality (360p)', value: QUALITY_LEVELS.LOW, resolution: 360 }
  ];
  
  // Get current video source based on quality setting
  const getVideoSource = () => {
    if (currentQuality === QUALITY_LEVELS.AUTO) {
      return src;
    }
    
    // Process URL to inject quality suffix
    // This matches common patterns for quality in filenames
    const qualityMatch = src.match(/_(1080p|720p|480p|360p)\./);
    if (qualityMatch) {
      return src.replace(qualityMatch[0], `_${currentQuality}.`);
    }
    
    // No quality suffix found, insert before extension
    const extensionMatch = src.match(/\.\w+$/);
    if (extensionMatch) {
      return src.replace(extensionMatch[0], `_${currentQuality}${extensionMatch[0]}`);
    }
    
    // No extension found, append quality
    return `${src}_${currentQuality}`;
  };
  
  // Detect optimal quality based on network and device
  const detectOptimalQuality = async () => {
    // Check if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Check connection type if available
    let connectionSpeed = 'unknown';
    if ('connection' in navigator && navigator.connection) {
      const connection = navigator.connection as any;
      connectionSpeed = connection.effectiveType || connection.type || 'unknown';
      
      // Data saver enabled = use lower quality
      if (connection.saveData) {
        setIsSlow(true);
        return isMobile ? QUALITY_LEVELS.LOW : QUALITY_LEVELS.MEDIUM;
      }
    }
    
    // Based on connection and device
    if (connectionSpeed === '4g' || connectionSpeed === 'wifi') {
      return isMobile ? QUALITY_LEVELS.HIGH : QUALITY_LEVELS.HD;
    } else if (connectionSpeed === '3g') {
      setIsSlow(true);
      return isMobile ? QUALITY_LEVELS.LOW : QUALITY_LEVELS.MEDIUM;
    } else if (connectionSpeed === '2g' || connectionSpeed === 'slow-2g') {
      setIsSlow(true);
      return QUALITY_LEVELS.LOW;
    }
    
    // Default based on device
    return isMobile ? QUALITY_LEVELS.MEDIUM : QUALITY_LEVELS.HIGH;
  };
  
  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (quality === currentQuality) return;
    
    setCurrentQuality(quality);
    setShowQualityTip(false);
    
    const video = videoRef.current;
    if (!video) return;
    
    // Save current state
    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;
    
    // When video loads after quality change
    const handleMetadata = () => {
      if (video) {
        video.currentTime = currentTime;
        if (wasPlaying) {
          video.play().catch(e => console.error('Failed to resume after quality change:', e));
        }
        video.removeEventListener('loadedmetadata', handleMetadata);
      }
    };
    
    video.addEventListener('loadedmetadata', handleMetadata);
  };
  
  // Initialize player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsLoading(true);
    setError(null);
    
    // Auto-detect optimal quality
    detectOptimalQuality().then((quality) => {
      setCurrentQuality(quality);
    }).catch(err => {
      console.error('Failed to detect quality:', err);
    }).finally(() => {
      setIsLoading(false);
    });
    
    // Track buffering state
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    
    // Set up event tracking
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleWaiting);
    
    // Track progress for analytics
    let progressTimer: number | null = null;
    if (onProgress) {
      progressTimer = window.setInterval(() => {
        onProgress(video.currentTime, video.duration);
      }, 1000);
    }
    
    // Clean up
    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleWaiting);
      
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
    };
  }, [src, onProgress]);
  
  // Monitor for playback issues
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let stallCount = 0;
    let lastStallTime = 0;
    
    // Check if video is stalling
    const checkStall = () => {
      if (video.readyState < 3 && video.currentTime > 0 && !video.paused) {
        const now = Date.now();
        
        // If this is a new stall
        if (lastStallTime === 0) {
          lastStallTime = now;
        }
        // If stalled for more than 3 seconds
        else if (now - lastStallTime > 3000) {
          stallCount++;
          lastStallTime = 0;
          
          // After 2 consecutive stalls, suggest lower quality
          if (stallCount >= 2 && currentQuality !== QUALITY_LEVELS.LOW) {
            setShowQualityTip(true);
            
            // Suggest a lower quality
            let suggested = currentQuality;
            if (currentQuality === QUALITY_LEVELS.HD) {
              suggested = QUALITY_LEVELS.HIGH;
            } else if (currentQuality === QUALITY_LEVELS.HIGH) {
              suggested = QUALITY_LEVELS.MEDIUM;
            } else if (currentQuality === QUALITY_LEVELS.MEDIUM) {
              suggested = QUALITY_LEVELS.LOW;
            }
            
            // Don't auto-switch, but show toast with suggestion
            if (suggested !== currentQuality) {
              toast({
                title: 'Buffering detected',
                description: 'Try switching to a lower quality for smoother playback',
                action: (
                  <Button 
                    variant="secondary" 
                    onClick={() => handleQualityChange(suggested)}
                  >
                    Switch to {suggested}
                  </Button>
                ),
              });
            }
          }
        }
      } else {
        // Reset if playing fine
        lastStallTime = 0;
      }
    };
    
    // Check every second
    const interval = setInterval(checkStall, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [currentQuality, toast]);
  
  // Handle errors
  const handleError = () => {
    const video = videoRef.current;
    if (!video || !video.error) return;
    
    let message = 'Unknown error occurred';
    switch (video.error.code) {
      case 1:
        message = 'Video loading aborted';
        break;
      case 2:
        message = 'Network error while loading video';
        break;
      case 3:
        message = 'Video decoding failed - format may be unsupported';
        break;
      case 4:
        message = 'Video is not available or cannot be played';
        break;
    }
    
    console.error('Video error:', message);
    setError(message);
    setIsLoading(false);
    setIsBuffering(false);
  };
  
  // Handle retrying after error
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };
  
  // Prepare video source
  const videoSource = getVideoSource();
  
  // If error, show error UI with retry button
  if (error) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-80 p-6 rounded-lg">
          <div className="bg-black p-4 rounded-lg shadow-lg max-w-md text-white">
            <h3 className="text-lg font-bold mb-2">Video Playback Error</h3>
            <p className="mb-4">{error}</p>
            <div className="flex justify-between gap-2">
              <Button 
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleRetry}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again ({retryCount + 1})
              </Button>
              
              {currentQuality !== QUALITY_LEVELS.LOW && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    handleQualityChange(QUALITY_LEVELS.LOW);
                    handleRetry();
                  }}
                >
                  Try Lower Quality
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative group ${className}`}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
            <p className="mt-2 text-white">Loading video...</p>
          </div>
        </div>
      )}
      
      {/* Buffering indicator */}
      {!isLoading && isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
            <p className="mt-2 text-white">Buffering video...</p>
            {isSlow && (
              <div className="mt-2 flex items-center bg-amber-600 bg-opacity-90 px-3 py-1 rounded-full">
                <WifiOff className="h-3 w-3 mr-1 text-white" />
                <p className="text-xs text-white">Slow connection detected</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Quality selector button */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              className="flex items-center bg-green-600 hover:bg-green-700 text-white border-2 border-white shadow-lg p-2 h-10 rounded-xl"
            >
              <Settings className="h-5 w-5 mr-2" />
              <span className="font-bold">{currentQuality.toUpperCase()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-0">
            {qualityOptions.map((quality) => (
              <DropdownMenuItem 
                key={quality.value}
                className={`flex justify-between items-center p-3 ${
                  currentQuality === quality.value ? "bg-gray-100 font-semibold" : ""
                }`}
                onClick={() => handleQualityChange(quality.value)}
              >
                <div className="flex items-center gap-2">
                  <span>{quality.label}</span>
                  {isSlow && quality.resolution && quality.resolution > 480 && (
                    <WifiOff className="h-3 w-3 text-amber-500" aria-label="May buffer on slow connections" />
                  )}
                </div>
                {currentQuality === quality.value && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Quality tip for buffering issues */}
      {showQualityTip && (
        <div className="absolute bottom-16 right-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-lg max-w-xs shadow-lg">
          <h4 className="font-medium text-sm mb-1">Buffering issues?</h4>
          <p className="text-xs mb-2">Try a lower quality for smoother playback</p>
          <div className="flex gap-2">
            {currentQuality !== QUALITY_LEVELS.MEDIUM && (
              <Button 
                size="sm" 
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleQualityChange(QUALITY_LEVELS.MEDIUM)}
              >
                Try 480p
              </Button>
            )}
            {currentQuality !== QUALITY_LEVELS.LOW && (
              <Button 
                size="sm" 
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleQualityChange(QUALITY_LEVELS.LOW)}
              >
                Try 360p
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs"
              onClick={() => setShowQualityTip(false)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
      
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoSource}
        poster={poster}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        onLoadedData={() => setIsLoading(false)}
        onPlay={() => { setIsBuffering(false); if (onPlay) onPlay(); }}
        onPause={() => { if (onPause) onPause(); }}
        onEnded={() => { if (onEnded) onEnded(); }}
        onError={handleError}
        className="w-full h-full rounded-lg"
        // Force reset when source changes, quality changes, or retry happens
        key={`${videoSource}-${retryCount}`}
      />
    </div>
  );
};

export default EnhancedVideoPlayer;