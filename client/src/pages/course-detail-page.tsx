import { useEffect, useState, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Course, Content, Enrollment, Progress } from "@shared/schema";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, clearApiCache } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProgressBadge } from "@/components/ui/progress-badge";
import { Loader2, Clock, Book, FileText, Video, CheckCircle } from "lucide-react";
import { MoodSelector } from "@/components/mood-selector";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch course details
  const {
    data: course,
    isLoading: isLoadingCourse,
    error: courseError,
  } = useQuery<Course>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !isNaN(courseId),
  });

  // Fetch course contents
  const {
    data: contents,
    isLoading: isLoadingContents,
    error: contentsError,
  } = useQuery<Content[]>({
    queryKey: [`/api/courses/${courseId}/contents`],
    enabled: !isNaN(courseId),
  });

  // Fetch user enrollment if logged in
  const {
    data: enrollments,
    isLoading: isLoadingEnrollments,
  } = useQuery<Enrollment[]>({
    queryKey: [user ? `/api/users/${user.id}/enrollments` : null],
    enabled: !!user,
  });
  
  // Fetch user progress if logged in
  const {
    data: userProgress,
    isLoading: isLoadingProgress,
  } = useQuery<Progress[]>({
    queryKey: [user ? `/api/users/${user.id}/progress` : null],
    enabled: !!user,
  });

  // State to track if user is enrolled in this course
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  
  // Check if user is enrolled in course
  useEffect(() => {
    if (user && enrollments && courseId) {
      const foundEnrollment = enrollments.find(e => e.courseId === courseId);
      setEnrollment(foundEnrollment || null);
    } else {
      setEnrollment(null);
    }
  }, [user, enrollments, courseId]);

  // Handle purchase button click
  const handlePurchase = () => {
    console.log("Purchase button clicked", { courseId });
    
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to purchase courses",
      });
      navigate("/auth");
    } else {
      // Use the URL format that's working in the browser
      navigate(`/checkout-page?courseId=${courseId}`);
    }
  };

  // Render content icon based on type
  const renderContentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'video':
        return <Video className="h-5 w-5 text-blue-600" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-600" />;
      case 'text':
        return <Book className="h-5 w-5 text-green-600" />;
      case 'quiz':
        return <CheckCircle className="h-5 w-5 text-purple-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  // Mark a content as completed
  const markCompletedMutation = useMutation({
    mutationFn: async ({ userId, contentId }: { userId: number, contentId: number }) => {
      const res = await apiRequest("POST", "/api/progress", {
        userId,
        contentId,
        completed: true,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/enrollments`] });
      toast({
        title: "Progress updated",
        description: "Your progress has been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating progress",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Save mood for content
  const saveMoodMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      contentId, 
      mood, 
      moodNote 
    }: { 
      userId: number, 
      contentId: number, 
      mood: string, 
      moodNote?: string 
    }) => {
      const res = await apiRequest("POST", "/api/progress", {
        userId,
        contentId,
        mood,
        moodNote,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/progress`] });
      toast({
        title: "Feedback recorded",
        description: "Thank you for sharing your experience",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle marking content as complete
  const handleMarkComplete = (contentId: number) => {
    if (!user) return;
    markCompletedMutation.mutate({ userId: user.id, contentId });
  };
  
  // Handle mood selection
  const handleMoodSelect = (contentId: number, mood: string, note?: string) => {
    if (!user) return;
    saveMoodMutation.mutate({ 
      userId: user.id, 
      contentId, 
      mood, 
      moodNote: note 
    });
  };

  if (isLoadingCourse || isLoadingContents || (user && isLoadingEnrollments)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </main>
        <Footer />
      </div>
    );
  }

  if (courseError || contentsError || !course) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Course Not Found</h1>
              <p className="text-gray-600 mb-8">The course you're looking for doesn't exist or has been removed.</p>
              <Link href="/courses">
                <Button className="bg-black hover:bg-gray-800 text-white">
                  Browse Courses
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Format price from cents to dollars
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(course.price / 100);

  // Rating has been removed from the app

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50">
        {/* Back Button */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/courses")}
            className="mb-4"
          >
            ← Back to Courses
          </Button>
        </div>
        {/* Course Header */}
        <div className="bg-gray-800 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:justify-between">
              <div className="lg:w-2/3">
                <Badge className="mb-4 bg-blue-600 hover:bg-blue-700">{course.category}</Badge>
                <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
                <p className="text-gray-300 mb-6">{course.description}</p>
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-gray-300" />
                    <span className="ml-1">{contents?.length || 0} Lessons</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-6 w-6 rounded-full bg-gray-600 flex items-center justify-center">
                      <span className="text-xs">{course.instructorName.charAt(0)}</span>
                    </div>
                    <span className="ml-1">{course.instructorName}</span>
                  </div>
                </div>
                {enrollment ? (
                  <div className="flex flex-wrap gap-4">
                    <ProgressBadge progress={enrollment.progress} size="lg" />
                    <Link href="/my-learning">
                      <Button className="bg-white text-black hover:bg-gray-200">
                        Continue Learning
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    onClick={handlePurchase}
                    className="bg-white text-black hover:bg-gray-200"
                    size="lg"
                  >
                    Enroll Now for {formattedPrice}
                  </Button>
                )}
              </div>
              {/* Course banner image with shorter height */}
              <div className="lg:w-1/3 mt-4 lg:mt-0">
                <div className="relative pb-[30%] rounded-md overflow-hidden">
                  <img
                    src={course.imageUrl || '/course-placeholder.svg'}
                    alt={course.title}
                    className="absolute h-full w-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Content */}
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="lg:flex lg:gap-8">
            {/* Left column - Course contents */}
            <div className="lg:w-2/3">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Content</h2>
              
              {contents && contents.length > 0 ? (
                <div className="space-y-3 mb-8">
                  {contents.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center justify-between p-4 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      <div 
                        onClick={() => {
                          if (!user) {
                            toast({
                              title: "Please sign in",
                              description: "You need to be signed in to access course content",
                            });
                            navigate("/auth");
                          } else if (!enrollment) {
                            toast({
                              title: "Not enrolled",
                              description: "You need to purchase this course to access its content",
                            });
                          } else {
                            navigate(`/lesson/${courseId}/${content.id}`);
                          }
                        }}
                        className="flex items-center flex-grow cursor-pointer"
                      >
                        <div className="flex items-center">
                          {renderContentTypeIcon(content.type)}
                          <span className="ml-2 font-medium">{content.title}</span>
                        </div>
                      </div>
                      {enrollment && (
                        <div className="flex items-center gap-2 ml-4">
                          {/* Find progress for this content if it exists */}
                          {userProgress?.some(p => p.contentId === content.id && p.completed) ? (
                            <Badge className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault(); // Prevent link navigation
                                e.stopPropagation();
                                navigate(`/lesson/${courseId}/${content.id}`);
                              }}
                              className="text-xs"
                            >
                              Start Learning
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="mb-8">
                  <CardContent className="p-6">
                    <p className="text-gray-500">No content available for this course yet.</p>
                  </CardContent>
                </Card>
              )}

              {/* About Instructor */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">About the Instructor</h2>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">{course.instructorName.charAt(0)}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">{course.instructorName}</h3>
                        <p className="text-gray-600 mt-1">
                          Professional instructor with years of experience in {course.category}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right column - Enrollment card */}
            <div className="lg:w-1/3 mt-8 lg:mt-0">
              <div className="sticky top-24">
                <Card className="shadow-lg">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 mb-4">{formattedPrice}</div>
                      {enrollment ? (
                        <div className="space-y-4">
                          <ProgressBadge progress={enrollment.progress} size="lg" className="w-full justify-center" />
                          <Link href="/my-learning">
                            <Button className="w-full bg-black hover:bg-gray-800 text-white">
                              Continue Learning
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Button
                          onClick={handlePurchase}
                          className="w-full bg-black hover:bg-gray-800 text-white"
                          size="lg"
                        >
                          Enroll Now
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
