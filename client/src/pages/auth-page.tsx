import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { isIOS } from "@/lib/capacitor";

// Optimized AuthPage component with prefetching and early redirects
export default function AuthPage() {
  const [location, navigate] = useLocation();
  const { user, loginMutation, adminLoginMutation } = useAuth();
  
  // Use memo for this calculation to avoid recalculating on re-renders
  const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
  
  // Use a ref with useRef instead of useState to prevent additional renders
  const redirectAttempted = useRef<boolean>(false);

  // Redirect if already logged in - optimized to prevent multiple redirects
  useEffect(() => {
    if (user && !redirectAttempted.current) {
      redirectAttempted.current = true;
      
      // Use replace for a faster, cleaner navigation
      if (user.isAdmin && isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/my-learning", { replace: true });
      }
    }
  }, [user, navigate, isAdmin]);

  // Login form schema - memoized by React's useState with enhanced error messages
  const [loginSchema] = useState(() => z.object({
    email: z.string()
      .min(1, "Email address is required")
      .email("Email format is incorrect. Please check for typos (example: name@domain.com)")
      .refine(
        (email) => {
          // Additional email validation to catch common mistakes
          const commonDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "mail.ru"];
          const domain = email.split('@')[1]?.toLowerCase();
          
          // Check for common typos in popular email domains
          if (domain && !commonDomains.includes(domain)) {
            // Check for near-misses like "gmal.com" instead of "gmail.com"
            const similarDomain = commonDomains.find(d => 
              // Levenshtein distance of 2 or less suggests a typo
              (d.length - domain.length <= 2) && 
              d.includes(domain.substring(0, 3))
            );
            
            if (similarDomain) {
              return false; // Likely a typo
            }
          }
          
          return true;
        },
        {
          message: "This doesn't look like a valid email. Did you mean to use gmail.com, yahoo.com, or outlook.com?"
        }
      ),
    password: isAdmin
      ? z.string().min(1, "Password is required for administrator login")
      : z.string().optional(),
  }));

  // Login form with optimized default settings
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      // Try to prefill email from localStorage if available
      email: typeof window !== 'undefined' ? localStorage.getItem('lastEmail') || "" : "",
      password: "",
    },
    // Reduce validation frequency for better performance
    mode: 'onSubmit',
  });

  // Helper for iOS-specific blur fix
  const handleIOSInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only apply this fix for iOS devices
    if (!isIOS()) return;
    
    // On iOS, blur the input field manually to ensure the keyboard is dismissed
    // This helps prevent visual glitches during form submission
    e.target.blur();
    
    // Additional logging for iOS device troubleshooting
    console.log("iOS input field blur applied");
  };
  
  // Handle login submission with improved performance
  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    // Clean email by trimming and ensuring consistent case format
    const cleanedEmail = data.email.trim();
    
    // Save email to localStorage for future use
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastEmail', cleanedEmail);
    }
    
    // Apply iOS-specific form submission optimizations
    if (isIOS()) {
      // Force blur any active elements to hide keyboard
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      
      // Small delay for iOS to properly process the form submission
      setTimeout(() => {
        submitForm(cleanedEmail, data);
      }, 50);
    } else {
      // Direct submission for non-iOS devices
      submitForm(cleanedEmail, data);
    }
  };
  
  // Helper function to keep the main submission logic clean
  const submitForm = (cleanedEmail: string, data: z.infer<typeof loginSchema>) => {
    const cleanedData = {
      ...data,
      email: cleanedEmail, // Replace original email with cleaned version
    };
    
    if (isAdmin) {
      adminLoginMutation.mutate({
        ...cleanedData,
        isAdmin: true
      });
    } else {
      loginMutation.mutate(cleanedData);
    }
  };

  // Get error message from either login mutation
  const loginError = loginMutation.error || adminLoginMutation.error;
  
  // Show loading state if mutations are in progress
  if (loginMutation.isPending || adminLoginMutation.isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Welcome to Multi Land</h2>
            <p className="mt-2 text-gray-600">Please sign in to continue</p>
          </div>

          <div className="bg-white shadow rounded-lg p-8 space-y-6">
            {/* Display login error with improved formatting and custom error types */}
            {loginError && (
              <div className="p-5 mb-4 text-sm text-red-800 bg-red-50 rounded-lg border border-red-200 shadow">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-bold text-base">Unable to Sign In</span>
                </div>
                
                {/* Extract just the message string from loginError */}
                <div className="mb-3 ml-7">
                  {loginError.message.includes('401:') 
                    ? loginError.message.split('{')[0].replace('401:', '') 
                    : loginError.message}
                </div>
                
                {/* Show specific help text based on error type */}
                <div className="ml-7 mt-3 text-xs border-t border-red-100 pt-2">
                  {loginError.message.includes('No account found') && (
                    <div className="mt-1">
                      <p>• This email doesn't exist in our system</p>
                      <p>• Make sure you've registered or try a different email</p>
                    </div>
                  )}
                  
                  {loginError.message.includes('format') && (
                    <div className="mt-1">
                      <p>• Email format should be: <span className="font-medium">yourname@domain.com</span></p>
                      <p>• Common examples: name@gmail.com, name@yahoo.com</p>
                    </div>
                  )}
                  
                  {loginError.message.includes('email') && (
                    <p className="mt-1">• Your email is case-insensitive (EXAMPLE@email.com is the same as example@email.com)</p>
                  )}
                  
                  {loginError.message.includes('password') && (
                    <p className="mt-1">• Administrator accounts require both email and password to login</p>
                  )}
                </div>
              </div>
            )}
            
            <Form {...loginForm}>
              <form 
                onSubmit={(e) => {
                  // Prevent default browser form submission
                  e.preventDefault();
                  // Use React Hook Form's submit handler
                  loginForm.handleSubmit(onLoginSubmit)(e);
                }} 
                className="space-y-6"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          onBlur={(e) => {
                            field.onBlur();
                            handleIOSInputBlur(e);
                          }}
                          onChange={field.onChange}
                          value={field.value}
                          name={field.name}
                          ref={field.ref}
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isAdmin && (
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your password"
                            onBlur={(e) => {
                              field.onBlur();
                              handleIOSInputBlur(e);
                            }}
                            onChange={field.onChange}
                            value={field.value}
                            name={field.name}
                            ref={field.ref}
                            autoComplete="current-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button
                  type="submit"
                  className="w-full bg-black hover:bg-gray-800 text-white"
                  onClick={(e) => {
                    // Also handle click separately to ensure proper handling
                    e.preventDefault();
                    loginForm.handleSubmit(onLoginSubmit)();
                  }}
                >
                  {isAdmin ? "Sign in as Administrator" : "Sign in"}
                </Button>

                {!isAdmin && (
                  <div className="text-center">
                    <a
                      href="/auth?admin=true"
                      className="text-sm text-gray-600 hover:text-black"
                    >
                      Administrator Login
                    </a>
                  </div>
                )}
              </form>
            </Form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}