import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Content, VideoItem, PDFItem, Comment } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CommentsSection } from "@/components/comments-section";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  ChevronLeft,
  FileText,
  Video,
  File,
  FileQuestion,
  MoveVertical,
  Save,
  ArrowLeft,
  Edit,
  LayoutList,
  Eye,
  ChevronUp,
  ChevronDown,
  CheckCircle
} from "lucide-react";

export default function ContentPreview() {
  const { contentId } = useParams();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("view");
  
  // Get content details
  const { data: content, isLoading } = useQuery<Content>({
    queryKey: ["/api/contents", contentId],
    queryFn: async () => {
      if (!contentId) return null;
      const res = await apiRequest("GET", `/api/contents/${contentId}`);
      return res.json();
    },
    enabled: !!contentId,
  });

  // Get comments for this content
  const { data: comments, isLoading: isLoadingComments } = useQuery<Comment[]>({
    queryKey: ["/api/contents", contentId, "comments"],
    queryFn: async () => {
      if (!contentId) return [];
      const res = await apiRequest("GET", `/api/contents/${contentId}/comments`);
      return res.json();
    },
    enabled: !!contentId,
  });
  
  // State for content sections (we'll use this for the reordering tab)
  const [contentElements, setContentElements] = useState<{
    id: string;
    type: 'text' | 'video' | 'pdf' | 'quiz';
    content: any;
    name?: string;
  }[]>([]);
  
  // Original content from the database
  const [originalOrder, setOriginalOrder] = useState<{
    id: string;
    type: 'text' | 'video' | 'pdf' | 'quiz';
    content: any;
    name?: string;
  }[]>([]);
  
  // Flag to track if order has changed
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  
  // State for tracking save status
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Update content section order mutation
  const updateSectionOrderMutation = useMutation({
    mutationFn: async (data: { 
      contentId: number; 
      updatedContent: Partial<Content>;
    }) => {
      const res = await apiRequest("PUT", `/api/contents/${data.contentId}`, data.updatedContent);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contents", contentId] });
      setHasOrderChanged(false);
    },
    onError: (error: Error) => {
      console.error("Failed to update content section order:", error.message);
    }
  });
  
  // Parse content and set up draggable elements
  useEffect(() => {
    if (content) {
      // First collect all available elements
      const availableElements: any[] = [];
      
      // Add text content if available
      if (content.textContent) {
        availableElements.push({
          id: 'text',
          type: 'text' as const,
          content: content.textContent,
          name: t('Text Content')
        });
      }
      
      // Add single video if available (legacy support)
      if (content.videoUrl && (!content.videoItems || content.videoItems.length === 0)) {
        availableElements.push({
          id: 'video-legacy',
          type: 'video' as const,
          content: content.videoUrl,
          name: t('Video')
        });
      }
      
      // Add multiple videos if available
      if (content.videoItems && content.videoItems.length > 0) {
        content.videoItems.forEach((video, index) => {
          availableElements.push({
            id: `video-${index}`,
            type: 'video' as const,
            content: video.url,
            name: video.name || t('Video') + ' ' + (index + 1)
          });
        });
      }
      
      // Add single PDF if available (legacy support)
      if (content.pdfUrl && (!content.pdfItems || content.pdfItems.length === 0)) {
        availableElements.push({
          id: 'pdf-legacy',
          type: 'pdf' as const,
          content: content.pdfUrl,
          name: t('PDF Document')
        });
      }
      
      // Add multiple PDFs if available
      if (content.pdfItems && content.pdfItems.length > 0) {
        content.pdfItems.forEach((pdf, index) => {
          availableElements.push({
            id: `pdf-${index}`,
            type: 'pdf' as const,
            content: pdf.url,
            name: pdf.name || t('PDF') + ' ' + (index + 1)
          });
        });
      }
      
      // Add quiz content if available
      if (content.quizContent) {
        availableElements.push({
          id: 'quiz',
          type: 'quiz' as const,
          content: content.quizContent,
          name: t('Quiz')
        });
      }
      
      console.log("Available elements:", availableElements);
      console.log("Content display_order:", content.display_order);
      
      // If we have a display_order saved, use it to order the elements
      let orderedElements = [...availableElements];
      if (content.display_order) {
        try {
          // Parse the saved order
          const savedOrder = JSON.parse(content.display_order);
          console.log("Parsed saved order:", savedOrder);
          
          // Reorder elements based on saved order
          if (Array.isArray(savedOrder) && savedOrder.length > 0) {
            // Create a new array with elements in the proper order
            orderedElements = savedOrder
              .map(id => availableElements.find(el => el.id === id))
              .filter(Boolean); // Filter out any undefined elements
              
            // Add any new elements that aren't in the saved order
            const savedIds = new Set(savedOrder);
            const newElements = availableElements.filter(el => !savedIds.has(el.id));
            orderedElements = [...orderedElements, ...newElements];
            
            console.log("Ordered elements based on saved order:", orderedElements);
          }
        } catch (error) {
          console.error("Error parsing display_order:", error);
          // If parsing fails, fall back to the default order
          orderedElements = [...availableElements];
        }
      }
      
      setContentElements(orderedElements);
      setOriginalOrder([...orderedElements]); // Save original order for comparison
    }
  }, [content, t]);
  
  // Handle drag end and reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(contentElements);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setContentElements(items);
    
    // Check if order has changed from original
    const hasChanged = JSON.stringify(items.map(item => item.id)) !== 
                       JSON.stringify(originalOrder.map(item => item.id));
    setHasOrderChanged(hasChanged);
  };
  
  // Handle moving elements up and down
  const moveElement = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === contentElements.length - 1)
    ) {
      return; // Can't move any further in that direction
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const items = Array.from(contentElements);
    const [movedItem] = items.splice(index, 1);
    items.splice(newIndex, 0, movedItem);
    
    setContentElements(items);
    
    // Check if order has changed from original
    const hasChanged = JSON.stringify(items.map(item => item.id)) !== 
                       JSON.stringify(originalOrder.map(item => item.id));
    setHasOrderChanged(hasChanged);
  };
  
  // Save the new order
  const saveNewOrder = async () => {
    if (!content || !contentId) return;
    
    // Reset state before saving
    setIsSaving(true);
    setSaveSuccess(false);
    
    console.log("Original content elements:", originalOrder);
    console.log("New content elements:", contentElements);
    console.log("Original content data:", content);
    
    // Create an array for elements in the desired order
    let elementsOrder: any[] = [];
    
    // Get elements in their updated order
    contentElements.forEach((element, index) => {
      elementsOrder.push({
        id: element.id,
        type: element.type,
        displayIndex: index,
        name: element.name
      });
    });
    
    console.log("New element order:", elementsOrder);
    
    // Create the order field - we will store the order as an array of element IDs in the order they should appear
    const orderData = elementsOrder.map(el => el.id);
    console.log("Order data to save:", orderData);
    
    // We'll use the display_order field to track the content order
    // This is a different approach that should work better with our server implementation
    let updatedContent: any = {
      // Include display_order as a field to track element order
      display_order: JSON.stringify(orderData)
    };
    
    console.log("Saving content with data:", updatedContent);
    
    // Send the updated display_order directly to the specific endpoint
    try {
      const response = await apiRequest(
        "PATCH", 
        `/api/contents/${contentId}/display-order`, 
        { display_order: JSON.stringify(orderData) }
      );
      
      if (response.ok) {
        console.log("Display order updated successfully");
        queryClient.invalidateQueries({ queryKey: ["/api/contents", contentId] });
        setHasOrderChanged(false);
        setSaveSuccess(true);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        console.error("Failed to update display order:", await response.text());
      }
    } catch (error) {
      console.error("Error updating display order:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!content) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">{t("Error")}</h3>
        <p className="text-sm mt-1">{t("Content not found")}</p>
      </div>
    );
  }

  return (
    <div className="container p-6">
      <div className="flex items-center mb-6 gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(`/admin/content-manager/${content.courseId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("Back")}
        </Button>
        <h1 className="text-2xl font-bold">{content.title}</h1>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full mb-4"
      >
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="view" className="flex items-center">
            <Eye className="h-4 w-4 mr-2" />
            {t("Student View")}
          </TabsTrigger>
          <TabsTrigger value="reorder" className="flex items-center">
            <LayoutList className="h-4 w-4 mr-2" />
            {t("Reorder Content")}
          </TabsTrigger>
        </TabsList>

        {/* Student View Tab */}
        <TabsContent value="view" className="pt-4">
          <div className="w-full">
            <div className="mb-4 flex justify-end gap-2 items-center">
              {saveSuccess && (
                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-md text-sm flex items-center mr-2">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {t("Order saved successfully")}
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={saveNewOrder}
                disabled={!hasOrderChanged || isSaving}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    {t("Saving...")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t("Save Order")}
                  </>
                )}
              </Button>
            </div>
            
            {contentElements.map((element, index) => (
              <Card key={element.id} className="mb-6 relative">
                <div className="absolute right-2 top-2 flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={index === 0}
                    onClick={() => moveElement(index, 'up')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${index === contentElements.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={index === contentElements.length - 1}
                    onClick={() => moveElement(index, 'down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                
                <CardHeader className="pb-0">
                  <Badge variant="outline" className="w-fit mb-2">
                    {element.type.charAt(0).toUpperCase() + element.type.slice(1)}
                  </Badge>
                  <CardTitle className="text-xl">{element.name}</CardTitle>
                </CardHeader>
                
                <CardContent className="pt-4">
                  {/* Text content */}
                  {element.type === 'text' && (
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap">{element.content}</p>
                    </div>
                  )}
                  
                  {/* Video content */}
                  {element.type === 'video' && (
                    <div className="aspect-video relative">
                      <video 
                        src={element.content} 
                        controls 
                        className="w-full h-full rounded-md"
                      />
                    </div>
                  )}
                  
                  {/* PDF content */}
                  {element.type === 'pdf' && (
                    <div className="border rounded-md p-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <File className="h-8 w-8 text-orange-500 mr-3" />
                        <span>{element.name}</span>
                      </div>
                      <a 
                        href={element.content} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="bg-black text-white py-1 px-3 rounded-md hover:bg-gray-800 text-sm"
                      >
                        {t("Open PDF")}
                      </a>
                    </div>
                  )}
                  
                  {/* Quiz content */}
                  {element.type === 'quiz' && (
                    <div>
                      <div className="flex items-center mb-3">
                        <FileQuestion className="h-5 w-5 text-green-500 mr-2" />
                        <span className="font-medium">{t("Quiz")}</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-md overflow-auto max-h-64">
                        <pre className="whitespace-pre-wrap">{element.content}</pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            

            {/* Comments Section */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{t("Comments")}</CardTitle>
                <CardDescription>
                  {t("Comments from students on this content")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingComments ? (
                  <div className="flex justify-center my-4">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <CommentsSection
                    comments={comments || []}
                    contentId={contentId ? parseInt(contentId) : 0}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reorder Content Tab */}
        <TabsContent value="reorder" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("Content Layout Management")}</CardTitle>
              <CardDescription>
                {t("Drag and drop content sections to rearrange how they will appear to students")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="content-sections">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {contentElements.map((element, index) => (
                        <Draggable key={element.id} draggableId={element.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="bg-white border rounded-md p-4 shadow-sm"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center">
                                  {element.type === 'text' && <FileText className="w-5 h-5 mr-3 text-blue-500" />}
                                  {element.type === 'video' && <Video className="w-5 h-5 mr-3 text-red-500" />}
                                  {element.type === 'pdf' && <File className="w-5 h-5 mr-3 text-orange-500" />}
                                  {element.type === 'quiz' && <FileQuestion className="w-5 h-5 mr-3 text-green-500" />}
                                  <div>
                                    <h3 className="font-medium">{element.name}</h3>
                                    <p className="text-sm text-gray-500">{t("Order")}: {index + 1}</p>
                                  </div>
                                </div>
                                <div 
                                  {...provided.dragHandleProps}
                                  className="cursor-move p-2 hover:bg-gray-100 rounded"
                                >
                                  <MoveVertical className="h-5 w-5 text-gray-400" />
                                </div>
                              </div>
                              
                              {/* Preview content based on type */}
                              <div className="mt-3">
                                {element.type === 'text' && (
                                  <div className="text-sm text-gray-700 border-t pt-3 max-h-24 overflow-y-auto">
                                    {element.content.substring(0, 150)}
                                    {element.content.length > 150 && '...'}
                                  </div>
                                )}
                                
                                {element.type === 'video' && (
                                  <div className="border-t pt-3">
                                    <a 
                                      href={element.content} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-500 hover:underline"
                                    >
                                      {t("View video")}
                                    </a>
                                  </div>
                                )}
                                
                                {element.type === 'pdf' && (
                                  <div className="border-t pt-3">
                                    <a 
                                      href={element.content} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-500 hover:underline"
                                    >
                                      {t("View PDF")}
                                    </a>
                                  </div>
                                )}
                                
                                {element.type === 'quiz' && (
                                  <div className="text-sm text-gray-700 border-t pt-3">
                                    {t("Quiz with")} {
                                      element.content.split('\n').length
                                    } {t("questions")}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
            <CardFooter className="flex justify-between">
              {saveSuccess && (
                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-md text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {t("Order saved successfully")}
                </div>
              )}
              <div className="ml-auto">
                <Button
                  onClick={saveNewOrder}
                  disabled={!hasOrderChanged || isSaving}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      {t("Saving...")}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t("Save Order")}
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}