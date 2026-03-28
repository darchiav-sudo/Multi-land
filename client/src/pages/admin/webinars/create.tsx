import React, { useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { CalendarClock, ArrowLeft, Users, Plus, Trash2, ExternalLink, Image, Upload, FileType, PaintBucket } from "lucide-react";
import { format } from "date-fns";

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

// Timezone data
const TIMEZONES = [
  { value: "Asia/Tbilisi", label: "Tbilisi (GMT+4)", isDefault: true },
  { value: "Europe/London", label: "London (GMT+0/+1)" },
  { value: "Europe/Paris", label: "Paris (GMT+1/+2)" },
  { value: "America/New_York", label: "New York (GMT-5/-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8/-7)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Australia/Sydney", label: "Sydney (GMT+10/+11)" },
];

// Define offer schema separately
const offerSchema = z.object({
  title: z.string().min(1, { message: "Offer title is required" }).default(""),
  buttonText: z.string().min(1, { message: "Button text is required" }).default("Buy Now"),
  buttonUrl: z.string().url({ message: "Valid URL is required" }).default(""),
  buttonColor: z.string().default("#22c55e"), // Default to green color
  imageUrl: z.string().url().optional(),
  durationSeconds: z.coerce.number().positive().default(60),
  active: z.boolean().default(true)
});

// Form schema
const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().optional().default(""),
  instructorName: z.string().default("Administrator"),
  scheduledStartTime: z.string().default(() => {
    const now = new Date();
    now.setHours(20, 0, 0, 0); // Default to 8:00 PM
    return now.toISOString().substring(0, 16); // Format: YYYY-MM-DDTHH:MM
  }),
  scheduledEndTime: z.string().optional().nullable().default(null),
  status: z.enum(["draft", "scheduled"]).default("scheduled"),
  // Store all settings in a settings JSON object
  settings: z.object({
    maxParticipants: z.coerce.number().min(1).max(2000).default(2000),
    allowChat: z.boolean().default(true),
    allowQuestions: z.boolean().default(true),
    moderateQuestions: z.boolean().default(false),
    requireRegistration: z.boolean().default(false),
    recordWebinar: z.boolean().default(false),
    timezone: z.string().default("Asia/Tbilisi"),
  }).default({
    maxParticipants: 2000,
    allowChat: true,
    allowQuestions: true,
    moderateQuestions: false,
    requireRegistration: false,
    recordWebinar: false,
    timezone: "Asia/Tbilisi"
  }),
  // Presentation file URL (PDF)
  presentationUrl: z.string().optional(),
  // Add an array of offers
  offers: z.array(offerSchema).default([])
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateWebinarPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitType, setSubmitType] = useState<"draft" | "scheduled">("scheduled");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      instructorName: "Administrator",
      status: "scheduled",
      // Default start time to 8:00 PM today
      scheduledStartTime: (() => {
        const now = new Date();
        now.setHours(20, 0, 0, 0); // Default to 8:00 PM
        return now.toISOString().substring(0, 16); // Format: YYYY-MM-DDTHH:MM
      })(),
      scheduledEndTime: null,
      settings: {
        maxParticipants: 2000,
        allowChat: true,
        allowQuestions: true,
        moderateQuestions: false,
        requireRegistration: false,
        recordWebinar: false,
        timezone: "Asia/Tbilisi"
      },
      presentationUrl: "",
      offers: []
    },
  });
  
  // Create webinar mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const result = await fetch("/api/webinars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!result.ok) {
        const error = await result.json();
        throw new Error(error.message || "Failed to create webinar");
      }
      
      return await result.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/webinars'] });
      toast({
        title: "Webinar created",
        description: "Your webinar has been created successfully.",
      });
      
      // Navigate to webinar detail or edit offers page
      navigate(`/admin/webinars/${data.id}/offers`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create webinar",
        variant: "destructive",
      });
    },
  });
  
  // Set up the field array for offers
  const { fields: offerFields, append: appendOffer, remove: removeOffer } = useFieldArray({
    control: form.control,
    name: "offers",
  });

  // Handler to add a new empty offer
  const handleAddOffer = () => {
    appendOffer({
      title: "",
      buttonText: "Buy Now",
      buttonUrl: "https://",
      buttonColor: "#22c55e", // Default green color
      durationSeconds: 60,
      active: true
    });
  };
  
  // Handle PDF presentation upload with chunked upload support for large files
  const handlePresentationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file is PDF
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Determine upload method based on file size
      if (file.size > 100 * 1024 * 1024) {
        // Large file > 100MB, use chunked upload for files up to 5GB
        await handleChunkedUpload(file);
      } else {
        // Smaller file, use direct upload
        await handleDirectUpload(file);
      }
      
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    }
  };
  
  // Handle direct upload for smaller files
  const handleDirectUpload = async (file: File) => {
    // Get presigned upload URL
    const getUrlResponse = await fetch('/api/s3/presigned-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: `webinar-presentations/${Date.now()}-${file.name}`,
        fileType: file.type
      })
    });
    
    if (!getUrlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }
    
    const { url, key } = await getUrlResponse.json();
    
    // Upload file to S3 with progress tracking
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percentage);
      }
    };
    
    // Handle the response
    const uploadResult = await new Promise<boolean>((resolve, reject) => {
      xhr.onload = async () => {
        if (xhr.status === 200) {
          resolve(true);
        } else {
          reject(new Error('Upload failed with status: ' + xhr.status));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };
      
      // Send the request
      xhr.send(file);
    });
    
    if (uploadResult) {
      // Get the public URL for the file
      const getPublicUrlResponse = await fetch(`/api/s3/url?key=${encodeURIComponent(key)}`);
      
      if (!getPublicUrlResponse.ok) {
        throw new Error('Failed to get public URL');
      }
      
      const { url: publicUrl } = await getPublicUrlResponse.json();
      
      // Update the form with the presentation URL
      form.setValue('presentationUrl', publicUrl);
      
      toast({
        title: "Upload successful",
        description: "Your presentation has been uploaded successfully",
      });
      setIsUploading(false);
    }
  };
  
  // Handle chunked upload for larger files (up to 5GB)
  const handleChunkedUpload = async (file: File) => {
    // Initialize the chunked upload
    const initResponse = await fetch('/api/uploads/chunked/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: `webinar-presentations/${Date.now()}-${file.name}`,
        contentType: file.type,
        fileSize: file.size
      })
    });
    
    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.message || 'Failed to initialize chunked upload');
    }
    
    const { uploadId, fileKey, chunkSize, partCount } = await initResponse.json();
    
    // Update progress message
    toast({
      title: "Upload started",
      description: `Processing ${partCount} chunks...`,
    });
    
    // Prepare chunks for upload
    const chunks: Blob[] = [];
    for (let i = 0; i < partCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push(file.slice(start, end));
    }
    
    // Get presigned URLs for each chunk
    const presignedUrlsResponse = await fetch(`/api/uploads/chunked/presigned-urls?uploadId=${uploadId}`);
    if (!presignedUrlsResponse.ok) {
      const error = await presignedUrlsResponse.json();
      throw new Error(error.message || 'Failed to get presigned URLs for chunks');
    }
    
    const { presignedUrls } = await presignedUrlsResponse.json();
    
    // Upload each chunk
    const uploadPromises = presignedUrls.map(async ({ partNumber, presignedUrl }: any, index: number) => {
      const chunk = chunks[index];
      
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl, true);
      
      // Track progress for this chunk
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Calculate overall progress based on all chunks
          const chunkProgress = (e.loaded / e.total) * (100 / partCount);
          const overallProgress = Math.round((index * (100 / partCount)) + chunkProgress);
          setUploadProgress(Math.min(overallProgress, 99)); // Cap at 99% until complete
        }
      };
      
      // Return a promise for this chunk upload
      return new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            // Extract ETag from headers
            const etag = xhr.getResponseHeader('ETag');
            if (etag) {
              resolve({ partNumber, etag: etag.replace(/"/g, '') });
            } else {
              reject(new Error('No ETag received for part ' + partNumber));
            }
          } else {
            reject(new Error(`Failed to upload part ${partNumber}: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error(`Network error uploading part ${partNumber}`));
        };
        
        xhr.send(chunk);
      });
    });
    
    try {
      // Wait for all chunks to upload
      const parts = await Promise.all(uploadPromises);
      
      // Complete the multipart upload
      const completeResponse = await fetch(`/api/uploads/chunked/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId,
          fileKey,
          parts
        })
      });
      
      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.message || 'Failed to complete upload');
      }
      
      const { fileUrl } = await completeResponse.json();
      
      // Update the form with the presentation URL
      form.setValue('presentationUrl', fileUrl);
      setUploadProgress(100);
      
      toast({
        title: "Upload successful",
        description: "Your presentation has been uploaded successfully",
      });
    } catch (error) {
      // Attempt to abort the multipart upload to clean up S3
      try {
        await fetch(`/api/uploads/chunked/abort`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uploadId,
            fileKey
          })
        });
      } catch (abortError) {
        console.error('Failed to abort multipart upload', abortError);
      }
      throw error;
    } finally {
      setIsUploading(false);
    }
  };
  
  // Form submission handler
  const onSubmit = (data: FormValues) => {
    // Set status based on the button that was clicked
    data.status = submitType;
    
    // If "scheduled" status but no start time, set status to "draft"
    if (data.status === "scheduled" && !data.scheduledStartTime) {
      data.status = "draft";
      toast({
        title: "Missing start time",
        description: "Webinar saved as draft because no start time was set",
        variant: "destructive",
      });
    }

    // For scheduled status, make sure we explicitly set scheduledEndTime to null
    // so the server can set the default (start time + 2 hours)
    if (data.status === "scheduled" && !data.scheduledEndTime) {
      data.scheduledEndTime = null;
    }
    
    // Process data before submitting to match server expectations
    const processedData = {
      ...data,
      // Ensure scheduledStartTime is not null if status is "scheduled"
      scheduledStartTime: data.scheduledStartTime || (data.status === "scheduled" ? new Date().toISOString() : null),
      // Let the server handle the end time calculation
      scheduledEndTime: null,
      createdBy: 1 // Admin user ID is 1
    };
    
    console.log("Submitting webinar data:", processedData);
    createMutation.mutate(processedData);
  };
  
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin/webinars")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create New Webinar</h1>
            <p className="text-slate-500 mt-1">
              Set up a new live webinar event
            </p>
          </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the details of your webinar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webinar Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter webinar title" {...field} />
                      </FormControl>
                      <FormDescription>
                        A clear, descriptive title for your webinar
                      </FormDescription>
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
                      <FormDescription>
                        Name of the webinar instructor/host
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>
            
            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Set when your webinar will take place
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledStartTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <Input 
                              type="datetime-local" 
                              {...field}
                              value={field.value || ""}
                              className="w-full"
                            />
                            <div className="ml-2 text-slate-500 flex items-center">
                              <CalendarClock className="h-4 w-4" />
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Set the date and time when your webinar will start
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="settings.timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Common Timezones</SelectLabel>
                              {TIMEZONES.map((timezone) => (
                                <SelectItem 
                                  key={timezone.value} 
                                  value={timezone.value}
                                >
                                  {timezone.label} {timezone.isDefault && "(Default)"}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        All times shown to attendees will be converted to their local timezone
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            {/* Presentation Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Presentation</CardTitle>
                <CardDescription>
                  Upload a PDF presentation for your webinar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="presentationUrl"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-col space-y-3">
                          <FormLabel>PDF Presentation</FormLabel>
                          <div className="flex items-center gap-3">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="application/pdf"
                              onChange={handlePresentationUpload}
                              className="hidden"
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className="flex items-center gap-2"
                            >
                              <FileType className="h-4 w-4" />
                              {isUploading ? "Uploading..." : "Choose PDF File"}
                            </Button>
                            {form.watch("presentationUrl") && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => window.open(form.watch("presentationUrl"), "_blank")}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View Uploaded PDF
                              </Button>
                            )}
                          </div>
                          
                          {isUploading && (
                            <div className="space-y-2">
                              <Progress value={uploadProgress} className="h-2 w-full" />
                              <p className="text-sm text-slate-500">Uploading: {uploadProgress}%</p>
                            </div>
                          )}
                          
                          {field.value && !isUploading && (
                            <div className="flex items-center space-x-2 text-sm text-green-600">
                              <FileType className="h-4 w-4" />
                              <span>PDF uploaded successfully</span>
                            </div>
                          )}
                          
                          <FormDescription>
                            Upload a PDF presentation that will be shown during the webinar.
                            Maximum file size: 5GB.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Attendee Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Attendee Settings</CardTitle>
                <CardDescription>
                  Configure how attendees will interact with your webinar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="settings.maxParticipants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Attendees</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input 
                            type="number" 
                            min={1} 
                            max={2000} 
                            {...field}
                          />
                          <div className="ml-2 text-slate-500 flex items-center">
                            <Users className="h-4 w-4" />
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Maximum number of attendees allowed (up to 2,000)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="settings.allowChat"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Chat</FormLabel>
                          <FormDescription>
                            Let attendees send chat messages
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.allowQuestions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Questions</FormLabel>
                          <FormDescription>
                            Let attendees ask questions
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.moderateQuestions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Moderate Questions</FormLabel>
                          <FormDescription>
                            Review questions before showing them
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("settings.allowQuestions")}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.requireRegistration"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Require Registration</FormLabel>
                          <FormDescription>
                            Attendees must provide email
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="settings.recordWebinar"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Record Webinar</FormLabel>
                          <FormDescription>
                            Save a recording for later access
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Special Offers */}
            <Card>
              <CardHeader>
                <CardTitle>Special Offers</CardTitle>
                <CardDescription>
                  Create special offers to show during your webinar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {offerFields.length === 0 ? (
                  <div className="text-center p-6 border border-dashed rounded-md">
                    <p className="text-slate-500 mb-4">No offers yet. Add special offers to show during your webinar.</p>
                    <Button type="button" onClick={handleAddOffer} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Offer
                    </Button>
                  </div>
                ) : (
                  <>
                    {offerFields.map((field, index) => (
                      <div key={field.id} className="border rounded-md p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Offer #{index + 1}</h3>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeOffer(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`offers.${index}.title`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Offer Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Special Discount" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`offers.${index}.buttonColor`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Button Color</FormLabel>
                                <FormControl>
                                  <div className="flex">
                                    <span 
                                      className="flex items-center px-3 rounded-l-md border border-r-0"
                                      style={{ backgroundColor: field.value }}
                                    >
                                      <PaintBucket className="h-4 w-4 text-white" />
                                    </span>
                                    <Input 
                                      type="color"
                                      {...field}
                                      className="h-10 w-full"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Description field removed as requested */}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`offers.${index}.buttonText`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Button Text</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Buy Now" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`offers.${index}.buttonUrl`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Button URL</FormLabel>
                                <FormControl>
                                  <div className="flex">
                                    <Input 
                                      placeholder="https://example.com/offer"
                                      {...field}
                                    />
                                    <div className="ml-2 flex items-center">
                                      <ExternalLink className="h-4 w-4 text-slate-500" />
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`offers.${index}.durationSeconds`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Duration (seconds)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min={10}
                                    placeholder="60"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  How long to display this offer
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`offers.${index}.active`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                  <FormLabel>Active</FormLabel>
                                  <FormDescription>
                                    Enable this offer
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-green-600 data-[state=checked]:text-white data-[state=unchecked]:bg-slate-900"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`offers.${index}.imageUrl`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Image URL (Optional)</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Input 
                                    placeholder="https://example.com/image.jpg"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                  <div className="ml-2 flex items-center">
                                    <Image className="h-4 w-4 text-slate-500" />
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Add an image to display with your offer
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                    
                    <Button 
                      type="button" 
                      onClick={handleAddOffer}
                      variant="outline"
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Offer
                    </Button>
                  </>
                )}
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
                {/* Save as Draft button */}
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={createMutation.isPending}
                  onClick={() => {
                    setSubmitType("draft");
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  Save as Draft
                </Button>
                
                {/* Schedule Webinar button (primary action) */}
                <Button 
                  type="button" 
                  disabled={createMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setSubmitType("scheduled");
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  {createMutation.isPending ? "Creating..." : "Schedule Webinar"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}