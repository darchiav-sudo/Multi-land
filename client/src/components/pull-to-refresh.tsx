import { useEffect, useRef, useState, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { APP_VERSION } from '@/lib/registerServiceWorker';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => void;
  pullDownThreshold?: number;
  refreshIndicatorHeight?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  pullDownThreshold = 80,
  refreshIndicatorHeight = 60,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const touchStart = (e: TouchEvent) => {
      // Only enable pull-to-refresh at the top of the page
      if (window.scrollY <= 5) {
        startYRef.current = e.touches[0].clientY;
      } else {
        startYRef.current = null;
      }
    };

    const touchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - startYRef.current;
      
      // Only activate for downward pulls and only when at the top of the page
      if (distance > 0 && window.scrollY <= 5) {
        // Apply resistance to make the pull feel natural
        const restrictedDistance = Math.min(distance * 0.4, pullDownThreshold * 1.2);
        setPullDistance(restrictedDistance);
        currentYRef.current = restrictedDistance;

        // Only prevent default if we're actively pulling down
        // This is crucial for proper mobile scrolling
        if (distance > 20 && window.scrollY === 0) {
          e.preventDefault();
        }
      }
    };

    const touchEnd = () => {
      if (startYRef.current === null) return;
      
      const finalDistance = currentYRef.current;
      
      if (finalDistance >= pullDownThreshold) {
        // Trigger refresh
        setRefreshing(true);
        setPullDistance(refreshIndicatorHeight);
        
        // Notify via toast
        toast({
          title: 'Refreshing Content',
          description: `App version: ${APP_VERSION}`,
        });
        
        // Custom refresh logic if provided
        if (onRefresh) {
          onRefresh();
        }
        
        // Simulate network request and reset
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
          window.location.reload();
        }, 1500);
      } else {
        // Reset position with animation
        setPullDistance(0);
      }
      
      startYRef.current = null;
      currentYRef.current = 0;
    };

    // Add event listeners to the container
    container.addEventListener('touchstart', touchStart, { passive: false });
    container.addEventListener('touchmove', touchMove, { passive: false });
    container.addEventListener('touchend', touchEnd);

    // Clean up listeners on component unmount
    return () => {
      container.removeEventListener('touchstart', touchStart);
      container.removeEventListener('touchmove', touchMove);
      container.removeEventListener('touchend', touchEnd);
    };
  }, [onRefresh, pullDownThreshold, refreshIndicatorHeight, toast]);

  return (
    <div 
      ref={containerRef} 
      className="w-full min-h-screen overflow-x-hidden" 
      style={{ touchAction: pullDistance > 0 ? 'none' : 'auto' }}
    >
      {/* Pull indicator */}
      <div 
        className="flex justify-center items-center bg-gray-100 transition-all duration-200 overflow-hidden"
        style={{ 
          height: `${pullDistance}px`,
          marginTop: pullDistance > 0 ? '0' : `-${refreshIndicatorHeight}px`
        }}
      >
        <RefreshCw 
          className={`text-gray-500 h-6 w-6 ${refreshing ? 'animate-spin' : ''}`} 
        />
        <span className="ml-2 text-sm text-gray-500">
          {refreshing ? 'Refreshing...' : 'Pull down to refresh'}
        </span>
      </div>

      {/* App content */}
      {children}
    </div>
  );
}