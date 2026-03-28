import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Content, Course } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Icons
import {
  ChevronLeft,
  Plus,
  Trash,
  Edit,
  Video,
  FileText,
  File,
  Loader2,
  MoveUp,
  MoveDown,
  AlertTriangle,
  LayoutGrid,
  ArrowUp,
  ArrowDown
} from "lucide-react";

/**
 * Lesson Manager Component
 * 
 * A completely new, redesigned lesson manager for Multi Land
 * with enhanced admin experience and better content organization.
 */
export default function LessonManager() {
  // Use simple parameter extraction to ensure we get the courseId
  const params = useParams();
  const courseId = params.courseId;
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [contentToDelete, setContentToDelete] = useState<Content | null>(null);
  
  // Fetch course details
  const { data: course, isLoading: isLoadingCourse } = useQuery<Course>({
    queryKey: [`/api/courses/${courseId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${courseId}`);
      return res.json();
    },
    enabled: !!courseId,
  });
  
  // Fetch course contents
  const { 
    data: contents, 
    isLoading: isLoadingContents,
    refetch: refetchContents
  } = useQuery<Content[]>({
    queryKey: [`/api/courses/${courseId}/contents`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courses/${courseId}/contents`);
      return res.json();
    },
    enabled: !!courseId,
  });
  
  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const res = await apiRequest("DELETE", `/api/contents/${contentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/contents`] });
      toast({
        title: t("Success"),
        description: t("Lesson deleted successfully"),
      });
      setContentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("Error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Move content (reorder) mutation
  const moveContentMutation = useMutation({
    mutationFn: async ({ contentId, direction }: { contentId: number; direction: 'up' | 'down' }) => {
      if (!contents) return;
      
      const currentIndex = contents.findIndex(c => c.id === contentId);
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= contents.length) return;
      
      const content = contents[currentIndex];
      const adjacentContent = contents[newIndex];
      
      // Swap orders
      const res = await apiRequest("PATCH", `/api/contents/${contentId}/order`, {
        order: adjacentContent.order
      });
      
      // Update the adjacent content to have the current content's order
      await apiRequest("PATCH", `/api/contents/${adjacentContent.id}/order`, {
        order: content.order
      });
      
      return res.json();
    },
    onSuccess: () => {
      refetchContents();
    },
    onError: (error: Error) => {
      toast({
        title: t("Error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle moving a content item up or down
  const handleMoveContent = (content: Content, direction: 'up' | 'down') => {
    moveContentMutation.mutate({ contentId: content.id, direction });
  };
  
  // Get content type icon
  const getContentTypeIcon = (content: Content) => {
    if (content.type === 'video' || (content.videoItems && content.videoItems.length > 0)) {
      return <Video className="h-5 w-5 text-blue-500" />;
    } else if (content.type === 'pdf' || (content.pdfItems && content.pdfItems.length > 0)) {
      return <File className="h-5 w-5 text-red-500" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Get content summary information
  const getContentSummary = (content: Content) => {
    const items = [];
    
    if (content.videoItems && content.videoItems.length > 0) {
      items.push(`${content.videoItems.length} ${content.videoItems.length === 1 ? t("video") : t("videos")}`);
    }
    
    if (content.pdfItems && content.pdfItems.length > 0) {
      items.push(`${content.pdfItems.length} ${content.pdfItems.length === 1 ? t("document") : t("documents")}`);
    }
    
    if (content.textContent) {
      items.push(t("text"));
    }
    
    return items.join(", ");
  };
  
  // Loading states
  if (isLoadingCourse) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!course) {
    return (
      <div className="container p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">
              <AlertTriangle className="h-6 w-6 inline-block mr-2" />
              {t("Course Not Found")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("The requested course could not be found")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-3 px-4">
      {/* Compact header with back button and title */}
      <div className="sticky top-0 z-40 bg-white py-2 px-3 mb-3 rounded-md shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/admin/courses")}
            className="h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">{t("Back to Courses")}</span>
          </Button>
          <h1 className="text-lg sm:text-xl font-medium truncate max-w-[180px] sm:max-w-md">
            {course.title}
          </h1>
        </div>
        <Button 
          onClick={() => navigate(`/admin/courses/${courseId}/new-lesson`)}
          className="bg-black text-white hover:bg-gray-800 h-8 px-3"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">{t("Add Lesson")}</span>
        </Button>
      </div>
      
      {/* More compact main content */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("Course Lessons")}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {t("Manage lessons for this course")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          {isLoadingContents ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !contents || contents.length === 0 ? (
            <div className="text-center py-6 border rounded-lg bg-gray-50">
              <LayoutGrid className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-base font-medium">{t("No lessons yet")}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {t("Create your first lesson to get started")}
              </p>
              <Button 
                onClick={() => navigate(`/admin/courses/${courseId}/new-lesson`)}
                className="mt-3 bg-black text-white hover:bg-gray-800 h-8 text-xs"
                size="sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("Add First Lesson")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {contents.map((content) => (
                <div 
                  key={content.id} 
                  className="flex items-center justify-between py-2 px-3 border rounded-md bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-grow">
                    <div className="flex-shrink-0">{getContentTypeIcon(content)}</div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate w-[180px] sm:w-auto">
                        {content.title}
                      </h3>
                      <p className="text-xs text-gray-500 truncate max-w-[240px]">
                        {getContentSummary(content)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveContent(content, 'up')}
                      disabled={contents.indexOf(content) === 0 || moveContentMutation.isPending}
                      className="h-7 w-7 p-0"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveContent(content, 'down')}
                      disabled={
                        contents.indexOf(content) === contents.length - 1 || 
                        moveContentMutation.isPending
                      }
                      className="h-7 w-7 p-0"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/courses/${courseId}/edit-lesson/${content.id}`)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContentToDelete(content)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!contentToDelete} onOpenChange={(open) => !open && setContentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Delete Lesson")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete the lesson")} 
              {contentToDelete ? <strong> "{contentToDelete.title}"</strong> : ''}? 
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => contentToDelete && deleteContentMutation.mutate(contentToDelete.id)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleteContentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash className="h-4 w-4 mr-2" />
              )}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}