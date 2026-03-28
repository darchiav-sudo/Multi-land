import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import AdminDashboard from "./dashboard";
import AdminCourses from "./courses";
import AdminUsers from "./users";
import AdminCategories from "./categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Video
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AdminLayout() {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Redirect if not logged in
  if (!user) {
    navigate("/auth");
    return null;
  }
  
  // Verify user is admin
  if (!user.isAdmin) {
    console.error("User is not admin, redirecting:", user?.email);
    navigate("/");
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen flex flex-col h-screen">
      {/* Top navigation bar - more compact with icon-only buttons */}
      <header className="bg-black text-white py-2 fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <div className="flex items-center">
              <svg 
                className="h-7 w-7 mr-2" 
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
              <h1 className="text-lg font-bold mr-4">Multi Land</h1>
            </div>
            
            {/* Admin menu - always visible, compact with icons only on desktop */}
            <div className="flex items-center space-x-1 flex-grow justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "dashboard" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setActiveTab("dashboard")}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Dashboard</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Dashboard</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "courses" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setActiveTab("courses")}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Courses</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Courses</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "users" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setActiveTab("users")}
                    >
                      <Users className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Users</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Users</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "categories" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setActiveTab("categories")}
                    >
                      <Tag className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Categories</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Categories</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "webinars" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => navigate("/admin/webinars")}
                    >
                      <Video className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Webinars</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Webinars</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === "settings" ? "default" : "ghost"}
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setActiveTab("settings")}
                    >
                      <Settings className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline">Settings</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>

                {/* Testing buttons removed from here and moved to the Settings page */}
              </TooltipProvider>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/">
                      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8">
                        <Home className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Back to Site</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-white hover:bg-white/10 h-8 w-8"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Logout</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content area - adjusted for new header height */}
      <div className="flex flex-1 pt-12 h-[calc(100vh-48px)]">
        {/* Mobile menu content is completely handled in the header now - this is just for reference */}
        <aside className="hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-lg">Admin Dashboard</h2>
            <p className="text-sm text-gray-500">Manage your platform</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="w-full bg-gray-50 overflow-y-auto">
          <div className="p-4 md:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard">
                <AdminDashboard />
              </TabsContent>
              <TabsContent value="courses">
                <AdminCourses />
              </TabsContent>
              <TabsContent value="users">
                <AdminUsers />
              </TabsContent>
              
              <TabsContent value="categories">
                <AdminCategories />
              </TabsContent>

              <TabsContent value="settings">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-500">
                      Platform settings will be available in a future update.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
