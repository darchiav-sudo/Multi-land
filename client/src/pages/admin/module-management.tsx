import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Course, Module, Content } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription, 
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Video, 
  FileQuestion, 
  File, 
  ArrowUpDown,
  AlertCircle,
  Layers
} from "lucide-react";

export default function ModuleManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentType, setContentType] = useState<string>("text");
  const [isFileUploading, setIsFileUploading] = useState(false);
  
  // Form data states
  const [moduleData, setModuleData] = useState({
    title: "",
    order: 1,
  });
  
  const [contentData, setContentData] = useState({
    title: "",
    thumbnailUrl: "",
    textContent: "",
    videoUrl: "",
    pdfUrl: "",
    quizContent: "",
    // Legacy fields for compatibility
    type: "mixed", // Now using "mixed" as default
    content: "",
    order: 1,
  });
  
  // File upload states
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    fileType: string;
    fileName: string;
  } | null>(null);
  
  const [uploadedThumbnail, setUploadedThumbnail] = useState<{
    fileUrl: string;
    fileType: string;
    fileName: string;
  } | null>(null);

  // Get courses
  const { data: courses, isLoading: isLoadingCourses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/courses");
      return res.json();
    },
  });

  // Get modules for selected course
  const { data: modules, isLoading: isLoadingModules } = useQuery<Module[]>({
    queryKey: ["/api/courses", selectedCourse, "modules"],
    queryFn: async () => {
      if (!selectedCourse) return [];
      const res = await apiRequest("GET", `/api/courses/${selectedCourse}/modules`);
      return res.json();
    },
    enabled: !!selectedCourse,
  });

  // Get contents for selected module
  const { data: contents, isLoading: isLoadingContents } = useQuery<Content[]>({
    queryKey: ["/api/modules", selectedModule, "contents"],
    queryFn: async () => {
      if (!selectedModule) return [];
      const res = await apiRequest("GET", `/api/modules/${selectedModule}/contents`);
      return res.json();
    },
    enabled: !!selectedModule,
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: async (data: { courseId: number; title: string; order: number }) => {
      const res = await apiRequest("POST", "/api/modules", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("Module added successfully"),
        description: t("The module has been added to the course"),
      });
      setModuleDialogOpen(false);
      setModuleData({ title: "", order: 1 });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", selectedCourse, "modules"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("Failed to add module"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create content mutation
  const createContentMutation = useMutation({
    mutationFn: async (data: { 
      moduleId: number; 
      title: string; 
      thumbnailUrl?: string;
      textContent?: string;
      videoUrl?: string;
      pdfUrl?: string;
      quizContent?: string;
      type: string; 
      content: string; 
      order: number 
    }) => {
      const res = await apiRequest("POST", "/api/contents", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("Content added successfully"),
        description: t("The content has been added to the module"),
      });
      setContentDialogOpen(false);
      setContentData({ 
        title: "", 
        thumbnailUrl: "",
        textContent: "",
        videoUrl: "",
        pdfUrl: "",
        quizContent: "",
        type: "mixed", 
        content: "", 
        order: 1 
      });
      setUploadedFile(null);
      setUploadedThumbnail(null);
      queryClient.invalidateQueries({ queryKey: ["/api/modules", selectedModule, "contents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("Failed to add content"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle file uploads
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create form data and append file
    const formData = new FormData();
    // Set file type to determine proper processing on the server
    formData.append('fileType', fileType);
    formData.append("file", file);

    setIsFileUploading(true);

    try {
      const response = await fetch("/api/upload/content-file", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update appropriate field based on file type
      if (fileType === 'thumbnail') {
        setUploadedThumbnail(result);
        setContentData({
          ...contentData,
          thumbnailUrl: result.fileUrl,
        });
      } else if (fileType === 'video') {
        setUploadedFile(result);
        setContentData({
          ...contentData,
          videoUrl: result.fileUrl,
          content: result.fileUrl, // For backward compatibility
        });
      } else if (fileType === 'pdf') {
        setUploadedFile(result);
        setContentData({
          ...contentData,
          pdfUrl: result.fileUrl,
          content: result.fileUrl, // For backward compatibility
        });
      }

      toast({
        title: t("File uploaded successfully"),
        description: t("The file has been uploaded and ready to be added"),
      });
    } catch (error) {
      toast({
        title: t("File upload failed"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsFileUploading(false);
    }
  };

  // Handle form submissions
  const handleModuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    createModuleMutation.mutate({
      courseId: selectedCourse,
      title: moduleData.title,
      order: moduleData.order,
    });
  };

  const handleContentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModule) return;

    // Prepare content summary for legacy compatibility
    const contentSummary = `Mixed content: ${contentData.textContent ? 'Text, ' : ''}${contentData.videoUrl ? 'Video, ' : ''}${contentData.pdfUrl ? 'PDF, ' : ''}${contentData.quizContent ? 'Quiz' : ''}`.replace(/, $/, '');

    createContentMutation.mutate({
      moduleId: selectedModule,
      title: contentData.title,
      thumbnailUrl: contentData.thumbnailUrl,
      textContent: contentData.textContent,
      videoUrl: contentData.videoUrl,
      pdfUrl: contentData.pdfUrl,
      quizContent: contentData.quizContent,
      type: "mixed",
      content: contentSummary || contentData.content, // For backward compatibility
      order: contentData.order,
    });
  };

  // Reset form when selected course changes
  useEffect(() => {
    setSelectedModule(null);
  }, [selectedCourse]);

  return (
    <div className="container p-6">
      <h1 className="text-3xl font-bold mb-6">{t("Module Management")}</h1>
      
      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("Select Course")}</CardTitle>
            <CardDescription>{t("Choose a course to manage its modules")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCourses ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <Select
                value={selectedCourse?.toString() || ""}
                onValueChange={(value) => setSelectedCourse(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select a course")} />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id.toString()}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedCourse && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{t("Modules")}</CardTitle>
                <CardDescription>{t("Manage course modules")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingModules ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : modules && modules.length > 0 ? (
                  <div className="space-y-2">
                    {modules.map((module) => (
                      <div
                        key={module.id}
                        className={`p-3 border rounded-md cursor-pointer hover:bg-gray-100 ${
                          selectedModule === module.id ? "bg-gray-100 border-primary" : ""
                        }`}
                        onClick={() => setSelectedModule(module.id)}
                      >
                        <div className="font-medium">{module.title}</div>
                        <div className="text-sm text-gray-500">
                          {t("Order")}: {module.order}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {t("No modules found. Add a module to get started.")}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => {
                    setModuleData({ title: "", order: (modules?.length || 0) + 1 });
                    setModuleDialogOpen(true);
                  }}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("Add Module")}
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("Content")}</CardTitle>
                <CardDescription>
                  {selectedModule
                    ? t("Manage content for the selected module")
                    : t("Select a module to manage its content")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedModule ? (
                  <div className="text-center py-8 text-gray-500">
                    {t("Select a module from the left panel")}
                  </div>
                ) : isLoadingContents ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : contents && contents.length > 0 ? (
                  <div className="space-y-3">
                    {contents.map((content) => (
                      <div key={content.id} className="p-4 border rounded-md">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            {content.thumbnailUrl && (
                              <div className="w-16 h-16 rounded border overflow-hidden flex-shrink-0">
                                <img 
                                  src={content.thumbnailUrl} 
                                  alt={content.title} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center">
                                {content.type === "text" && <FileText className="w-4 h-4 mr-2 text-blue-500" />}
                                {content.type === "video" && <Video className="w-4 h-4 mr-2 text-red-500" />}
                                {content.type === "pdf" && <File className="w-4 h-4 mr-2 text-orange-500" />}
                                {content.type === "quiz" && <FileQuestion className="w-4 h-4 mr-2 text-green-500" />}
                                {content.type === "mixed" && <Layers className="w-4 h-4 mr-2 text-purple-500" />}
                                <span className="font-medium">{content.title}</span>
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {t("Type")}: {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {t("Order")}: {content.order}
                              </div>
                              {/* Show mixed content indicators */}
                              {content.type === "mixed" && (
                                <div className="flex gap-1 mt-1">
                                  {content.textContent && <Badge variant="outline" className="text-xs"><FileText className="w-3 h-3 mr-1" />Text</Badge>}
                                  {content.videoUrl && <Badge variant="outline" className="text-xs"><Video className="w-3 h-3 mr-1" />Video</Badge>}
                                  {content.pdfUrl && <Badge variant="outline" className="text-xs"><File className="w-3 h-3 mr-1" />PDF</Badge>}
                                  {content.quizContent && <Badge variant="outline" className="text-xs"><FileQuestion className="w-3 h-3 mr-1" />Quiz</Badge>}
                                </div>
                              )}
                              {content.type === "text" && (
                                <div className="mt-2 text-sm">
                                  {content.content.length > 100
                                    ? `${content.content.slice(0, 100)}...`
                                    : content.content}
                                </div>
                              )}
                              {(content.type === "video" || content.type === "pdf") && (
                                <div className="mt-2 text-sm">
                                  <a 
                                    href={content.content} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {t("View file")}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {t("No content found. Add content to this module.")}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => {
                    setContentData({
                      title: "",
                      thumbnailUrl: "",
                      textContent: "",
                      videoUrl: "",
                      pdfUrl: "",
                      quizContent: "",
                      type: "mixed",
                      content: "",
                      order: (contents?.length || 0) + 1,
                    });
                    setContentDialogOpen(true);
                  }}
                  className="w-full"
                  disabled={!selectedModule}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("Add Content")}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Module dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Module")}</DialogTitle>
            <DialogDescription>
              {t("Add a new module to the selected course.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleModuleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("Module Title")}</Label>
                <Input
                  id="title"
                  value={moduleData.title}
                  onChange={(e) => setModuleData({ ...moduleData, title: e.target.value })}
                  placeholder={t("Enter module title")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">{t("Order")}</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  value={moduleData.order}
                  onChange={(e) =>
                    setModuleData({ ...moduleData, order: parseInt(e.target.value) })
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createModuleMutation.isPending}>
                {createModuleMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    {t("Adding...")}
                  </>
                ) : (
                  t("Add Module")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Content dialog */}
      <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("Add Content")}</DialogTitle>
            <DialogDescription>
              {t("Add new content to the selected module.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContentSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="content-title">{t("Content Title")}</Label>
                <Input
                  id="content-title"
                  value={contentData.title}
                  onChange={(e) => setContentData({ ...contentData, title: e.target.value })}
                  placeholder={t("Enter content title")}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content-order">{t("Order")}</Label>
                <Input
                  id="content-order"
                  type="number"
                  min="1"
                  value={contentData.order}
                  onChange={(e) =>
                    setContentData({ ...contentData, order: parseInt(e.target.value) })
                  }
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t("Thumbnail")}</Label>
                <div className="border rounded-md p-4">
                  <div className="space-y-2">
                    <Input
                      id="thumbnail-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'thumbnail')}
                      disabled={isFileUploading}
                    />
                    {uploadedThumbnail && (
                      <div className="mt-2">
                        <div className="text-sm text-gray-500 mb-1">{t("Preview")}:</div>
                        <div className="w-32 h-32 border rounded-md overflow-hidden">
                          <img
                            src={uploadedThumbnail.fileUrl}
                            alt="Thumbnail preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="text" onValueChange={(value) => setContentType(value)}>
                <TabsList className="grid grid-cols-4 mb-2">
                  <TabsTrigger value="text">
                    <FileText className="w-4 h-4 mr-2" />
                    {t("Text")}
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    <Video className="w-4 h-4 mr-2" />
                    {t("Video")}
                  </TabsTrigger>
                  <TabsTrigger value="pdf">
                    <File className="w-4 h-4 mr-2" />
                    {t("PDF")}
                  </TabsTrigger>
                  <TabsTrigger value="quiz">
                    <FileQuestion className="w-4 h-4 mr-2" />
                    {t("Quiz")}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="space-y-2">
                  <Label htmlFor="text-content">{t("Text Content")}</Label>
                  <Textarea
                    id="text-content"
                    rows={5}
                    value={contentData.textContent}
                    onChange={(e) => setContentData({ ...contentData, textContent: e.target.value })}
                    placeholder={t("Enter text content here...")}
                  />
                </TabsContent>
                
                <TabsContent value="video" className="space-y-2">
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("Video Upload")}</AlertTitle>
                    <AlertDescription>
                      {t("Upload a video file. Supported formats: MP4, WEBM.")}
                    </AlertDescription>
                  </Alert>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e, 'video')}
                    disabled={isFileUploading}
                  />
                  {contentData.videoUrl && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 mb-1">{t("Video URL")}:</div>
                      <div className="text-sm break-all bg-gray-50 p-2 rounded-md">
                        {contentData.videoUrl}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="pdf" className="space-y-2">
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("PDF Upload")}</AlertTitle>
                    <AlertDescription>
                      {t("Upload a PDF document.")}
                    </AlertDescription>
                  </Alert>
                  <Input
                    id="pdf-file"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileUpload(e, 'pdf')}
                    disabled={isFileUploading}
                  />
                  {contentData.pdfUrl && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 mb-1">{t("PDF URL")}:</div>
                      <div className="text-sm break-all bg-gray-50 p-2 rounded-md">
                        {contentData.pdfUrl}
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="quiz" className="space-y-2">
                  <Label htmlFor="quiz-content">{t("Quiz Content (JSON)")}</Label>
                  <Textarea
                    id="quiz-content"
                    rows={5}
                    value={contentData.quizContent}
                    onChange={(e) => setContentData({ ...contentData, quizContent: e.target.value })}
                    placeholder={t("Enter quiz content in JSON format...")}
                  />
                </TabsContent>
              </Tabs>
            </div>
            
            <DialogFooter>
              <Button type="submit" disabled={createContentMutation.isPending || isFileUploading}>
                {createContentMutation.isPending || isFileUploading ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    {isFileUploading ? t("Uploading...") : t("Adding...")}
                  </>
                ) : (
                  t("Add Content")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}