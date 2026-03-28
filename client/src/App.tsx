import { Switch, Route, useLocation } from "wouter";
import { queryClient, initWebSocket, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/components/LanguageProvider";
import { useEffect, useState, lazy, Suspense } from "react";
import { initCapacitor, setupNetworkListeners } from "./lib/capacitor";
import { ProtectedRoute } from "./lib/protected-route";
import { initOfflineSupport } from "./lib/offline-db";
import { useAuth } from "@/hooks/use-auth";
import { checkForAppUpdates } from "./lib/registerServiceWorker";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { PullToRefresh } from "@/components/pull-to-refresh";
import AppErrorHandler from "./components/AppErrorHandler";

// Use lazy loading for components that aren't needed immediately
// This drastically reduces the initial bundle size and improves loading speed
const NotFound = lazy(() => import("@/pages/not-found"));
const HomePage = lazy(() => import("@/pages/home-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CoursesPage = lazy(() => import("@/pages/courses-page"));
const CourseDetailPage = lazy(() => import("@/pages/course-detail-page"));
const LessonViewerPage = lazy(() => import("@/pages/lesson-viewer-page"));
const CheckoutPage = lazy(() => import("@/pages/checkout-page"));
const MyLearningPage = lazy(() => import("@/pages/my-learning-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const RefundPolicyPage = lazy(() => import("@/pages/refund-policy"));
const VideoPlayerTestPage = lazy(() => import("@/pages/admin/video-player-test"));
const S3UploadTestPage = lazy(() => import("@/pages/s3-upload-test"));
const UploadTestPage = lazy(() => import("@/pages/upload-test"));

// VS Dating Reviews page (hidden, public)
const VsDatingReviews = lazy(() => import("@/pages/vs-dating-reviews"));

// Lazy load admin components separately since they're only used by admins
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const AdminCourses = lazy(() => import("@/pages/admin/courses"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
// New lesson management components
const LessonManager = lazy(() => import("@/pages/admin/lesson-manager"));
const ContentEditor = lazy(() => import("@/pages/admin/content-editor"));
// Cloud storage management
const CloudStorage = lazy(() => import("@/pages/admin/cloud-storage"));
// Translation management
const TranslationManager = lazy(() => import("@/pages/admin/translation-manager"));
// Webinar management
const WebinarsPage = lazy(() => import("@/pages/admin/webinars/index"));
const CreateWebinarPage = lazy(() => import("@/pages/admin/webinars/create"));
const EditWebinarPage = lazy(() => import("@/pages/admin/webinars/edit"));
const WebinarOffersPage = lazy(() => import("@/pages/admin/webinars/offers"));
const WebinarSettingsPage = lazy(() => import("@/pages/admin/webinars/settings"));
const WebinarHostPage = lazy(() => import("@/pages/admin/webinars/host"));
const WebinarViewPage = lazy(() => import("@/pages/webinar-view"));
const WebinarWaitingRoom = lazy(() => import("@/pages/webinar-waiting-room"));
const WebinarLiveRoom = lazy(() => import("@/pages/webinar-live-room"));

// Component to pre-cache important content
function PreCacheManager() {
  const { user } = useAuth();
  
  useEffect(() => {
    const preCacheImportantData = async () => {
      try {
        // Pre-cache categories (lightweight)
        await queryClient.prefetchQuery({
          queryKey: ['/api/categories'],
          staleTime: 1000 * 60 * 60, // 1 hour
        });
        
        // Pre-cache courses (important for offline browsing)
        await queryClient.prefetchQuery({
          queryKey: ['/api/courses'],
          staleTime: 1000 * 60 * 60, // 1 hour
        });
        
        // If user is logged in, pre-cache their enrolled courses
        if (user) {
          await queryClient.prefetchQuery({
            queryKey: ['/api/enrollments', user.id],
            staleTime: 1000 * 60 * 60, // 1 hour
          });
          
          // Pre-cache user's progress data
          await queryClient.prefetchQuery({
            queryKey: ['/api/progress', user.id],
            staleTime: 1000 * 60 * 30, // 30 minutes
          });
        }
      } catch (error) {
        console.error('Failed to pre-cache data:', error);
      }
    };
    
    preCacheImportantData();
  }, [user]);
  
  return null; // This component doesn't render anything
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/courses" component={CoursesPage} />
      <Route path="/courses/:id" component={CourseDetailPage} />
      {/* Lesson viewer routes - new and legacy format for backward compatibility */}
      <ProtectedRoute path="/lesson/:courseId/:contentId" component={LessonViewerPage} />
      <ProtectedRoute path="/courses/:courseId/content/:contentId" component={LessonViewerPage} />
      
      {/* Adding multiple routes for checkout to handle different URL formats */}
      <Route path="/checkout/:id" component={CheckoutPage} />
      <Route path="/checkout-page" component={CheckoutPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      
      {/* Hidden page for VS Dating review generator (not linked in navigation) */}
      <Route path="/vs-dating-reviews" component={VsDatingReviews} />
      
      <ProtectedRoute path="/my-learning" component={MyLearningPage} />
      {/* Profile page route removed */}
      {/* Admin Routes - All protected and requiring admin privileges */}
      <ProtectedRoute path="/admin" component={AdminDashboard} adminOnly={true} />
      <ProtectedRoute path="/admin/courses" component={AdminCourses} adminOnly={true} />
      <ProtectedRoute path="/admin/users" component={AdminUsers} adminOnly={true} />
      <ProtectedRoute path="/admin/categories" component={AdminCategories} adminOnly={true} />
      <ProtectedRoute path="/admin/content-manager/:courseId" component={LessonManager} adminOnly={true} />
      <ProtectedRoute path="/admin/courses/:courseId/new-lesson" component={ContentEditor} adminOnly={true} />
      <ProtectedRoute path="/admin/courses/:courseId/edit-lesson/:contentId" component={ContentEditor} adminOnly={true} />
      <ProtectedRoute path="/admin/video-player-test" component={VideoPlayerTestPage} adminOnly={true} />
      <ProtectedRoute path="/admin/cloud-storage" component={CloudStorage} adminOnly={true} />
      <ProtectedRoute path="/admin/s3-test" component={S3UploadTestPage} adminOnly={true} />
      <ProtectedRoute path="/admin/translations" component={TranslationManager} adminOnly={true} />
      
      {/* Webinar management routes */}
      <ProtectedRoute path="/admin/webinars" component={WebinarsPage} adminOnly={true} />
      <ProtectedRoute path="/admin/webinars/create" component={CreateWebinarPage} adminOnly={true} />
      <ProtectedRoute path="/admin/webinars/:id/edit" component={EditWebinarPage} adminOnly={true} />
      <ProtectedRoute path="/admin/webinars/:id/offers" component={WebinarOffersPage} adminOnly={true} />
      <ProtectedRoute path="/admin/webinars/:id/settings" component={WebinarSettingsPage} adminOnly={true} />
      <ProtectedRoute path="/admin/webinars/:id/host" component={WebinarHostPage} adminOnly={true} />
      
      {/* Webinar attendee routes - protected but don't require admin privileges */}
      <ProtectedRoute path="/webinar/:uniqueId" component={WebinarWaitingRoom} />
      <ProtectedRoute path="/webinar/:uniqueId/live" component={WebinarLiveRoom} />
      <ProtectedRoute path="/webinar/:id" component={WebinarViewPage} />
      
      <ProtectedRoute path="/upload-test" component={UploadTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true);

  // Store initialization status to prevent double initialization
  const [initialized, setInitialized] = useState(false);

  // Initialize Capacitor and WebSocket when the app loads but only once
  useEffect(() => {
    // Prevent multiple initializations which can cause refresh loops
    if (initialized) {
      return;
    }
    
    console.log('Initializing app services - first run');
    setInitialized(true);
    
    // Initialize Capacitor
    initCapacitor();
    
    // Initialize WebSocket connection for real-time updates - with retry limit
    let wsInitialized = false;
    if (isNetworkAvailable && !wsInitialized) {
      wsInitialized = true;
      initWebSocket();
    }
    
    // Initialize offline support - but don't allow it to reload the page
    initOfflineSupport().catch(error => {
      console.error('Failed to initialize offline support:', error);
    });
    
    // Set up network listeners with debouncing to prevent rapid state changes
    let onlineDebounceTimer: NodeJS.Timeout | null = null;
    let offlineDebounceTimer: NodeJS.Timeout | null = null;
    
    const getNetworkStatus = setupNetworkListeners(
      () => {
        // Cancel any pending offline state change
        if (offlineDebounceTimer) {
          clearTimeout(offlineDebounceTimer);
          offlineDebounceTimer = null;
        }
        
        // Debounce online status change (500ms)
        if (!onlineDebounceTimer) {
          onlineDebounceTimer = setTimeout(() => {
            console.log('App is online!');
            setIsNetworkAvailable(true);
            
            // Only reconnect WebSocket if not already connected
            if (!wsInitialized) {
              wsInitialized = true;
              initWebSocket();
            }
            
            onlineDebounceTimer = null;
          }, 500);
        }
      },
      () => {
        // Cancel any pending online state change
        if (onlineDebounceTimer) {
          clearTimeout(onlineDebounceTimer);
          onlineDebounceTimer = null;
        }
        
        // Debounce offline status change (800ms)
        if (!offlineDebounceTimer) {
          offlineDebounceTimer = setTimeout(() => {
            console.log('App is offline!');
            setIsNetworkAvailable(false);
            wsInitialized = false;
            offlineDebounceTimer = null;
          }, 800);
        }
      }
    );
    
    // Check network status immediately, but only once
    if (getNetworkStatus) {
      getNetworkStatus().then(online => {
        setIsNetworkAvailable(online);
      });
    }
    
    // Cleanup function
    return () => {
      if (onlineDebounceTimer) {
        clearTimeout(onlineDebounceTimer);
      }
      if (offlineDebounceTimer) {
        clearTimeout(offlineDebounceTimer);
      }
    };
  }, [initialized]);

  // Handle refresh action
  const handleRefresh = () => {
    // Check for service worker updates
    checkForAppUpdates();
    
    // Invalidate and refetch key API queries
    queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
    queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    
    // For enrolled users, invalidate their enrollments and progress
    queryClient.invalidateQueries({ queryKey: ['/api/enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['/api/progress'] });
  };

  // Add a loading fallback for when lazy-loaded components are being loaded
  const suspenseFallback = (
    <div className="min-h-screen flex justify-center items-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin w-10 h-10 border-4 border-black border-t-transparent rounded-full mb-3"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <PreCacheManager />
          {/* Wrap the entire app in our error handler */}
          <AppErrorHandler>
            <PullToRefresh onRefresh={handleRefresh}>
              <Suspense fallback={suspenseFallback}>
                <Router />
              </Suspense>
              <OfflineBanner />
            </PullToRefresh>
          </AppErrorHandler>
          <Toaster />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
