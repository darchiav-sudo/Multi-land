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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Course, Category, insertCourseSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Edit, Trash2, Plus, Filter, FileText, BookOpen, ArrowLeft, Image } from "lucide-react";
import { CourseBannerGenerator } from "@/components/course-banner-generator";

export default function AdminCourses() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  


  // Fetch all courses
  const {
    data: courses,
    isLoading: isLoadingCourses,
    error: coursesError,
  } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch categories for filter and form select
  const {
    data: categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Filter courses based on search query and category
  const filteredCourses = courses?.filter((course) => {
    const matchesSearch = searchQuery
      ? course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesCategory = categoryFilter && categoryFilter !== "all"
      ? course.category === categoryFilter
      : true;
    
    return matchesSearch && matchesCategory;
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof courseFormSchema>) => {
      // Remove modules from the form data as it's now handled by the server with a default value
      const res = await apiRequest("POST", "/api/courses", {
        ...data,
        price: Math.round(parseFloat(data.price) * 100), // Convert to cents
        rating: data.rating ? Math.round(parseFloat(data.rating) * 10) : null, // Convert to internal rating format
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Course created",
        description: "The course has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update course mutation
  const updateCourseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof courseFormSchema> & { id: number }) => {
      const { id, ...courseData } = data;
      const res = await apiRequest("PUT", `/api/courses/${id}`, {
        ...courseData,
        price: Math.round(parseFloat(courseData.price) * 100), // Convert to cents
        rating: courseData.rating ? Math.round(parseFloat(courseData.rating) * 10) : null, // Convert to internal rating format
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsEditDialogOpen(false);
      setSelectedCourse(null);
      toast({
        title: "Course updated",
        description: "The course has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsDeleteDialogOpen(false);
      setSelectedCourse(null);
      toast({
        title: "Course deleted",
        description: "The course has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // The extended schema for forms
  const courseFormSchema = insertCourseSchema.extend({
    price: z.string().regex(/^\d+(\.\d{1,2})?$/, {
      message: "Price must be a valid number",
    }), // Price as string for form handling
    rating: z.string().regex(/^[0-5](\.[0-9])?$/, {
      message: "Rating must be between 0 and 5",
    }).or(z.literal("")), // Rating as string for form handling, allowing empty string
  });

  // Create course form
  const createCourseForm = useForm<z.infer<typeof courseFormSchema>>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "0.00",
      category: "",
      imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
      instructorName: "",
      rating: "0.0",
      published: false,
    },
  });

  // Edit course form
  const editCourseForm = useForm<z.infer<typeof courseFormSchema>>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "0.00",
      category: "",
      imageUrl: "",
      instructorName: "",
      rating: "0.0",
      published: false,
    },
  });

  // Handle edit button click
  const handleEditClick = (course: Course) => {
    setSelectedCourse(course);
    
    // Convert course data for form
    editCourseForm.reset({
      title: course.title,
      description: course.description,
      price: (course.price / 100).toFixed(2), // Convert from cents
      category: course.category,
      imageUrl: course.imageUrl,
      instructorName: course.instructorName,
      rating: course.rating !== null ? (course.rating / 10).toFixed(1) : "0.0", // Convert from internal format
      published: course.published,
    });
    
    setIsEditDialogOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (course: Course) => {
    setSelectedCourse(course);
    setIsDeleteDialogOpen(true);
  };

  // Handle create course form submission
  const onCreateCourseSubmit = (data: z.infer<typeof courseFormSchema>) => {
    createCourseMutation.mutate(data);
  };

  // Handle edit course form submission
  const onEditCourseSubmit = (data: z.infer<typeof courseFormSchema>) => {
    if (selectedCourse) {
      updateCourseMutation.mutate({ ...data, id: selectedCourse.id });
    }
  };

  // Handle delete course confirmation
  const onDeleteCourseConfirm = () => {
    if (selectedCourse) {
      deleteCourseMutation.mutate(selectedCourse.id);
    }
  };

  if (isLoadingCourses || isLoadingCategories) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (coursesError || categoriesError || !courses || !categories) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">Error Loading Courses</h3>
        <p className="text-sm mt-1">There was a problem loading the course data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">Manage Courses</h2>
        </div>
        
        {/* Action buttons in a grid for better mobile display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button className="bg-black hover:bg-gray-800 text-white w-full" onClick={() => window.location.href = "/admin/users"}>
            <Plus className="mr-2 h-4 w-4" />
            Add Users
          </Button>
          <Button className="bg-black hover:bg-gray-800 text-white w-full" onClick={() => window.location.href = "/admin/categories"}>
            <Plus className="mr-2 h-4 w-4" />
            Manage Categories
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black hover:bg-gray-800 text-white w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add New Course
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogDescription>
                  Create a new course to add to your platform.
                </DialogDescription>
              </DialogHeader>
              <Form {...createCourseForm}>
                <form onSubmit={createCourseForm.handleSubmit(onCreateCourseSubmit)} className="space-y-6">
                  <FormField
                    control={createCourseForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Course Title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createCourseForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Course Description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createCourseForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createCourseForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createCourseForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course Banner</FormLabel>
                        <div className="flex flex-col gap-2">
                          {field.value && (
                            <div className="flex items-center gap-2 mb-2">
                              <img 
                                src={field.value} 
                                alt="Course preview" 
                                className="h-12 w-full object-cover rounded-md"
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
                          
                          <FormControl>
                            <CourseBannerGenerator
                              initialText={createCourseForm.getValues().title.substring(0, 15)}
                              initialBgColor="#000000"
                              onBannerGenerated={(imageData) => {
                                field.onChange(imageData);
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createCourseForm.control}
                      name="instructorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instructor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Instructor Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createCourseForm.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating (0-5)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" min="0" max="5" value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createCourseForm.control}
                      name="published"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Published</FormLabel>
                            <FormDescription>
                              Make this course available to students
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
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-black hover:bg-gray-800 text-white"
                      disabled={createCourseMutation.isPending}
                    >
                      {createCourseMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Course"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
              }}
              className="whitespace-nowrap"
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Courses Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  <th className="px-4 py-3 w-1/3">Course</th>
                  <th className="px-4 py-3">Actions</th>
                  <th className="px-4 py-3">Instructor</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCourses && filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                            <img
                              src={course.imageUrl}
                              alt={course.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{course.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/admin/content-manager/${course.id}`)}
                            className="h-8 w-8 p-0 text-purple-600 hover:text-purple-800"
                            title="Manage Content"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditClick(course)}
                            className="h-8 w-8 p-0 text-gray-700 hover:text-black"
                            title="Edit Course"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteClick(course)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                            title="Delete Course"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {course.instructorName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(course.price / 100)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={course.published ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {course.published ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                          {course.category}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No courses found. Create a new course to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the details of your course.
            </DialogDescription>
          </DialogHeader>
          <Form {...editCourseForm}>
            <form onSubmit={editCourseForm.handleSubmit(onEditCourseSubmit)} className="space-y-6">
              {/* Same form fields as Add Course dialog */}
              <FormField
                control={editCourseForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Course Title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCourseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Course Description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editCourseForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editCourseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editCourseForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Banner</FormLabel>
                    <div className="flex flex-col gap-2">
                      {field.value && (
                        <div className="flex items-center gap-2 mb-2">
                          <img 
                            src={field.value} 
                            alt="Course preview" 
                            className="h-12 w-full object-cover rounded-md"
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
                      
                      <FormControl>
                        <CourseBannerGenerator
                          initialText={editCourseForm.getValues().title.substring(0, 15)}
                          initialBgColor="#000000"
                          onBannerGenerated={(imageData) => {
                            field.onChange(imageData);
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editCourseForm.control}
                  name="instructorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Instructor Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editCourseForm.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating (0-5)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" min="0" max="5" value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editCourseForm.control}
                  name="published"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Published</FormLabel>
                        <FormDescription>
                          Make this course available to students
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
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-black hover:bg-gray-800 text-white"
                  disabled={updateCourseMutation.isPending}
                >
                  {updateCourseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Course"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Course Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this course? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded overflow-hidden">
                  <img 
                    src={selectedCourse.imageUrl} 
                    alt={selectedCourse.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-medium">{selectedCourse.title}</div>
                  <div className="text-sm text-gray-500">{selectedCourse.category}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={onDeleteCourseConfirm}
              disabled={deleteCourseMutation.isPending}
            >
              {deleteCourseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Course"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}