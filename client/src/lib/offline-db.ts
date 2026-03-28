// Enhanced IndexedDB for improved offline support with video caching
import { Progress } from '@shared/schema';

const DB_NAME = 'multiland_offline_db';
const DB_VERSION = 2; // Increased version to add video cache store

const STORES = {
  PROGRESS: 'progress',
  COMMENTS: 'comments',
  QUEUE: 'request_queue',
  VIDEO_CACHE: 'video_cache',
  COURSE_DATA: 'course_data'
};

type OfflineProgressData = {
  id: string;
  userId: number;
  contentId: number;
  completed?: boolean;
  progress?: number;
  timestamp: number;
};

type OfflineComment = {
  id: string;
  userId: number;
  contentId: number;
  text: string;
  parentId?: number | null;
  timestamp: number;
};

type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  body: string;
  timestamp: number;
  attempts: number;
};

// Video cache entry
type VideoCacheEntry = {
  url: string;
  contentId: number;
  lessonId: number;
  title: string;
  blob: Blob;
  size: number;
  mimeType: string;
  timestamp: number;
  expiresAt: number; // Timestamp when this cache should expire
};

// Course data for offline access
type OfflineCourseData = {
  id: number;
  title: string;
  description: string;
  lessons: {
    id: number;
    title: string;
    videoItems?: { url: string; name: string; }[];
    pdfItems?: { url: string; name: string; }[];
    textContent?: string;
  }[];
  timestamp: number;
  expiresAt: number; // When offline course data should be refreshed
};

// Open the database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open offline database');
      reject(new Error('Could not open IndexedDB'));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
        progressStore.createIndex('userId', 'userId', { unique: false });
        progressStore.createIndex('contentId', 'contentId', { unique: false });
        progressStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.COMMENTS)) {
        const commentsStore = db.createObjectStore(STORES.COMMENTS, { keyPath: 'id' });
        commentsStore.createIndex('userId', 'userId', { unique: false });
        commentsStore.createIndex('contentId', 'contentId', { unique: false });
        commentsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('attempts', 'attempts', { unique: false });
      }
      
      // Add video cache store in version 2
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORES.VIDEO_CACHE)) {
          const videoCacheStore = db.createObjectStore(STORES.VIDEO_CACHE, { keyPath: 'url' });
          videoCacheStore.createIndex('contentId', 'contentId', { unique: false });
          videoCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          videoCacheStore.createIndex('size', 'size', { unique: false });
          console.log('Created video cache store for offline viewing');
        }
        
        if (!db.objectStoreNames.contains(STORES.COURSE_DATA)) {
          const courseDataStore = db.createObjectStore(STORES.COURSE_DATA, { keyPath: 'id' });
          courseDataStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created course data store for offline access');
        }
      }
    };
  });
}

// Save progress data when offline
export async function saveOfflineProgress(data: Omit<OfflineProgressData, 'id' | 'timestamp'>): Promise<string> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.PROGRESS], 'readwrite');
    const store = transaction.objectStore(STORES.PROGRESS);
    
    const id = crypto.randomUUID();
    const progressData: OfflineProgressData = {
      ...data,
      id,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(progressData);
      
      request.onsuccess = () => {
        // Register for background sync if supported
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            // @ts-ignore - TypeScript doesn't recognize sync API yet
            registration.sync.register('course-progress-sync').catch((err: Error) => {
              console.error('Background sync registration failed:', err);
            });
          });
        }
        resolve(id);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to save offline progress'));
      };
    });
  } catch (error) {
    console.error('Error in saveOfflineProgress:', error);
    throw error;
  }
}

// Get all stored progress data
export async function getOfflineProgressData(): Promise<OfflineProgressData[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.PROGRESS], 'readonly');
    const store = transaction.objectStore(STORES.PROGRESS);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get offline progress data'));
      };
    });
  } catch (error) {
    console.error('Error in getOfflineProgressData:', error);
    return [];
  }
}

// Remove a progress entry
export async function removeProgressData(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.PROGRESS], 'readwrite');
    const store = transaction.objectStore(STORES.PROGRESS);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to remove progress data'));
      };
    });
  } catch (error) {
    console.error('Error in removeProgressData:', error);
    return false;
  }
}

// Save a comment when offline
export async function saveOfflineComment(data: Omit<OfflineComment, 'id' | 'timestamp'>): Promise<string> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.COMMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.COMMENTS);
    
    const id = crypto.randomUUID();
    const commentData: OfflineComment = {
      ...data,
      id,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(commentData);
      
      request.onsuccess = () => {
        // Register for background sync if supported
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            // @ts-ignore - TypeScript doesn't recognize sync API yet
            registration.sync.register('comment-sync').catch((err: Error) => {
              console.error('Background sync registration failed:', err);
            });
          });
        }
        resolve(id);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to save offline comment'));
      };
    });
  } catch (error) {
    console.error('Error in saveOfflineComment:', error);
    throw error;
  }
}

// Get all stored comments
export async function getOfflineComments(): Promise<OfflineComment[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.COMMENTS], 'readonly');
    const store = transaction.objectStore(STORES.COMMENTS);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get offline comments'));
      };
    });
  } catch (error) {
    console.error('Error in getOfflineComments:', error);
    return [];
  }
}

// Remove a comment entry
export async function removeOfflineComment(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.COMMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.COMMENTS);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to remove comment'));
      };
    });
  } catch (error) {
    console.error('Error in removeOfflineComment:', error);
    return false;
  }
}

// Queue a request for later execution
export async function queueRequest(url: string, method: string, body: any): Promise<string> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.QUEUE);
    
    const id = crypto.randomUUID();
    const queueData: QueuedRequest = {
      id,
      url,
      method,
      body: JSON.stringify(body),
      timestamp: Date.now(),
      attempts: 0
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(queueData);
      
      request.onsuccess = () => {
        resolve(id);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to queue request'));
      };
    });
  } catch (error) {
    console.error('Error in queueRequest:', error);
    throw error;
  }
}

// Register for periodic sync (for content updates)
export async function registerPeriodicSync() {
  if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // @ts-ignore - TypeScript doesn't recognize periodicSync yet
      const status = await navigator.permissions.query({
        // @ts-ignore - TypeScript doesn't recognize this permission name
        name: 'periodic-background-sync',
      });
      
      if (status.state === 'granted') {
        // @ts-ignore - TypeScript doesn't recognize periodicSync yet
        await registration.periodicSync.register('update-content', {
          minInterval: 24 * 60 * 60 * 1000, // once per day
        });
        console.log('Periodic background sync registered!');
      } else {
        console.log('Periodic background sync rejected.');
      }
    } catch (error) {
      console.error('Error registering periodic sync:', error);
    }
  }
}

// Cache a video for offline viewing
export async function cacheVideoForOffline(
  url: string, 
  contentId: number, 
  lessonId: number, 
  title: string
): Promise<boolean> {
  try {
    // Check if already cached
    const existingCache = await getVideoFromCache(url);
    if (existingCache) {
      console.log(`Video already cached: ${url}`);
      return true;
    }

    // Fetch the video file
    console.log(`Starting to cache video: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    
    // Get the video as a blob
    const blob = await response.blob();
    console.log(`Video downloaded, size: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
    
    // Get storage availability
    const storageEstimate = await getStorageEstimate();
    if (storageEstimate.availableSpace < blob.size * 1.2) { // Leave some buffer
      throw new Error(`Not enough storage space. Need ${(blob.size / (1024 * 1024)).toFixed(2)} MB but only have ${(storageEstimate.availableSpace / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    // Store in IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORES.VIDEO_CACHE], 'readwrite');
    const store = transaction.objectStore(STORES.VIDEO_CACHE);
    
    const now = Date.now();
    const cacheEntry: VideoCacheEntry = {
      url,
      contentId,
      lessonId,
      title,
      blob,
      size: blob.size,
      mimeType: blob.type || 'video/mp4',
      timestamp: now,
      expiresAt: now + (30 * 24 * 60 * 60 * 1000), // 30 days by default
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(cacheEntry);
      
      request.onsuccess = () => {
        console.log(`Video cached successfully: ${url}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error(`Failed to cache video: ${url}`, request.error);
        reject(new Error(`Failed to cache video: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error caching video:', error);
    return false;
  }
}

// Get a cached video
export async function getVideoFromCache(url: string): Promise<VideoCacheEntry | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.VIDEO_CACHE], 'readonly');
    const store = transaction.objectStore(STORES.VIDEO_CACHE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      
      request.onsuccess = () => {
        const entry = request.result as VideoCacheEntry;
        
        // If expired, delete and return null
        if (entry && entry.expiresAt < Date.now()) {
          console.log(`Cached video expired: ${url}`);
          removeVideoFromCache(url).catch(console.error);
          resolve(null);
        } else {
          resolve(entry || null);
        }
      };
      
      request.onerror = () => {
        console.error(`Failed to get cached video: ${url}`, request.error);
        reject(new Error(`Failed to get cached video: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error getting cached video:', error);
    return null;
  }
}

// Remove a video from cache
export async function removeVideoFromCache(url: string): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.VIDEO_CACHE], 'readwrite');
    const store = transaction.objectStore(STORES.VIDEO_CACHE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(url);
      
      request.onsuccess = () => {
        console.log(`Video removed from cache: ${url}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error(`Failed to remove cached video: ${url}`, request.error);
        reject(new Error(`Failed to remove cached video: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error removing cached video:', error);
    return false;
  }
}

// Create URL for cached video
export function createVideoObjectURL(cacheEntry: VideoCacheEntry): string {
  return URL.createObjectURL(cacheEntry.blob);
}

// Get all cached videos
export async function getAllCachedVideos(): Promise<VideoCacheEntry[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.VIDEO_CACHE], 'readonly');
    const store = transaction.objectStore(STORES.VIDEO_CACHE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result as VideoCacheEntry[];
        const now = Date.now();
        
        // Filter out expired entries
        const validEntries = entries.filter(entry => entry.expiresAt > now);
        
        // If any were filtered out, clean them up
        if (validEntries.length < entries.length) {
          entries
            .filter(entry => entry.expiresAt <= now)
            .forEach(entry => {
              removeVideoFromCache(entry.url).catch(console.error);
            });
        }
        
        resolve(validEntries);
      };
      
      request.onerror = () => {
        console.error('Failed to get all cached videos', request.error);
        reject(new Error(`Failed to get all cached videos: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error getting all cached videos:', error);
    return [];
  }
}

// Clean up old cached videos to make space
export async function cleanupVideoCache(targetSizeInMB: number = 500): Promise<number> {
  try {
    const cachedVideos = await getAllCachedVideos();
    
    // Sort by oldest first
    cachedVideos.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate current cache size
    const totalSize = cachedVideos.reduce((total, entry) => total + entry.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    
    console.log(`Current video cache size: ${totalSizeMB.toFixed(2)} MB, target: ${targetSizeInMB} MB`);
    
    if (totalSizeMB <= targetSizeInMB) {
      return 0; // No cleanup needed
    }
    
    // Need to free up space
    const bytesToFree = totalSize - (targetSizeInMB * 1024 * 1024);
    let freedBytes = 0;
    let removedCount = 0;
    
    for (const entry of cachedVideos) {
      await removeVideoFromCache(entry.url);
      freedBytes += entry.size;
      removedCount++;
      
      if (freedBytes >= bytesToFree) {
        break;
      }
    }
    
    console.log(`Cleaned up ${removedCount} videos, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`);
    return removedCount;
  } catch (error) {
    console.error('Error cleaning up video cache:', error);
    return 0;
  }
}

// Get storage estimate
export async function getStorageEstimate(): Promise<{ 
  totalSpace: number;
  usedSpace: number;
  availableSpace: number;
  quotaExceeded: boolean;
}> {
  try {
    // @ts-ignore - Some browsers may not support navigator.storage.estimate()
    if (navigator.storage && navigator.storage.estimate) {
      // @ts-ignore
      const estimate = await navigator.storage.estimate();
      return {
        totalSpace: estimate.quota || 0,
        usedSpace: estimate.usage || 0,
        availableSpace: (estimate.quota || 0) - (estimate.usage || 0),
        quotaExceeded: (estimate.usage || 0) >= (estimate.quota || 0)
      };
    }
    
    // Fallback for browsers without storage estimate
    return {
      totalSpace: 1024 * 1024 * 1024, // Assume 1GB
      usedSpace: 0,
      availableSpace: 1024 * 1024 * 1024,
      quotaExceeded: false
    };
  } catch (error) {
    console.error('Error getting storage estimate:', error);
    return {
      totalSpace: 0,
      usedSpace: 0,
      availableSpace: 0,
      quotaExceeded: true
    };
  }
}

// Save course data for offline access
export async function saveCourseDataForOffline(courseData: Omit<OfflineCourseData, 'timestamp' | 'expiresAt'>): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.COURSE_DATA], 'readwrite');
    const store = transaction.objectStore(STORES.COURSE_DATA);
    
    const now = Date.now();
    const data: OfflineCourseData = {
      ...courseData,
      timestamp: now,
      expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7 days
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log(`Course data saved for offline: ${courseData.id}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error(`Failed to save course data: ${courseData.id}`, request.error);
        reject(new Error(`Failed to save course data: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error saving course data:', error);
    return false;
  }
}

// Get course data for offline access
export async function getCourseDataForOffline(courseId: number): Promise<OfflineCourseData | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORES.COURSE_DATA], 'readonly');
    const store = transaction.objectStore(STORES.COURSE_DATA);
    
    return new Promise((resolve, reject) => {
      const request = store.get(courseId);
      
      request.onsuccess = () => {
        const data = request.result as OfflineCourseData;
        
        // If expired, delete and return null
        if (data && data.expiresAt < Date.now()) {
          console.log(`Course data expired: ${courseId}`);
          // Remove expired data
          const deleteTransaction = db.transaction([STORES.COURSE_DATA], 'readwrite');
          const deleteStore = deleteTransaction.objectStore(STORES.COURSE_DATA);
          deleteStore.delete(courseId);
          resolve(null);
        } else {
          resolve(data || null);
        }
      };
      
      request.onerror = () => {
        console.error(`Failed to get course data: ${courseId}`, request.error);
        reject(new Error(`Failed to get course data: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (error) {
    console.error('Error getting course data:', error);
    return null;
  }
}

// Initialize offline support
export async function initOfflineSupport() {
  // Register for periodic sync
  await registerPeriodicSync();
  
  // Attempt to sync any pending data
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-ignore - TypeScript doesn't recognize sync API yet
      await registration.sync.register('course-progress-sync');
      // @ts-ignore - TypeScript doesn't recognize sync API yet
      await registration.sync.register('comment-sync');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
  
  // Clean up expired videos
  try {
    const videos = await getAllCachedVideos();
    console.log(`Found ${videos.length} cached videos`);
    
    // Clean up to target size (500MB by default)
    await cleanupVideoCache();
  } catch (error) {
    console.error('Error during cache cleanup:', error);
  }
}