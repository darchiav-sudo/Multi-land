/**
 * Browser Compatibility Helper Functions
 * 
 * This module contains polyfills and compatibility checks for various browser features
 * to ensure consistent behavior across different browsers like Chrome, Firefox, Safari,
 * Opera, and Edge.
 */

// Network Information API interface (not fully supported in all browsers)
interface NetworkInformation {
  readonly effectiveType?: string;
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
}

// Extend Navigator with non-standard properties
interface ExtendedNavigator extends Navigator {
  connection?: NetworkInformation;
}

/**
 * Check if the browser properly supports FormData and XMLHttpRequest uploads
 */
export function checkUploadCapability(): { supported: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for FormData support
  if (typeof FormData === 'undefined') {
    issues.push('FormData API not supported');
  }
  
  // Check for XMLHttpRequest support
  if (typeof XMLHttpRequest === 'undefined') {
    issues.push('XMLHttpRequest not supported');
  } else {
    // Check for XMLHttpRequest upload property
    const xhr = new XMLHttpRequest();
    if (!('upload' in xhr)) {
      issues.push('XMLHttpRequest upload property not supported');
    }
  }
  
  // Check for Blob support
  if (typeof Blob === 'undefined') {
    issues.push('Blob API not supported');
  }
  
  return {
    supported: issues.length === 0,
    issues
  };
}

/**
 * Enhances XMLHttpRequest to make it more compatible across browsers
 */
export function createEnhancedXHR(): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  
  // Ensure timeout property exists
  if (!('timeout' in xhr)) {
    Object.defineProperty(xhr, 'timeout', {
      get: function() { 
        return this._timeout || 0; 
      },
      set: function(value) { 
        this._timeout = value; 
      }
    });
  }
  
  // Set default timeout to 5 minutes
  xhr.timeout = 300000;
  
  return xhr;
}

/**
 * Helper for browser detection
 */
export function detectBrowser(): { name: string; version: string } {
  const userAgent = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "Unknown";
  
  if (userAgent.indexOf("Opera") !== -1 || userAgent.indexOf("OPR") !== -1) {
    browserName = "Opera";
    browserVersion = userAgent.indexOf("OPR") !== -1 
      ? userAgent.substring(userAgent.indexOf("OPR")).split("/")[1]
      : userAgent.substring(userAgent.indexOf("Opera")).split("/")[1];
  } else if (userAgent.indexOf("Edg") !== -1) {
    browserName = "Edge";
    browserVersion = userAgent.substring(userAgent.indexOf("Edg")).split("/")[1];
  } else if (userAgent.indexOf("Chrome") !== -1) {
    browserName = "Chrome";
    browserVersion = userAgent.substring(userAgent.indexOf("Chrome")).split("/")[1];
  } else if (userAgent.indexOf("Safari") !== -1) {
    browserName = "Safari";
    browserVersion = userAgent.substring(userAgent.indexOf("Safari")).split("/")[1];
  } else if (userAgent.indexOf("Firefox") !== -1) {
    browserName = "Firefox";
    browserVersion = userAgent.substring(userAgent.indexOf("Firefox")).split("/")[1];
  } else if (userAgent.indexOf("MSIE") !== -1 || userAgent.indexOf("Trident/") !== -1) {
    browserName = "Internet Explorer";
    browserVersion = userAgent.substring(userAgent.indexOf("MSIE")).split(";")[0].split(" ")[1];
  }
  
  return { name: browserName, version: browserVersion };
}

/**
 * Log current browser details to help with troubleshooting
 */
export function logBrowserInfo() {
  const browser = detectBrowser();
  const uploadCapability = checkUploadCapability();
  
  console.log(`Browser: ${browser.name} ${browser.version}`);
  console.log(`User Agent: ${navigator.userAgent}`);
  console.log('Upload capability:', uploadCapability.supported ? 'Supported' : 'Not fully supported');
  
  if (uploadCapability.issues.length > 0) {
    console.log('Upload issues detected:', uploadCapability.issues);
  }
  
  // Check connection type if available using Network Information API
  const nav = navigator as ExtendedNavigator;
  if (nav.connection) {
    console.log('Connection type:', nav.connection.effectiveType || 'unknown');
    console.log('Connection downlink:', nav.connection.downlink || 'unknown', 'Mbps');
  }
}

/**
 * Detect if the current network connection is slow
 * Returns a promise that resolves to true if connection is slow, false otherwise
 */
export async function detectSlowConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const nav = navigator as ExtendedNavigator;
    
    // First check Network Information API if available
    if (nav.connection) {
      if (nav.connection.saveData) {
        // User has requested reduced data usage, treat as slow connection
        resolve(true);
        return;
      }
      
      // Check effective connection type
      if (nav.connection.effectiveType) {
        if (nav.connection.effectiveType === 'slow-2g' || 
            nav.connection.effectiveType === '2g' || 
            nav.connection.effectiveType === '3g') {
          resolve(true);
          return;
        }
      }
      
      // Check downlink (≤1.5 Mbps is considered slow)
      if (nav.connection.downlink !== undefined && nav.connection.downlink <= 1.5) {
        resolve(true);
        return;
      }
      
      // Check RTT (>500ms is considered high latency)
      if (nav.connection.rtt !== undefined && nav.connection.rtt > 500) {
        resolve(true);
        return;
      }
    }
    
    // Fallback: Do a small network test
    const startTime = Date.now();
    const testImage = new Image();
    
    // Set a small 1x1 pixel test image from the current domain
    testImage.src = `${window.location.origin}/favicon.ico?_=${Date.now()}`;
    
    // Set a timeout for slow networks
    const timeoutId = setTimeout(() => {
      resolve(true); // Connection is too slow if it takes >3 seconds
    }, 3000);
    
    testImage.onload = () => {
      clearTimeout(timeoutId);
      const loadTime = Date.now() - startTime;
      resolve(loadTime > 1000); // If image takes >1s to load, consider connection slow
    };
    
    testImage.onerror = () => {
      clearTimeout(timeoutId);
      // If image fails to load, we can't determine speed, assume normal
      resolve(false);
    };
  });
}

/**
 * Get rough bandwidth quality estimate
 * Returns: 'fast', 'medium', 'slow' or 'unknown'
 */
export function getConnectionQuality(): 'fast' | 'medium' | 'slow' | 'unknown' {
  const nav = navigator as ExtendedNavigator;
  
  if (!nav.connection) {
    return 'unknown';
  }
  
  // If save-data is enabled, always return slow
  if (nav.connection.saveData) {
    return 'slow';
  }
  
  // Check effective type
  if (nav.connection.effectiveType) {
    switch (nav.connection.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 'slow';
      case '3g':
        return 'medium';
      case '4g':
        return 'fast';
      default:
        // Unknown type, use other metrics
        break;
    }
  }
  
  // Check downlink speed
  if (nav.connection.downlink !== undefined) {
    if (nav.connection.downlink <= 1.0) {
      return 'slow';
    } else if (nav.connection.downlink <= 3.0) {
      return 'medium';
    } else {
      return 'fast';
    }
  }
  
  return 'unknown';
}