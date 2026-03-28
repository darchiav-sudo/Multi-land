import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Settings, Play, Volume2, Volume1, VolumeX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import UniversalVideoPlayer from '@/components/UniversalVideoPlayer';

// Test URLs for different video qualities
const SAMPLE_VIDEOS = [
  { 
    name: 'Test Video 1 (480p)',
    url: '/api/stream/sample-480p.mp4',
    quality: '480p'
  },
  { 
    name: 'Test Video 2 (720p)',
    url: '/api/stream/sample-720p.mp4',
    quality: '720p'
  },
  { 
    name: 'Test Video 3 (1080p)',
    url: '/api/stream/sample-1080p.mp4',
    quality: '1080p'
  },
  {
    name: 'Custom URL',
    url: '',
    quality: 'custom'
  }
];

export default function VideoPlayerTestPage() {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [playbackUrl, setPlaybackUrl] = useState<string>(SAMPLE_VIDEOS[0].url);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [logMessages, setLogMessages] = useState<Array<{type: string, message: string, timestamp: number}>>([]);
  const [networkStatus, setNetworkStatus] = useState<{online: boolean, speed?: string}>({
    online: true
  });
  const [activeTab, setActiveTab] = useState<string>('player');

  // Add a log message
  const addLog = (type: 'info' | 'error' | 'success', message: string) => {
    setLogMessages(prev => [
      { type, message, timestamp: Date.now() },
      ...prev.slice(0, 49) // Keep last 50 messages
    ]);
  };

  // Handle video selection
  const handleVideoSelect = (index: number) => {
    setSelectedVideoIndex(index);
    // If it's not the custom URL option
    if (index < SAMPLE_VIDEOS.length - 1) {
      setPlaybackUrl(SAMPLE_VIDEOS[index].url);
      addLog('info', `Selected video: ${SAMPLE_VIDEOS[index].name}`);
    } else {
      // For custom URL, use the input value
      setPlaybackUrl(customUrl);
      addLog('info', 'Using custom URL: ' + (customUrl || '[empty]'));
    }
  };

  // Handle custom URL changes
  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomUrl(e.target.value);
  };

  // Apply custom URL
  const applyCustomUrl = () => {
    if (customUrl) {
      setPlaybackUrl(customUrl);
      addLog('info', 'Applied custom URL: ' + customUrl);
    } else {
      addLog('error', 'Custom URL is empty');
    }
  };

  // Handle play button click
  const handlePlayClick = () => {
    addLog('info', 'Play requested manually');
  };

  // Handle video error
  const handleVideoError = (error: string) => {
    addLog('error', `Playback error: ${error}`);
  };

  // Handle video play
  const handleVideoPlay = () => {
    addLog('success', 'Video playback started successfully');
  };

  // Detect network status and speed
  useEffect(() => {
    const checkNetwork = async () => {
      const online = navigator.onLine;
      setNetworkStatus(prev => ({...prev, online}));
      
      if (online) {
        try {
          addLog('info', 'Checking network connection speed...');
          
          // Start time
          const startTime = Date.now();
          
          // Fetch a small test file to measure speed
          // The size is approximately 100KB
          const response = await fetch('/api/network-test?size=100');
          if (!response.ok) throw new Error('Network test failed');
          
          // End time
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000; // in seconds
          
          // Get the actual size from headers if available, or use the 100KB estimate
          const contentLength = parseInt(response.headers.get('content-length') || '102400', 10);
          const speedKbps = Math.round((contentLength * 8) / duration / 1000); // in Kbps
          
          let speedDescription;
          if (speedKbps < 500) {
            speedDescription = `Slow (${speedKbps} Kbps)`;
          } else if (speedKbps < 1500) {
            speedDescription = `Medium (${speedKbps} Kbps)`;
          } else {
            speedDescription = `Fast (${speedKbps} Kbps)`;
          }
          
          setNetworkStatus(prev => ({...prev, speed: speedDescription}));
          addLog('success', `Network speed: ${speedDescription}`);
        } catch (error) {
          console.error('Error checking network speed:', error);
          addLog('error', 'Failed to check network speed');
          setNetworkStatus(prev => ({...prev, speed: 'Unknown'}));
        }
      } else {
        addLog('error', 'Currently offline');
        setNetworkStatus({online: false});
      }
    };
    
    checkNetwork();
    
    // Set up network status change listeners
    const handleOnline = () => {
      addLog('success', 'Network connection restored');
      checkNetwork();
    };
    
    const handleOffline = () => {
      addLog('error', 'Network connection lost');
      setNetworkStatus({online: false});
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container px-4 py-6 pt-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="flex items-center">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Video Player Testing</h1>
          </div>
          
          <Badge 
            variant={networkStatus.online ? 'outline' : 'destructive'}
            className="flex items-center gap-1"
          >
            {networkStatus.online 
              ? <>Online {networkStatus.speed && `- ${networkStatus.speed}`}</>
              : <>Offline</>
            }
          </Badge>
        </div>

        <Tabs defaultValue="player" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="player">Player</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="player" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Playback Test</CardTitle>
                <CardDescription>Test video playback with different formats and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                  <UniversalVideoPlayer
                    src={playbackUrl}
                    controls={showControls}
                    muted={isMuted}
                    autoPlay={isAutoPlay}
                    loop={isLooping}
                    onError={handleVideoError}
                    onPlay={handleVideoPlay}
                    className="w-full h-full"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <div className="flex-1 min-w-[250px]">
                    <Select value={selectedVideoIndex.toString()} onValueChange={(value) => handleVideoSelect(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a test video" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Test Videos</SelectLabel>
                          {SAMPLE_VIDEOS.map((video, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {video.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={handlePlayClick}
                    className="flex items-center"
                    disabled={!playbackUrl}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Play
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <><VolumeX className="h-4 w-4 mr-1" /> Unmute</>
                    ) : (
                      <><Volume2 className="h-4 w-4 mr-1" /> Mute</>
                    )}
                  </Button>
                </div>
                
                {selectedVideoIndex === SAMPLE_VIDEOS.length - 1 && (
                  <div className="flex gap-2 mt-4">
                    <Input
                      placeholder="Enter custom video URL"
                      value={customUrl}
                      onChange={handleCustomUrlChange}
                      className="flex-1"
                    />
                    <Button onClick={applyCustomUrl} disabled={!customUrl}>
                      Apply
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col items-start space-y-4">
                <div className="w-full">
                  <h3 className="text-sm font-medium mb-2">Current Settings</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="font-medium">Controls</div>
                      <div className="text-muted-foreground">{showControls ? 'Shown' : 'Hidden'}</div>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="font-medium">AutoPlay</div>
                      <div className="text-muted-foreground">{isAutoPlay ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="font-medium">Loop</div>
                      <div className="text-muted-foreground">{isLooping ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="font-medium">Audio</div>
                      <div className="text-muted-foreground">{isMuted ? 'Muted' : 'Enabled'}</div>
                    </div>
                  </div>
                </div>
                {networkStatus.speed && (
                  <Alert className="w-full">
                    <AlertDescription>
                      Based on your network speed ({networkStatus.speed}), we recommend:
                      {networkStatus.speed.includes('Slow') ? (
                        <strong className="block mt-1">480p video quality</strong>
                      ) : networkStatus.speed.includes('Medium') ? (
                        <strong className="block mt-1">720p video quality</strong>
                      ) : (
                        <strong className="block mt-1">1080p or higher video quality</strong>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Player Settings</CardTitle>
                <CardDescription>Configure video player behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-controls">Show Player Controls</Label>
                      <div className="text-sm text-muted-foreground">
                        Display play, pause, and other media controls
                      </div>
                    </div>
                    <Switch
                      id="show-controls"
                      checked={showControls}
                      onCheckedChange={setShowControls}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoplay">Autoplay</Label>
                      <div className="text-sm text-muted-foreground">
                        Start playing automatically when loaded (may not work on mobile)
                      </div>
                    </div>
                    <Switch
                      id="autoplay"
                      checked={isAutoPlay}
                      onCheckedChange={setIsAutoPlay}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="loop">Loop Playback</Label>
                      <div className="text-sm text-muted-foreground">
                        Replay video when it ends
                      </div>
                    </div>
                    <Switch
                      id="loop"
                      checked={isLooping}
                      onCheckedChange={setIsLooping}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="muted">Mute Audio</Label>
                      <div className="text-sm text-muted-foreground">
                        Disable sound during playback
                      </div>
                    </div>
                    <Switch
                      id="muted"
                      checked={isMuted}
                      onCheckedChange={setIsMuted}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setActiveTab('player');
                    addLog('info', 'Applied settings changes');
                  }}
                >
                  Apply and Return to Player
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Event Logs</CardTitle>
                  <CardDescription>Video player events and diagnostic messages</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLogMessages([])}
                  className="h-8"
                >
                  Clear Logs
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-md border p-2">
                  {logMessages.length > 0 ? (
                    <div className="space-y-2">
                      {logMessages.map((log, index) => (
                        <div 
                          key={index} 
                          className={`p-2 rounded text-sm ${
                            log.type === 'error' 
                              ? 'bg-red-50 text-red-900 border-l-4 border-red-500' 
                              : log.type === 'success'
                                ? 'bg-green-50 text-green-900 border-l-4 border-green-500'
                                : 'bg-gray-50 text-gray-900 border-l-4 border-gray-500'
                          }`}
                        >
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{log.type.toUpperCase()}</span>
                            <span className="text-xs opacity-70">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p>{log.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center text-muted-foreground">
                      <RefreshCw className="h-10 w-10 mb-2 opacity-20" />
                      <p>No logs yet. Start playing videos to see events.</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}