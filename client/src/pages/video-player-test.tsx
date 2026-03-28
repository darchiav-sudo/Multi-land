import { useState } from "react";
import { useLocation } from "wouter";
import MultiPlayerVideo from "@/components/MultiPlayerVideo";
import UniversalVideoPlayer from "@/components/UniversalVideoPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VideoPlayerTestPage() {
  const [, setLocation] = useLocation();
  const [testUrl, setTestUrl] = useState<string>('/uploads/content-files/sample-video.mp4');
  const [posterUrl, setPosterUrl] = useState<string>('');
  
  // List of test videos to try
  const testVideos = [
    { name: 'Sample MP4', url: '/uploads/content-files/sample-video.mp4' },
    { name: 'Sample WebM', url: '/uploads/content-files/sample-video.webm' },
    { name: 'High quality', url: '/uploads/content-files/1080p-sample.mp4' },
    { name: 'Mobile optimized', url: '/uploads/content-files/360p-mobile.mp4' },
    { name: 'External HLS', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' }
  ];
  
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Video Player Test</h1>
        <Button variant="outline" onClick={() => setLocation('/admin')}>
          Back to Admin
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>Configure video URLs to test across different players</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="video-url">Video URL</Label>
                  <Input 
                    id="video-url" 
                    placeholder="Enter video URL" 
                    value={testUrl}
                    onChange={e => setTestUrl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="poster-url">Poster Image URL (optional)</Label>
                  <Input 
                    id="poster-url" 
                    placeholder="Enter poster image URL" 
                    value={posterUrl}
                    onChange={e => setPosterUrl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Test Videos</Label>
                  <div className="flex flex-wrap gap-2">
                    {testVideos.map((video, idx) => (
                      <Button 
                        key={idx} 
                        variant="outline" 
                        size="sm"
                        onClick={() => setTestUrl(video.url)}
                      >
                        {video.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
              <CardDescription>Current browser and device details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-medium">User Agent:</span> 
                  <span className="block mt-1 text-muted-foreground text-xs break-words">
                    {navigator.userAgent}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Screen Size:</span> 
                  <span className="ml-2">{window.innerWidth}x{window.innerHeight}</span>
                </div>
                <div>
                  <span className="font-medium">Mobile:</span> 
                  <span className="ml-2">
                    {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                      ? 'Yes'
                      : 'No'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Tabs defaultValue="multi">
        <TabsList className="mb-6">
          <TabsTrigger value="multi">MultiPlayer</TabsTrigger>
          <TabsTrigger value="universal">Universal Player</TabsTrigger>
        </TabsList>
        
        <TabsContent value="multi">
          <Card>
            <CardHeader>
              <CardTitle>MultiPlayerVideo Component</CardTitle>
              <CardDescription>
                Test with multiple player options (Universal, HTML5, Simple, Mobile)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MultiPlayerVideo 
                src={testUrl} 
                poster={posterUrl || undefined}
                title="Test Video"
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="universal">
          <Card>
            <CardHeader>
              <CardTitle>UniversalVideoPlayer Component</CardTitle>
              <CardDescription>
                Cross-device optimized player with enhanced error handling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UniversalVideoPlayer 
                src={testUrl} 
                poster={posterUrl || undefined}
                title="Test Video"
                onError={(error) => console.error("Player error:", error)}
                onReady={() => console.log("Player ready")}
                onPlay={() => console.log("Video started playing")}
                onPause={() => console.log("Video paused")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Video playback troubleshooting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Common Issues:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Video format not supported by the browser</li>
                  <li>CORS issues with external video sources</li>
                  <li>Missing range request headers on server</li>
                  <li>Network connectivity issues</li>
                  <li>Mobile-specific playback restrictions</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Playback Tips:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Switch player types if one fails</li>
                  <li>Try lower resolution videos on slow connections</li>
                  <li>Use MP4 format for best compatibility</li>
                  <li>HLS (.m3u8) streams work well for adaptive bitrate</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}