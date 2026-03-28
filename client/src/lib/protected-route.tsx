import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useRoute } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  adminOnly = false,
}: {
  path: string;
  component: React.ComponentType<any>;
  adminOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [match, params] = useRoute(path);

  // Enhanced path and user debugging - enabled for troubleshooting
  if (path === "/my-learning") {
    console.log(`[PROTECTED ROUTE DEBUG] My Learning | User:`, user ? { id: user.id, email: user.email } : 'null', 
      `| Loading:`, isLoading, 
      `| Match:`, match, 
      `| Path:`, window.location.pathname);
  }

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check admin access if required
  if (adminOnly && !user.isAdmin) {
    console.warn("Protected route: Admin access denied for", user?.email);
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      <Component {...params} />
    </Route>
  );
}
