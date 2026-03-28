import { Card, CardContent } from "@/components/ui/card";
import { Star, StarHalf } from "lucide-react";

interface TestimonialCardProps {
  name: string;
  role: string;
  rating: number; // Out of 5
  content: string;
}

export function TestimonialCard({ name, role, rating, content }: TestimonialCardProps) {
  // Generate star icons based on rating
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="h-5 w-5 text-yellow-400 fill-current" />);
    }
    
    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="h-5 w-5 text-yellow-400 fill-current" />);
    }
    
    // Fill remaining with empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="h-5 w-5 text-yellow-400" />);
    }
    
    return stars;
  };

  return (
    <Card className="bg-white p-6 rounded-lg shadow-md h-full">
      <CardContent className="p-0">
        <div className="flex items-center mb-4">
          <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
            <i className="fas fa-user text-gray-500"></i>
          </div>
          <div>
            <h4 className="font-medium">{name}</h4>
            <p className="text-sm text-gray-500">{role}</p>
          </div>
        </div>
        <div className="flex mb-4 text-yellow-400">
          {renderStars()}
        </div>
        <p className="text-gray-600">{content}</p>
      </CardContent>
    </Card>
  );
}
