import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Camera, Mic, Video, Monitor, Layout, Users } from "lucide-react";

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Form schema
const formSchema = z.object({
  // Video settings
  cameraEnabled: z.boolean().default(true),
  microphoneEnabled: z.boolean().default(true),
  screenShareEnabled: z.boolean().default(true),
  videoQuality: z.enum(["low", "medium", "high", "hd"]).default("high"),
  
  // Layout settings
  layoutType: z.enum(["grid", "speaker-focus", "presentation"]).default("speaker-focus"),
  showAttendeeCount: z.boolean().default(true),
  allowAttendeeVideo: z.boolean().default(false),
  allowAttendeeAudio: z.boolean().default(false),
  
  // Chat settings
  chatEnabled: z.boolean().default(true),
  moderateChat: z.boolean().default(false),
  privateChatEnabled: z.boolean().default(false),
  
  // Recording settings
  recordSession: z.boolean().default(false),
  includeChat: z.boolean().default(true),
  includeAttendees: z.boolean().default(false),
  
  // Host settings
  showHostControls: z.boolean().default(true),
  multipleHosts: z.boolean().default(false),
  maxHosts: z.coerce.number().min(1).max(10).default(1),
});

type FormValues = z.infer<typeof formSchema>;

export default function WebinarSettingsPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/webinars/:id/settings");
  const webinarId = params?.id || "";
  const { toast } = useToast();
  
  // Get webinar data
  const { data: webinar, isLoading, error } = useQuery({
    queryKey: [`/api/webinars/${webinarId}`],
    queryFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch webinar");
      }
      return res.json();
    },
  });
  
  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cameraEnabled: true,
      microphoneEnabled: true,
      screenShareEnabled: true,
      videoQuality: "high",
      layoutType: "speaker-focus",
      showAttendeeCount: true,
      allowAttendeeVideo: false,
      allowAttendeeAudio: false,
      chatEnabled: true,
      moderateChat: false,
      privateChatEnabled: false,
      recordSession: false,
      includeChat: true,
      includeAttendees: false,
      showHostControls: true,
      multipleHosts: false,
      maxHosts: 1,
    },
  });
  
  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await fetch(`/api/webinars/${webinarId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error("Failed to update webinar settings");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}`] });
      toast({
        title: "Settings saved",
        description: "Webinar settings have been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: FormValues) => {
    updateSettingsMutation.mutate(data);
  };
  
  const publishWebinar = async () => {
    try {
      const res = await fetch(`/api/webinars/${webinarId}/publish`, {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Failed to publish webinar");
      }
      
      toast({
        title: "Webinar published",
        description: "Your webinar is now ready to be shared",
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}`] });
      navigate("/admin/webinars");
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to publish webinar: ${error.message}`,
        variant: "destructive",
      });
    }
  };
  
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(`/admin/webinars/${webinarId}/offers`)}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Webinar Room Settings</h1>
            <p className="text-slate-500 mt-1">
              Configure your webinar room layout and features
            </p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <p>Error loading webinar: {(error as Error).message}</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Tabs defaultValue="video">
                <TabsList className="mb-8">
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <span>Video & Audio</span>
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    <span>Layout</span>
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Attendees & Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="recording" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span>Recording</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="video">
                  <Card>
                    <CardHeader>
                      <CardTitle>Video & Audio Settings</CardTitle>
                      <CardDescription>
                        Configure video and audio settings for your webinar
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-6">
                        <FormField
                          control={form.control}
                          name="cameraEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Camera Enabled
                                </FormLabel>
                                <FormDescription>
                                  Allow host to use camera during webinar
                                </FormDescription>
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
                          name="microphoneEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Microphone Enabled
                                </FormLabel>
                                <FormDescription>
                                  Allow host to use microphone during webinar
                                </FormDescription>
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
                          name="screenShareEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Screen Sharing
                                </FormLabel>
                                <FormDescription>
                                  Allow host to share screen during webinar
                                </FormDescription>
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
                          name="videoQuality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Video Quality</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select video quality" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low (360p) - Best for slow connections</SelectItem>
                                  <SelectItem value="medium">Medium (480p) - Good balance</SelectItem>
                                  <SelectItem value="high">High (720p) - Recommended</SelectItem>
                                  <SelectItem value="hd">HD (1080p) - Best quality</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Higher quality requires more bandwidth
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="layout">
                  <Card>
                    <CardHeader>
                      <CardTitle>Layout Settings</CardTitle>
                      <CardDescription>
                        Configure how your webinar will appear to viewers
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField
                        control={form.control}
                        name="layoutType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Layout Type</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-1"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="grid" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Grid view (all participants equal size)
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="speaker-focus" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Speaker focus (active speaker is larger)
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="presentation" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Presentation (shared content is largest)
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Separator />
                      
                      <FormField
                        control={form.control}
                        name="showAttendeeCount"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Show Attendee Count
                              </FormLabel>
                              <FormDescription>
                                Display the number of viewers in the webinar
                              </FormDescription>
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
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="chat">
                  <Card>
                    <CardHeader>
                      <CardTitle>Attendees & Chat Settings</CardTitle>
                      <CardDescription>
                        Configure attendee permissions and chat features
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="chatEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Enable Chat
                              </FormLabel>
                              <FormDescription>
                                Allow attendees to chat during the webinar
                              </FormDescription>
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
                      
                      {form.watch("chatEnabled") && (
                        <>
                          <FormField
                            control={form.control}
                            name="moderateChat"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Moderate Chat
                                  </FormLabel>
                                  <FormDescription>
                                    Messages require host approval before appearing
                                  </FormDescription>
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
                            name="privateChatEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Private Chat
                                  </FormLabel>
                                  <FormDescription>
                                    Allow attendees to send private messages to each other
                                  </FormDescription>
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
                        </>
                      )}
                      
                      <Separator />
                      
                      <FormField
                        control={form.control}
                        name="allowAttendeeVideo"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Allow Attendee Video
                              </FormLabel>
                              <FormDescription>
                                Allow attendees to share their video if called upon
                              </FormDescription>
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
                        name="allowAttendeeAudio"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Allow Attendee Audio
                              </FormLabel>
                              <FormDescription>
                                Allow attendees to speak if called upon
                              </FormDescription>
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
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="recording">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recording Settings</CardTitle>
                      <CardDescription>
                        Configure recording options for your webinar
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="recordSession"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Record Webinar
                              </FormLabel>
                              <FormDescription>
                                Automatically record the entire webinar
                              </FormDescription>
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
                      
                      {form.watch("recordSession") && (
                        <>
                          <FormField
                            control={form.control}
                            name="includeChat"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Include Chat
                                  </FormLabel>
                                  <FormDescription>
                                    Include chat messages in the recording
                                  </FormDescription>
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
                            name="includeAttendees"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Include Attendee List
                                  </FormLabel>
                                  <FormDescription>
                                    Include attendee information in the recording metadata
                                  </FormDescription>
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
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-between">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/admin/webinars/${webinarId}/offers`)}
                >
                  Previous: Offers
                </Button>
                
                <div className="space-x-3">
                  <Button 
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={publishWebinar}
                  >
                    Finish & Publish
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AdminLayout>
  );
}