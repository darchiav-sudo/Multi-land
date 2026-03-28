/**
 * Video optimization utilities for better performance
 * Provides functions for preloading, adaptive streaming and resource management
 */

/**
 * Video quality levels for adaptive streaming
 */
export const VIDEO_QUALITY_LEVELS = {
  AUTO: 'auto',
  HD: '1080p',
  HIGH: '720p',
  MEDIUM: '480p',
  LOW: '360p'
};

/**
 * Video preloader for prefetching video segments
 * Helps reduce buffering by loading portions in advance
 */
export class VideoPreloader {
  private preloadCache: Map<string, { blob: Blob, timestamp: number }> = new Map();
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB default cache size
  private currentCacheSize: number = 0;
  
  constructor(maxCacheSizeMB?: number) {
    if (maxCacheSizeMB) {
      this.maxCacheSize = maxCacheSizeMB * 1024 * 1024;
    }
  }
  
  /**
   * Preload a video segment to reduce buffering
   * @param url The video URL or segment URL
   * @param byteStart Start byte position for range request
   * @param byteEnd End byte position for range request
   * @returns Promise resolving to the cached blob
   */
  async preloadSegment(url: string, byteStart?: number, byteEnd?: number): Promise<Blob | null> {
    const cacheKey = byteStart !== undefined && byteEnd !== undefined
      ? `${url}_${byteStart}_${byteEnd}`
      : url;
      
    // Return from cache if available
    if (this.preloadCache.has(cacheKey)) {
      const cached = this.preloadCache.get(cacheKey)!;
      // Update access timestamp
      cached.timestamp = Date.now();
      return cached.blob;
    }
    
    // Skip preloading if we're offline
    if (!navigator.onLine) {
      return null;
    }
    
    try {
      const headers: HeadersInit = {};
      if (byteStart !== undefined && byteEnd !== undefined) {
        headers['Range'] = `bytes=${byteStart}-${byteEnd}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) return null;
      
      const blob = await response.blob();
      
      // Make room in the cache if needed
      this.evictIfNeeded(blob.size);
      
      // Cache the segment
      this.preloadCache.set(cacheKey, {
        blob,
        timestamp: Date.now()
      });
      this.currentCacheSize += blob.size;
      
      return blob;
    } catch (error) {
      console.error("Error preloading video segment:", error);
      return null;
    }
  }
  
  /**
   * Clear the preload cache
   */
  clearCache(): void {
    this.preloadCache.clear();
    this.currentCacheSize = 0;
  }
  
  /**
   * Evict least recently used segments to make room in the cache
   * @param neededSize Size needed for new segment
   */
  private evictIfNeeded(neededSize: number): void {
    if (this.currentCacheSize + neededSize <= this.maxCacheSize) {
      return;
    }
    
    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(this.preloadCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Evict oldest entries until we have enough space
    while (this.currentCacheSize + neededSize > this.maxCacheSize && entries.length > 0) {
      const [key, entry] = entries.shift()!;
      this.preloadCache.delete(key);
      this.currentCacheSize -= entry.blob.size;
    }
  }
}

/**
 * Detects the optimal initial video quality based on network conditions
 * @returns Promise resolving to the recommended quality level
 */
export async function detectOptimalQuality(): Promise<string> {
  try {
    // Use Navigator Connection API if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        // Check if we're on a slow connection
        if (connection.saveData) {
          return VIDEO_QUALITY_LEVELS.LOW; // Prefer low quality on data saver mode
        }
        
        // Check connection type
        const connectionType = connection.effectiveType || connection.type;
        
        if (connectionType === '4g' || connectionType === 'wifi') {
          return VIDEO_QUALITY_LEVELS.HIGH;
        } else if (connectionType === '3g') {
          return VIDEO_QUALITY_LEVELS.MEDIUM;
        } else {
          return VIDEO_QUALITY_LEVELS.LOW;
        }
      }
    }
    
    // Fallback: Measure actual download speed
    const testUrl = 'https://httpbin.org/bytes/1000000'; // 1MB test file
    const startTime = Date.now();
    
    try {
      const response = await fetch(testUrl);
      if (!response.ok) throw new Error('Network test failed');
      
      const blob = await response.blob();
      const endTime = Date.now();
      
      const durationSeconds = (endTime - startTime) / 1000;
      const fileSizeMB = blob.size / (1024 * 1024);
      const speedMbps = (fileSizeMB * 8) / durationSeconds;
      
      // Choose quality based on speed
      if (speedMbps > 5) {
        return VIDEO_QUALITY_LEVELS.HIGH;
      } else if (speedMbps > 2) {
        return VIDEO_QUALITY_LEVELS.MEDIUM;
      } else {
        return VIDEO_QUALITY_LEVELS.LOW;
      }
    } catch (error) {
      console.error('Speed test failed:', error);
      return VIDEO_QUALITY_LEVELS.MEDIUM; // Default to medium on error
    }
  } catch (error) {
    console.error('Error detecting optimal quality:', error);
    return VIDEO_QUALITY_LEVELS.AUTO; // Default to auto if detection fails
  }
}

/**
 * Generates a video thumbnail from a given video URL
 * @param videoUrl The URL of the video
 * @param timeInSeconds The time in seconds to capture the thumbnail
 * @param width Width of the thumbnail
 * @param height Height of the thumbnail
 * @returns Promise resolving to a data URL of the thumbnail
 */
export function generateVideoThumbnail(
  videoUrl: string,
  timeInSeconds: number = 0,
  width: number = 320,
  height: number = 180
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.style.display = 'none';
    document.body.appendChild(video);
    
    video.onloadedmetadata = () => {
      // Ensure we don't exceed the video duration
      const safeTime = Math.min(timeInSeconds, video.duration - 0.1);
      video.currentTime = safeTime;
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Draw the video frame on the canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Clean up
        document.body.removeChild(video);
        
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    video.onerror = (error) => {
      document.body.removeChild(video);
      reject(error);
    };
    
    // Set src and start loading
    video.src = videoUrl;
    video.load();
  });
}

// Singleton instance for app-wide usage
export const videoPreloader = new VideoPreloader();

// Export a function to generate quality options based on source URL
export function generateQualityOptions(baseUrl: string, extension: string = 'mp4'): Record<string, string> {
  if (!baseUrl) return {};
  
  // Remove any existing quality suffix and file extension
  const cleanBaseUrl = baseUrl.replace(/_\d+p\.\w+$/, '').replace(/\.\w+$/, '');
  
  return {
    [VIDEO_QUALITY_LEVELS.HD]: `${cleanBaseUrl}_1080p.${extension}`,
    [VIDEO_QUALITY_LEVELS.HIGH]: `${cleanBaseUrl}_720p.${extension}`,
    [VIDEO_QUALITY_LEVELS.MEDIUM]: `${cleanBaseUrl}_480p.${extension}`,
    [VIDEO_QUALITY_LEVELS.LOW]: `${cleanBaseUrl}_360p.${extension}`
  };
}