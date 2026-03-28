import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  HelpCircle,
  ChevronRight,
  X,
  Ban,
  Check,
  Users,
  Video,
  MicOff,
  Mic,
  CameraOff,
  Camera,
  CreditCard,
} from "lucide-react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

interface ChatMessage {
  id: number;
  userId: number;
  userName: string;
  webinarId: number;
  message: string;
  createdAt: string;
  type: "chat" | "question" | "offer";
  isApproved?: boolean;
  offerData?: {
    id: number;
    title: string;
    buttonText: string;
    buttonLink: string;
    buttonColor: string;
    durationSeconds: number;
    expiresAt: string | null;
  } | null;
}

export default function WebinarLiveRoom() {
  const { uniqueId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [webinar, setWebinar] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [questionMessages, setQuestionMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [showPDF, setShowPDF] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isWebsocketConnected, setIsWebsocketConnected] = useState(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const questionContainerRef = useRef<HTMLDivElement>(null);
  
  // Video streaming state
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localPlayerContainerRef = useRef<HTMLDivElement>(null);
  const remotePlayerContainerRef = useRef<HTMLDivElement>(null);
  
  // Load webinar details
  useEffect(() => {
    const fetchWebinarDetails = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/public/webinars/${uniqueId}`);
        
        if (!res.ok) {
          throw new Error("Failed to fetch webinar details");
        }
        
        const data = await res.json();
        setWebinar(data);
        
        // Check if webinar is actually live
        if (data.status !== "live") {
          // If not live, redirect to waiting room
          navigate(`/webinar/${uniqueId}`);
          return;
        }
        
        // Load presentation PDF if available
        if (data.presentationUrl) {
          setPdfUrl(data.presentationUrl);
        }
        
        // Load active offers
        if (data.offers) {
          const activeOffersList = data.offers.filter(
            (offer: any) => offer.isActive && 
            (!offer.expiresAt || new Date(offer.expiresAt) > new Date())
          );
          setActiveOffers(activeOffersList);
        }
        
        // Temporarily disable WebSocket connection until stability issues are resolved
        // initializeWebSocket();
        
        // Load chat history
        const chatRes = await fetch(`/api/public/webinars/${uniqueId}/chat`);
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setChatMessages(chatData.filter((msg: ChatMessage) => msg.type === "chat"));
          setQuestionMessages(chatData.filter((msg: ChatMessage) => 
            msg.type === "question" && (data.settings?.moderateQuestions ? msg.isApproved : true)
          ));
        }
        
      } catch (err) {
        setError(err as Error);
        toast({
          title: "Error",
          description: `Failed to load webinar: ${(err as Error).message}`,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWebinarDetails();
    
    return () => {
      // Clean up WebSocket connection when component unmounts
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
      
      // Clean up Agora client
      leaveCall();
    };
  }, [uniqueId, navigate, toast]);
  
  // Initialize Agora client
  useEffect(() => {
    if (webinar && !agoraClientRef.current) {
      initializeAgoraClient();
    }
  }, [webinar]);
  
  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Scroll questions to bottom when new questions arrive
  useEffect(() => {
    if (questionContainerRef.current) {
      questionContainerRef.current.scrollTop = questionContainerRef.current.scrollHeight;
    }
  }, [questionMessages]);
  
  // Initialize WebSocket connection with improved stability
  const initializeWebSocket = () => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.close();
        console.warn('WebSocket connection timeout');
        setIsWebsocketConnected(false);
      }
    }, 10000); // 10 second timeout
    
    socket.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('WebSocket connection established');
      setIsWebsocketConnected(true);
      
      // Join webinar room with retry logic
      if (user && webinar) {
        const joinMessage = {
          type: 'join-webinar',
          webinarId: webinar.id,
          uniqueId: uniqueId,
          userId: user.id,
          userName: user.username || user.email
        };
        
        try {
          socket.send(JSON.stringify(joinMessage));
        } catch (err) {
          console.error('Failed to send join message:', err);
        }
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Batch state updates to improve performance
        if (data.type === 'chat-message') {
          if (data.message.type === 'chat') {
            setChatMessages(prev => {
              // Limit chat messages to prevent memory issues
              const newMessages = [...prev, data.message];
              return newMessages.length > 500 ? newMessages.slice(-400) : newMessages;
            });
          } else if (data.message.type === 'question') {
            // Only add approved questions if moderation is enabled
            if (!webinar?.settings?.moderateQuestions || data.message.isApproved) {
              setQuestionMessages(prev => {
                const newQuestions = [...prev, data.message];
                return newQuestions.length > 200 ? newQuestions.slice(-150) : newQuestions;
              });
            }
          } else if (data.message.type === 'offer') {
            // Add offer to chat
            setChatMessages(prev => {
              const newMessages = [...prev, data.message];
              return newMessages.length > 500 ? newMessages.slice(-400) : newMessages;
            });
            
            // Add to active offers if it's not there already
            if (data.message.offerData) {
              setActiveOffers(prev => {
                if (data.message.offerData && !prev.some(offer => offer.id === data.message.offerData.id)) {
                  return [...prev, data.message.offerData];
                }
                return prev;
              });
            }
          }
        } else if (data.type === 'approve-question') {
          setQuestionMessages(prev => {
            const newQuestions = [...prev, data.message];
            return newQuestions.length > 200 ? newQuestions.slice(-150) : newQuestions;
          });
        } else if (data.type === 'webinar-ended') {
          toast({
            title: "Webinar Ended",
            description: "The host has ended the webinar."
          });
          // Clean up before redirect
          leaveCall();
          setTimeout(() => navigate('/'), 3000);
        } else if (data.type === 'presentation-update') {
          if (data.presentationUrl) {
            setPdfUrl(data.presentationUrl);
            setShowPDF(true);
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    socket.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error('WebSocket error:', error);
      setIsWebsocketConnected(false);
    };
    
    socket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log('WebSocket connection closed:', event.code, event.reason);
      setIsWebsocketConnected(false);
      
      // Only attempt reconnect if not a deliberate close
      if (event.code !== 1000 && document.visibilityState !== 'hidden') {
        const backoffDelay = Math.min(1000 * Math.pow(2, Math.random()), 30000); // Exponential backoff with jitter
        setTimeout(() => {
          initializeWebSocket();
        }, backoffDelay);
      }
    };
    
    webSocketRef.current = socket;
  };
  
  // Handle sending chat messages
  const handleSendMessage = () => {
    if (!messageInput.trim() || !isWebsocketConnected || !user || !webinar) return;
    
    const messageData = {
      type: 'send-message',
      messageType: 'chat',
      webinarId: webinar.id,
      uniqueId: uniqueId,
      userId: user.id,
      userName: user.username || user.email,
      message: messageInput.trim()
    };
    
    webSocketRef.current?.send(JSON.stringify(messageData));
    setMessageInput('');
  };
  
  // Handle sending questions
  const handleSendQuestion = () => {
    if (!questionInput.trim() || !isWebsocketConnected || !user || !webinar) return;
    
    const questionData = {
      type: 'send-message',
      messageType: 'question',
      webinarId: webinar.id,
      uniqueId: uniqueId,
      userId: user.id,
      userName: user.username || user.email,
      message: questionInput.trim()
    };
    
    webSocketRef.current?.send(JSON.stringify(questionData));
    setQuestionInput('');
    
    // If questions are moderated, show a toast to inform the user
    if (webinar.settings?.moderateQuestions) {
      toast({
        title: "Question Submitted",
        description: "Your question has been submitted and will be reviewed by the host.",
      });
    }
  };
  
  // Initialize Agora client with performance optimizations
  const initializeAgoraClient = async () => {
    try {
      if (!webinar) return;
      
      // Initialize the Agora client with optimized settings
      const client = AgoraRTC.createClient({ 
        mode: 'live', 
        codec: 'vp8'
      });
      agoraClientRef.current = client;
      
      // Set role based on user type (host only for now, attendee for everyone else)
      await client.setClientRole('audience');
      
      // Set up event handlers with error handling
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);
      client.on('connection-state-change', (curState, revState) => {
        console.log(`Agora connection state changed from ${revState} to ${curState}`);
        if (curState === 'DISCONNECTED') {
          toast({
            title: "Connection Issue",
            description: "Video connection lost. Attempting to reconnect...",
            variant: "destructive"
          });
        }
      });
      
      // Join the channel with retry logic
      const publicRoomId = webinar.publicRoomId || webinar.id.toString();
      const publicToken = webinar.publicRoomToken || null;
      const uid = user?.id.toString() || `attendee-${Math.floor(Math.random() * 100000)}`;
      
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await client.join(
            import.meta.env.VITE_AGORA_APP_ID || '',
            publicRoomId,
            publicToken,
            uid
          );
          console.log('Successfully joined Agora channel');
          break;
        } catch (joinError) {
          retryCount++;
          console.warn(`Agora join attempt ${retryCount} failed:`, joinError);
          
          if (retryCount >= maxRetries) {
            throw joinError;
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // Subscribe to existing users in the channel
      const remoteUsers = client.remoteUsers;
      for (const user of remoteUsers) {
        if (user.hasAudio) {
          await client.subscribe(user, 'audio').catch(console.error);
        }
        if (user.hasVideo) {
          await client.subscribe(user, 'video').catch(console.error);
        }
      }
      
    } catch (err) {
      console.error('Failed to initialize Agora client:', err);
      toast({
        title: "Video Error",
        description: "Failed to connect to the live stream. Please check your internet connection and refresh the page.",
        variant: "destructive"
      });
    }
  };
  
  // Handle when a remote user publishes a stream
  const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    await agoraClientRef.current?.subscribe(user, mediaType);
    
    // If the user published a video track, play it
    if (mediaType === 'video' && user.videoTrack) {
      setRemoteUsers(prevUsers => {
        if (prevUsers.find(existingUser => existingUser.uid === user.uid)) {
          return prevUsers.map(existingUser => 
            existingUser.uid === user.uid ? user : existingUser
          );
        } else {
          return [...prevUsers, user];
        }
      });
      
      // Play the video in the container
      if (remotePlayerContainerRef.current) {
        user.videoTrack.play(remotePlayerContainerRef.current);
      }
    }
    
    // If the user published an audio track, play it
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play();
    }
  };
  
  // Handle when a remote user unpublishes a stream
  const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
    setRemoteUsers(prevUsers => 
      prevUsers.filter(existingUser => existingUser.uid !== user.uid)
    );
  };
  
  // Leave the call and clean up resources
  const leaveCall = async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      
      if (localVideoTrack) {
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      
      await agoraClientRef.current?.leave();
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  };
  
  // Register attendance
  useEffect(() => {
    const registerAttendance = async () => {
      if (webinar && user) {
        try {
          await fetch(`/api/public/webinars/${uniqueId}/register-attendance`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              isLive: true  // Mark that they attended the live webinar
            })
          });
        } catch (err) {
          console.error("Failed to register attendance:", err);
        }
      }
    };
    
    registerAttendance();
    
    // Set up heartbeat to update attendance duration
    const intervalId = setInterval(() => {
      if (webinar && user) {
        fetch(`/api/public/webinars/${uniqueId}/update-attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: user.id
          })
        }).catch(err => {
          console.error("Failed to update attendance:", err);
        });
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [webinar, user, uniqueId]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="w-full max-w-xl">
          <div className="flex justify-center mb-8">
            <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Joining Webinar</h1>
          <p className="text-center text-gray-600">
            Please wait while we connect you to the live session...
          </p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="w-full max-w-xl">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
            <p className="text-center">Error: {error.message}</p>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={() => navigate("/")}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!webinar) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Webinar Not Found</h1>
            <p className="text-gray-600">
              The webinar you're looking for doesn't exist or has ended.
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={() => navigate("/")}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white py-2 px-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white mr-2"
            onClick={() => {
              if (confirm("Are you sure you want to leave the webinar?")) {
                navigate("/");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Leave
          </Button>
          <h1 className="font-bold truncate max-w-[300px]">{webinar.title}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center rounded-full bg-green-700 px-3 py-1 text-xs">
            <Users className="h-3 w-3 mr-1" />
            <span>Live</span>
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left side - Video and presentation area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Video container */}
          <div className="relative w-full h-[40vh] md:h-full bg-black flex items-center justify-center">
            {/* Remote streams (host video) */}
            <div
              ref={remotePlayerContainerRef}
              className="w-full h-full bg-black overflow-hidden flex items-center justify-center"
            >
              {remoteUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center text-white">
                  <Video className="h-12 w-12 mb-2 text-gray-400" />
                  <p>Waiting for the host to start the video...</p>
                </div>
              )}
            </div>
            
            {/* PDF Presentation overlay */}
            {showPDF && pdfUrl && (
              <div className="absolute inset-0 bg-black flex flex-col">
                <div className="flex justify-between items-center p-2 bg-gray-800">
                  <p className="text-white text-sm font-medium">Presentation</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white"
                    onClick={() => setShowPDF(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 w-full overflow-auto">
                  <iframe
                    src={`${pdfUrl}#toolbar=0`}
                    className="w-full h-full border-0"
                    title="Presentation"
                  />
                </div>
              </div>
            )}
            
            {/* Live offers overlay */}
            {activeOffers.length > 0 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 max-w-md w-full">
                {activeOffers.map((offer) => (
                  <div 
                    key={offer.id} 
                    className="bg-white rounded-lg shadow-lg p-4 mb-2 animate-pulse max-w-md mx-auto"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{offer.title}</h3>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setActiveOffers(offers => 
                          offers.filter(o => o.id !== offer.id)
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        className="font-bold"
                        style={{ backgroundColor: offer.buttonColor || "#22c55e" }}
                        onClick={() => window.open(offer.buttonLink, '_blank')}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {offer.buttonText || "Buy Now"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right side - Chat, questions, controls */}
        <div className="w-full md:w-96 bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex flex-col h-[60vh] md:h-full overflow-hidden">
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-2 mx-4 mt-4">
              <TabsTrigger value="chat">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              {webinar.settings?.allowQuestions && (
                <TabsTrigger value="questions">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Questions
                </TabsTrigger>
              )}
            </TabsList>
            
            {/* Chat tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden mb-4 pr-2 space-y-3"
              >
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                    <MessageSquare className="h-8 w-8 mb-2" />
                    <p>No messages yet</p>
                    <p className="text-sm">Be the first to send a message!</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className="break-words">
                      {message.type === 'offer' && message.offerData ? (
                        <div className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-bold text-green-400">{message.userName}</span>
                              <span className="text-xs ml-2 text-gray-400">
                                {format(new Date(message.createdAt), "h:mm a")}
                              </span>
                            </div>
                          </div>
                          <div className="mb-2 bg-gray-600 p-2 rounded-md">
                            <p className="font-bold text-white text-sm">{message.offerData?.title || "Special Offer"}</p>
                            <div className="flex justify-end mt-2">
                              <Button
                                className="font-bold text-xs md:text-sm px-2 py-1"
                                style={{ backgroundColor: message.offerData?.buttonColor || "#22c55e" }}
                                size="sm"
                                onClick={() => window.open(message.offerData?.buttonLink || '#', '_blank')}
                              >
                                {message.offerData?.buttonText || "Buy Now"}
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center">
                            <span className="font-bold text-green-400">{message.userName}</span>
                            <span className="text-xs ml-2 text-gray-400">
                              {format(new Date(message.createdAt), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-white">{message.message}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              {webinar.settings?.allowChat && (
                <div className="mt-auto">
                  <div className="flex items-end space-x-2">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[60px] bg-gray-700 border-gray-600 text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || !isWebsocketConnected}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Questions tab */}
            {webinar.settings?.allowQuestions && (
              <TabsContent value="questions" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
                <div 
                  ref={questionContainerRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden mb-4 pr-2 space-y-4"
                >
                  {questionMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                      <HelpCircle className="h-8 w-8 mb-2" />
                      <p>No questions yet</p>
                      <p className="text-sm">Ask the first question!</p>
                    </div>
                  ) : (
                    questionMessages.map((question) => (
                      <div key={question.id} className="bg-gray-700 rounded-lg p-3 break-words">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-green-400">{question.userName}</span>
                            <span className="text-xs ml-2 text-gray-400">
                              {format(new Date(question.createdAt), "h:mm a")}
                            </span>
                          </div>
                          {webinar.settings?.moderateQuestions && question.isApproved && (
                            <div className="bg-green-700 text-white text-xs py-1 px-2 rounded-full flex items-center">
                              <Check className="h-3 w-3 mr-1" />
                              Approved
                            </div>
                          )}
                        </div>
                        <p className="text-white">{question.message}</p>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-auto">
                  <div className="flex items-end space-x-2">
                    <Textarea
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder="Ask a question..."
                      className="min-h-[60px] bg-gray-700 border-gray-600 text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendQuestion();
                        }
                      }}
                    />
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSendQuestion}
                      disabled={!questionInput.trim() || !isWebsocketConnected}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {webinar.settings?.moderateQuestions && (
                    <p className="text-xs text-gray-400 mt-2">
                      Questions will be reviewed by the host before appearing publicly.
                    </p>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
      
      {/* Bottom bar with controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-3 flex justify-center">
        <div className="flex space-x-2">
          {/* View presentation button */}
          {pdfUrl && (
            <Button
              variant={showPDF ? "default" : "outline"}
              className={showPDF ? "bg-green-600 hover:bg-green-700" : "text-white"}
              size="sm"
              onClick={() => setShowPDF(!showPDF)}
            >
              {showPDF ? "Hide Presentation" : "Show Presentation"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}