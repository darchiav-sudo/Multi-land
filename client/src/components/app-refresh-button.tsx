import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { checkForAppUpdates } from '@/lib/registerServiceWorker';
import { APP_VERSION } from '@/lib/registerServiceWorker';
import { useVersionChecker } from '@/lib/version-checker';

export function AppRefreshButton() {
  const [isRotating, setIsRotating] = useState(false);
  const { toast } = useToast();
  const { hasUpdate } = useVersionChecker();

  // Trigger animation when update is detected
  useEffect(() => {
    if (hasUpdate) {
      // Gentle pulse animation when update is available
      const interval = setInterval(() => {
        setIsRotating(true);
        setTimeout(() => setIsRotating(false), 1000);
      }, 5000); // Pulse every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [hasUpdate]);

  const handleRefresh = () => {
    setIsRotating(true);
    
    // Check for service worker updates
    checkForAppUpdates();
    
    // Show toast with current app version
    toast({
      title: 'Checking for updates',
      description: `Current version: ${APP_VERSION}`,
    });
    
    // Manual reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleRefresh}
      title={hasUpdate ? "Update available! Click to refresh" : `App version: ${APP_VERSION}`}
      className={`relative ${hasUpdate ? 'animate-pulse' : ''}`}
    >
      <RefreshCw className={`h-5 w-5 ${isRotating ? 'animate-spin' : ''} ${hasUpdate ? 'text-primary' : 'text-gray-500'}`} />
      <div className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 ${hasUpdate ? 'bg-red-500' : 'bg-black'} rounded-full`}>
        <span className="text-white text-[8px] font-bold">
          {APP_VERSION.split('.')[2]}
        </span>
      </div>
    </Button>
  );
}