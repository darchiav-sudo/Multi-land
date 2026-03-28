import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2, Clock, BadgeDollarSign, Edit, ExternalLink } from "lucide-react";

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
interface WebinarOffer {
  id: string;
  title: string;
  description: string;
  price?: number;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  timing?: number;
  durationSeconds?: number;
  active: boolean;
  created: string;
}

interface Webinar {
  id: number;
  title: string;
  offers: WebinarOffer[];
  status: string;
}

// Offer form schema
const offerSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().optional(),
  buttonText: z.string().min(1, "Button text is required"),
  buttonUrl: z.string().min(1, "Button URL is required"),
  imageUrl: z.string().optional(),
  timing: z.coerce.number().optional(),
  durationSeconds: z.coerce.number().optional(),
  active: z.boolean().default(true),
});

type OfferFormValues = z.infer<typeof offerSchema>;

export default function WebinarOffersPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/webinars/:id/offers");
  const webinarId = params?.id || "";
  const { toast } = useToast();
  
  // State for offer dialog
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<WebinarOffer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<string | null>(null);
  
  // Initialize form
  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      title: "",
      description: "",
      buttonText: "Buy Now",
      buttonUrl: "",
      active: true,
    },
  });
  
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
  
  // Add offer mutation
  const addOfferMutation = useMutation({
    mutationFn: async (data: OfferFormValues) => {
      const res = await fetch(`/api/webinars/${webinarId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error("Failed to add offer");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}`] });
      toast({
        title: "Offer added",
        description: "Your offer has been added to the webinar",
      });
      setOfferDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add offer: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Update offer mutation
  const updateOfferMutation = useMutation({
    mutationFn: async ({ offerId, data }: { offerId: string; data: OfferFormValues }) => {
      const res = await fetch(`/api/webinars/${webinarId}/offers/${offerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error("Failed to update offer");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}`] });
      toast({
        title: "Offer updated",
        description: "Your offer has been updated",
      });
      setOfferDialogOpen(false);
      form.reset();
      setCurrentOffer(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update offer: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Delete offer mutation
  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await fetch(`/api/webinars/${webinarId}/offers/${offerId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete offer");
      }
      
      return res.status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}`] });
      toast({
        title: "Offer deleted",
        description: "The offer has been removed from the webinar",
      });
      setDeleteDialogOpen(false);
      setOfferToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete offer: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (data: OfferFormValues) => {
    if (currentOffer) {
      updateOfferMutation.mutate({ offerId: currentOffer.id, data });
    } else {
      addOfferMutation.mutate(data);
    }
  };
  
  // Open dialog to add new offer
  const openAddOfferDialog = () => {
    form.reset({
      title: "",
      description: "",
      buttonText: "Buy Now",
      buttonUrl: "",
      active: true,
    });
    setCurrentOffer(null);
    setOfferDialogOpen(true);
  };
  
  // Open dialog to edit offer
  const openEditOfferDialog = (offer: WebinarOffer) => {
    form.reset({
      title: offer.title,
      description: offer.description,
      price: offer.price,
      buttonText: offer.buttonText,
      buttonUrl: offer.buttonUrl,
      imageUrl: offer.imageUrl,
      timing: offer.timing,
      durationSeconds: offer.durationSeconds,
      active: offer.active,
    });
    setCurrentOffer(offer);
    setOfferDialogOpen(true);
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (offerId: string) => {
    setOfferToDelete(offerId);
    setDeleteDialogOpen(true);
  };
  
  // Format time in minutes to readable format
  const formatMinutes = (minutes?: number) => {
    if (!minutes) return "Not set";
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    
    return `${mins}m`;
  };
  
  // Continue to next step (settings page)
  const goToNextStep = () => {
    navigate(`/admin/webinars/${webinarId}/settings`);
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
            <h1 className="text-3xl font-bold">Webinar Offers</h1>
            <p className="text-slate-500 mt-1">
              Create special offers to display during your webinar
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
          <>
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle>
                  Webinar: {webinar?.title}
                </CardTitle>
                <CardDescription>
                  Create offers that will be displayed during your webinar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={openAddOfferDialog}>
                    <CardContent className="flex flex-col items-center justify-center h-full py-8">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-1">Add New Offer</h3>
                      <p className="text-sm text-slate-500 text-center">
                        Create a special offer to display during your webinar
                      </p>
                    </CardContent>
                  </Card>
                  
                  {webinar?.offers?.map((offer: WebinarOffer) => (
                    <Card key={offer.id} className={!offer.active ? "opacity-70" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between">
                          <CardTitle className="text-lg truncate max-w-[200px]">
                            {offer.title}
                          </CardTitle>
                          {offer.price !== undefined && (
                            <div className="text-lg font-bold text-primary flex items-center">
                              <BadgeDollarSign className="h-4 w-4 mr-1" />
                              ${(offer.price / 100).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <CardDescription className="truncate max-w-[250px]">
                          {offer.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {offer.timing !== undefined && (
                          <div className="flex items-center text-sm">
                            <Clock className="h-4 w-4 mr-2 text-slate-500" />
                            <span>Show at {formatMinutes(offer.timing)}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center text-sm">
                          <ExternalLink className="h-4 w-4 mr-2 text-slate-500" />
                          <span className="truncate max-w-[200px]">{offer.buttonUrl}</span>
                        </div>
                        
                        {!offer.active && (
                          <div className="text-sm text-amber-600 mt-2">This offer is inactive</div>
                        )}
                      </CardContent>
                      <Separator />
                      <CardFooter className="p-3 flex justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(offer.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditOfferDialog(offer)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                {webinar?.offers?.length === 0 && (
                  <div className="bg-slate-50 p-6 rounded-md text-center mt-4">
                    <p className="text-slate-500 mb-2">
                      No offers have been created yet
                    </p>
                    <p className="text-slate-400 text-sm">
                      Add offers that will be displayed to attendees during your webinar
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-4 flex justify-end">
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/admin/webinars/${webinarId}/edit`)}
                  >
                    Previous: Details
                  </Button>
                  <Button onClick={goToNextStep}>
                    Next: Room Settings
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </>
        )}
        
        {/* Offer Dialog */}
        <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {currentOffer ? "Edit Offer" : "Add New Offer"}
              </DialogTitle>
              <DialogDescription>
                {currentOffer 
                  ? "Update the details of your offer"
                  : "Create a special offer to display during your webinar"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Special Discount" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your offer" 
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (USD)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                              <span className="text-gray-500">$</span>
                            </div>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              className="pl-7"
                              {...field}
                              value={field.value !== undefined ? field.value / 100 : ''}
                              onChange={e => {
                                const value = e.target.value;
                                field.onChange(value ? Math.round(parseFloat(value) * 100) : undefined);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>Leave empty for non-priced offers</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="timing"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Show at (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 15" 
                            {...field}
                            value={field.value || ''}
                            onChange={e => {
                              const value = e.target.value;
                              field.onChange(value ? parseInt(value) : undefined);
                            }}
                          />
                        </FormControl>
                        <FormDescription>Minutes into webinar</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="buttonText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Button Text</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Buy Now" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="buttonUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Button URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormDescription>Where users will go when they click the button</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="durationSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Duration (seconds)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 60" 
                          {...field}
                          value={field.value || ''}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value) : undefined);
                          }}
                        />
                      </FormControl>
                      <FormDescription>How long the offer stays on screen</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>Image to display with the offer</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive offers will not be displayed
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
                
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOfferDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addOfferMutation.isPending || updateOfferMutation.isPending}
                  >
                    {currentOffer ? "Update Offer" : "Add Offer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Offer</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this offer? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => offerToDelete && deleteOfferMutation.mutate(offerToDelete)}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteOfferMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}