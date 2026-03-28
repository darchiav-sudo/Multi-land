import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, Clock, Users, Video, ArrowLeft } from "lucide-react";

interface WebinarDetailsProps {
  title: string;
  instructorName: string;
  scheduledStartTime: string;
  timezone: string;
  maxParticipants: number;
  remainingTime: string | null;
}

function WebinarDetails({
  title,
  instructorName,
  scheduledStartTime,
  timezone,
  maxParticipants,
  remainingTime
}: WebinarDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-slate-500" />
            <span>{scheduledStartTime}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-slate-500" />
            <span>Timezone: {timezone}</span>
          </div>
          <div className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-slate-500" />
            <span>Maximum attendees: {maxParticipants}</span>
          </div>
          <div className="flex items-center">
            <Video className="h-5 w-5 mr-2 text-slate-500" />
            <span>Host: {instructorName}</span>
          </div>
          
          {remainingTime && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-center text-green-700 font-medium">
                Starting in {remainingTime}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WebinarWaitingRoom() {
  const { uniqueId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [webinar, setWebinar] = useState<any | null>(null);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  // Poll for webinar status and remaining time
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
        
        // Check if webinar is already live
        if (data.status === "live") {
          setIsLive(true);
          // Redirect to the live room
          navigate(`/webinar/${uniqueId}/live`);
          return;
        }
        
        // Calculate time until webinar starts
        if (data.scheduledStartTime) {
          const startTime = new Date(data.scheduledStartTime);
          const now = new Date();
          const diff = startTime.getTime() - now.getTime();
          
          if (diff <= 0) {
            // Webinar should be starting soon, check if it's live
            const liveCheckRes = await fetch(`/api/public/webinars/${uniqueId}/status`);
            const liveStatus = await liveCheckRes.json();
            
            if (liveStatus.status === "live") {
              setIsLive(true);
              navigate(`/webinar/${uniqueId}/live`);
              return;
            } else {
              setRemainingTime("any moment now");
            }
          } else {
            // Format remaining time
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (hours > 0) {
              setRemainingTime(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
              setRemainingTime(`${minutes}m ${seconds}s`);
            } else {
              setRemainingTime(`${seconds}s`);
            }
          }
        }
      } catch (err) {
        setError(err as Error);
        toast({
          title: "Error",
          description: `Failed to fetch webinar details: ${(err as Error).message}`,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Call immediately
    fetchWebinarDetails();
    
    // Then poll every 5 seconds
    const intervalId = setInterval(fetchWebinarDetails, 5000);
    
    return () => clearInterval(intervalId);
  }, [uniqueId, navigate, toast]);
  
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
              email: user.email
            })
          });
          // No need to alert the user about this backend operation
        } catch (err) {
          console.error("Failed to register attendance:", err);
          // Silent failure - don't bother the user with this error
        }
      }
    };
    
    registerAttendance();
  }, [webinar, user, uniqueId]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="w-full max-w-xl">
          <div className="flex justify-center mb-8">
            <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Loading Webinar</h1>
          <p className="text-center text-gray-600">
            Please wait while we prepare the webinar room...
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
              The webinar you're looking for doesn't exist or has been cancelled.
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
  
  // Format the scheduled start time
  const formattedStartTime = format(
    new Date(webinar.scheduledStartTime),
    "MMM d, yyyy 'at' h:mm a"
  );
  
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="mb-4 self-start"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Webinar Waiting Room</h1>
            <p className="text-gray-600">
              The host will admit you when the webinar begins.
            </p>
          </div>
        </div>
        
        <WebinarDetails
          title={webinar.title}
          instructorName={webinar.instructorName}
          scheduledStartTime={formattedStartTime}
          timezone={webinar.settings?.timezone || "GMT+0"}
          maxParticipants={webinar.settings?.maxParticipants || 2000}
          remainingTime={remainingTime}
        />
        
        <div className="mt-6 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-medium mb-4">Preparing to Join</h2>
          <p className="mb-3">
            While you wait for the webinar to begin:
          </p>
          <ul className="space-y-2 list-disc pl-5 mb-4">
            <li>Make sure your internet connection is stable</li>
            <li>Test your audio - you'll need speakers or headphones</li>
            <li>Close unnecessary applications to optimize performance</li>
            <li>You'll be automatically redirected when the webinar begins</li>
          </ul>
          <div className="flex justify-center mt-4">
            <Button 
              disabled={!isLive}
              onClick={() => navigate(`/webinar/${uniqueId}/live`)}
              className="bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Video className="h-5 w-5 mr-2" />
              {isLive ? "Join Webinar Now" : "Waiting for Host to Start"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}