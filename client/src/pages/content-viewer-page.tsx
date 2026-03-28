/**
 * This page is being replaced by the new lesson-viewer-page.tsx
 * We're keeping this file for backward compatibility and redirecting users to the new page
 */
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function ContentViewerPage() {
  // Get URL parameters
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const [, navigate] = useLocation();
  
  // Redirect to the new lesson page format
  useEffect(() => {
    if (courseId && contentId) {
      navigate(`/lesson/${courseId}/${contentId}`);
    }
  }, [courseId, contentId, navigate]);
  
  // Show loading indicator while redirecting
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex justify-center items-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
          <p>Redirecting to new lesson viewer...</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}