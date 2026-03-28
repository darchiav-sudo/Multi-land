import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// Define preset colors and gradients
const BANNER_COLORS = [
  // Solid colors
  { name: "Black", value: "#000000", type: "solid" },
  { name: "Green", value: "#4caf50", type: "solid" },
  { name: "Dark Green", value: "#2e7d32", type: "solid" },
  { name: "Light Green", value: "#81c784", type: "solid" },
  { name: "Gray", value: "#616161", type: "solid" },
  { name: "Dark Gray", value: "#212121", type: "solid" },
  
  // Gradients
  { name: "Dark Green Gradient", value: "linear-gradient(to right, #000000, #2e7d32)", type: "gradient" },
  { name: "Green Gradient", value: "linear-gradient(to right, #000000, #4caf50)", type: "gradient" },
  { name: "Black-Gray Gradient", value: "linear-gradient(to right, #000000, #616161)", type: "gradient" },
  { name: "Green-Light Gradient", value: "linear-gradient(to bottom, #2e7d32, #81c784)", type: "gradient" },
];

interface CourseBannerGeneratorProps {
  initialText?: string;
  initialBgColor?: string;
  onBannerGenerated: (imageData: string) => void;
}

export function CourseBannerGenerator({
  initialText = "",
  initialBgColor = "#000000",
  onBannerGenerated,
}: CourseBannerGeneratorProps) {
  const [bannerText, setBannerText] = useState(initialText);
  const [backgroundColor, setBackgroundColor] = useState(initialBgColor);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Function to generate/update the banner
  const generateBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas dimensions - match the aspect ratio we're using for course banners (30% height)
    const width = 800;
    const height = 240; // 30% of width
    
    canvas.width = width;
    canvas.height = height;

    // Check if the background is a gradient
    if (backgroundColor.startsWith('linear-gradient')) {
      // Create temporary canvas for gradient
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // Extract gradient direction and colors
        const gradientInfo = backgroundColor.match(/linear-gradient\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
        
        if (gradientInfo) {
          const direction = gradientInfo[1].trim();
          const startColor = gradientInfo[2].trim();
          const endColor = gradientInfo[3].trim();
          
          let gradient;
          if (direction === 'to right') {
            gradient = tempCtx.createLinearGradient(0, 0, width, 0);
          } else if (direction === 'to bottom') {
            gradient = tempCtx.createLinearGradient(0, 0, 0, height);
          } else if (direction === 'to left') {
            gradient = tempCtx.createLinearGradient(width, 0, 0, 0);
          } else if (direction === 'to top') {
            gradient = tempCtx.createLinearGradient(0, height, 0, 0);
          } else {
            // Default to right if direction is not recognized
            gradient = tempCtx.createLinearGradient(0, 0, width, 0);
          }
          
          gradient.addColorStop(0, startColor);
          gradient.addColorStop(1, endColor);
          
          tempCtx.fillStyle = gradient;
          tempCtx.fillRect(0, 0, width, height);
          
          // Copy the gradient to the main canvas
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    } else {
      // Fill with solid background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Add text
    ctx.fillStyle = textColor;
    ctx.font = "bold 32px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Limit text to 15 characters
    const displayText = bannerText.substring(0, 15);
    ctx.fillText(displayText, width / 2, height / 2);

    // Get image data and pass it to the callback
    const imageData = canvas.toDataURL("image/png");
    onBannerGenerated(imageData);
  };

  // Generate the banner on initial load and when options change
  useEffect(() => {
    generateBanner();
  }, [bannerText, backgroundColor, textColor]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Course Banner Generator</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a custom banner for your course
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="banner-text">Banner Text (max 15 characters)</Label>
            <Input
              id="banner-text"
              value={bannerText}
              onChange={(e) => {
                const newText = e.target.value;
                if (newText.length > 15) {
                  toast({
                    title: "Text limit reached",
                    description: "Maximum 15 characters allowed",
                  });
                }
                setBannerText(newText.substring(0, 15));
              }}
              placeholder="Enter banner text"
              maxLength={15}
            />
            <p className="text-xs text-gray-500">{bannerText.length}/15 characters</p>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="background-color">Background Color</Label>
            <Select
              value={backgroundColor}
              onValueChange={setBackgroundColor}
            >
              <SelectTrigger id="background-color">
                <SelectValue placeholder="Select background color" />
              </SelectTrigger>
              <SelectContent>
                {BANNER_COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={
                          color.type === 'gradient' 
                            ? { background: color.value } 
                            : { backgroundColor: color.value }
                        }
                      ></div>
                      {color.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="text-color">Text Color</Label>
            <Select
              value={textColor}
              onValueChange={setTextColor}
            >
              <SelectTrigger id="text-color">
                <SelectValue placeholder="Select text color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="#FFFFFF">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                      style={{ backgroundColor: "#FFFFFF" }}
                    ></div>
                    White
                  </div>
                </SelectItem>
                <SelectItem value="#000000">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: "#000000" }}
                    ></div>
                    Black
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
            />
          </div>

          <Button 
            onClick={generateBanner} 
            className="w-full bg-black hover:bg-gray-800 text-white"
          >
            Regenerate Banner
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}