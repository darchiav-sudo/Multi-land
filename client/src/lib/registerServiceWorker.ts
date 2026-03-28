// Service Worker Registration - Multi Land v2.0.5 - No Cache Version
import { initOfflineSupport } from './offline-db';
import { checkForUpdates } from './version-checker';

// App version for tracking updates
export const APP_VERSION = '2.0.5';

// Key for tracking refresh to prevent infinite loops
const REFRESH_GUARD_KEY = 'sw_refresh_guard';
const REFRESH_COOLDOWN_MS = 10000; // 10 seconds cooldown between refreshes

// Check if we're in a refresh loop
function isInRefreshLoop(): boolean {
  try {
    const lastRefresh = sessionStorage.getItem(REFRESH_GUARD_KEY);
    if (lastRefresh) {
      const elapsed = Date.now() - parseInt(lastRefresh, 10);
      if (elapsed < REFRESH_COOLDOWN_MS) {
        console.log('Refresh loop detected, skipping reload. Elapsed:', elapsed, 'ms');
        return true;
      }
    }
  } catch (e) {
    // sessionStorage might not be available
  }
  return false;
}

// Mark that we're about to refresh
function markRefresh(): void {
  try {
    sessionStorage.setItem(REFRESH_GUARD_KEY, Date.now().toString());
  } catch (e) {
    // sessionStorage might not be available
  }
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      console.log('Preparing to register service worker');
      
      // Register service worker with stable URL - browser handles updates internally
      // Even if a service worker is already active, calling register() allows the browser
      // to check for updates according to its normal update cycle
      const registration = await navigator.serviceWorker.register(
        `/service-worker.js`, 
        { scope: '/' }
      );
      
      console.log('Service Worker registered with scope:', registration.scope);
      
      // Listen for updates - prompt user instead of auto-reloading
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          console.log('New service worker found, waiting for install...');
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user via version checker
              console.log('New service worker installed, update available');
              window.dispatchEvent(new CustomEvent('app-update-available', { 
                detail: { source: 'service-worker' }
              }));
            }
          });
        }
      });
      
      // Initialize basic offline support
      await initOfflineSupport();
      
      // IMPORTANT: Do NOT auto-reload on controllerchange - this causes infinite loops
      // The version checker and updatefound handler will notify users of updates instead
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  } else {
    console.warn('Service Worker is not supported in this browser');
  }
}

// Check for app updates - works with no-cache approach
// This is called MANUALLY by users when they want to update
export function checkForAppUpdates() {
  if ('serviceWorker' in navigator) {
    try {
      // Prevent refresh loops - only allow one refresh per cooldown period
      if (isInRefreshLoop()) {
        console.log('Skipping update - refresh cooldown active');
        return;
      }
      
      console.log('Forcing app update by refreshing service worker');
      
      // First unregister all existing service workers
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
          console.log('Unregistered service worker for update');
        }
        
        // Then clear all caches
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
            console.log('Deleted cache:', cacheName);
          });
          
          // Mark that we're about to refresh to prevent loops
          markRefresh();
          
          // Finally, reload the page to get fresh content
          console.log('Reloading page to apply updates');
          window.location.reload();
        });
      });
    } catch (error) {
      console.error('Error checking for Service Worker updates:', error);
    }
  }
}

// Register for push notifications
export async function registerForPushNotifications() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }
      
      // Subscribe to push notifications
      const options = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // This is a placeholder - you should replace with your actual VAPID public key
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
        )
      };
      
      const subscription = await registration.pushManager.subscribe(options);
      console.log('Push notification subscription:', JSON.stringify(subscription));
      
      // Send the subscription to your server
      // await sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }
}

// Utility function to convert base64 to Uint8Array for push subscription
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}