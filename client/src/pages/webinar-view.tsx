import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  X,
  Camera,
  Mic,
  MicOff,
  VideoOff,
  Users,
  MessageSquare,
  Clock,
  Send,
  User,
  Hand,
  Volume2,
  VolumeX
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";

// Type definitions
interface WebinarChatMessage {
  id: number;
  userId: number;
  username: string;
  message: string;
  timestamp: string;
  isPrivate: boolean;
  isHost: boolean;
  isApproved: boolean;
}

interface WebinarAttendee {
  id: number;
  userId: number;
  username: string;
  joinedAt: string;
  hasCamera: boolean;
  hasMic: boolean;
  handRaised: boolean;
  isActive: boolean;
  lastActive: string;
  timeWatched: number;
}

interface WebinarOffer {
  id: string;
  title: string;
  description: string;
  price?: number;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  timing?: number; // Minutes into webinar
  durationSeconds?: number;
  active: boolean;
}

interface Webinar {
  id: number;
  uniqueId: string;
  title: string;
  description: string | null;
  status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  hostId: number;
  hostName: string;
  maxAttendees: number | null;
  settings: {
    cameraEnabled: boolean;
    microphoneEnabled: boolean;
    screenShareEnabled: boolean;
    layoutType: string;
    showAttendeeCount: boolean;
    chatEnabled: boolean;
    moderateChat: boolean;
    privateChatEnabled: boolean;
    allowAttendeeVideo: boolean;
    allowAttendeeAudio: boolean;
    recordSession: boolean;
  };
  currentAttendees: number;
}

// Form schema for chat messages
const chatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  isPrivate: z.boolean().default(false),
  recipientId: z.number().optional(),
});

type ChatMessageFormValues = z.infer<typeof chatMessageSchema>;

// Offer display component
const OfferDisplay = ({ 
  offer, 
  onClose 
}: { 
  offer: WebinarOffer; 
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm sm:max-w-lg relative overflow-hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10 h-7 w-7 sm:h-8 sm:w-8"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        
        <div className="p-4 sm:p-6">
          <div className="mb-3 sm:mb-4">
            <h2 className="text-xl sm:text-2xl font-bold truncate">{offer.title}</h2>
          </div>
          
          <p className="text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base">{offer.description}</p>
          
          {offer.price !== undefined && (
            <div className="mb-3 sm:mb-4 flex items-center flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-green-600">${(offer.price / 100).toFixed(2)}</span>
              <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold">
                Special Offer
              </span>
            </div>
          )}
          
          {offer.imageUrl && (
            <div className="mb-3 sm:mb-4">
              <img 
                src={offer.imageUrl} 
                alt={offer.title}
                className="w-full rounded-md"
              />
            </div>
          )}
          
          <a 
            href={offer.buttonUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors text-sm sm:text-base"
          >
            {offer.buttonText}
          </a>
        </div>
      </div>
    </div>
  );
};

// Countdown timer component 
const CountdownTimer = ({ 
  scheduledTime, 
  onComplete 
}: { 
  scheduledTime: string; 
  onComplete: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const target = new Date(scheduledTime).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = target - now;
      
      if (difference <= 0) {
        setTimeLeft("Starting...");
        onComplete();
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      let formattedTime = '';
      
      if (days > 0) {
        formattedTime += `${days}d `;
      }
      
      formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(formattedTime);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [scheduledTime, onComplete]);

  return (
    <div className="bg-black/10 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full inline-flex items-center">
      <Clock className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="font-mono font-medium text-xs sm:text-sm">{timeLeft}</span>
    </div>
  );
};

export default function WebinarViewPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/webinar/:id");
  const webinarId = params?.id || "";
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Refs for video and audio elements
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const hostScreenRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // State for webinar attendee controls
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const [activeOffer, setActiveOffer] = useState<WebinarOffer | null>(null);
  const [webinarJoined, setWebinarJoined] = useState(false);
  const [deviceSetupCompleted, setDeviceSetupCompleted] = useState(false);
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  const [webinarStarted, setWebinarStarted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  
  // Local media stream
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Form for chat messages
  const chatForm = useForm<ChatMessageFormValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: {
      message: "",
      isPrivate: false,
    },
  });
  
  // Get webinar data
  const { data: webinar, isLoading: webinarLoading } = useQuery({
    queryKey: [`/api/webinars/public/${webinarId}`],
    queryFn: async () => {
      const res = await fetch(`/api/webinars/public/${webinarId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch webinar");
      }
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds to get status updates
  });
  
  // Get webinar attendees
  const { data: attendees, isLoading: attendeesLoading } = useQuery({
    queryKey: [`/api/webinars/${webinarId}/attendees`],
    queryFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}/attendees`);
      if (!res.ok) {
        throw new Error("Failed to fetch attendees");
      }
      return res.json();
    },
    refetchInterval: 20000, // Refresh every 20 seconds
    enabled: webinarJoined && webinar?.status === "live",
  });
  
  // Get chat messages
  const { data: chatMessages, isLoading: chatLoading } = useQuery({
    queryKey: [`/api/webinars/${webinarId}/chat`],
    queryFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}/chat`);
      if (!res.ok) {
        throw new Error("Failed to fetch chat messages");
      }
      return res.json();
    },
    refetchInterval: 3000, // Refresh every 3 seconds
    enabled: webinarJoined && webinar?.status === "live" && webinar?.settings?.chatEnabled,
  });
  
  // Get active offer
  const { data: currentOffer } = useQuery({
    queryKey: [`/api/webinars/${webinarId}/active-offer`],
    queryFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}/active-offer`);
      if (!res.ok) {
        if (res.status === 404) {
          return null; // No active offer
        }
        throw new Error("Failed to fetch active offer");
      }
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: webinarJoined && webinar?.status === "live",
  });

  // Update active offer when data changes
  useEffect(() => {
    if (currentOffer) {
      setActiveOffer(currentOffer);
    } else if (currentOffer === null) {
      setActiveOffer(null);
    }
  }, [currentOffer]);
  
  // Join webinar mutation
  const joinWebinarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hasCamera: cameraEnabled,
          hasMic: micEnabled,
        }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to join webinar");
      }
      
      return res.json();
    },
    onSuccess: () => {
      setWebinarJoined(true);
      
      toast({
        title: "Joined Webinar",
        description: "You have successfully joined the webinar",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to join webinar: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Leave webinar mutation
  const leaveWebinarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/webinars/${webinarId}/leave`, {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Failed to leave webinar");
      }
      
      return res.json();
    },
    onSuccess: () => {
      navigate("/my-learning");
      
      toast({
        title: "Left Webinar",
        description: "You have left the webinar",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to leave webinar: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Send chat message mutation
  const sendChatMutation = useMutation({
    mutationFn: async (data: ChatMessageFormValues) => {
      const res = await fetch(`/api/webinars/${webinarId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error("Failed to send message");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}/chat`] });
      chatForm.reset({ message: "", isPrivate: false });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Toggle hand raised status mutation
  const toggleHandMutation = useMutation({
    mutationFn: async () => {
      const action = handRaised ? "lower-hand" : "raise-hand";
      const res = await fetch(`/api/webinars/${webinarId}/attendees/me/${action}`, {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error(`Failed to ${handRaised ? 'lower' : 'raise'} hand`);
      }
      
      return res.json();
    },
    onSuccess: () => {
      setHandRaised(!handRaised);
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/${webinarId}/attendees`] });
      
      toast({
        title: handRaised ? "Hand Lowered" : "Hand Raised",
        description: handRaised ? "You have lowered your hand" : "You have raised your hand",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to change hand status: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Initialize device setup
  const initializeDeviceSetup = async () => {
    try {
      // Check if user has granted permission to access camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      
      // Set video source for setup preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Enable camera and mic by default for setup
      setCameraEnabled(true);
      setMicEnabled(true);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast({
        title: "Media Access Error",
        description: "Could not access camera or microphone. Please check your device permissions.",
        variant: "destructive",
      });
      
      // Set both to false if permissions are denied
      setCameraEnabled(false);
      setMicEnabled(false);
    }
  };
  
  // Complete device setup and join webinar
  const completeDeviceSetup = () => {
    setDeviceSetupCompleted(true);
    setShowDeviceSetup(false);
    
    // Join webinar with current device settings
    joinWebinarMutation.mutate();
  };
  
  // Handle refreshing webinar if scheduled start time has passed
  const handleWebinarStartCheck = () => {
    if (webinar?.status === "scheduled") {
      queryClient.invalidateQueries({ queryKey: [`/api/webinars/public/${webinarId}`] });
    }
  };
  
  // Effect to setup devices when starting to join
  useEffect(() => {
    if (showDeviceSetup) {
      initializeDeviceSetup();
    }
  }, [showDeviceSetup]);
  
  // Effect to check if webinar has started
  useEffect(() => {
    if (webinar?.status === "live" && !webinarStarted) {
      setWebinarStarted(true);
      
      // If user has already completed device setup, join automatically
      if (deviceSetupCompleted) {
        joinWebinarMutation.mutate();
      } else {
        setShowDeviceSetup(true);
      }
      
      // Set webinar start time
      if (webinar.actualStartTime) {
        const startTime = new Date(webinar.actualStartTime);
        
        const intervalId = setInterval(() => {
          const now = new Date();
          const diff = now.getTime() - startTime.getTime();
          
          // Format as HH:MM:SS
          const hours = Math.floor(diff / 3600000);
          const minutes = Math.floor((diff % 3600000) / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          
          setElapsedTime(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          );
        }, 1000);
        
        return () => clearInterval(intervalId);
      }
    }
  }, [webinar, webinarStarted, deviceSetupCompleted]);
  
  // Handle camera toggle
  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setCameraEnabled(!cameraEnabled);
    }
  };
  
  // Handle microphone toggle
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setMicEnabled(!micEnabled);
    }
  };
  
  // Handle audio mute for the host's audio
  const toggleAudioMute = () => {
    if (hostVideoRef.current) {
      hostVideoRef.current.muted = !hostVideoRef.current.muted;
      setAudioMuted(!audioMuted);
    }
    
    if (hostScreenRef.current) {
      hostScreenRef.current.muted = !hostScreenRef.current.muted;
    }
  };
  
  // Handle chat message submission
  const handleSendMessage = (data: ChatMessageFormValues) => {
    sendChatMutation.mutate(data);
  };
  
  // Handle leaving webinar
  const handleLeaveWebinar = () => {
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Leave the webinar
    leaveWebinarMutation.mutate();
  };
  
  // Hide an offer
  const handleHideOffer = () => {
    setActiveOffer(null);
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  // Format scheduled date for display with timezone
  const formatScheduledDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    
    return date.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };
  
  if (webinarLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-white">Loading webinar...</p>
        </div>
      </div>
    );
  }
  
  if (!webinar) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="text-2xl font-bold mb-4 text-white">Webinar Not Found</h1>
        <p className="text-gray-300 mb-6">The webinar you're looking for doesn't exist or has ended.</p>
        <Button onClick={() => navigate("/my-learning")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Learning
        </Button>
      </div>
    );
  }
  
  // Display "Webinar has ended" screen
  if (webinar.status === "ended" || webinar.status === "cancelled") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="text-2xl font-bold mb-4 text-white">
          {webinar.status === "ended" ? "Webinar Has Ended" : "Webinar Cancelled"}
        </h1>
        <p className="text-gray-300 mb-6">
          {webinar.status === "ended"
            ? "This webinar has concluded. Thank you for your participation."
            : "This webinar has been cancelled by the host."}
        </p>
        <Button onClick={() => navigate("/my-learning")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Learning
        </Button>
      </div>
    );
  }
  
  // Display "Waiting for webinar to start" screen for scheduled webinars
  if (webinar.status === "scheduled" && webinar.scheduledStartTime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <div className="max-w-2xl w-full p-8 rounded-lg bg-gray-800 text-white">
          <h1 className="text-3xl font-bold mb-4 text-center">{webinar.title}</h1>
          
          <div className="flex flex-col items-center mb-6">
            <p className="text-lg font-medium text-gray-300">Starts in</p>
            <CountdownTimer 
              scheduledTime={webinar.scheduledStartTime} 
              onComplete={handleWebinarStartCheck} 
            />
          </div>
          
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Details</h2>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="mb-3"><span className="font-medium">Host:</span> {webinar.hostName || "Unknown"}</p>
              <p className="mb-3"><span className="font-medium">Scheduled for:</span> {formatScheduledDate(webinar.scheduledStartTime)}</p>
              {webinar.description && (
                <p><span className="font-medium">Description:</span> {webinar.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <Button 
              variant="outline"
              className="mr-4"
              onClick={() => navigate("/my-learning")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <Button 
              variant="default"
              onClick={() => setShowDeviceSetup(true)}
            >
              Setup Devices
            </Button>
          </div>
        </div>
        
        {/* Device setup dialog */}
        <Dialog open={showDeviceSetup} onOpenChange={setShowDeviceSetup}>
          <DialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-lg sm:text-xl">Device Setup</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Test your camera and microphone before the webinar starts.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Video preview */}
              <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {!cameraEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <p className="text-white text-sm sm:text-base">Camera is turned off</p>
                  </div>
                )}
              </div>
              
              {/* Device controls */}
              <div className="flex justify-center gap-3 sm:gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={cameraEnabled ? "default" : "secondary"}
                        size="icon"
                        className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                        onClick={toggleCamera}
                      >
                        {cameraEnabled ? (
                          <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="hidden sm:block">
                      <p>{cameraEnabled ? "Turn off camera" : "Turn on camera"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={micEnabled ? "default" : "secondary"}
                        size="icon"
                        className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                        onClick={toggleMic}
                      >
                        {micEnabled ? (
                          <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="hidden sm:block">
                      <p>{micEnabled ? "Mute microphone" : "Unmute microphone"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-2 sm:pt-0">
              <Button 
                variant="outline" 
                onClick={() => setShowDeviceSetup(false)}
                className="w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={completeDeviceSetup}
                className="w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
              >
                {webinar.status === "live" ? "Join Webinar" : "Save Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  // Main webinar view (live and joined)
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-black text-white px-2 sm:px-4 py-2 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-300 hover:text-white mr-2 sm:mr-4 p-1 sm:p-2"
            onClick={handleLeaveWebinar}
          >
            <ArrowLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden xs:inline-block">Leave</span>
          </Button>
          <div>
            <h1 className="font-bold truncate max-w-[120px] xs:max-w-[200px] sm:max-w-none text-sm sm:text-base">
              {webinar.title}
            </h1>
            <div className="flex items-center text-xs text-gray-400">
              <Clock className="h-3 w-3 mr-1" />
              <span>{elapsedTime}</span>
              <Badge className="ml-2 bg-red-600 text-[10px] sm:text-xs py-0 h-4 sm:h-5">LIVE</Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {webinar.settings.showAttendeeCount && (
            <div className="px-2 py-1 flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 bg-gray-800 rounded">
              <Users className="h-3 w-3" />
              <span>{webinar.currentAttendees || 0}</span>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video stream area */}
        <div className={`flex-1 bg-black relative ${showChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Video elements */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Host video */}
            <video
              ref={hostVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Host screen share */}
            <video
              ref={hostScreenRef}
              autoPlay
              playsInline
              className="hidden w-full h-full object-contain"
            />
            
            {/* Controls overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 sm:px-4 py-1 sm:py-2 flex items-center gap-1 sm:gap-2">
                {/* Only show camera button if attendees are allowed video */}
                {webinar.settings.allowAttendeeVideo && (
                  <TooltipProvider delayDuration={700}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={cameraEnabled ? "default" : "secondary"} 
                          size="icon" 
                          className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                          onClick={toggleCamera}
                        >
                          {cameraEnabled ? (
                            <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="hidden sm:block">
                        <p>{cameraEnabled ? "Turn off camera" : "Turn on camera"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Only show mic button if attendees are allowed audio */}
                {webinar.settings.allowAttendeeAudio && (
                  <TooltipProvider delayDuration={700}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={micEnabled ? "default" : "secondary"} 
                          size="icon" 
                          className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                          onClick={toggleMic}
                        >
                          {micEnabled ? (
                            <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="hidden sm:block">
                        <p>{micEnabled ? "Mute microphone" : "Unmute microphone"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Raise hand button */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={handRaised ? "default" : "secondary"} 
                        size="icon" 
                        className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                        onClick={() => toggleHandMutation.mutate()}
                      >
                        <Hand className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden sm:block">
                      <p>{handRaised ? "Lower hand" : "Raise hand"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Audio mute button */}
                <TooltipProvider delayDuration={700}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={audioMuted ? "default" : "secondary"} 
                        size="icon" 
                        className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                        onClick={toggleAudioMute}
                      >
                        {audioMuted ? (
                          <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden sm:block">
                      <p>{audioMuted ? "Unmute audio" : "Mute audio"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Mobile-only toggle for chat */}
                <div className="md:hidden">
                  <Separator orientation="vertical" className="h-6 sm:h-8 mx-1" />
                  
                  <TooltipProvider delayDuration={700}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                          onClick={() => setShowChat(true)}
                        >
                          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="hidden sm:block">
                        <p>Show chat</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right sidebar with chat */}
        {webinar.settings.chatEnabled && (
          <div className={`w-full md:w-80 lg:w-96 bg-gray-800 text-white flex flex-col ${!showChat ? 'hidden md:flex' : 'flex'}`}>
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              <TabsList className="bg-gray-900 p-1">
                <TabsTrigger 
                  value="chat"
                  className="flex-1 data-[state=active]:bg-gray-800"
                >
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Chat</span>
                  </div>
                </TabsTrigger>
                
                {/* Attendees tab only if host allows it */}
                {webinar.settings.showAttendeeCount && (
                  <TabsTrigger 
                    value="participants"
                    className="flex-1 data-[state=active]:bg-gray-800"
                  >
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">Participants</span>
                      <span className="ml-1 sm:ml-2 bg-gray-700 text-white text-[10px] sm:text-xs rounded-full px-1 sm:px-2 py-0.5">
                        {webinar.currentAttendees || 0}
                      </span>
                    </div>
                  </TabsTrigger>
                )}
              </TabsList>
              
              {/* Mobile view - back button */}
              <div className="md:hidden flex items-center justify-between p-1.5 sm:p-2 bg-gray-900">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 sm:h-8 text-[10px] sm:text-xs py-0 px-2"
                  onClick={() => setShowChat(false)}
                >
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Back to Stream
                </Button>
              </div>
              
              {/* Chat tab */}
              <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0">
                {/* Chat messages */}
                <ScrollArea className="flex-1 p-1.5 sm:p-3">
                  {chatLoading ? (
                    <div className="flex justify-center p-3 sm:p-4">
                      <div className="animate-spin w-4 h-4 sm:w-6 sm:h-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : chatMessages?.length === 0 ? (
                    <div className="text-center text-gray-500 py-5 sm:py-8">
                      <MessageSquare className="h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 opacity-50" />
                      <p className="text-xs sm:text-sm">No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 sm:space-y-3">
                      {chatMessages?.map((msg: WebinarChatMessage) => {
                        // If chat is moderated, only show approved messages or host messages
                        if (webinar.settings.moderateChat && !msg.isApproved && !msg.isHost) {
                          return null;
                        }
                        
                        return (
                          <div 
                            key={msg.id} 
                            className={`p-1.5 sm:p-2 rounded-lg ${
                              msg.isHost 
                                ? 'bg-green-900/50 text-green-100' 
                                : msg.isPrivate 
                                  ? 'bg-purple-900/30 text-purple-100'
                                  : 'bg-gray-700/50'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
                              <div className="flex items-center">
                                <span className="font-semibold text-[11px] sm:text-sm max-w-[90px] xs:max-w-[120px] sm:max-w-none truncate">
                                  {msg.username}
                                </span>
                                {msg.isHost && (
                                  <Badge className="ml-1 sm:ml-2 bg-green-700 text-[7px] sm:text-[10px] py-0 h-3.5 sm:h-4">Host</Badge>
                                )}
                                {msg.isPrivate && (
                                  <Badge className="ml-1 sm:ml-2 bg-purple-700 text-[7px] sm:text-[10px] py-0 h-3.5 sm:h-4">Private</Badge>
                                )}
                              </div>
                              <span className="text-[8px] sm:text-xs text-gray-400">
                                {formatDate(msg.timestamp)}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-sm break-words">{msg.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                
                {/* Chat input */}
                <div className="p-1.5 sm:p-3 border-t border-gray-700">
                  <form onSubmit={chatForm.handleSubmit(handleSendMessage)} className="flex flex-col gap-1 sm:gap-2">
                    <div className="flex gap-1 sm:gap-2">
                      <Textarea 
                        className="flex-1 h-7 sm:h-10 min-h-7 sm:min-h-10 text-xs sm:text-sm bg-gray-700 border-gray-600 py-1.5 sm:py-2 px-2 sm:px-3"
                        placeholder="Type a message..."
                        {...chatForm.register("message")}
                      />
                      <Button 
                        type="submit" 
                        disabled={sendChatMutation.isPending}
                        className="h-7 w-7 sm:h-10 sm:w-10 p-0"
                      >
                        <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>
              
              {/* Participants tab */}
              {webinar.settings.showAttendeeCount && (
                <TabsContent value="participants" className="flex-1 flex flex-col p-0 m-0">
                  <ScrollArea className="flex-1 p-1.5 sm:p-3">
                    {attendeesLoading ? (
                      <div className="flex justify-center p-3 sm:p-4">
                        <div className="animate-spin w-4 h-4 sm:w-6 sm:h-6 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    ) : attendees?.length === 0 ? (
                      <div className="text-center text-gray-500 py-5 sm:py-8">
                        <Users className="h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm">No participants yet</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 sm:space-y-2">
                        {attendees?.map((attendee: WebinarAttendee) => (
                          <div key={attendee.id} className="p-1.5 sm:p-2 bg-gray-700/50 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-gray-600 flex items-center justify-center">
                                  <User className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                                </div>
                                <div>
                                  <div className="font-medium text-[11px] sm:text-sm max-w-[90px] xs:max-w-[120px] sm:max-w-none truncate">
                                    {attendee.username}
                                    {attendee.userId === webinar.hostId && (
                                      <Badge className="ml-1 sm:ml-2 bg-green-700 text-[7px] sm:text-[10px] py-0 h-3.5 sm:h-4">Host</Badge>
                                    )}
                                  </div>
                                  <div className="text-[8px] sm:text-xs text-gray-400">
                                    Joined: {formatDate(attendee.joinedAt)}
                                  </div>
                                </div>
                              </div>
                              
                              {attendee.handRaised && (
                                <Badge className="bg-yellow-600 text-[7px] sm:text-xs h-3.5 sm:h-5 py-0">
                                  <Hand className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                  Hand
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </div>
      
      {/* Active offer display */}
      {activeOffer && (
        <OfferDisplay 
          offer={activeOffer} 
          onClose={handleHideOffer} 
        />
      )}
      
      {/* Device setup dialog */}
      <Dialog open={showDeviceSetup} onOpenChange={setShowDeviceSetup}>
        <DialogContent className="max-w-[90vw] w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Device Setup</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Test your camera and microphone before joining the webinar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Video preview */}
            <div className="bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <p className="text-white text-xs sm:text-base">Camera is turned off</p>
                </div>
              )}
            </div>
            
            {/* Device controls */}
            <div className="flex justify-center gap-3 sm:gap-4">
              <TooltipProvider delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={cameraEnabled ? "default" : "secondary"}
                      size="icon"
                      className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                      onClick={toggleCamera}
                    >
                      {cameraEnabled ? (
                        <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="hidden sm:block">
                    <p>{cameraEnabled ? "Turn off camera" : "Turn on camera"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider delayDuration={700}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={micEnabled ? "default" : "secondary"}
                      size="icon"
                      className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                      onClick={toggleMic}
                    >
                      {micEnabled ? (
                        <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="hidden sm:block">
                    <p>{micEnabled ? "Mute microphone" : "Unmute microphone"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDeviceSetup(false)}
              className="text-xs sm:text-sm h-8 sm:h-10"
            >
              Cancel
            </Button>
            <Button 
              onClick={completeDeviceSetup}
              className="text-xs sm:text-sm h-8 sm:h-10"
            >
              {webinar.status === "live" ? "Join Webinar" : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}