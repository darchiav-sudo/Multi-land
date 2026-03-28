import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Course } from "@shared/schema";
import { Link } from "wouter";
import { Star } from "lucide-react";

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  
  // Format price from cents to dollars
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(course.price / 100);

  return (
    <Card className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 h-full flex flex-col">
      {/* Image with shorter height */}
      <div className="relative pb-[30%]">
        <img
          src={course.imageUrl || '/course-placeholder.svg'}
          alt={course.title}
          className="absolute h-full w-full object-cover object-center"
        />
      </div>
      <CardContent className="p-3 flex-grow flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs py-0 px-2">
            {course.category}
          </Badge>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">{course.title}</h3>
        <p className="text-gray-500 text-xs mb-2 flex-grow line-clamp-2">{course.description}</p>
        <div className="flex justify-between items-center mt-auto">
          <span className="text-black font-bold text-sm">{formattedPrice}</span>
          <div className="flex gap-1">
            <Link href={`/courses/${course.id}`}>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                Details
              </Button>
            </Link>
            <Link href={`/checkout-page?courseId=${course.id}`}>
              <Button 
                className="bg-black hover:bg-gray-800 text-white h-7 text-xs px-2"
                size="sm"
              >
                Buy Now
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
