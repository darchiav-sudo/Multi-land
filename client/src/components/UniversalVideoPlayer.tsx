import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { detectSlowConnection } from '@/lib/browser-compatibility';
import { generateQualityOptions, detectOptimalQuality, VIDEO_QUALITY_LEVELS } from '@/lib/video-optimization';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export interface QualityOption {
  label: string;
  value: string;
  src: string;
  resolution?: number; // vertical resolution in pixels
  bitrate?: number;    // bitrate in kbps
}

interface UniversalVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  onError?: (error: string) => void;
  onPlay?: () => void;
  onReady?: () => void;
  onPause?: () => void;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  qualityOptions?: QualityOption[];
}

const UniversalVideoPlayer = ({
  src,
  poster = '',
  className = '',
  title = 'Video',
  onError,
  onPlay,
  onReady,
  onPause,
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
  qualityOptions = [],
}: UniversalVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [playAttempted, setPlayAttempted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online'|'offline'|'slow'>('online');
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const bufferTimer = useRef<number | null>(null);
  const stuckTimer = useRef<number | null>(null);
  const lastPlayedPosition = useRef<number>(0);
  const positionCheckInterval = useRef<number | null>(null);
  
  // If quality options are provided, add "auto" as the default option
  const fullQualityOptions = useCallback(() => {
    // Always show at least the Auto option, even if no quality options provided
    if (qualityOptions.length === 0 && src) {
      // Add default src as "Auto" quality
      return [
        { label: 'Auto (Recommended)', value: 'auto', src },
        { label: 'High (1080p)', value: '1080p', src: src, resolution: 1080 },
        { label: 'Medium (720p)', value: '720p', src: src, resolution: 720 },
        { label: 'Low (480p)', value: '480p', src: src, resolution: 480 },
        { label: 'Very Low (360p)', value: '360p', src: src, resolution: 360 }
      ];
    }
    
    // Sort quality options by resolution (highest first) if resolution is specified
    const sortedOptions = [...qualityOptions].sort((a, b) => {
      if (a.resolution && b.resolution) {
        return b.resolution - a.resolution;
      }
      return 0;
    });
    
    // Add "Auto" as the first option
    return [
      { label: 'Auto (Recommended)', value: 'auto', src },
      ...sortedOptions
    ];
  }, [qualityOptions, src]);

  // Check if video is stuck (not advancing despite being in playing state)
  const checkIfVideoStuck = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;
    
    const currentPosition = video.currentTime;
    // If position hasn't changed in 3 seconds while playing, video might be stuck
    if (currentPosition === lastPlayedPosition.current) {
      console.log('Video appears to be stuck, attempting recovery');
      handleStuckVideo();
    }
    lastPlayedPosition.current = currentPosition;
  }, [isPlaying]);

  // Handle situation where video appears to be stuck
  const handleStuckVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // First, check network status
    detectSlowConnection()
      .then(isSlowConnection => {
        setNetworkStatus(isSlowConnection ? 'slow' : 'online');
        
        // Try to unstick the video by seeking slightly forward
        try {
          // If we're near the end, don't seek forward
          if (video.currentTime < video.duration - 1) {
            const seekForwardAmount = 0.5; // seek forward half a second
            video.currentTime += seekForwardAmount;
            console.log(`Seeking forward ${seekForwardAmount}s to unstick video`);
          }
          
          // If we're already buffering, this will restart playback after seeking
          if (isBuffering && !video.paused) {
            video.play().catch(e => console.warn('Could not restart after seeking', e));
          }
        } catch (e) {
          console.error('Error while trying to recover stuck video', e);
        }
      });
  };

  // Set up buffering and stuck video detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Function to detect and handle waiting/stalled events
    const handleWaiting = () => {
      setIsBuffering(true);
      console.log('Video buffering...');
      
      // Clear any existing buffer timer
      if (bufferTimer.current !== null) {
        window.clearTimeout(bufferTimer.current);
      }
      
      // If buffering continues for too long, check network and try recovery
      bufferTimer.current = window.setTimeout(() => {
        if (video.readyState < 3) { // HAVE_FUTURE_DATA=3
          console.log('Extended buffering detected, checking network...');
          detectSlowConnection().then(isSlowConnection => {
            setNetworkStatus(isSlowConnection ? 'slow' : 'online');
          });
        }
      }, 5000); // Wait 5 seconds before considering it "stuck" buffering
    };
    
    // Function to handle when buffering ends
    const handlePlaying = () => {
      setIsBuffering(false);
      if (bufferTimer.current !== null) {
        window.clearTimeout(bufferTimer.current);
        bufferTimer.current = null;
      }
    };
    
    // Start position check interval when playing
    const startPositionCheck = () => {
      if (positionCheckInterval.current !== null) {
        window.clearInterval(positionCheckInterval.current);
      }
      
      // Check every 3 seconds if the video position is advancing
      positionCheckInterval.current = window.setInterval(checkIfVideoStuck, 3000);
      lastPlayedPosition.current = video.currentTime;
    };
    
    // Stop position check when paused
    const stopPositionCheck = () => {
      if (positionCheckInterval.current !== null) {
        window.clearInterval(positionCheckInterval.current);
        positionCheckInterval.current = null;
      }
    };
    
    // Detect network conditions on load
    detectSlowConnection().then(isSlowConnection => {
      setNetworkStatus(isSlowConnection ? 'slow' : 'online');
      
      // If network is slow, reduce initial buffer size
      if (isSlowConnection && video.buffered.length === 0) {
        // Most browsers don't expose this, but worth a try
        try {
          // @ts-ignore - Some browsers have undocumented preload settings
          if (video._mediaSource && video._mediaSource.bufferSize) {
            // @ts-ignore
            video._mediaSource.bufferSize = 30; // Smaller buffer in seconds
          }
        } catch (e) {
          // Ignore errors accessing private properties
        }
      }
    });
    
    // Add event listeners
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleWaiting);
    video.addEventListener('play', startPositionCheck);
    video.addEventListener('pause', stopPositionCheck);
    
    // Cleanup
    return () => {
      if (bufferTimer.current !== null) {
        window.clearTimeout(bufferTimer.current);
      }
      if (stuckTimer.current !== null) {
        window.clearTimeout(stuckTimer.current);
      }
      if (positionCheckInterval.current !== null) {
        window.clearInterval(positionCheckInterval.current);
      }
      
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleWaiting);
      video.removeEventListener('play', startPositionCheck);
      video.removeEventListener('pause', stopPositionCheck);
    };
  }, [checkIfVideoStuck, isPlaying]);
  
  // Get current video source based on selected quality
  const getCurrentVideoSource = useCallback(() => {
    if (qualityOptions.length === 0 || currentQuality === 'auto') {
      return src;
    }
    
    const selectedQuality = qualityOptions.find(q => q.value === currentQuality);
    return selectedQuality ? selectedQuality.src : src;
  }, [src, currentQuality, qualityOptions]);
  
  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (quality === currentQuality) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    // Save current position and playing state
    const wasPlaying = !video.paused;
    const currentPos = video.currentTime;
    
    setCurrentQuality(quality);
    setCurrentTime(currentPos);
    
    // The source change will happen in the useEffect below
    // After source changes, the video will be reset to the saved position
    
    // If network is slow, show a user-friendly message
    if (networkStatus === 'slow' && quality !== 'auto') {
      // Find selected quality info
      const selectedQuality = qualityOptions.find(q => q.value === quality);
      if (selectedQuality && selectedQuality.resolution && selectedQuality.resolution > 480) {
        console.log('Warning user about high quality selection on slow network');
      }
    }
  };
  
  // Auto-select lower quality on slow connections
  useEffect(() => {
    if (networkStatus === 'slow' && currentQuality === 'auto' && qualityOptions.length > 0) {
      // Find a lower quality option (480p or lower is good for slow connections)
      const lowerQualityOption = qualityOptions.find(
        q => q.resolution && q.resolution <= 480
      );
      
      if (lowerQualityOption) {
        console.log('Auto-selecting lower quality due to slow connection:', lowerQualityOption.label);
        setCurrentQuality(lowerQualityOption.value);
      }
    }
  }, [networkStatus, currentQuality, qualityOptions]);

  // Reset error state when source changes
  useEffect(() => {
    const videoSrc = getCurrentVideoSource();
    
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);
    setPlayAttempted(false);
    setRetryCount(0);
    setIsBuffering(false);
    
    // Clear any existing timers
    if (bufferTimer.current !== null) {
      window.clearTimeout(bufferTimer.current);
      bufferTimer.current = null;
    }
    if (stuckTimer.current !== null) {
      window.clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
    if (positionCheckInterval.current !== null) {
      window.clearInterval(positionCheckInterval.current);
      positionCheckInterval.current = null;
    }
    
    // When video loads after quality change, restore position
    const handleLoadedMetadata = () => {
      const video = videoRef.current;
      if (video && currentTime > 0) {
        video.currentTime = currentTime;
        // Try to restore playback state
        if (isPlaying) {
          video.play().catch(err => console.warn("Could not resume playback after quality change:", err));
        }
      }
    };
    
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }
    
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [src, getCurrentVideoSource, currentTime, isPlaying]);

  // Handle video errors
  const handleError = (e: any) => {
    const video = videoRef.current;
    if (!video) return;

    let errorMessage = "Unknown error occurred";
    
    // Get detailed error information
    if (video.error) {
      switch (video.error.code) {
        case 1:
          errorMessage = "Video loading aborted";
          break;
        case 2:
          errorMessage = "Network error occurred while loading video";
          break;
        case 3:
          errorMessage = "Video decoding failed - format may be unsupported on this device";
          break;
        case 4:
          errorMessage = "Video is not available or cannot be played in this browser";
          break;
        default:
          errorMessage = `Error: ${video.error.message || video.error.code}`;
      }
    }

    console.error(`Video playback error for ${src}:`, errorMessage);
    setError(errorMessage);
    setIsLoading(false);
    
    // Call the onError callback if provided
    if (onError) {
      onError(errorMessage);
    }
  };

  // Handle loading state
  const handleCanPlay = () => {
    setIsLoading(false);
    
    // Notify that video is ready for playback
    if (onReady) {
      onReady();
    }
    
    // Auto-play if specified (with mobile limitations)
    if (autoPlay && !playAttempted) {
      attemptPlay();
    }
  };

  // Handle play attempt
  const attemptPlay = () => {
    setPlayAttempted(true);
    const video = videoRef.current;
    if (!video) return;

    video.play()
      .then(() => {
        setIsPlaying(true);
        if (onPlay) onPlay();
      })
      .catch(err => {
        console.warn("Auto-play failed (commonly blocked on mobile):", err.message);
        // Don't consider autoplay blocks as errors
        // Mobile browsers often block autoplay
      });
  };

  // Handle successful play
  const handlePlay = () => {
    setIsPlaying(true);
    if (onPlay) onPlay();
  };

  // Handle pause
  const handlePause = () => {
    setIsPlaying(false);
    if (onPause) {
      onPause();
    }
  };

  // Retry loading the video
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);
    
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };

  // Get the actual video source to use based on quality selection
  const videoSource = getCurrentVideoSource();
  
  // Calculate available quality options
  const availableQualities = fullQualityOptions();

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-10">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-600" />
            <p className="mt-2 text-sm text-gray-700">Loading video...</p>
          </div>
        </div>
      )}
      
      {/* Show buffering indicator */}
      {!isLoading && isBuffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 z-10">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin text-white" />
            <p className="mt-2 text-sm text-white">Buffering video...</p>
            {networkStatus === 'slow' && (
              <div className="mt-2 flex items-center bg-yellow-500 bg-opacity-80 px-3 py-1 rounded-full">
                <WifiOff className="h-3 w-3 mr-1 text-white" />
                <p className="text-xs text-white">Slow connection detected</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Quality selector with maximum visibility - positioned over video controls */}
      {!error && (
        <div className="absolute top-4 right-4 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="default"
                className="flex items-center bg-green-600 text-white hover:bg-green-700 border-2 border-white shadow-2xl p-3 h-12 rounded-xl"
              >
                <Settings className="h-6 w-6 mr-2" />
                <span className="font-bold text-lg">QUALITY</span>
                <ChevronDown className="h-5 w-5 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-lg">
              {availableQualities.map((quality) => (
                <DropdownMenuItem 
                  key={quality.value}
                  onClick={() => handleQualityChange(quality.value)}
                  className={currentQuality === quality.value ? "bg-gray-100 font-semibold" : ""}
                >
                  {quality.label}
                  {quality.resolution && quality.value !== 'auto' && (
                    <span className="ml-1 text-xs text-gray-500">
                      {quality.resolution}p
                      {quality.bitrate && ` (${Math.round(quality.bitrate/1000)}Mbps)`}
                    </span>
                  )}
                  {networkStatus === 'slow' && quality.resolution && quality.resolution > 480 && (
                    <WifiOff className="h-3 w-3 ml-1 text-amber-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Video Playback Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            
            <div className="text-sm text-gray-600 mb-4">
              <p className="mb-2">Possible solutions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Check your internet connection</li>
                {networkStatus === 'slow' && (
                  <li className="text-amber-600">
                    <strong>Slow connection detected</strong> - try a lower quality setting
                  </li>
                )}
                <li>Try a different browser or player type</li>
                <li>The video format may not be supported by your device</li>
              </ul>
            </div>
            
            <div className="flex justify-between gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleRetry}
                className="flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry Video
              </Button>
              
              {/* Provide quality options if available */}
              {availableQualities.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      <span>Quality: {currentQuality}</span>
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {availableQualities.map((quality) => (
                      <DropdownMenuItem 
                        key={quality.value}
                        onClick={() => {
                          handleQualityChange(quality.value);
                          handleRetry();
                        }}
                      >
                        {quality.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      )}
      
      <video
        ref={videoRef}
        title={title}
        poster={poster}
        controls={controls}
        loop={loop}
        muted={muted}
        playsInline // Important for iOS
        preload="metadata"
        className={`w-full h-full object-contain ${error ? 'opacity-20' : 'opacity-100'}`}
        onError={handleError}
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onPause={handlePause}
        key={`${videoSource}-${retryCount}-${currentQuality}`} // Force reload on retry or quality change
      >
        {/* Add HLS and DASH format support */}
        {videoSource.endsWith('.m3u8') ? (
          <source src={videoSource} type="application/vnd.apple.mpegurl" />
        ) : videoSource.endsWith('.mpd') ? (
          <source src={videoSource} type="application/dash+xml" />
        ) : (
          <>
            <source src={videoSource} type="video/mp4" />
            <source src={videoSource} type="video/webm" />
          </>
        )}
        <p>
          Your browser doesn't support HTML5 video. 
          <a href={videoSource} target="_blank" rel="noopener noreferrer">
            Download the video
          </a> instead.
        </p>
      </video>
    </div>
  );
};

export default UniversalVideoPlayer;