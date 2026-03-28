import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Course, Category } from "@shared/schema";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CourseCard } from "@/components/course-card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";

export default function CoursesPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get query parameters
  const params = new URLSearchParams(location.split("?")[1]);
  const categoryParam = params.get("category");
  
  // State for filter and search
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  
  // Fetch all courses
  const { 
    data: courses, 
    isLoading: isLoadingCourses 
  } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });
  
  // Fetch categories for filter
  const { 
    data: categories, 
    isLoading: isLoadingCategories 
  } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  // Filter courses based on category and search query
  useEffect(() => {
    if (courses) {
      let filtered = [...courses];
      
      // Only show published courses
      filtered = filtered.filter(course => course.published);
      
      if (selectedCategory && selectedCategory !== "all") {
        filtered = filtered.filter(
          course => course.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          course => 
            course.title.toLowerCase().includes(query) || 
            course.description.toLowerCase().includes(query)
        );
      }
      
      setFilteredCourses(filtered);
    }
  }, [courses, selectedCategory, searchQuery]);
  
  // Update URL when category changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) {
      params.set("category", selectedCategory);
    }
    const queryString = params.toString();
    const newUrl = `/courses${queryString ? `?${queryString}` : ""}`;
    if (newUrl !== location) {
      navigate(newUrl, { replace: true });
    }
  }, [selectedCategory, navigate, location]);
  
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  

  
  const clearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50">
        {/* Header */}
        <div className="bg-white py-2 border-b">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <h1 className="text-xl font-bold text-gray-900">Courses</h1>
            <p className="text-xs text-gray-600">Discover our range of professional courses</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white border-b py-1">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
              <div className="w-full md:w-1/3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search courses..."
                    className="pl-8 h-9 text-sm"
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
              
              <div className="flex space-x-2 items-center">
                <div className="w-40">
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button variant="ghost" onClick={clearFilters} className="text-gray-500 h-9 px-2 text-sm">
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Course grid */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
          {isLoadingCourses || isLoadingCategories ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-4">
              <h3 className="text-sm font-medium text-gray-900 mb-1">No courses found</h3>
              <p className="text-xs text-gray-500">Try adjusting your search or filter criteria</p>
              <Button onClick={clearFilters} className="mt-2 bg-black hover:bg-gray-800 text-white h-7 text-xs">
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">{filteredCourses.length} courses found</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {filteredCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
