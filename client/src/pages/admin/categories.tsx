import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Category, insertCategorySchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Edit, Trash2, Plus, FolderIcon, ArrowLeft } from "lucide-react";

export default function AdminCategories() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Fetch all categories
  const {
    data: categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof categoryFormSchema>) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Category created",
        description: "The category has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof categoryFormSchema> & { id: number }) => {
      const { id, ...categoryData } = data;
      const res = await apiRequest("PUT", `/api/categories/${id}`, categoryData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      toast({
        title: "Category updated",
        description: "The category has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      toast({
        title: "Category deleted",
        description: "The category has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // The extended schema for forms
  const categoryFormSchema = insertCategorySchema.extend({});

  // Create category form
  const createCategoryForm = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      icon: "📚",
      imageUrl: "",
      courseCount: 0,
    },
  });

  // Edit category form
  const editCategoryForm = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      icon: "",
      imageUrl: "",
      courseCount: 0,
    },
  });

  // Handle edit button click
  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    
    // Set form values
    editCategoryForm.reset({
      name: category.name,
      icon: category.icon,
      imageUrl: category.imageUrl || "",
      courseCount: category.courseCount,
    });
    
    setIsEditDialogOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  // Handle create category form submission
  const onCreateCategorySubmit = (data: z.infer<typeof categoryFormSchema>) => {
    createCategoryMutation.mutate(data);
  };

  // Handle edit category form submission
  const onEditCategorySubmit = (data: z.infer<typeof categoryFormSchema>) => {
    if (selectedCategory) {
      updateCategoryMutation.mutate({ ...data, id: selectedCategory.id });
    }
  };

  // Handle delete category confirmation
  const onDeleteCategoryConfirm = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.id);
    }
  };

  if (isLoadingCategories) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (categoriesError || !categories) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">Error Loading Categories</h3>
        <p className="text-sm mt-1">There was a problem loading the category data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 self-start"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Manage Categories</h2>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" className="bg-black hover:bg-gray-800 text-white text-xs" onClick={() => navigate("/admin/users")}>
            <Plus className="mr-1 h-3 w-3" />
            Users
          </Button>
          <Button size="sm" className="bg-black hover:bg-gray-800 text-white text-xs" onClick={() => navigate("/admin/courses")}>
            <Plus className="mr-1 h-3 w-3" />
            Courses
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-black hover:bg-gray-800 text-white text-xs">
                <Plus className="mr-1 h-3 w-3" />
                New Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] max-w-[85vw] max-h-[85vh] overflow-y-auto p-4">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-base">Add New Category</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new category to organize your courses.
                </DialogDescription>
              </DialogHeader>
              <Form {...createCategoryForm}>
                <form onSubmit={createCategoryForm.handleSubmit(onCreateCategorySubmit)} className="space-y-6">
                  <FormField
                    control={createCategoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Category Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createCategoryForm.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon (emoji or icon name)</FormLabel>
                        <FormControl>
                          <Input placeholder="📚 or book" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createCategoryForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Image (recommended size: 300x200px)</FormLabel>
                        <div className="flex flex-col gap-2">
                          {field.value && (
                            <div className="flex items-center gap-2 mb-2">
                              <img 
                                src={field.value} 
                                alt="Category preview" 
                                className="h-12 w-20 object-cover rounded-md"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => field.onChange("")}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="https://example.com/image.jpg" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <div className="relative">
                              <Input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    // Create a FormData object to send the file
                                    const formData = new FormData();
                                    formData.append('image', file);

                                    try {
                                      // Upload the image using our API
                                      const response = await fetch('/api/upload/category-image', {
                                        method: 'POST',
                                        body: formData,
                                        credentials: 'include',
                                      });

                                      if (!response.ok) {
                                        throw new Error('Failed to upload image');
                                      }

                                      const data = await response.json();
                                      // Update the field value with the returned URL
                                      field.onChange(data.imageUrl);
                                      toast({
                                        title: "Image uploaded",
                                        description: "Image has been uploaded successfully",
                                      });
                                    } catch (error) {
                                      console.error('Error uploading image:', error);
                                      toast({
                                        title: "Upload failed",
                                        description: "Failed to upload image. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                              >
                                Upload
                              </Button>
                            </div>
                          </div>
                        </div>
                        <FormDescription>
                          Enter a URL or upload an image for the category.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddDialogOpen(false)}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-black hover:bg-gray-800 text-white text-xs h-8"
                      size="sm"
                      disabled={createCategoryMutation.isPending}
                    >
                      {createCategoryMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Category"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-md shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-lg">
                {category.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">{category.name}</h3>
                <p className="text-xs text-gray-500">{category.courseCount || 0} courses</p>
              </div>
              {category.imageUrl && (
                <img 
                  src={category.imageUrl} 
                  alt={category.name}
                  className="w-8 h-8 object-cover rounded-md hidden sm:block"
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditClick(category)}
                className="h-7 text-xs px-2 py-0 flex-1 sm:flex-none"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteClick(category)}
                className="h-7 text-xs px-2 py-0 flex-1 sm:flex-none text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px] max-w-[85vw] max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Edit Category</DialogTitle>
            <DialogDescription className="text-xs">
              Update the details of your category.
            </DialogDescription>
          </DialogHeader>
          <Form {...editCategoryForm}>
            <form onSubmit={editCategoryForm.handleSubmit(onEditCategorySubmit)} className="space-y-6">
              <FormField
                control={editCategoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Category Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCategoryForm.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon (emoji or icon name)</FormLabel>
                    <FormControl>
                      <Input placeholder="📚 or book" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCategoryForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Image (recommended size: 300x200px)</FormLabel>
                    <div className="flex flex-col gap-2">
                      {field.value && (
                        <div className="flex items-center gap-2 mb-2">
                          <img 
                            src={field.value} 
                            alt="Category preview" 
                            className="h-12 w-20 object-cover rounded-md"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => field.onChange("")}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="https://example.com/image.jpg" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <div className="relative">
                          <Input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                // Create a FormData object to send the file
                                const formData = new FormData();
                                formData.append('image', file);

                                try {
                                  // Upload the image using our API
                                  const response = await fetch('/api/upload/category-image', {
                                    method: 'POST',
                                    body: formData,
                                    credentials: 'include',
                                  });

                                  if (!response.ok) {
                                    throw new Error('Failed to upload image');
                                  }

                                  const data = await response.json();
                                  // Update the field value with the returned URL
                                  field.onChange(data.imageUrl);
                                  toast({
                                    title: "Image uploaded",
                                    description: "Image has been uploaded successfully",
                                  });
                                } catch (error) {
                                  console.error('Error uploading image:', error);
                                  toast({
                                    title: "Upload failed",
                                    description: "Failed to upload image. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                          >
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>
                    <FormDescription>
                      Enter a URL or upload an image for the category.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-black hover:bg-gray-800 text-white text-xs h-8"
                  size="sm"
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Category"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] max-w-[85vw] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Delete Category</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete this category? All associated courses will need to be re-categorized.
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center text-lg">
                  {selectedCategory.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{selectedCategory.name}</div>
                  <div className="text-xs text-gray-500">{selectedCategory.courseCount || 0} courses</div>
                </div>
              </div>
              {selectedCategory.imageUrl && (
                <div className="mt-2 rounded-md overflow-hidden">
                  <img 
                    src={selectedCategory.imageUrl} 
                    alt={selectedCategory.name}
                    className="w-full h-24 sm:h-32 object-cover"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              size="sm"
              onClick={onDeleteCategoryConfirm}
              disabled={deleteCategoryMutation.isPending}
              className="text-xs h-8"
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}