import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queryClient";
import { SelectTimezone } from "@/components/timezone-select";
import { Switch as BaseSwitch } from "@/components/ui/switch";

// Custom switch component with green/black styling
const Switch = React.forwardRef((props: any, ref) => {
  return (
    <BaseSwitch
      {...props}
      ref={ref}
      className={`${props.checked ? 'bg-green-600' : 'bg-black'} ${props.className || ''}`}
    />
  );
});
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { 
  Calendar, 
  Trash2, 
  ArrowLeft, 
  Save, 
  Clock, 
  AlarmCheck,
  Bell,
  Users
} from "lucide-react";
import { format, parse } from "date-fns";

// Create a schema for webinar form validation
const webinarSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  instructorName: z.string().min(1, "Instructor name is required"),
  scheduledStartTime: z.string().min(1, "Start time is required"),
  settings: z.object({
    maxParticipants: z.number().min(1, "Must allow at least 1 participant"),
    timezone: z.string().min(1, "Timezone is required"),
    allowChat: z.boolean(),
    allowQuestions: z.boolean(),
    moderateQuestions: z.boolean(),
    requireRegistration: z.boolean(),
    recordWebinar: z.boolean(),
  }),
});

type WebinarFormValues = z.infer<typeof webinarSchema>;

export default function EditWebinarPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [webinar, setWebinar] = useState<any | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Define form
  const form = useForm<WebinarFormValues>({
    resolver: zodResolver(webinarSchema),
    defaultValues: {
      title: "",
      description: "",
      instructorName: "",
      scheduledStartTime: "",
      settings: {
        maxParticipants: 2000,
        timezone: "Asia/Tbilisi",
        allowChat: true,
        allowQuestions: true,
        moderateQuestions: false,
        requireRegistration: false,
        recordWebinar: false,
      },
    },
  });
  
  // Load webinar data
  useEffect(() => {
    const fetchWebinar = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/webinars/${id}`);
        
        if (!res.ok) {
          throw new Error("Failed to fetch webinar");
        }
        
        const data = await res.json();
        setWebinar(data);
        
        // Format date for form input
        let formattedStartTime = "";
        
        if (data.scheduledStartTime) {
          const date = new Date(data.scheduledStartTime);
          formattedStartTime = format(date, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Set form values
        form.reset({
          title: data.title,
          description: data.description || "",
          instructorName: data.instructorName,
          scheduledStartTime: formattedStartTime,
          settings: {
            maxParticipants: data.settings.maxParticipants || 2000,
            timezone: data.timezone || "Asia/Tbilisi",
            allowChat: data.settings.allowChat !== false, // Default to true if not specified
            allowQuestions: data.settings.allowQuestions !== false,
            moderateQuestions: data.settings.moderateQuestions || false,
            requireRegistration: data.settings.requireRegistration || false,
            recordWebinar: data.settings.recordWebinar || false,
          },
        });
      } catch (err) {
        setError(err as Error);
        toast({
          title: "Error",
          description: `Failed to fetch webinar: ${(err as Error).message}`,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWebinar();
  }, [id, form, toast]);
  
  // Handle form submission
  const onSubmit = async (values: WebinarFormValues) => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      // Parse the date string to a Date object
      const scheduledStartTime = values.scheduledStartTime;
      
      // Prepare data for API
      const webinarData = {
        ...values,
        updatedBy: user.id,
      };
      
      const res = await fetch(`/api/webinars/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webinarData),
      });
      
      if (!res.ok) {
        throw new Error("Failed to update webinar");
      }
      
      // Invalidate queries to refetch webinar data
      queryClient.invalidateQueries({ queryKey: ['/api/webinars'] });
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${id}`] });
      
      toast({
        title: "Webinar updated",
        description: "The webinar has been successfully updated.",
      });
      
      // Redirect to webinar list
      navigate("/admin/webinars");
    } catch (err) {
      toast({
        title: "Error",
        description: `Failed to update webinar: ${(err as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle webinar deletion
  const handleDeleteWebinar = async () => {
    try {
      setIsDeleting(true);
      
      const res = await fetch(`/api/webinars/${id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete webinar");
      }
      
      // Invalidate queries to refetch webinar list
      queryClient.invalidateQueries({ queryKey: ['/api/webinars'] });
      
      toast({
        title: "Webinar deleted",
        description: "The webinar has been successfully deleted.",
      });
      
      // Redirect to webinar list
      navigate("/admin/webinars");
    } catch (err) {
      toast({
        title: "Error",
        description: `Failed to delete webinar: ${(err as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={() => navigate("/admin/webinars")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Edit Webinar</h1>
            </div>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={() => navigate("/admin/webinars")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Edit Webinar</h1>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <p>Error: {error.message}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  if (!webinar) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={() => navigate("/admin/webinars")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Edit Webinar</h1>
            </div>
          </div>
          <div className="text-center p-10 bg-slate-50 rounded-md">
            <h3 className="text-lg font-medium mb-1">Webinar not found</h3>
            <p className="text-slate-500 mb-4">
              The webinar you're trying to edit doesn't exist or has been deleted.
            </p>
            <Button 
              onClick={() => navigate("/admin/webinars")} 
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Webinars
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => navigate("/admin/webinars")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Edit Webinar</h1>
          </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Webinar Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter webinar title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter webinar description" 
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="instructorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter instructor name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledStartTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scheduled Start Time</FormLabel>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-slate-500" />
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-slate-500" />
                          <FormControl>
                            <SelectTimezone
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="settings.maxParticipants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Participants</FormLabel>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-slate-500" />
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={2000} 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Attendee Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="settings.allowChat"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Chat</FormLabel>
                          <p className="text-sm text-slate-500">
                            Enable chat functionality for attendees
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Separator />
                  
                  <FormField
                    control={form.control}
                    name="settings.allowQuestions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Questions</FormLabel>
                          <p className="text-sm text-slate-500">
                            Let attendees submit questions
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.moderateQuestions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between pl-8">
                        <div className="space-y-0.5">
                          <FormLabel>Moderate Questions</FormLabel>
                          <p className="text-sm text-slate-500">
                            Review questions before they are visible to everyone
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("settings.allowQuestions")}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Separator />
                  
                  <FormField
                    control={form.control}
                    name="settings.requireRegistration"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Require Registration</FormLabel>
                          <p className="text-sm text-slate-500">
                            Attendees must register before joining
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Separator />
                  
                  <FormField
                    control={form.control}
                    name="settings.recordWebinar"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Record Webinar</FormLabel>
                          <p className="text-sm text-slate-500">
                            Automatically record the webinar
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div>
                {/* Cancel button */}
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate("/admin/webinars")}
                >
                  Cancel
                </Button>
              </div>
              <div className="flex space-x-2">
                {/* Delete button */}
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                
                {/* Save Changes button (primary action) */}
                <Button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                webinar and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWebinar}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}