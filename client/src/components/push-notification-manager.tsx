import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';

// Convert the VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
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

export function PushNotificationManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window &&
                       'Notification' in window;
      
      setIsSupported(supported);
      
      if (supported && navigator.serviceWorker.ready) {
        try {
          const swRegistration = await navigator.serviceWorker.ready;
          const existingSubscription = await swRegistration.pushManager.getSubscription();
          setSubscription(existingSubscription);
        } catch (error) {
          console.error('Error checking push subscription:', error);
        }
      }
    };
    
    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    if (!isSupported || !user) return;
    
    try {
      setIsRegistering(true);
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: t('notifications.permission_denied'),
          description: t('notifications.enable_notifications'),
          variant: 'destructive',
        });
        return;
      }
      
      // Get service worker registration
      const swRegistration = await navigator.serviceWorker.ready;
      
      // Get the VAPID public key from the server
      const response = await apiRequest('GET', '/api/push/vapid-public-key');
      const { publicKey } = await response.json();
      
      // Subscribe to push notifications
      const newSubscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      // Save the subscription to the server
      await apiRequest('POST', '/api/push/register', {
        subscription: newSubscription
      });
      
      setSubscription(newSubscription);
      
      toast({
        title: t('notifications.subscribed'),
        description: t('notifications.will_receive'),
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: t('notifications.subscription_failed'),
        description: t('notifications.try_again'),
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribeFromPush = async () => {
    if (!subscription || !user) return;
    
    try {
      setIsUnregistering(true);
      
      // Unsubscribe from push manager
      await subscription.unsubscribe();
      
      // Remove subscription from server
      await apiRequest('POST', '/api/push/unregister');
      
      setSubscription(null);
      
      toast({
        title: t('notifications.unsubscribed'),
        description: t('notifications.wont_receive'),
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: t('notifications.unsubscription_failed'),
        description: t('notifications.try_again'),
        variant: 'destructive',
      });
    } finally {
      setIsUnregistering(false);
    }
  };

  // If push notifications are not supported, or user is not logged in, don't render anything
  if (!isSupported || !user) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      {subscription ? (
        <Button
          variant="outline"
          size="icon"
          onClick={unsubscribeFromPush}
          disabled={isUnregistering}
          title={t('notifications.disable')}
          className="h-8 w-8"
        >
          <BellOff className="h-4 w-4" />
          <span className="sr-only">{t('notifications.disable')}</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={subscribeToPush}
          disabled={isRegistering}
          title={t('notifications.enable')}
          className="h-8 w-8"
        >
          <Bell className="h-4 w-4" />
          <span className="sr-only">{t('notifications.enable')}</span>
        </Button>
      )}
      <Link href="/profile">
        <Button
          variant="outline"
          size="icon"
          title={t('nav.profile') || 'Profile'}
          className="h-8 w-8"
        >
          <User className="h-4 w-4" />
          <span className="sr-only">{t('nav.profile') || 'Profile'}</span>
        </Button>
      </Link>
    </div>
  );
}