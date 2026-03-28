import { Link } from "wouter";
import { Category } from "@shared/schema";

interface CategoryCardProps {
  category: Category;
}

export function CategoryCard({ category }: CategoryCardProps) {
  // Map category name to icon
  const getIconClass = (iconName: string) => {
    return `fas fa-${iconName}`;
  };

  return (
    <Link href={`/courses?category=${encodeURIComponent(category.name)}`} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 text-center group block overflow-hidden">
        {category.imageUrl ? (
          <div className="w-full h-40 overflow-hidden">
            <img 
              src={category.imageUrl} 
              alt={category.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center bg-gray-100">
            <span className="text-5xl">{category.icon}</span>
          </div>
        )}
        <div className="p-6">
          {!category.imageUrl && (
            <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4 group-hover:bg-blue-200 transition-colors duration-200">
              <i className={`${getIconClass(category.icon)} text-blue-600 text-xl`}></i>
            </div>
          )}
          <h3 className="text-lg font-medium text-gray-900 mb-1">{category.name}</h3>
          <p className="text-sm text-gray-500">{category.courseCount} Courses</p>
        </div>
    </Link>
  );
}
