import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppRefreshButton } from "@/components/app-refresh-button";
import { APP_VERSION } from "@/lib/registerServiceWorker";
// Removed dropdown menu imports as they're no longer needed
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if we're on an admin page
  const isAdminPage = location.startsWith("/admin");

  const isActive = (path: string) => {
    return location === path;
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // If on admin page and user is admin, don't show the navbar
  if (isAdminPage && user?.isAdmin) {
    return null;
  }

  return (
    <nav className="bg-black text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-white font-bold text-xl flex items-center">
                <svg 
                  className="h-6 w-6 mr-2" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                Multi Land
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                isActive("/") 
                  ? "border-white text-white" 
                  : "border-transparent text-gray-300 hover:border-gray-500 hover:text-white"
              }`}>
                {t('nav.home')}
              </Link>
              <Link href="/courses" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                isActive("/courses") 
                  ? "border-white text-white" 
                  : "border-transparent text-gray-300 hover:border-gray-500 hover:text-white"
              }`}>
                {t('nav.courses')}
              </Link>
              {user && (
                <Link href="/my-learning" className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/my-learning") 
                    ? "border-white text-white" 
                    : "border-transparent text-gray-300 hover:border-gray-500 hover:text-white"
                }`}>
                  {t('nav.myLearning')}
                </Link>
              )}

            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <LanguageSwitcher />
            
            {/* App Refresh Button - Always visible */}
            <div className="ml-2">
              <AppRefreshButton />
            </div>
            
            {user ? (
              <>
                {/* Admin Dashboard and Logout buttons - more compact */}
                {user.isAdmin && (
                  <Link href="/admin" className="ml-2">
                    <Button variant="outline" size="sm" className="text-white border-white hover:bg-white/10 h-8 px-2 py-0 text-xs">
                      {t('nav.adminDashboard')}
                    </Button>
                  </Link>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="ml-2 text-white border-white hover:bg-white/10"
                  onClick={handleLogout}
                >
                  {t('nav.logout')}
                </Button>
              </>
            ) : (
              <Link href="/auth">
                <Button className="ml-4 bg-white hover:bg-gray-200 text-black">
                  {t('nav.signIn')}
                </Button>
              </Link>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              className="text-white hover:bg-white/10"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-black border-t border-gray-800">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/" className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive("/")
                ? "border-white text-white bg-gray-900"
                : "border-transparent text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white"
            }`}>
              {t('nav.home')}
            </Link>
            <Link href="/courses" className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive("/courses")
                ? "border-white text-white bg-gray-900"
                : "border-transparent text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white"
            }`}>
              {t('nav.courses')}
            </Link>
            {user && (
              <>
                <Link href="/my-learning" className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive("/my-learning")
                    ? "border-white text-white bg-gray-900"
                    : "border-transparent text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white"
                }`}>
                  {t('nav.myLearning')}
                </Link>
              </>
            )}

            {/* Language Selection */}
            <div className="py-2 px-3 flex items-center border-l-4 border-transparent">
              <span className="text-sm text-gray-400 mr-2">{t('nav.language')}:</span>
              <div className="flex space-x-2">
                <LanguageSwitcher />
              </div>
            </div>
            
            {/* App refresh button for mobile */}
            <div className="py-2 px-3 flex items-center justify-between border-l-4 border-transparent">
              <span className="text-sm text-gray-400">{t('nav.appVersion') || 'App Version'}: {APP_VERSION}</span>
              <AppRefreshButton />
            </div>

            {user ? (
              <>
                {user.isAdmin && (
                  <Link href="/admin" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white">
                    {t('nav.adminDashboard')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link href="/auth" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-300 hover:bg-gray-900 hover:border-gray-600 hover:text-white">
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
