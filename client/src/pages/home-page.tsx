import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold mb-8">Multi Land</h1>
          
          <div className="flex flex-col space-y-4 items-center">
            {user?.isAdmin && (
              <Link href="/admin">
                <Button className="w-48 bg-black hover:bg-gray-800 text-white">
                  Admin Dashboard
                </Button>
              </Link>
            )}
            
            {!user && (
              <Link href="/auth">
                <Button className="w-48 bg-black hover:bg-gray-800 text-white">
                  Sign In
                </Button>
              </Link>
            )}
            
            {user && !user.isAdmin && (
              <Link href="/my-learning">
                <Button className="w-48 bg-black hover:bg-gray-800 text-white">
                  My Learning
                </Button>
              </Link>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
