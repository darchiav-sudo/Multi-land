import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

import {
  ArrowLeft, Users, MessageSquare, Share2, Radio, 
  Settings, Copy, PanelTopClose, User, Play, Pause,
  Clock, CalendarDays, X, UserPlus, Link2, ExternalLink,
  Image, FileText, UploadCloud, Send, Megaphone, 
  MoveHorizontal, MoveVertical, Video
} from "lucide-react";

interface WebinarOffer {
  id: number;
  title: string;
  buttonText: string;
  buttonColor: string;
  url: string;
  active: boolean;
  displayDuration: number;
}

interface Webinar {
  id: number;
  uniqueId: string;
  title: string;
  description: string | null;
  status: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  timezone: string;
  maxAttendees: number | null;
  instructorName: string;
  createdAt: string;
  settings: any;
  offers?: WebinarOffer[];
  presentationUrl?: string;
}

// Webinar host room page
export default function WebinarHostPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<WebinarOffer | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description,
    });
  };

  // Load webinar data
  useEffect(() => {
    const fetchWebinar = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/webinars/${id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch webinar data");
        }
        const data = await res.json();
        setWebinar(data);
        setIsLive(data.status === "live");
      } catch (err) {
        setError(err as Error);
        toast({
          title: "Error",
          description: `Failed to fetch webinar data: ${(err as Error).message}`,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebinar();
  }, [id, toast]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!webinar || !webinar.id) return;

    // Determine WebSocket URL (use secure WebSocket if the page is loaded over HTTPS)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // WebSocket event handlers
    ws.onopen = () => {
      setWsConnected(true);
      setConnectionStatus("connected");
      console.log("WebSocket connection established");
      
      // Join as host
      ws.send(JSON.stringify({
        type: "join_as_host",
        webinarId: webinar.id,
        clientId: `host_${webinar.id}`
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "participants_update":
            setParticipants(message.participants);
            break;
          case "chat_message":
            setMessages(prevMessages => [...prevMessages, message.data]);
            // Scroll to bottom of chat
            if (messageEndRef.current) {
              messageEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
            break;
          case "webinar_status_change":
            if (message.status === "live") {
              setIsLive(true);
            } else if (message.status === "ended") {
              setIsLive(false);
              navigate(`/admin/webinars`);
            }
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setConnectionStatus("disconnected");
      console.log("WebSocket connection closed");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("disconnected");
    };

    // Cleanup function to close WebSocket connection
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [webinar, navigate]);

  // Setup local video stream
  useEffect(() => {
    // Get user media (camera and microphone)
    const setupLocalVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalVideoStream(stream);
        
        // Set local video element source
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast({
          title: "Camera/Microphone Error",
          description: "Could not access your camera or microphone. Please check permissions.",
          variant: "destructive"
        });
      }
    };
    
    setupLocalVideo();
    
    // Cleanup function to stop media streams
    return () => {
      if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  // Start webinar
  const startWebinar = async () => {
    try {
      const res = await fetch(`/api/webinars/${id}/start`, {
        method: "POST"
      });
      
      if (!res.ok) {
        throw new Error("Failed to start webinar");
      }
      
      setIsLive(true);
      toast({
        title: "Webinar Started",
        description: "Your webinar is now live!"
      });
      
      // Refresh webinar data
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${id}`] });
    } catch (err) {
      toast({
        title: "Error",
        description: `Failed to start webinar: ${(err as Error).message}`,
        variant: "destructive"
      });
    }
  };

  // End webinar
  const endWebinar = async () => {
    try {
      const res = await fetch(`/api/webinars/${id}/end`, {
        method: "POST"
      });
      
      if (!res.ok) {
        throw new Error("Failed to end webinar");
      }
      
      setIsLive(false);
      toast({
        title: "Webinar Ended",
        description: "Your webinar has been ended."
      });
      
      // Navigate back to webinars list
      navigate("/admin/webinars");
    } catch (err) {
      toast({
        title: "Error",
        description: `Failed to end webinar: ${(err as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setShowEndConfirm(false);
    }
  };

  // Send a chat message
  const sendMessage = () => {
    if (!newMessage.trim() || !wsConnected || !wsRef.current) return;
    
    const messageData = {
      type: "chat_message",
      webinarId: webinar?.id,
      data: {
        id: Date.now(),
        sender: "Host",
        message: newMessage,
        timestamp: new Date().toISOString(),
        isHost: true
      }
    };
    
    wsRef.current.send(JSON.stringify(messageData));
    setMessages(prev => [...prev, messageData.data]);
    setNewMessage("");
    
    // Scroll to bottom of chat
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    if (localVideoStream) {
      const audioTracks = localVideoStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicEnabled(!isMicEnabled);
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (localVideoStream) {
      const videoTracks = localVideoStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraEnabled(!isCameraEnabled);
    }
  };

  // Publish offer to chat
  const publishOfferToChat = () => {
    if (!selectedOffer || !wsConnected || !wsRef.current) return;
    
    const offerMessage = {
      type: "special_offer",
      webinarId: webinar?.id,
      data: {
        id: selectedOffer.id,
        title: selectedOffer.title,
        buttonText: selectedOffer.buttonText,
        buttonColor: selectedOffer.buttonColor,
        url: selectedOffer.url,
        displayDuration: selectedOffer.displayDuration
      }
    };
    
    wsRef.current.send(JSON.stringify(offerMessage));
    toast({
      title: "Offer Published",
      description: `"${selectedOffer.title}" has been published to all participants`
    });
    
    setShowOfferDialog(false);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Webinar Host Room</h1>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Webinar Host Room</h1>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <p>Error: {error.message}</p>
            <Button 
              className="mt-4" 
              variant="outline"
              onClick={() => navigate("/admin/webinars")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Webinars
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!webinar) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Webinar Host Room</h1>
          </div>
          <div className="text-center p-10 bg-slate-50 rounded-md">
            <h3 className="text-lg font-medium mb-1">Webinar not found</h3>
            <p className="text-slate-500 mb-4">
              The webinar you're looking for doesn't exist or has been deleted.
            </p>
            <Button 
              onClick={() => navigate("/admin/webinars")} 
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Webinars
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={() => navigate("/admin/webinars")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">{webinar.title}</h1>
              <Badge className={`ml-3 ${isLive ? 'bg-green-500' : 'bg-amber-500'}`}>
                {isLive ? 'LIVE' : 'Not Started'}
              </Badge>
            </div>
            <p className="text-slate-500 mt-1">
              {webinar.instructorName} • {participants.length} Participants
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareLinks(true)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              Invite Links
            </Button>
            {!isLive ? (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={startWebinar}
              >
                <Play className="h-4 w-4 mr-1" />
                Start Webinar
              </Button>
            ) : (
              <Button 
                variant="destructive"
                onClick={() => setShowEndConfirm(true)}
              >
                <X className="h-4 w-4 mr-1" />
                End Webinar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main content area (3/4 width on large screens) */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Live Stream</span>
                  <div className="flex space-x-1">
                    <Button
                      variant={isMicEnabled ? "default" : "outline"}
                      size="sm"
                      className={isMicEnabled ? "bg-green-600 hover:bg-green-700" : "text-muted-foreground"}
                      onClick={toggleMicrophone}
                    >
                      <Radio className="h-4 w-4" />
                      <span className="sr-only">Toggle Microphone</span>
                    </Button>
                    <Button
                      variant={isCameraEnabled ? "default" : "outline"}
                      size="sm"
                      className={isCameraEnabled ? "bg-green-600 hover:bg-green-700" : "text-muted-foreground"}
                      onClick={toggleCamera}
                    >
                      <Video className="h-4 w-4" />
                      <span className="sr-only">Toggle Camera</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOfferDialog(true)}
                    >
                      <Megaphone className="h-4 w-4" />
                      <span className="sr-only">Show Offers</span>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div 
                  ref={videoContainerRef} 
                  className={`relative rounded-md overflow-hidden bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}
                >
                  {/* Main video stream */}
                  <div className="w-full h-full flex items-center justify-center">
                    <video 
                      ref={localVideoRef} 
                      className="w-full h-full object-contain" 
                      autoPlay 
                      playsInline 
                      muted 
                    />
                  </div>
                  
                  {/* Connection status indicator */}
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs ${
                    connectionStatus === "connected" 
                      ? "bg-green-600 text-white" 
                      : connectionStatus === "connecting" 
                        ? "bg-yellow-500 text-white" 
                        : "bg-red-600 text-white"
                  }`}>
                    {connectionStatus === "connected" 
                      ? "Connected" 
                      : connectionStatus === "connecting" 
                        ? "Connecting..." 
                        : "Disconnected"}
                  </div>

                  {/* Fullscreen button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-2 right-2 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => {
                      if (isFullscreen) {
                        document.exitFullscreen();
                      } else if (videoContainerRef.current) {
                        videoContainerRef.current.requestFullscreen();
                      }
                      setIsFullscreen(!isFullscreen);
                    }}
                  >
                    {isFullscreen ? <MoveHorizontal className="h-4 w-4" /> : <MoveVertical className="h-4 w-4" />}
                  </Button>
                </div>

                {webinar.presentationUrl && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">Presentation</h3>
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-slate-100 p-2 flex justify-between items-center">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="text-sm">presentation.pdf</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(webinar.presentationUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Open presentation</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar (1/4 width on large screens) */}
          <div className="lg:col-span-1">
            <Tabs defaultValue="chat">
              <TabsList className="w-full">
                <TabsTrigger value="chat" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="participants" className="flex-1">
                  <Users className="h-4 w-4 mr-1" />
                  Participants
                </TabsTrigger>
                <TabsTrigger value="offers" className="flex-1">
                  <Megaphone className="h-4 w-4 mr-1" />
                  Offers
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">Live Chat</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div 
                      ref={chatContainerRef}
                      className="h-[400px] overflow-y-auto p-3"
                    >
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">
                            No messages yet. Start the conversation!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((msg) => (
                            <div 
                              key={msg.id} 
                              className={`flex ${msg.isHost ? 'justify-end' : 'justify-start'}`}
                            >
                              <div 
                                className={`max-w-[85%] rounded-lg p-2 ${
                                  msg.isHost 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center mb-1">
                                  <span className={`text-xs font-bold ${msg.isHost ? 'text-white' : 'text-slate-700'}`}>
                                    {msg.sender}
                                  </span>
                                  <span className={`text-xs ml-2 ${msg.isHost ? 'text-green-200' : 'text-slate-500'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className={`text-sm ${msg.isHost ? 'text-white' : 'text-slate-800'}`}>
                                  {msg.message}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={messageEndRef} />
                        </div>
                      )}
                    </div>
                    <div className="border-t p-3">
                      <div className="flex items-center">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          className="flex-1 border-0 focus:ring-0 text-sm"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                        >
                          <Send className="h-4 w-4" />
                          <span className="sr-only">Send</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="participants">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">
                      Participants ({participants.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[400px] overflow-y-auto">
                      {participants.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <Users className="h-10 w-10 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">
                            No participants have joined yet.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {participants.map((participant) => (
                            <div key={participant.id} className="flex items-center justify-between p-3">
                              <div className="flex items-center">
                                <User className="h-4 w-4 mr-2 text-slate-400" />
                                <span className="text-sm">{participant.name || 'Anonymous'}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {participant.role || 'Viewer'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="offers">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">Special Offers</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[400px] overflow-y-auto p-3">
                      {!webinar.offers || webinar.offers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <Megaphone className="h-10 w-10 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">
                            No special offers have been created for this webinar.
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-2"
                            onClick={() => navigate(`/admin/webinars/${webinar.id}/offers`)}
                          >
                            Manage Offers
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {webinar.offers.map((offer) => (
                            <div 
                              key={offer.id} 
                              className="border rounded-lg p-3 hover:bg-slate-50"
                            >
                              <h3 className="font-medium text-sm">{offer.title}</h3>
                              <div className="mt-2 mb-2">
                                <div className="text-xs text-slate-500 mb-1">
                                  Button: "{offer.buttonText}" ({offer.buttonColor})
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  URL: {offer.url}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedOffer(offer);
                                  setShowOfferDialog(true);
                                }}
                              >
                                <Megaphone className="h-3 w-3 mr-1" />
                                Publish to Chat
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* End webinar confirmation dialog */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Webinar</DialogTitle>
            <DialogDescription>
              Are you sure you want to end this webinar? This will disconnect all participants and mark the webinar as ended.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={endWebinar}
            >
              End Webinar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish offer dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Special Offer</DialogTitle>
            <DialogDescription>
              This will show the selected offer to all participants in the webinar.
            </DialogDescription>
          </DialogHeader>
          
          {selectedOffer && (
            <div className="mb-4">
              <div className="border rounded-lg p-3">
                <h3 className="font-medium">{selectedOffer.title}</h3>
                <div className="mt-2">
                  <div className="text-sm text-slate-500 mb-1">
                    Button: "{selectedOffer.buttonText}"
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    URL: {selectedOffer.url}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={publishOfferToChat}
            >
              Publish to All Participants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Links Dialog */}
      <Dialog open={showShareLinks} onOpenChange={setShowShareLinks}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Webinar Links</DialogTitle>
            <DialogDescription>
              Share these links to access the webinar "{webinar.title}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Host Link */}
            <div className="space-y-2">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-2 text-green-600" />
                <h3 className="text-sm font-medium">Host Link</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-slate-50 rounded text-xs overflow-hidden text-ellipsis">
                  {`${window.location.origin}/admin/webinars/${webinar.id}/host`}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(
                    `${window.location.origin}/admin/webinars/${webinar.id}/host`,
                    "Host link copied to clipboard"
                  )}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this link to host and manage the webinar. Only share with co-hosts.
              </p>
            </div>
            
            {/* Public Link */}
            <div className="space-y-2">
              <div className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
                <h3 className="text-sm font-medium">Participant Link</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-slate-50 rounded text-xs overflow-hidden text-ellipsis">
                  {`${window.location.origin}/webinar/${webinar.uniqueId}`}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(
                    `${window.location.origin}/webinar/${webinar.uniqueId}`,
                    "Participant link copied to clipboard"
                  )}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with participants to attend the webinar.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowShareLinks(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}