import { useEffect, useRef, useState } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface YouTubePlayerProps {
  videoUrl: string;
  title?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  className?: string;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function YouTubePlayer({ videoUrl, title, onProgress, onComplete, className = "" }: YouTubePlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoId = extractYouTubeId(videoUrl);

  useEffect(() => {
    console.log('YouTube Player - URL:', videoUrl);
    console.log('YouTube Player - Extracted ID:', videoId);
    
    if (!videoId) {
      console.error('YouTube Player - Invalid video ID extracted from:', videoUrl);
      setError('Invalid YouTube URL');
      setIsLoading(false);
      return;
    }

    // Add timeout for loading state
    const loadingTimeout = setTimeout(() => {
      console.warn('YouTube Player - Loading timeout after 10 seconds');
      setError('Video loading timed out. Please try refreshing the page.');
      setIsLoading(false);
    }, 10000);

    // Load YouTube IFrame API
    if (!window.YT) {
      console.log('YouTube Player - Loading YouTube IFrame API');
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube Player - API Ready');
        clearTimeout(loadingTimeout);
        initializePlayer();
      };
    } else {
      console.log('YouTube Player - API already loaded');
      clearTimeout(loadingTimeout);
      initializePlayer();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  const initializePlayer = () => {
    if (!videoId) {
      console.error('YouTube Player - No video ID for initialization');
      return;
    }

    console.log('YouTube Player - Initializing player for ID:', videoId);

    try {
      // Ensure container element exists
      const containerId = `youtube-player-${videoId}`;
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('YouTube Player - Container not found:', containerId);
        setError('Player container not found');
        setIsLoading(false);
        return;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            console.log('YouTube Player - Player ready');
            setIsLoading(false);
            setError(null);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            console.log('YouTube Player - State change:', state);
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startProgressTracking();
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              stopProgressTracking();
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              stopProgressTracking();
              onComplete?.();
            }
          },
          onError: (event: any) => {
            console.error('YouTube Player - Error:', event.data);
            setError('Failed to load video. Please check if the video is accessible.');
            setIsLoading(false);
          },
        },
      });
    } catch (err) {
      console.error('YouTube Player - Initialization error:', err);
      setError('Failed to initialize video player');
      setIsLoading(false);
    }
  };

  const startProgressTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        
        if (duration > 0) {
          const progress = (currentTime / duration) * 100;
          onProgress?.(Math.min(progress, 100));
        }
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  if (!videoId) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Invalid YouTube URL format</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.open(videoUrl, '_blank')} variant="outline">
          <Play className="h-4 w-4 mr-2" />
          Open in YouTube
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-100 rounded-lg aspect-video flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <div className="aspect-video">
        <div id={`youtube-player-${videoId}`} className="w-full h-full"></div>
      </div>
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <h3 className="text-white font-medium truncate">{title}</h3>
        </div>
      )}
    </div>
  );
}

// Global type declarations for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}