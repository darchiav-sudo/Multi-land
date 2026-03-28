import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  Calendar, CalendarDays, Clock, Edit, Plus, 
  MoreVertical, Trash2, Play, Users, Paintbrush,
  Settings, Share2, Repeat, ExternalLink,
  Copy, User, UserPlus, Link2
} from "lucide-react";

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type WebinarStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";

interface Webinar {
  id: number;
  uniqueId: string;
  title: string;
  description: string | null;
  status: WebinarStatus;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  timezone: string;
  maxAttendees: number | null;
  createdAt: string;
}

// Utility function to format dates with timezone
function formatDate(date: string | null, timezone: string): string {
  if (!date) return "Not scheduled";
  try {
    return format(new Date(date), "MMM d, yyyy h:mm a");
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Invalid date";
  }
}

// Status badge component
function StatusBadge({ status }: { status: WebinarStatus }) {
  let color = "";
  
  switch (status) {
    case "draft":
      color = "bg-slate-500";
      break;
    case "scheduled":
      color = "bg-blue-500";
      break;
    case "live":
      color = "bg-green-500";
      break;
    case "ended":
      color = "bg-purple-500";
      break;
    case "cancelled":
      color = "bg-red-500";
      break;
  }
  
  return (
    <Badge className={`${color} capitalize`}>
      {status}
    </Badge>
  );
}

// Webinar card component
function WebinarCard({ webinar, onShowLinks }: { webinar: Webinar, onShowLinks: (webinar: Webinar) => void }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/webinars/${webinar.id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete webinar");
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webinars'] });
      toast({
        title: "Webinar deleted",
        description: "The webinar has been deleted successfully."
      });
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete webinar: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Start webinar mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/webinars/${webinar.id}/start`, {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Failed to start webinar");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webinars'] });
      toast({
        title: "Webinar started",
        description: "The webinar is now live."
      });
      // Navigate to host page
      navigate(`/admin/webinars/${webinar.id}/host`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to start webinar: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg truncate max-w-[250px]">{webinar.title}</CardTitle>
            <CardDescription className="mt-1 truncate max-w-[250px]">
              {webinar.description || "No description"}
            </CardDescription>
          </div>
          <StatusBadge status={webinar.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-slate-500" />
            <span>{formatDate(webinar.scheduledStartTime, webinar.timezone)}</span>
          </div>
          {webinar.scheduledEndTime && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-slate-500" />
              <span>{formatDate(webinar.scheduledEndTime, webinar.timezone)}</span>
            </div>
          )}
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2 text-slate-500" />
            <span>Max {webinar.maxAttendees || 2000} attendees</span>
          </div>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="p-3 flex justify-between">
        <Button 
          variant="default" 
          className="bg-green-600 hover:bg-green-700"
          size="sm"
          onClick={() => onShowLinks(webinar)}
        >
          <Link2 className="h-4 w-4 mr-1" />
          Your Links
        </Button>
        {webinar.status === "live" && (
          <Button 
            variant="default" 
            className="bg-blue-600 hover:bg-blue-700 ml-2"
            size="sm"
            onClick={() => navigate(`/admin/webinars/${webinar.id}/host`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Enter Room
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate(`/admin/webinars/${webinar.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => navigate(`/admin/webinars/${webinar.id}/offers`)}>
              <Paintbrush className="h-4 w-4 mr-2" />
              Manage Offers
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => navigate(`/admin/webinars/${webinar.id}/settings`)}>
              <Settings className="h-4 w-4 mr-2" />
              Room Settings
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => onShowLinks(webinar)}>
              <Share2 className="h-4 w-4 mr-2" />
              Your Links
            </DropdownMenuItem>
            
            {webinar.status !== "draft" && webinar.status !== "cancelled" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/admin/webinars/${webinar.id}/clone`)}>
                  <Repeat className="h-4 w-4 mr-2" />
                  Clone Webinar
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 focus:text-red-600" 
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
      
      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webinar</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webinar? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function WebinarsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [webinarForLinks, setWebinarForLinks] = useState<Webinar | null>(null);
  
  const { data: webinars, isLoading, error } = useQuery({
    queryKey: ['/api/webinars'],
    queryFn: async () => {
      const res = await fetch('/api/webinars');
      if (!res.ok) {
        throw new Error('Failed to fetch webinars');
      }
      return res.json();
    }
  });
  
  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description,
    });
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Webinars</h1>
            <p className="text-slate-500 mt-1">
              Manage your live webinars, presentations and online events
            </p>
          </div>
          <Button onClick={() => navigate("/admin/webinars/create")}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 text-lg"
            size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Webinar
          </Button>
        </div>
        
        {/* Webinar Links Dialog */}
        <Dialog open={!!webinarForLinks} onOpenChange={(open) => !open && setWebinarForLinks(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Webinar Links</DialogTitle>
              <DialogDescription>
                Share these links to access the webinar "{webinarForLinks?.title}".
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {/* Host Link */}
              <div className="space-y-2">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-green-600" />
                  <h3 className="text-sm font-medium">Host Link</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 rounded text-xs overflow-hidden text-ellipsis">
                    {`${window.location.origin}/admin/webinars/${webinarForLinks?.id}/host`}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => copyToClipboard(
                      `${window.location.origin}/admin/webinars/${webinarForLinks?.id}/host`,
                      "Host link copied to clipboard"
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this link to host and manage the webinar. Only share with co-hosts.
                </p>
              </div>
              
              {/* Public Link */}
              <div className="space-y-2">
                <div className="flex items-center">
                  <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
                  <h3 className="text-sm font-medium">Participant Link</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-slate-50 rounded text-xs overflow-hidden text-ellipsis">
                    {`${window.location.origin}/webinar/${webinarForLinks?.uniqueId}`}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => copyToClipboard(
                      `${window.location.origin}/webinar/${webinarForLinks?.uniqueId}`,
                      "Participant link copied to clipboard"
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with participants to attend the webinar.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setWebinarForLinks(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <p>Error loading webinars: {(error as Error).message}</p>
          </div>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList className="mb-6">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming">
              {webinars?.upcoming?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {webinars.upcoming.map((webinar: Webinar) => (
                    <WebinarCard 
                      key={webinar.id} 
                      webinar={webinar} 
                      onShowLinks={setWebinarForLinks} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-10 bg-slate-50 rounded-md">
                  <CalendarDays className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium mb-1">No upcoming webinars</h3>
                  <p className="text-slate-500 mb-4">
                    You don't have any scheduled webinars. Create your first webinar now.
                  </p>
                  <Button onClick={() => navigate("/admin/webinars/create")} 
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 text-lg animate-pulse"
                    size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Create Webinar
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="active">
              {webinars?.active?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {webinars.active.map((webinar: Webinar) => (
                    <WebinarCard 
                      key={webinar.id} 
                      webinar={webinar} 
                      onShowLinks={setWebinarForLinks} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-10 bg-slate-50 rounded-md">
                  <Play className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium mb-1">No active webinars</h3>
                  <p className="text-slate-500">
                    You don't have any live webinars running at the moment.
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="past">
              {webinars?.past?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {webinars.past.map((webinar: Webinar) => (
                    <WebinarCard 
                      key={webinar.id} 
                      webinar={webinar} 
                      onShowLinks={setWebinarForLinks} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center p-10 bg-slate-50 rounded-md">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium mb-1">No past webinars</h3>
                  <p className="text-slate-500">
                    You haven't hosted any webinars yet.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}