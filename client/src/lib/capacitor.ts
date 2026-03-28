import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { checkForAppUpdates } from './registerServiceWorker';
import { saveOfflineProgress, saveOfflineComment } from './offline-db';

// Extend the Window interface to include Capacitor
declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => string;
      Plugins?: any;
      [key: string]: any;
    };
    opera?: any;
    MSStream?: any;
  }
}

// Check if the app is running in a Capacitor environment (native mobile)
export const isNative = () => {
  return window.hasOwnProperty('Capacitor');
};

// Get detailed mobile device information
export const getMobileInfo = () => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  let deviceType = 'unknown';
  let os = 'unknown';
  let browser = 'unknown';
  let version = 'unknown';
  
  // OS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    os = 'iOS';
    // Extract iOS version
    const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      version = `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`;
    }
  } else if (/android/i.test(userAgent)) {
    os = 'Android';
    // Extract Android version
    const match = userAgent.match(/Android (\d+(?:\.\d+)*)/);
    if (match) {
      version = match[1];
    }
  } else if (/Windows Phone/i.test(userAgent)) {
    os = 'Windows Phone';
  } else if (/Windows NT/.test(userAgent)) {
    os = 'Windows';
  } else if (/Macintosh/.test(userAgent)) {
    os = 'MacOS';
  } else if (/Linux/.test(userAgent)) {
    os = 'Linux';
  }
  
  // Device type detection
  if (/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    deviceType = (/tablet|ipad|playbook/i.test(userAgent)) ? 'tablet' : 'mobile';
  } else {
    deviceType = 'desktop';
  }
  
  // Browser detection
  if (/OPR|Opera/.test(userAgent)) {
    browser = 'Opera';
  } else if (/Firefox/.test(userAgent)) {
    browser = 'Firefox';
  } else if (/Edg\//.test(userAgent)) {
    browser = 'Edge';
  } else if (/Chrome/.test(userAgent)) {
    browser = 'Chrome';
  } else if (/Safari/.test(userAgent)) {
    browser = 'Safari';
  } else if (/MSIE|Trident/.test(userAgent)) {
    browser = 'Internet Explorer';
  }
  
  return {
    deviceType,
    os,
    browser,
    version,
    userAgent,
    isNative: isNative(),
    isMobile: deviceType === 'mobile' || deviceType === 'tablet'
  };
};

// Detect iOS devices (both native and browser)
export const isIOS = () => {
  // Check if in Capacitor iOS app
  if (isNative() && (window as any).Capacitor?.getPlatform?.() === 'ios') {
    return true;
  }
  
  // Check if in iOS browser
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
};

// Detect Android devices (both native and browser)
export const isAndroid = () => {
  // Check if in Capacitor Android app
  if (isNative() && (window as any).Capacitor?.getPlatform?.() === 'android') {
    return true;
  }
  
  // Check if in Android browser
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android/i.test(userAgent);
};

// Detect any mobile device (iOS, Android, or other)
export const isMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

// Initialize Capacitor and apply platform-specific fixes
export const initCapacitor = async () => {
  // Log device info for debugging
  const deviceInfo = getMobileInfo();
  console.log('Device info:', deviceInfo);
  
  // Apply platform-specific fixes
  if (isIOS()) {
    applyIOSFixes();
    document.body.classList.add('ios-device');
  } else if (isAndroid()) {
    applyAndroidFixes();
    document.body.classList.add('android-device');
  } else if (isMobile()) {
    applyGenericMobileFixes();
    document.body.classList.add('mobile-device');
  }
  
  // Don't continue with native initialization if not in native app
  if (!isNative()) return;

  // Set up status bar
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch (error) {
    console.error('Error setting status bar:', error);
  }

  // Set up app lifecycle event listeners
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('App state changed. Is active:', isActive);
    
    // Check for updates when app comes to foreground
    if (isActive && import.meta.env.PROD) {
      checkForAppUpdates();
    }
  });

  App.addListener('backButton', () => {
    // Handle custom back button logic if needed
    // If at root, prompt to exit
    if (window.location.pathname === '/') {
      if (confirm('Do you want to exit the app?')) {
        exitApp();
      }
    } else {
      // Otherwise go back in history
      window.history.back();
    }
  });

  // Hide the splash screen with a fade animation
  try {
    await SplashScreen.hide({
      fadeOutDuration: 500
    });
  } catch (error) {
    console.error('Error hiding splash screen:', error);
  }
};

// Apply iOS-specific fixes and optimizations
export const applyIOSFixes = () => {
  if (!isIOS()) return;
  
  // Add meta viewport tag to prevent zooming on inputs
  let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta') as HTMLMetaElement;
    viewportMeta.setAttribute('name', 'viewport');
    document.head.appendChild(viewportMeta);
  }
  
  // Set content with maximum-scale and user-scalable to prevent zooming
  viewportMeta.setAttribute('content', 
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  
  // Fix for pull-to-refresh sensitivity by disabling it completely
  document.body.style.overscrollBehavior = 'none';
  
  // Add special style for iOS to prevent various UI glitches
  const style = document.createElement('style');
  style.innerHTML = `
    /* Prevent double-tap zoom */
    * { touch-action: manipulation; }
    
    /* Fix iOS scrolling issues */
    html, body {
      height: 100%;
      -webkit-overflow-scrolling: touch;
      overflow-x: hidden;
    }
    
    /* Fix iOS input field zooming */
    input, select, textarea {
      font-size: 16px !important; /* Prevent zoom on focus */
    }
    
    /* Fix iOS button highlight */
    button, a {
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
  `;
  document.head.appendChild(style);
  
  // Fix for position: fixed elements disappearing when keyboard opens
  window.addEventListener('resize', () => {
    // Force redraw by triggering a reflow
    document.body.style.display = 'none';
    // Need to access a layout property to force reflow
    document.body.offsetHeight;
    document.body.style.display = '';
  });
  
  // Fix for iOS input focus issues
  document.addEventListener('touchend', (e) => {
    // Detect if touch is on an input element
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Add a slight delay before focusing to prevent iOS keyboard glitches
      setTimeout(() => {
        (target as HTMLInputElement).focus();
      }, 100);
    }
  });
  
  // Disable pull to refresh in iOS but only at the top of the page
  let startY = 0;
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 5) { // Only track if near the top
      startY = e.touches[0].clientY;
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', (e) => {
    // Only prevent default if we're pulling down from the top of the page
    if (window.scrollY <= 5 && e.touches[0].clientY > startY + 10) {
      e.preventDefault();
    }
  }, { passive: false });

  console.log("iOS specific fixes applied");
};

// Apply Android-specific fixes and optimizations
export const applyAndroidFixes = () => {
  if (!isAndroid()) return;
  
  // Add meta viewport tag for Android
  let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta') as HTMLMetaElement;
    viewportMeta.setAttribute('name', 'viewport');
    document.head.appendChild(viewportMeta);
  }
  
  // Set content for Android - allowing pinch zoom but preventing auto-zoom on inputs
  viewportMeta.setAttribute('content', 
    'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');
  
  // Add special style for Android to prevent various UI glitches
  const style = document.createElement('style');
  style.innerHTML = `
    /* Prevent Android-specific issues */
    * {
      -webkit-tap-highlight-color: transparent;
    }
    
    /* Fix font rendering on Android */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    /* Fix Android input field issues */
    input, textarea {
      font-size: 16px; /* Prevent zoom on focus */
      background-color: transparent; /* Fix Android input background */
    }
    
    /* Fix Android button issues */
    button {
      background-image: none; /* Remove default Android button gradient */
    }
  `;
  document.head.appendChild(style);
  
  // Fix for Chrome/Android 300ms tap delay
  // This is particularly important for Android devices
  const script = document.createElement('script');
  script.innerHTML = `
    // Add passive event listeners where supported
    document.addEventListener('touchstart', function(){}, {passive: true});
    document.addEventListener('touchmove', function(){}, {passive: true});
  `;
  document.head.appendChild(script);
  
  // Handle Android back button via history API
  window.addEventListener('popstate', () => {
    // Do nothing, just catch the event to handle native back properly
  });
  
  console.log("Android specific fixes applied");
};

// Apply generic mobile fixes for other platforms
export const applyGenericMobileFixes = () => {
  // Add meta viewport tag
  let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta') as HTMLMetaElement;
    viewportMeta.setAttribute('name', 'viewport');
    document.head.appendChild(viewportMeta);
  }
  
  // Set reasonable defaults
  viewportMeta.setAttribute('content', 
    'width=device-width, initial-scale=1, maximum-scale=2, user-scalable=yes');
  
  // Add styles for mobile devices in general
  const style = document.createElement('style');
  style.innerHTML = `
    /* Generic mobile fixes */
    * {
      touch-action: manipulation; /* Improve touch response */
      -webkit-tap-highlight-color: rgba(0,0,0,0); /* Remove tap highlights */
    }
    
    /* Make buttons and links more tappable */
    button, a, .clickable {
      min-height: 44px; /* Recommended minimum for touch targets */
      min-width: 44px;
    }

    /* Ensure proper sizing and prevent horizontal overflow */
    html, body {
      max-width: 100vw;
      overflow-x: hidden;
    }
    
    /* Make form inputs more usable on mobile */
    input, select, textarea {
      font-size: 16px; /* Prevent zoom on focus */
      max-width: 100%;
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);
  
  console.log("Generic mobile fixes applied");
};

// Network status monitoring with service worker sync integration
export const setupNetworkListeners = (
  onOnline?: () => void,
  onOffline?: () => void
) => {
  // Create a variable to track network status
  let isOnline = true;
  
  // For web and native, listen to online/offline events
  window.addEventListener('online', () => {
    console.log('Browser online event');
    if (!isOnline) {
      isOnline = true;
      if (onOnline) onOnline();
      
      // Trigger sync when coming back online
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          // @ts-ignore - TypeScript doesn't recognize sync property yet
          registration.sync.register('course-progress-sync');
          // @ts-ignore
          registration.sync.register('comment-sync');
        }).catch(err => {
          console.error('Sync registration failed:', err);
        });
      }
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Browser offline event');
    isOnline = false;
    if (onOffline) onOffline();
  });

  // If in native mode, also use the Network plugin
  if (isNative()) {
    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status.connected);
      isOnline = status.connected;
      
      if (status.connected) {
        if (onOnline) onOnline();
        
        // Trigger sync when coming back online
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            // @ts-ignore - TypeScript doesn't recognize sync property yet
            registration.sync.register('course-progress-sync');
            // @ts-ignore
            registration.sync.register('comment-sync');
          }).catch(err => {
            console.error('Sync registration failed:', err);
          });
        }
      } else {
        if (onOffline) onOffline();
      }
    });
  }

  // Return a function to check network status
  return async () => {
    if (isNative()) {
      const status = await Network.getStatus();
      return status.connected;
    }
    return isOnline;
  };
};

// Offline-aware course progress update
export const updateCourseProgress = async (data: { userId: number, contentId: number, progress?: number, completed?: boolean }) => {
  try {
    // Try to update via the API first
    const response = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Failed to update progress online, saving offline:', error);
  }
  
  // If network request fails, save offline
  return saveOfflineProgress(data);
};

// Offline-aware comment posting
export const postComment = async (data: { userId: number, contentId: number, text: string, parentId?: number | null }) => {
  try {
    // Try to post via the API first
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Failed to post comment online, saving offline:', error);
  }
  
  // If network request fails, save offline
  return saveOfflineComment(data);
};

// Preferences storage (for offline data)
export const storeData = async (key: string, value: any) => {
  if (!isNative()) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  await Preferences.set({
    key,
    value: JSON.stringify(value),
  });
};

export const getData = async (key: string) => {
  if (!isNative()) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  const { value } = await Preferences.get({ key });
  return value ? JSON.parse(value) : null;
};

export const removeData = async (key: string) => {
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }

  await Preferences.remove({ key });
};

// Exit app (only works in native)
export const exitApp = async () => {
  if (isNative()) {
    await App.exitApp();
  }
};