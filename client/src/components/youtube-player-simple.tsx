import { useState } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
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

export function YouTubePlayerSimple({ videoUrl, title, className = "" }: YouTubePlayerProps) {
  const [hasError, setHasError] = useState(false);
  const videoId = extractYouTubeId(videoUrl);

  console.log('YouTubePlayerSimple - URL:', videoUrl);
  console.log('YouTubePlayerSimple - Extracted ID:', videoId);

  if (!videoId) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Invalid YouTube URL format</p>
        <Button onClick={() => window.open(videoUrl, '_blank')} variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in YouTube
        </Button>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Unable to load video</p>
        <Button onClick={() => window.open(videoUrl, '_blank')} variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in YouTube
        </Button>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&showinfo=0`;

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <div className="aspect-video">
        <iframe
          src={embedUrl}
          title={title || "YouTube video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
          onError={() => {
            console.error('YouTube iframe failed to load');
            setHasError(true);
          }}
        />
      </div>
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <h3 className="text-white font-medium truncate">{title}</h3>
        </div>
      )}
    </div>
  );
}