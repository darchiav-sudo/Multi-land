import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Course, Enrollment, Progress } from "@shared/schema";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { ProgressBadge } from "@/components/ui/progress-badge";
import { Loader2, BookOpen, CheckCircle2 } from "lucide-react";

export default function MyLearningPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("in-progress");
  const [courses, setCourses] = useState<{
    inProgress: (Course & { enrollment: Enrollment })[];
    completed: (Course & { enrollment: Enrollment })[];
  }>({
    inProgress: [],
    completed: [],
  });

  // Fetch user enrollments with better error handling
  const {
    data: enrollments,
    isLoading: isLoadingEnrollments,
    error: enrollmentsError,
  } = useQuery<Enrollment[]>({
    queryKey: ['/api/enrollments', user?.id],
    enabled: !!user?.id, // Only run query if user ID is available
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/enrollments`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch enrollments');
      return res.json();
    }
  });

  // Fetch all courses
  const {
    data: allCourses,
    isLoading: isLoadingCourses,
    error: coursesError,
  } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch user progress with better error handling
  const {
    data: progress,
    isLoading: isLoadingProgress,
    error: progressError,
  } = useQuery<Progress[]>({
    queryKey: ['/api/progress', user?.id],
    enabled: !!user?.id, // Only run query if user ID is available
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/progress`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    }
  });

  // Process the user's courses when data is loaded
  useEffect(() => {
    if (enrollments && allCourses) {
      const inProgressCourses: (Course & { enrollment: Enrollment })[] = [];
      const completedCourses: (Course & { enrollment: Enrollment })[] = [];

      // Match enrollments with course data
      enrollments.forEach((enrollment) => {
        const course = allCourses.find((c) => c.id === enrollment.courseId);
        if (course) {
          const courseWithEnrollment = { ...course, enrollment };
          if (enrollment.completed) {
            completedCourses.push(courseWithEnrollment);
          } else {
            inProgressCourses.push(courseWithEnrollment);
          }
        }
      });

      // Sort by most recent enrollment
      inProgressCourses.sort((a, b) => {
        return new Date(b.enrollment.enrolledAt).getTime() - new Date(a.enrollment.enrolledAt).getTime();
      });
      
      completedCourses.sort((a, b) => {
        return new Date(b.enrollment.enrolledAt).getTime() - new Date(a.enrollment.enrolledAt).getTime();
      });

      setCourses({
        inProgress: inProgressCourses,
        completed: completedCourses,
      });
    }
  }, [enrollments, allCourses]);

  // We need to make sure we have the user before we consider the page fully loaded
  const isUserDataRequired = !user && !isAuthLoading;
  const isDataLoading = isLoadingEnrollments || isLoadingCourses || isLoadingProgress;
  const isPageLoading = isDataLoading || (user && !enrollments) || (user && !allCourses);
  
  // Only show errors if we're not in a loading state and we have a user
  const hasError = user && (enrollmentsError || coursesError || progressError);
  
  // Special case: User might need to login first
  if (isUserDataRequired) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Please Sign In</h1>
              <p className="text-gray-600 mb-8">You need to sign in to view your enrolled courses.</p>
              <Link href="/auth">
                <Button className="bg-black hover:bg-gray-800 text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex justify-center items-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading your courses...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (hasError) {
    console.error("My Learning page errors:", { 
      enrollments: enrollmentsError,
      courses: coursesError,
      progress: progressError
    });
    
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Error Loading Your Courses</h1>
              <p className="text-gray-600 mb-8">There was an error loading your courses. Please try again.</p>
              <Button onClick={() => window.location.reload()} className="bg-black hover:bg-gray-800 text-white">
                Retry
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Learning</h1>

          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-2 md:w-auto">
              <TabsTrigger value="in-progress" className="px-8">
                In Progress
                {courses.inProgress.length > 0 && (
                  <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {courses.inProgress.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-8">
                Completed
                {courses.completed.length > 0 && (
                  <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {courses.completed.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="in-progress">
              {courses.inProgress.length === 0 ? (
                <EmptyState
                  title="No courses in progress"
                  description="You haven't started any courses yet."
                  buttonText="Browse Courses"
                  buttonLink="/courses"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {courses.inProgress.map((course) => (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      enrollmentProgress={course.enrollment.progress}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {courses.completed.length === 0 ? (
                <EmptyState
                  title="No completed courses"
                  description="You haven't completed any courses yet."
                  buttonText="Continue Learning"
                  buttonLink="#"
                  onButtonClick={() => setActiveTab("in-progress")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {courses.completed.map((course) => (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      enrollmentProgress={course.enrollment.progress}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Course Card for My Learning
function CourseCard({ 
  course, 
  enrollmentProgress 
}: { 
  course: Course & { enrollment: Enrollment }; 
  enrollmentProgress: number;
}) {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="relative pb-[30%]">
        <img
          src={course.imageUrl || '/course-placeholder.svg'}
          alt={course.title}
          className="absolute h-full w-full object-cover object-center"
        />
        <div className="absolute top-3 right-3">
          <ProgressBadge progress={enrollmentProgress} />
        </div>
      </div>
      <CardContent className="p-6 flex-grow flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
        <p className="text-gray-500 text-sm mb-4 flex-grow">{course.description}</p>
        <div className="mt-auto">
          <Link href={`/courses/${course.id}`}>
            <Button className="w-full bg-black hover:bg-gray-800 text-white">
              {enrollmentProgress === 100 ? (
                <span className="flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Review Course
                </span>
              ) : (
                <span className="flex items-center">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Continue Learning
                </span>
              )}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state component
function EmptyState({ 
  title, 
  description, 
  buttonText, 
  buttonLink, 
  onButtonClick 
}: { 
  title: string; 
  description: string; 
  buttonText: string; 
  buttonLink: string;
  onButtonClick?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 mb-6">{description}</p>
        {onButtonClick ? (
          <Button onClick={onButtonClick} className="bg-black hover:bg-gray-800 text-white">
            {buttonText}
          </Button>
        ) : (
          <Link href={buttonLink}>
            <Button className="bg-black hover:bg-gray-800 text-white">
              {buttonText}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}