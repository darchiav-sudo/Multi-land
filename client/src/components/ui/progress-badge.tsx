import { cn } from "@/lib/utils";

interface ProgressBadgeProps {
  progress: number; // 0-100
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressBadge({ 
  progress, 
  size = "md", 
  className 
}: ProgressBadgeProps) {
  // Determine color based on progress
  const getColor = () => {
    if (progress < 25) return "bg-red-100 text-red-800";
    if (progress < 50) return "bg-orange-100 text-orange-800";
    if (progress < 75) return "bg-yellow-100 text-yellow-800";
    if (progress < 100) return "bg-blue-100 text-blue-800";
    return "bg-green-100 text-green-800";
  };

  // Determine size
  const getSize = () => {
    switch (size) {
      case "sm": return "text-xs px-2 py-0.5";
      case "lg": return "text-sm px-3 py-1.5";
      default: return "text-xs px-2.5 py-1"; // md
    }
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        getSize(),
        getColor(),
        className
      )}
    >
      {progress === 100 ? (
        "Complete"
      ) : (
        `${progress}% Complete`
      )}
    </span>
  );
}
