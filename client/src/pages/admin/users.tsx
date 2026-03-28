import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, 
  Search, 
  User, 
  UserPlus, 
  BookOpen, 
  Clock, 
  CheckCircle, 
  Trash,
  AlertTriangle,
  PenTool,
  Plus
} from "lucide-react";
import { User as UserType, Enrollment, insertUserSchema, Course } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManageCoursesOpen, setIsManageCoursesOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  // Track the access duration for each course
  const [courseDurations, setCourseDurations] = useState<Record<number, number>>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State for storing selected courses for new user
  const [newUserCourseIds, setNewUserCourseIds] = useState<number[]>([]);
  // State for storing course durations for new user
  const [newUserCourseDurations, setNewUserCourseDurations] = useState<Record<number, number>>({});
  
  // Form schema for adding a new user
  const formSchema = insertUserSchema.pick({ email: true }).extend({
    email: z.string().email("Invalid email format"),
  });
  
  // Form for adding a new user
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });
  
  // Handle course selection for new user
  const handleNewUserCourseSelection = (courseId: number, checked: boolean) => {
    if (checked) {
      setNewUserCourseIds(prev => [...prev, courseId]);
      // Set default duration to 12 months if not already set
      if (!newUserCourseDurations[courseId]) {
        setNewUserCourseDurations(prev => ({
          ...prev,
          [courseId]: 12
        }));
      }
    } else {
      setNewUserCourseIds(prev => prev.filter(id => id !== courseId));
    }
  };
  
  // Handle duration change for new user courses
  const handleNewUserDurationChange = (courseId: number, months: number) => {
    setNewUserCourseDurations(prev => ({
      ...prev,
      [courseId]: months
    }));
  };
  
  // Mutation for adding a new user
  const addUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Prepare course enrollment data
      const courseEnrollments = newUserCourseIds.map(courseId => ({
        courseId,
        accessDuration: newUserCourseDurations[courseId] || 12
      }));
      
      const res = await apiRequest("POST", "/api/users", {
        email: data.email,
        username: data.email.split("@")[0], // Generate a username from the email
        isAdmin: false, // Default to non-admin
        courseEnrollments: courseEnrollments // Send course enrollments with user creation
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User added successfully with course enrollments",
        variant: "default",
      });
      setIsAddUserOpen(false);
      setNewUserCourseIds([]);
      setNewUserCourseDurations({});
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for deleting a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
      setIsUserDetailsOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle delete user action
  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Fetch all users
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Filter users based on search query
  const filteredUsers = users?.filter((user) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const matchesUsername = user.username.toLowerCase().includes(query);
    const matchesEmail = user.email.toLowerCase().includes(query);
    const matchesId = user.id.toString() === query;
    
    return matchesUsername || matchesEmail || matchesId;
  });

  // Handle viewing user details
  const handleViewUserDetails = (user: UserType) => {
    setSelectedUser(user);
    setIsUserDetailsOpen(true);
  };

  // Fetch user enrollments when a user is selected
  const {
    data: userEnrollments,
    isLoading: isLoadingEnrollments,
  } = useQuery<Enrollment[]>({
    queryKey: [selectedUser ? `/api/users/${selectedUser.id}/enrollments` : null],
    enabled: !!selectedUser,
  });
  
  // Fetch all available courses
  const {
    data: courses,
    isLoading: isLoadingCourses,
  } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });
  
  // Effect to initialize selected course IDs and durations from user enrollments
  useEffect(() => {
    if (userEnrollments && selectedUser && !selectedUser.isAdmin) {
      setSelectedCourseIds(userEnrollments.map(enrollment => enrollment.courseId));
      
      // Initialize course durations from existing enrollments
      const durationMap: Record<number, number> = {};
      userEnrollments.forEach(enrollment => {
        if (enrollment.accessDuration) {
          durationMap[enrollment.courseId] = enrollment.accessDuration;
        }
      });
      setCourseDurations(durationMap);
    } else {
      setSelectedCourseIds([]);
      setCourseDurations({});
    }
  }, [userEnrollments, selectedUser]);
  
  // Handle changing the duration for a specific course
  const handleDurationChange = (courseId: number, months: number) => {
    setCourseDurations(prev => ({
      ...prev,
      [courseId]: months
    }));
  };
  
  // Handle saving enrollments with durations
  const handleSaveEnrollments = (userId: number) => {
    const enrollmentData = selectedCourseIds.map(courseId => ({
      courseId,
      accessDuration: courseDurations[courseId] || 12 // Default to 12 months if not specified
    }));
    
    manageEnrollmentsMutation.mutate({
      userId,
      enrollments: enrollmentData
    });
  };
  
  // Mutation for managing user course enrollments
  const manageEnrollmentsMutation = useMutation({
    mutationFn: async (data: {
      userId: number;
      enrollments: { courseId: number; accessDuration: number }[]
    }) => {
      const res = await apiRequest("POST", `/api/users/${data.userId}/manage-enrollments`, {
        courseEnrollments: data.enrollments
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User course enrollments updated successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: [selectedUser ? `/api/users/${selectedUser.id}/enrollments` : null] });
      setIsManageCoursesOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoadingUsers) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (usersError || !users) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">Error Loading Users</h3>
        <p className="text-sm mt-1">There was a problem loading the user data.</p>
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
          <h2 className="text-2xl font-bold tracking-tight">Manage Users</h2>
        </div>
        
        <div className="flex justify-end">
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white">
                <UserPlus className="h-4 w-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Enter an email address to create a new user account. A random password will be generated,
                and the user will be able to log in with their email only.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => addUserMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="user@example.com" />
                      </FormControl>
                      <FormDescription>
                        This email will be used as the user's login credential.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Course enrollments section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Course Enrollments</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setNewUserCourseIds([])}
                      >
                        Deselect All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => courses && setNewUserCourseIds(courses.map(c => c.id))}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                  
                  {isLoadingCourses ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  ) : courses && courses.length > 0 ? (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 border rounded-md p-2">
                      <div className="mb-2 text-sm font-medium text-gray-500 sticky top-0 bg-white p-1 border-b">
                        Selected {newUserCourseIds.length} of {courses.length} courses
                      </div>
                      {courses.map((course) => {
                        // Get the selected duration for this course
                        const selectedDuration = newUserCourseDurations[course.id] || 12;
                        
                        return (
                          <div key={course.id} 
                            className={`flex flex-col space-y-2 p-3 rounded-md transition-colors 
                              ${newUserCourseIds.includes(course.id) 
                                ? 'bg-green-50 border border-green-200' 
                                : 'border hover:bg-gray-50'}`}>
                            <div className="flex items-center space-x-3">
                              <Checkbox 
                                id={`new-user-course-${course.id}`}
                                checked={newUserCourseIds.includes(course.id)}
                                onCheckedChange={(checked) => {
                                  handleNewUserCourseSelection(course.id, !!checked);
                                }}
                                className="h-5 w-5"
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`new-user-course-${course.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {course.title}
                                </label>
                                <div className="mt-1 flex items-center flex-wrap gap-2">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                                    ${(course.price / 100).toFixed(2)}
                                  </Badge>
                                  {course.published ? (
                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                      Published
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-100 text-amber-800">
                                      Unpublished
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Access duration selector - only shown for selected courses */}
                            {newUserCourseIds.includes(course.id) && (
                              <div className="pl-8 pt-2 border-t mt-2">
                                <div className="text-sm font-medium mb-1">Access Duration:</div>
                                <div className="flex flex-wrap gap-2">
                                  {[2, 4, 6, 12].map(months => (
                                    <div
                                      key={`new-user-${course.id}-${months}`}
                                      className={`px-3 py-1 rounded-full text-xs border cursor-pointer
                                        ${selectedDuration === months 
                                          ? 'bg-black text-white border-black' 
                                          : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                      onClick={() => handleNewUserDurationChange(course.id, months)}
                                    >
                                      {months} {months === 1 ? 'Month' : 'Months'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 text-center rounded-md">
                      <p className="text-gray-500">No courses available</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 mt-6 sticky bottom-0 bg-white py-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddUserOpen(false);
                      setNewUserCourseIds([]);
                      setNewUserCourseDurations({});
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addUserMutation.isPending}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    {addUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Filter */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${searchQuery ? 'text-green-500' : 'text-gray-500'}`} />
          <Input
            placeholder="Search users by email or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${searchQuery ? 'border-green-500 ring-green-500/20' : ''}`}
            autoFocus
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-medium text-gray-500">
              {filteredUsers?.length} result{filteredUsers?.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={() => setSearchQuery("")}
          disabled={!searchQuery}
        >
          Clear
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge 
                          variant="outline" 
                          className={user.isAdmin 
                            ? "bg-purple-100 text-purple-800" 
                            : "bg-blue-100 text-blue-800"
                          }
                        >
                          {user.isAdmin ? "Administrator" : "Student"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewUserDetails(user)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500 font-medium">No users found matching your search</p>
                        {searchQuery && (
                          <p className="text-sm text-gray-400 max-w-md">
                            Try different keywords or search by a partial email address, username, or exact user ID
                          </p>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSearchQuery("")}
                          className="mt-2"
                          disabled={!searchQuery}
                        >
                          Clear Search
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Users stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-medium">Total Users</h3>
            </div>
            <p className="mt-2 text-3xl font-bold">{users.length}</p>
            <p className="text-sm text-gray-500 mt-1">Registered users on the platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-medium">Active Learners</h3>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {users.filter(user => !user.isAdmin).length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Users with access to courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-medium">Administrators</h3>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {users.filter(user => user.isAdmin).length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Users with admin privileges</p>
          </CardContent>
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about the selected user.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-xl font-medium">{selectedUser.username}</h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  <Badge 
                    variant="outline" 
                    className={selectedUser.isAdmin 
                      ? "bg-purple-100 text-purple-800 mt-2" 
                      : "bg-blue-100 text-blue-800 mt-2"
                    }
                  >
                    {selectedUser.isAdmin ? "Administrator" : "Student"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-500">User ID</p>
                  <p className="font-medium">{selectedUser.id}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-500">Joined</p>
                  <p className="font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="enrollments">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="enrollments" className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Course Enrollments</h3>
                    {selectedUser && !selectedUser.isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2" 
                        onClick={() => setIsManageCoursesOpen(true)}
                      >
                        <PenTool className="h-4 w-4" />
                        Manage Courses
                      </Button>
                    )}
                  </div>
                  
                  {isLoadingEnrollments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                  ) : userEnrollments && userEnrollments.length > 0 ? (
                    <div className="space-y-4">
                      {userEnrollments.map((enrollment) => {
                        const course = courses?.find(c => c.id === enrollment.courseId);
                        return (
                          <div key={enrollment.id} className="bg-white border rounded-md p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center">
                                  <BookOpen className="h-4 w-4 text-blue-500 mr-2" />
                                  <p className="font-medium">
                                    {course ? course.title : `Course #${enrollment.courseId}`}
                                  </p>
                                </div>
                                <div className="flex items-center mt-2 text-sm text-gray-500">
                                  <Clock className="h-4 w-4 mr-2" />
                                  <p>Enrolled on {new Date(enrollment.enrolledAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <Badge className={enrollment.completed ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                                {enrollment.completed ? "Completed" : `${enrollment.progress}% Complete`}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-8 text-center rounded-md">
                      <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">User is not enrolled in any courses</p>
                      {selectedUser && !selectedUser.isAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4 flex items-center gap-2 mx-auto" 
                          onClick={() => setIsManageCoursesOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Add Course Enrollments
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="pt-4">
                  <div className="bg-gray-50 p-8 text-center rounded-md">
                    <p className="text-gray-500">Activity log will be available in a future update</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="flex items-center gap-2"
              disabled={selectedUser?.email === "Darchiav@gmail.com"}
            >
              <Trash className="h-4 w-4" />
              Delete User
            </Button>
            <Button onClick={() => setIsUserDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  Are you sure you want to delete user <strong>{selectedUser.username}</strong> ({selectedUser.email})?
                  <div className="mt-2">
                    This action cannot be undone and will:
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>Remove the user account permanently</li>
                      <li>Delete all their enrollments and progress data</li>
                    </ul>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash className="h-4 w-4 mr-2" />
              )}
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Manage Course Enrollments Dialog */}
      <Dialog open={isManageCoursesOpen} onOpenChange={setIsManageCoursesOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3 mb-3">
            <DialogTitle className="text-xl">Manage Course Access</DialogTitle>
            <DialogDescription>
              Select which courses this user can access and set the access duration. Users will only be able to view and participate in selected courses for the specified time period.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="flex flex-col h-full">
              {/* Controls section */}
              <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="font-medium">User:</span> 
                  <span className="text-gray-700">{selectedUser.username}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCourseIds([])}
                  >
                    Deselect All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => courses && setSelectedCourseIds(courses.map(c => c.id))}
                  >
                    Select All
                  </Button>
                </div>
              </div>
              
              {/* Course selection list */}
              <div className="space-y-2 flex-grow overflow-y-auto max-h-[40vh] pr-1 border-b border-t py-3">
                {isLoadingCourses ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  </div>
                ) : courses && courses.length > 0 ? (
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-500">
                      Selected {selectedCourseIds.length} of {courses.length} courses
                    </div>
                    {courses.map((course) => {
                      // Find the current enrollment for this course if it exists
                      const enrollment = userEnrollments?.find(e => e.courseId === course.id);
                      // Get the selected duration for this course
                      const selectedDuration = courseDurations[course.id] || 
                        (enrollment?.accessDuration || 12);
                      
                      return (
                        <div key={course.id} 
                          className={`flex flex-col space-y-2 p-3 rounded-md transition-colors 
                            ${selectedCourseIds.includes(course.id) 
                              ? 'bg-green-50 border border-green-200' 
                              : 'border hover:bg-gray-50'}`}>
                          <div className="flex items-center space-x-3">
                            <Checkbox 
                              id={`course-${course.id}`}
                              checked={selectedCourseIds.includes(course.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCourseIds([...selectedCourseIds, course.id]);
                                } else {
                                  setSelectedCourseIds(selectedCourseIds.filter(id => id !== course.id));
                                }
                              }}
                              className="h-5 w-5"
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={`course-${course.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {course.title}
                              </label>
                              <div className="mt-1 flex items-center flex-wrap gap-2">
                                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                                  ${(course.price / 100).toFixed(2)}
                                </Badge>
                                {course.published ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    Published
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                                    Unpublished
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Access duration selector - only shown for selected courses */}
                          {selectedCourseIds.includes(course.id) && (
                            <div className="pl-8 pt-2 border-t mt-2">
                              <div className="text-sm font-medium mb-1">Access Duration:</div>
                              <div className="flex flex-wrap gap-2">
                                {[2, 4, 6, 12].map(months => (
                                  <div
                                    key={`${course.id}-${months}`}
                                    className={`px-3 py-1 rounded-full text-xs border cursor-pointer
                                      ${selectedDuration === months 
                                        ? 'bg-black text-white border-black' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    onClick={() => handleDurationChange(course.id, months)}
                                  >
                                    {months} {months === 1 ? 'Month' : 'Months'}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Show expiration info if course is currently enrolled */}
                              {enrollment?.expiresAt && (
                                <div className="text-xs text-gray-500 mt-2">
                                  Current access expires: {new Date(enrollment.expiresAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-8 text-center rounded-md">
                    <p className="text-gray-500">No courses available</p>
                  </div>
                )}
              </div>
              
              {/* Save button section - prominently displayed */}
              <div className="mt-4 flex flex-col sm:flex-row-reverse gap-2 items-center">
                <Button
                  disabled={manageEnrollmentsMutation.isPending}
                  onClick={() => selectedUser && handleSaveEnrollments(selectedUser.id)}
                  className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto"
                  size="lg"
                >
                  {manageEnrollmentsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsManageCoursesOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
