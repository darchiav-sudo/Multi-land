import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiRequest } from "./queryClient";
import { APP_VERSION } from "./registerServiceWorker";

// Use the APP_VERSION imported from registerServiceWorker.ts to ensure consistency

// Minimum time between version checks (5 minutes - shorter for no-cache strategy)
const CHECK_INTERVAL = 5 * 60 * 1000;

// Last time we checked for updates
let lastCheckTime = 0;

// State to track if an update is available
let updateAvailable = false;

// Simplified function to check for app updates - direct API only approach
export async function checkForUpdates(): Promise<boolean> {
  try {
    // Only check once every CHECK_INTERVAL unless an update is already available
    const now = Date.now();
    if (now - lastCheckTime < CHECK_INTERVAL && !updateAvailable) {
      return updateAvailable;
    }
    
    lastCheckTime = now;
    
    // Add cache-busting parameter to ensure we get a fresh response
    const timestamp = new Date().getTime();
    const response = await apiRequest("GET", `/api/app-version?nocache=${timestamp}`);
    const data = await response.json();
    
    // Compare versions
    if (data.version && data.version !== APP_VERSION) {
      console.log(`Version update detected: ${APP_VERSION} -> ${data.version}`);
      updateAvailable = true;
      
      // Dispatch event for any listeners
      window.dispatchEvent(new CustomEvent('app-update-available', { 
        detail: {
          currentVersion: APP_VERSION,
          newVersion: data.version
        }
      }));
      
      return true;
    }
    
    return updateAvailable;
  } catch (error) {
    console.error("Failed to check for updates:", error);
    return updateAvailable;
  }
}

// Hook for components to use
export function useVersionChecker() {
  const [hasUpdate, setHasUpdate] = useState(updateAvailable);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Listen for custom events indicating an update is available
  useEffect(() => {
    const handleUpdateEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      setHasUpdate(true);
      
      if (customEvent.detail?.newVersion) {
        setNewVersion(customEvent.detail.newVersion);
      }
      
      // Show notification
      toast({
        title: "Update Available",
        description: "A new version is available. Click to refresh.",
        duration: 10000,
      });
    };
    
    window.addEventListener('app-update-available', handleUpdateEvent);
    
    return () => {
      window.removeEventListener('app-update-available', handleUpdateEvent);
    };
  }, [toast]);
  
  // Check for updates when the component mounts and periodically
  useEffect(() => {
    // Initial check
    const initialCheck = async () => {
      const hasNewUpdate = await checkForUpdates();
      if (hasNewUpdate && !hasUpdate) {
        setHasUpdate(true);
      }
    };
    
    initialCheck();
    
    // Set up interval to check periodically
    const interval = setInterval(async () => {
      const hasNewUpdate = await checkForUpdates();
      if (hasNewUpdate && !hasUpdate) {
        setHasUpdate(true);
      }
    }, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [hasUpdate]);
  
  return {
    hasUpdate,
    appVersion: APP_VERSION,
    newVersion
  };
}