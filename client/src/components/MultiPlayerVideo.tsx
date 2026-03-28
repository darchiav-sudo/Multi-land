import { useState, useEffect, useRef } from 'react';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';
import { 
  detectOptimalQuality, 
  VIDEO_QUALITY_LEVELS, 
  monitorPlaybackQuality,
  VideoQualityOption,
  createQualityOptions
} from '@/lib/video-quality-helper';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Settings, Check, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MultiPlayerVideoProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  initialQuality?: string;
  loop?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
  startTime?: number;
}

const MultiPlayerVideo = ({
  src,
  poster,
  className = '',
  title = 'Video',
  onProgress,
  onEnded,
  initialQuality,
  loop = false,
  autoPlay = false,
  controls = true,
  startTime = 0
}: MultiPlayerVideoProps) => {
  const [currentQuality, setCurrentQuality] = useState<string>(initialQuality || VIDEO_QUALITY_LEVELS.AUTO);
  const [isSlow, setIsSlow] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showQualityTip, setShowQualityTip] = useState<boolean>(false);
  const [qualityOptions, setQualityOptions] = useState<VideoQualityOption[]>([]);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qualityMonitorRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  // Initialize optimal quality and quality monitoring
  useEffect(() => {
    if (!src) return;
    
    // Set up quality options
    setQualityOptions(createQualityOptions(src));
    
    // Detect optimal quality on initial load
    const detectQuality = async () => {
      try {
        const optimalQuality = await detectOptimalQuality();
        if (!initialQuality) {
          setCurrentQuality(optimalQuality);
        }
        
        // Check if we're on a slow connection
        if (
          optimalQuality === VIDEO_QUALITY_LEVELS.LOW || 
          optimalQuality === VIDEO_QUALITY_LEVELS.MEDIUM
        ) {
          setIsSlow(true);
        }
      } catch (error) {
        console.error('Error detecting optimal video quality:', error);
      }
    };
    
    detectQuality();
    
    // Clean up any previous quality monitor
    return () => {
      if (qualityMonitorRef.current) {
        qualityMonitorRef.current();
        qualityMonitorRef.current = null;
      }
    };
  }, [src, initialQuality]);

  // Set up quality monitoring whenever video reference changes
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Clean up any previous monitor
    if (qualityMonitorRef.current) {
      qualityMonitorRef.current();
    }
    
    // Set up quality monitoring
    qualityMonitorRef.current = monitorPlaybackQuality(
      videoRef.current,
      (suggestedQuality) => {
        setShowQualityTip(true);
        
        toast({
          title: "Playback Issue Detected",
          description: "Try switching to a lower video quality for smoother playback",
          variant: "default",
          action: (
            <Button 
              variant="outline" 
              onClick={() => {
                setCurrentQuality(suggestedQuality);
                setShowQualityTip(false);
              }}
            >
              Switch to {suggestedQuality}
            </Button>
          ),
        });
      }
    );
    
    return () => {
      if (qualityMonitorRef.current) {
        qualityMonitorRef.current();
        qualityMonitorRef.current = null;
      }
    };
  }, [videoRef.current, toast]);

  // Handle when user changes quality manually
  const handleQualityChange = (quality: string) => {
    setCurrentQuality(quality);
    setIsQualityMenuOpen(false);
    setShowQualityTip(false);
  };

  // Prepare video source based on selected quality
  const getVideoSource = () => {
    // For AUTO quality, just use the original source
    if (currentQuality === VIDEO_QUALITY_LEVELS.AUTO) {
      return src;
    }
    
    // Try to construct quality-specific URL
    // First, check if src already has a quality suffix
    const qualityMatch = src.match(/_(1080p|720p|480p|360p)\./);
    if (qualityMatch) {
      // Replace existing quality with new one
      return src.replace(qualityMatch[0], `_${currentQuality}.`);
    }
    
    // If not, insert quality before extension
    const extensionMatch = src.match(/\.[^.]+$/);
    if (extensionMatch) {
      return src.replace(extensionMatch[0], `_${currentQuality}${extensionMatch[0]}`);
    }
    
    // Fallback - just append quality
    return `${src}_${currentQuality}`;
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Optimized video player */}
      <OptimizedVideoPlayer
        ref={videoRef}
        src={getVideoSource()}
        poster={poster}
        autoplay={autoPlay}
        controls={controls}
        loop={loop}
        startTime={startTime}
        onProgress={onProgress}
        onEnded={onEnded}
        className="w-full h-full rounded-lg overflow-hidden"
      />
      
      {/* Quality selector - more visible and on-brand */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <Popover open={isQualityMenuOpen} onOpenChange={setIsQualityMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              className="bg-green-600 hover:bg-green-700 text-white border-2 border-white shadow-lg p-2 h-10 rounded-xl"
            >
              <Settings className="h-5 w-5 mr-2" />
              <span className="font-bold">{currentQuality.toUpperCase()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <div className="flex flex-col gap-1">
              <div className="text-base font-medium mb-2">Video Quality</div>
              {qualityOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  className="flex justify-between items-center"
                  onClick={() => handleQualityChange(option.value)}
                >
                  <div className="flex items-center">
                    <span>{option.label}</span>
                    {isSlow && option.resolution > 480 && (
                      <WifiOff className="h-3 w-3 ml-2 text-amber-500" />
                    )}
                  </div>
                  {currentQuality === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              ))}
              
              {isSlow && (
                <div className="text-xs text-amber-600 mt-2 flex items-center">
                  <WifiOff className="h-3 w-3 mr-1" />
                  <span>Slow connection detected</span>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Quality tip - shows when buffering issues are detected */}
      {showQualityTip && !isQualityMenuOpen && (
        <div className="absolute bottom-16 right-3 z-20 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg max-w-xs">
          <div className="text-sm font-medium mb-2">Playback issues?</div>
          <p className="text-xs mb-2">Try a lower video quality for smoother playback</p>
          <div className="flex gap-2">
            {currentQuality !== VIDEO_QUALITY_LEVELS.MEDIUM && (
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs h-7 bg-opacity-50 hover:bg-opacity-70"
                onClick={() => handleQualityChange(VIDEO_QUALITY_LEVELS.MEDIUM)}
              >
                Try 480p
              </Button>
            )}
            {currentQuality !== VIDEO_QUALITY_LEVELS.LOW && (
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs h-7 bg-opacity-50 hover:bg-opacity-70"
                onClick={() => handleQualityChange(VIDEO_QUALITY_LEVELS.LOW)}
              >
                Try 360p
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              className="text-xs h-7"
              onClick={() => setShowQualityTip(false)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiPlayerVideo;