import React, { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Book,
  LayoutDashboard,
  Users,
  Package,
  Settings,
  LogOut,
  Menu,
  Grid,
  MessageSquare,
  Cloud,
  Video,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "../../hooks/use-media-query";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Admin navigation items
  const navItems = [
    {
      label: t("Dashboard"),
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: "/admin",
      active: location === "/admin",
      key: "dashboard",
    },
    {
      label: t("Courses"),
      icon: <Book className="h-5 w-5" />,
      href: "/admin/courses",
      active: location.startsWith("/admin/courses"),
      key: "courses",
    },
    {
      label: t("Users"),
      icon: <Users className="h-5 w-5" />,
      href: "/admin/users",
      active: location.startsWith("/admin/users"),
      key: "users",
    },
    {
      label: t("Categories"),
      icon: <Grid className="h-5 w-5" />,
      href: "/admin/categories",
      active: location.startsWith("/admin/categories"),
      key: "categories",
    },
    // Webinar section - adding force-visible with separate props to ensure it shows
    {
      label: t("Webinars"),
      icon: <Video className="h-5 w-5" />,
      href: "/admin/webinars",
      active: location.startsWith("/admin/webinars"),
      key: "webinars",
      forceVisible: true,
    },
    {
      label: t("Comments"),
      icon: <MessageSquare className="h-5 w-5" />,
      href: "/admin/comments",
      active: location.startsWith("/admin/comments"),
      key: "comments",
    },
    {
      label: t("Cloud Storage"),
      icon: <Cloud className="h-5 w-5" />,
      href: "/admin/cloud-storage",
      active: location.startsWith("/admin/cloud-storage"),
      key: "cloud",
    },
    {
      label: t("Enrollments"),
      icon: <Package className="h-5 w-5" />,
      href: "/admin/enrollments",
      active: location.startsWith("/admin/enrollments"),
      key: "enrollments",
    },
    {
      label: t("Settings"),
      icon: <Settings className="h-5 w-5" />,
      href: "/admin/settings",
      active: location.startsWith("/admin/settings"),
      key: "settings",
    },
  ];

  // Check if user is admin
  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate("/");
      toast({
        title: t("Access Denied"),
        description: t("You don't have permission to access the admin area"),
        variant: "destructive",
      });
    }
  }, [user, navigate, t, toast]);

  const handleLogout = () => {
    logoutMutation.mutate();
    navigate("/");
  };

  // If user is not loaded yet or doesn't have admin privileges
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col w-screen max-w-screen overflow-x-hidden">
      {/* Admin header - more compact with smaller height */}
      <header className="sticky top-0 z-50 bg-black text-white">
        <div className="max-w-full flex h-12 items-center justify-between px-2">
          <div className="flex items-center gap-1">
            <Link href="/admin">
              <a className="flex items-center mr-2">
                <span className="font-bold text-xs tracking-tight">
                  {t("Multi Land")}
                </span>
              </a>
            </Link>
            
            <div className="h-4 border-r border-gray-700 mx-1 hidden sm:block"></div>
            
            {/* Desktop Navigation - Compact Icons */}
            {!isMobile && (
              <nav className="flex items-center space-x-0.5">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={`flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-800 ${
                        item.active
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "text-gray-300"
                      }`}
                      title={item.label}
                    >
                      {React.cloneElement(item.icon, { className: "h-3 w-3" })}
                    </a>
                  </Link>
                ))}
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mobile Menu - more compact */}
            {isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-1 h-7 w-7 text-white">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {navItems.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      className={item.active ? "bg-gray-100" : ""}
                      onClick={() => navigate(item.href)}
                    >
                      <div className="flex items-center gap-2">
                        {React.cloneElement(item.icon, { className: "h-4 w-4" })}
                        <span className="text-sm">{item.label}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* User menu - more compact */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-7 w-7 rounded bg-gray-700 p-0 text-white"
                >
                  <span className="font-medium text-xs">
                    {user.username ? user.username.charAt(0).toUpperCase() : "A"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/")}>
                  {t("Back to Site")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("Logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      {/* Page content */}
      <main className="flex-1 bg-gray-50">{children}</main>
      
      {/* Footer */}
      <footer className="border-t py-4 bg-white">
        <div className="container flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Multi Land. {t("All rights reserved")}
          </p>
          <p className="text-xs text-gray-400">
            {t("Admin Version")} 2.0.5
          </p>
        </div>
      </footer>
    </div>
  );
}