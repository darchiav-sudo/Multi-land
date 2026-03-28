import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  UsersRound, 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  TrendingUp,
  ChevronRight,
  Tag,
  Settings,
  ExternalLink
} from "lucide-react";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  // Fetch admin stats
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <h3 className="font-medium">Error Loading Dashboard</h3>
        <p className="text-sm mt-1">There was a problem loading the admin dashboard.</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Users" 
          value={stats.totalUsers}
          description="+12% from last month"
          icon={<UsersRound className="h-6 w-6 text-blue-600" />}
          color="blue"
        />
        <StatsCard 
          title="Active Courses" 
          value={stats.totalCourses}
          description="+3 new this week"
          icon={<BookOpen className="h-6 w-6 text-green-600" />}
          color="green"
        />
        <StatsCard 
          title="Course Completions" 
          value={stats.totalCompletions}
          description="+15% from last month"
          icon={<CheckCircle2 className="h-6 w-6 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-white hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <BookOpen className="h-5 w-5 mr-3 text-green-600" />
              Manage Courses
            </CardTitle>
            <CardDescription>
              Add, edit or remove courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Create and update course content, manage pricing, and organize course materials.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/courses">
              <Button variant="outline" className="w-full flex items-center justify-between">
                Go to Courses <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="bg-white hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <UsersRound className="h-5 w-5 mr-3 text-blue-600" />
              Manage Users
            </CardTitle>
            <CardDescription>
              View and manage user accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Manage user accounts, view enrollments, and track student progress across courses.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/users">
              <Button variant="outline" className="w-full flex items-center justify-between">
                Go to Users <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="bg-white hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Tag className="h-5 w-5 mr-3 text-purple-600" />
              Manage Categories
            </CardTitle>
            <CardDescription>
              Organize courses by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Create and manage course categories to help students find relevant content.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/admin/categories">
              <Button variant="outline" className="w-full flex items-center justify-between">
                Go to Categories <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Courses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentUsers.map((user: any) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                          <UsersRound className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.username}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {/* This would be from aggregated data, using mock for now */}
                      {Math.floor(Math.random() * 5) + 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Recent Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentEnrollments.map((enrollment: any) => (
                  <tr key={enrollment.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.userName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.courseName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(enrollment.amount / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Admin actions */}
      <div className="mt-8">
        <Card className="bg-gray-50 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="flex items-center justify-start space-x-2">
                <ExternalLink className="h-4 w-4" />
                <span>View Live Site</span>
              </Button>
              <Button variant="outline" className="flex items-center justify-start space-x-2">
                <Settings className="h-4 w-4" />
                <span>Site Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "purple" | "red";
}

function StatsCard({ title, value, description, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50",
    green: "bg-green-50",
    yellow: "bg-yellow-50",
    purple: "bg-purple-50",
    red: "bg-red-50",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-full ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        <p className="text-xs text-green-500 mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}
