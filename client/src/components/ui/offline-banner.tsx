import { useState, useEffect } from "react";
import { Network } from '@capacitor/network';
import { isNative } from "@/lib/capacitor";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Function to check online status
    const checkOnlineStatus = async () => {
      // For regular web
      if (!isNative()) {
        setIsOnline(navigator.onLine);
        return;
      }
      
      // For Capacitor apps
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch (error) {
        console.error("Error checking network status:", error);
        // Fallback to browser API
        setIsOnline(navigator.onLine);
      }
    };

    // Check immediately
    checkOnlineStatus();

    // For regular web
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // For Capacitor apps
    let networkListener: any;
    if (isNative()) {
      networkListener = Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkListener) {
        networkListener.remove();
      }
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white p-2 flex items-center justify-center z-50">
      <WifiOff className="w-4 h-4 mr-2" />
      <span>You are currently offline. Some features may be unavailable.</span>
    </div>
  );
}