import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Layers,
  Tag,
  ChevronRight,
  Home,
  UploadCloud,
  Video,
  Languages,
  Globe
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    // Verify user is admin
    if (!user.isAdmin) {
      console.error("User is not admin, redirecting:", user?.email);
      navigate("/");
      return;
    }
  }, [user, navigate]);

  // If still loading or not authenticated, show nothing
  if (!user || !user.isAdmin) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const menuItems = [
    { 
      icon: <BarChart3 className="h-5 w-5" />, 
      label: t('admin.dashboard'), 
      href: "/admin" 
    },
    { 
      icon: <BookOpen className="h-5 w-5" />, 
      label: t('admin.courses'), 
      href: "/admin/courses" 
    },
    { 
      icon: <Users className="h-5 w-5" />, 
      label: t('admin.users'), 
      href: "/admin/users" 
    },
    { 
      icon: <Tag className="h-5 w-5" />, 
      label: t('admin.categories'), 
      href: "/admin/categories" 
    },
    { 
      icon: <UploadCloud className="h-5 w-5" />, 
      label: t('admin.uploads'), 
      href: "/admin/uploads" 
    },
    { 
      icon: <Video className="h-5 w-5" />, 
      label: t('admin.videoManager'), 
      href: "/admin/videos" 
    },
    { 
      icon: <Globe className="h-5 w-5" />, 
      label: t('admin.translations'), 
      href: "/admin/translations" 
    },
    { 
      icon: <Settings className="h-5 w-5" />, 
      label: t('admin.settings'), 
      href: "/admin/settings" 
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex h-14 items-center border-b border-gray-200 dark:border-gray-800 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Layers className="h-6 w-6 text-primary" />
            <span className="text-primary">Multi Land</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t('admin.management')}
            </h2>
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    location === item.href 
                      ? "bg-primary text-primary-foreground" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="font-semibold text-primary">
                {user.username?.charAt(0) || "A"}
              </span>
            </div>
            <div className="flex-1 truncate">
              <div className="font-medium">{user.username || "Admin"}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      {/* Mobile header with menu button */}
      <div className="md:hidden fixed inset-x-0 top-0 z-50 h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex h-full items-center justify-between px-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="rounded-md p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Layers className="h-6 w-6 text-primary" />
            <span className="text-primary">Multi Land</span>
          </Link>
          <div className="w-6" />
        </div>
      </div>

      {/* Mobile sidebar */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50">
          <div className="fixed inset-y-0 left-0 w-3/4 max-w-sm bg-white dark:bg-gray-900 shadow-lg">
            <div className="flex h-14 items-center border-b border-gray-200 dark:border-gray-800 px-4">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="rounded-md p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-6 w-6" />
              </button>
              <Link 
                href="/" 
                className="flex items-center gap-2 font-bold ml-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <Layers className="h-6 w-6 text-primary" />
                <span className="text-primary">Multi Land</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-auto py-4">
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t('admin.management')}
                </h2>
                <div className="space-y-1">
                  {menuItems.map((item, index) => (
                    <Link
                      key={index}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                        location === item.href 
                          ? "bg-primary text-primary-foreground" 
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
            <div className="border-t border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="font-semibold text-primary">
                    {user.username?.charAt(0) || "A"}
                  </span>
                </div>
                <div className="flex-1 truncate">
                  <div className="font-medium">{user.username || "Admin"}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-2 w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}