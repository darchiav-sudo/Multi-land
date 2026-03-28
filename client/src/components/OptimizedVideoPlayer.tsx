import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { detectOptimalQuality, videoPreloader, VIDEO_QUALITY_LEVELS, generateQualityOptions } from '@/lib/video-optimization';
import { Settings, Check } from 'lucide-react';
import { memoize, debounce } from '@/lib/utils';

interface OptimizedVideoPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
  controls?: boolean;
  loop?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  startTime?: number;
  extensionOverride?: string;
}

/**
 * Detects file extension from URL
 */
const getFileExtension = memoize((url: string): string => {
  const match = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return match ? match[1].toLowerCase() : 'mp4';
});

const OptimizedVideoPlayer = forwardRef<HTMLVideoElement, OptimizedVideoPlayerProps>(({
  src,
  poster,
  autoplay = false,
  onProgress,
  onEnded,
  className = '',
  controls = true,
  loop = false,
  preload = 'metadata',
  startTime = 0,
  extensionOverride
}, ref) => {
  // Create internal ref that we'll forward
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  
  // Forward the internal ref to the parent component
  useImperativeHandle(ref, () => internalVideoRef.current!);
  const [currentQuality, setCurrentQuality] = useState<string>(VIDEO_QUALITY_LEVELS.AUTO);
  const [availableQualities, setAvailableQualities] = useState<Record<string, string>>({});
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressInterval = useRef<number | null>(null);

  // Initialize quality options and detect optimal quality
  useEffect(() => {
    if (!src) return;
    
    const extension = extensionOverride || getFileExtension(src);
    const options = generateQualityOptions(src, extension);
    setAvailableQualities(options);
    
    // Detect optimal quality based on network conditions
    const detectQuality = async () => {
      try {
        const optimalQuality = await detectOptimalQuality();
        console.log(`Optimal quality detected: ${optimalQuality}`);
        setCurrentQuality(optimalQuality);
        
        // If not AUTO, switch to the detected quality
        if (optimalQuality !== VIDEO_QUALITY_LEVELS.AUTO) {
          const qualitySrc = options[optimalQuality] || src;
          setCurrentSrc(qualitySrc);
        }
      } catch (error) {
        console.error('Error detecting optimal quality:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    detectQuality();
    
    // Start preloading the video
    if (videoPreloader) {
      videoPreloader.preloadSegment(src, 0, 1024 * 1024); // Preload first 1MB
    }
    
    // Cleanup on unmount
    return () => {
      if (progressInterval.current) {
        window.clearInterval(progressInterval.current);
      }
    };
  }, [src, extensionOverride]);

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (quality === currentQuality) return;
    
    // Save current playback state and position
    const wasPlaying = !videoRef.current?.paused;
    const currentPosition = videoRef.current?.currentTime || 0;
    
    // Update quality
    setCurrentQuality(quality);
    setIsQualityMenuOpen(false);
    
    if (quality === VIDEO_QUALITY_LEVELS.AUTO) {
      setCurrentSrc(src);
    } else {
      setCurrentSrc(availableQualities[quality] || src);
    }
    
    // Resume playback state after source change
    const onLoadedMetadata = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentPosition;
        if (wasPlaying) {
          videoRef.current.play().catch(e => console.error('Failed to resume playback:', e));
        }
        videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
      }
    };
    
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
    }
  };

  // Set up progress tracking
  useEffect(() => {
    if (!videoRef.current) return;
    
    const updateProgress = () => {
      if (videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const duration = videoRef.current.duration || 0;
        
        setCurrentTime(currentTime);
        setDuration(duration);
        
        if (onProgress) {
          onProgress(currentTime, duration);
        }
      }
    };
    
    // Use a throttled update to avoid too many updates
    const throttledUpdate = debounce(updateProgress, 250);
    
    videoRef.current.addEventListener('timeupdate', throttledUpdate);
    videoRef.current.addEventListener('durationchange', updateProgress);
    videoRef.current.addEventListener('play', () => setIsPlaying(true));
    videoRef.current.addEventListener('pause', () => setIsPlaying(false));
    videoRef.current.addEventListener('ended', () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    });
    
    // Set initial time if provided
    if (startTime > 0 && videoRef.current) {
      videoRef.current.currentTime = startTime;
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', throttledUpdate);
        videoRef.current.removeEventListener('durationchange', updateProgress);
        videoRef.current.removeEventListener('play', () => setIsPlaying(true));
        videoRef.current.removeEventListener('pause', () => setIsPlaying(false));
        videoRef.current.removeEventListener('ended', () => setIsPlaying(false));
      }
    };
  }, [onProgress, onEnded, startTime]);

  // Preload next segment when approaching the end of current buffer
  useEffect(() => {
    if (!videoRef.current || !videoPreloader) return;
    
    const handleProgress = () => {
      if (!videoRef.current) return;
      
      // Get buffered ranges
      const buffered = videoRef.current.buffered;
      if (buffered.length === 0) return;
      
      // Get the end of the current buffer range containing our current time
      let bufferEnd = 0;
      const currentTime = videoRef.current.currentTime;
      
      for (let i = 0; i < buffered.length; i++) {
        if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
          bufferEnd = buffered.end(i);
          break;
        }
      }
      
      // If we're within 10 seconds of the buffer end, preload more content
      if (bufferEnd > 0 && currentTime > bufferEnd - 10) {
        // Estimate byte range for next segment (rough approximation)
        const videoDuration = videoRef.current.duration || 0;
        if (videoDuration <= 0) return;
        
        const totalSize = 10 * 1024 * 1024; // Assume 10MB video file average
        const bytesPerSecond = totalSize / videoDuration;
        
        const startByte = Math.floor(bufferEnd * bytesPerSecond);
        const endByte = startByte + Math.floor(10 * bytesPerSecond); // 10 seconds ahead
        
        // Preload next segment
        videoPreloader.preloadSegment(currentSrc, startByte, endByte);
      }
    };
    
    videoRef.current.addEventListener('progress', handleProgress);
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('progress', handleProgress);
      }
    };
  }, [currentSrc]);

  return (
    <div className={`relative group ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
        </div>
      )}
      
      <video
        ref={videoRef}
        src={currentSrc}
        poster={poster}
        controls={controls}
        autoPlay={autoplay}
        loop={loop}
        preload={preload}
        className="w-full h-full"
        playsInline
      />
      
      {/* Quality selector button */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <Popover open={isQualityMenuOpen} onOpenChange={setIsQualityMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-1 h-8"
            >
              <Settings className="h-4 w-4 mr-1" />
              {currentQuality}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium mb-1">Video Quality</div>
              <Button
                variant="ghost"
                size="sm"
                className="flex justify-between items-center"
                onClick={() => handleQualityChange(VIDEO_QUALITY_LEVELS.AUTO)}
              >
                <span>Auto</span>
                {currentQuality === VIDEO_QUALITY_LEVELS.AUTO && (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              {Object.keys(availableQualities).map((quality) => (
                <Button
                  key={quality}
                  variant="ghost"
                  size="sm"
                  className="flex justify-between items-center"
                  onClick={() => handleQualityChange(quality)}
                >
                  <span>{quality}</span>
                  {currentQuality === quality && <Check className="h-4 w-4" />}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default OptimizedVideoPlayer;