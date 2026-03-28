import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Course, Enrollment, Progress } from "@shared/schema";
import { 
  User, 
  BookOpen, 
  Award, 
  FileText, 
  Star, 
  Settings,
  BarChart3,
  Bookmark,
  CircleCheck
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("overview");

  // Redirect if not logged in
  if (!user) {
    navigate("/auth");
    return null;
  }

  // Fetch user courses
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<
    (Enrollment & { course: Course })[]
  >({
    queryKey: [`/api/users/${user.id}/enrollments`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${user.id}/enrollments`);
      return res.json();
    },
  });

  // Fetch user progress
  const { data: userProgress, isLoading: isLoadingProgress } = useQuery<Progress[]>({
    queryKey: [`/api/users/${user.id}/progress`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${user.id}/progress`);
      return res.json();
    },
  });

  // Calculate statistics
  const totalCourses = userEnrollments?.length || 0;
  const completedCourses = userEnrollments?.filter(
    (e) => e.completed
  ).length || 0;
  
  const totalProgress = userEnrollments?.reduce(
    (acc, curr) => acc + (curr.progress || 0),
    0
  ) || 0;
  
  const averageProgress = 
    totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;

  const completedContent = userProgress?.filter(
    (p) => p.completed
  ).length || 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t("myProfile.profile")}</h1>
            <p className="mt-2 text-gray-600">
              Manage your profile, view your progress, and track your achievements
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Profile sidebar */}
            <div className="lg:col-span-1">
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                      <User className="h-12 w-12 text-gray-500" />
                    </div>
                    <CardTitle>{user.username || user.email}</CardTitle>
                    <CardDescription>Member since {new Date(user.createdAt).toLocaleDateString()}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p>{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Courses enrolled</p>
                      <p>{totalCourses}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Courses completed</p>
                      <p>{completedCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="space-y-2">
                <Button 
                  variant={selectedTab === "overview" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("overview")}
                >
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Overview
                </Button>
                <Button 
                  variant={selectedTab === "courses" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("courses")}
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  {t("myProfile.courses")}
                </Button>
                <Button 
                  variant={selectedTab === "certificates" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("certificates")}
                >
                  <Award className="mr-2 h-5 w-5" />
                  {t("myProfile.certificates")}
                </Button>
                <Button 
                  variant={selectedTab === "notes" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("notes")}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  {t("myProfile.notes")}
                </Button>
                <Button 
                  variant={selectedTab === "ratings" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("ratings")}
                >
                  <Star className="mr-2 h-5 w-5" />
                  {t("myProfile.ratings")}
                </Button>
                <Button 
                  variant={selectedTab === "settings" ? "secondary" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setSelectedTab("settings")}
                >
                  <Settings className="mr-2 h-5 w-5" />
                  {t("myProfile.accountSettings")}
                </Button>
              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-3">
              {selectedTab === "overview" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Learning Progress</CardTitle>
                      <CardDescription>Your overall learning journey</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Stats overview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-500">Enrolled Courses</p>
                                  <p className="text-2xl font-bold">{totalCourses}</p>
                                </div>
                                <BookOpen className="h-8 w-8 text-blue-600" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-500">Completed Courses</p>
                                  <p className="text-2xl font-bold">{completedCourses}</p>
                                </div>
                                <CircleCheck className="h-8 w-8 text-green-600" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-500">Completed Content</p>
                                  <p className="text-2xl font-bold">{completedContent}</p>
                                </div>
                                <FileText className="h-8 w-8 text-purple-600" />
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Overall progress */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <p className="text-sm font-medium">Overall Progress</p>
                            <p className="text-sm font-medium">{averageProgress}%</p>
                          </div>
                          <ProgressBar value={averageProgress} className="h-2" />
                        </div>

                        {/* Recent courses */}
                        <div>
                          <h3 className="text-lg font-medium mb-4">Recent Courses</h3>
                          {userEnrollments && userEnrollments.length > 0 ? (
                            <div className="space-y-4">
                              {userEnrollments.slice(0, 3).map((enrollment) => (
                                <Card key={enrollment.id} className="overflow-hidden">
                                  <div className="flex flex-col sm:flex-row">
                                    <div className="sm:w-1/3 bg-gray-100 flex items-center justify-center p-4">
                                      {enrollment.course.imageUrl ? (
                                        <img 
                                          src={enrollment.course.imageUrl} 
                                          alt={enrollment.course.title} 
                                          className="w-full max-h-32 object-cover"
                                        />
                                      ) : (
                                        <BookOpen className="h-16 w-16 text-gray-400" />
                                      )}
                                    </div>
                                    <div className="sm:w-2/3 p-4">
                                      <div className="flex justify-between items-start">
                                        <h4 className="font-medium">{enrollment.course.title}</h4>
                                        <Badge variant={enrollment.completed ? "secondary" : "outline"} className={enrollment.completed ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                                          {enrollment.completed ? "Completed" : `${enrollment.progress}% Complete`}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                        {enrollment.course.description}
                                      </p>
                                      <div className="mt-4">
                                        <ProgressBar value={enrollment.progress} className="h-1 mb-2" />
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="mt-2"
                                          onClick={() => navigate(`/courses/${enrollment.course.id}`)}
                                        >
                                          Continue Learning
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center p-8 bg-gray-50 rounded-lg">
                              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium mb-2">No courses enrolled yet</h3>
                              <p className="text-gray-500 mb-4">Start your learning journey by enrolling in a course</p>
                              <Button onClick={() => navigate("/courses")}>Browse Courses</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === "courses" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Courses</CardTitle>
                      <CardDescription>All the courses you're enrolled in</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userEnrollments && userEnrollments.length > 0 ? (
                        <div className="space-y-4">
                          {userEnrollments.map((enrollment) => (
                            <Card key={enrollment.id} className="overflow-hidden">
                              <div className="flex flex-col sm:flex-row">
                                <div className="sm:w-1/4 bg-gray-100 flex items-center justify-center p-4">
                                  {enrollment.course.imageUrl ? (
                                    <img 
                                      src={enrollment.course.imageUrl} 
                                      alt={enrollment.course.title} 
                                      className="w-full max-h-32 object-cover"
                                    />
                                  ) : (
                                    <BookOpen className="h-16 w-16 text-gray-400" />
                                  )}
                                </div>
                                <div className="sm:w-3/4 p-4">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-medium">{enrollment.course.title}</h4>
                                    <Badge variant={enrollment.completed ? "secondary" : "outline"} className={enrollment.completed ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                                      {enrollment.completed ? "Completed" : `${enrollment.progress}% Complete`}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-2">
                                    {enrollment.course.description}
                                  </p>
                                  <div className="mt-4">
                                    <ProgressBar value={enrollment.progress} className="h-1 mb-2" />
                                    <div className="flex space-x-2 mt-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => navigate(`/courses/${enrollment.course.id}`)}
                                      >
                                        View Course
                                      </Button>
                                      {enrollment.progress > 0 && !enrollment.completed && (
                                        <Button 
                                          size="sm"
                                          onClick={() => navigate(`/courses/${enrollment.course.id}`)}
                                        >
                                          Continue Learning
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">No courses enrolled yet</h3>
                          <p className="text-gray-500 mb-4">Start your learning journey by enrolling in a course</p>
                          <Button onClick={() => navigate("/courses")}>Browse Courses</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === "certificates" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("myProfile.certificates")}</CardTitle>
                      <CardDescription>Your earned certificates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {completedCourses > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {userEnrollments
                            ?.filter(e => e.completed)
                            .map((enrollment) => (
                              <Card key={enrollment.id} className="overflow-hidden">
                                <CardContent className="p-6">
                                  <div className="border-4 border-gray-200 p-6 rounded-lg text-center">
                                    <Award className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold mb-1">Certificate of Completion</h3>
                                    <p className="text-sm text-gray-500 mb-4">This certifies that</p>
                                    <p className="text-xl font-semibold mb-4">{user.username || user.email}</p>
                                    <p className="text-sm text-gray-500 mb-2">has successfully completed</p>
                                    <p className="text-lg font-medium mb-4">{enrollment.course.title}</p>
                                    <p className="text-xs text-gray-500">
                                      Issued on {new Date().toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="mt-4 flex justify-center">
                                    <Button variant="outline" size="sm">
                                      Download Certificate
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                          <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">No certificates yet</h3>
                          <p className="text-gray-500 mb-4">Complete courses to earn certificates</p>
                          <Button onClick={() => navigate("/my-learning")}>Go to My Learning</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === "notes" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("myProfile.notes")}</CardTitle>
                      <CardDescription>Your personal notes from courses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8 bg-gray-50 rounded-lg">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Notes feature coming soon</h3>
                        <p className="text-gray-500 mb-4">
                          Take notes while watching courses and organize them here
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === "ratings" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("myProfile.ratings")}</CardTitle>
                      <CardDescription>Your ratings and reviews</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8 bg-gray-50 rounded-lg">
                        <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Ratings feature coming soon</h3>
                        <p className="text-gray-500 mb-4">
                          Rate courses and content to improve your learning experience
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedTab === "settings" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("myProfile.accountSettings")}</CardTitle>
                      <CardDescription>Manage your account preferences</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-4">Personal Information</h3>
                          {/* Personal info form would go here */}
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Username</label>
                                <input
                                  type="text"
                                  disabled
                                  value={user.username || ''}
                                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                  type="email"
                                  disabled
                                  value={user.email}
                                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                              </div>
                            </div>
                            <Button variant="outline">Edit Profile</Button>
                          </div>
                        </div>
                        <div className="border-t pt-6">
                          <h3 className="text-lg font-medium mb-4">Preferences</h3>
                          {/* Preferences would go here */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Email Notifications</p>
                                <p className="text-sm text-gray-500">Receive emails about your courses</p>
                              </div>
                              <Button variant="outline">Manage</Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Language</p>
                                <p className="text-sm text-gray-500">Change your preferred language</p>
                              </div>
                              <Button variant="outline">Change</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}