import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, CreditCard, Calendar, Info } from "lucide-react";
import stripePromise from "@/lib/stripe-loader";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Course, PaymentPlan } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

// CheckoutForm component that handles the payment submission
function CheckoutForm({ 
  courseId, 
  paymentType = "full", 
  paymentPlanId,
  selectedPlan,
  handleSuccess 
}: { 
  courseId: number; 
  paymentType?: string;
  paymentPlanId?: number;
  selectedPlan?: PaymentPlan;
  handleSuccess: () => void; 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/my-learning",
      },
      redirect: "if_required",
    });

    if (error) {
      toast({
        title: t("Payment Failed"),
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      // Payment succeeded, notify the server to create enrollment
      try {
        await apiRequest("POST", "/api/payment-success", {
          paymentIntentId: paymentIntent.id,
          courseId,
          paymentType,
          paymentPlanId,
          subscriptionId: null // For first payment of subscription
        });
        
        // Call success callback
        handleSuccess();
      } catch (err) {
        toast({
          title: t("Error Enrolling"),
          description: t("Your payment was successful, but there was an issue enrolling you in the course."),
          variant: "destructive",
        });
      }
    }
  };

  const buttonText = paymentType === "installment" && selectedPlan
    ? `${t("Pay")} ${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(selectedPlan.installmentAmount / 100)} ${t("now")}`
    : t("Pay Now");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{
        paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
        defaultValues: {
          billingDetails: {
            email: localStorage.getItem('user_email') || ''
          }
        },
        wallets: {
          applePay: 'auto',
          googlePay: 'auto'
        },
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#000000',
            colorBackground: '#ffffff',
            colorText: '#000000',
            colorDanger: '#df1b41',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            spacingUnit: '4px',
            borderRadius: '4px'
          }
        }
      }} />
      
      {paymentType === "installment" && selectedPlan && (
        <div className="bg-gray-100 p-4 rounded-lg mt-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 mt-0.5 mr-2 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-700 font-medium">{t("Payment Plan Information")}</p>
              <p className="text-sm text-gray-600 mt-1">
                {t("You will be charged")} {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(selectedPlan.installmentAmount / 100)} {t("today and")} {selectedPlan.installments - 1} {t("more monthly payments of the same amount.")}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {t("Total")} {selectedPlan.installments} {t("payments")}: {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format((selectedPlan.installmentAmount * selectedPlan.installments) / 100)}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full bg-black hover:bg-gray-800 text-white"
      >
        {isProcessing ? (
          <span className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("Processing")}...
          </span>
        ) : (
          buttonText
        )}
      </Button>
    </form>
  );
}

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  
  // Support both URL formats: /checkout/:id and /checkout-page?courseId=
  const params = new URLSearchParams(window.location.search);
  const courseIdParam = params.get('courseId');
  
  // Get course ID from either route param or query param
  const courseId = id ? parseInt(id) : courseIdParam ? parseInt(courseIdParam) : 0;
  
  // Debug log to see what parameters are received
  console.log("Checkout page parameters:", { id, courseIdParam, courseId, path: window.location.pathname });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [clientSecret, setClientSecret] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "installment">("full");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  
  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Fetch course details
  const {
    data: course,
    isLoading: isLoadingCourse,
    error: courseError,
  } = useQuery<Course>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !isNaN(courseId),
  });
  
  // Fetch payment plans
  const {
    data: paymentPlans = [],
    isLoading: isLoadingPlans,
  } = useQuery<PaymentPlan[]>({
    queryKey: [`/api/courses/${courseId}/payment-plans`],
    enabled: !isNaN(courseId),
  });
  
  const selectedPlan = paymentPlans.find(plan => plan.id === selectedPlanId);
  
  // Create payment intent when page loads or payment type/plan changes
  useEffect(() => {
    const createPaymentIntent = async () => {
      if (!courseId || !user) return;
      
      try {
        // Clear the client secret first to show loading state
        setClientSecret("");
        
        // Different API endpoints based on payment type
        const endpoint = paymentType === "installment" ? "/api/create-subscription" : "/api/create-payment-intent";
        
        const payload = paymentType === "installment" 
          ? { courseId, paymentPlanId: selectedPlanId } 
          : { courseId };
        
        const res = await apiRequest("POST", endpoint, payload);
        const data = await res.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error("Error creating payment intent:", error);
        toast({
          title: t("Payment Setup Failed"),
          description: t("There was an issue setting up the payment. Please try again."),
          variant: "destructive",
        });
      }
    };

    // Only create payment intent if we have a courseId and user
    // For installment payments, also require a selected plan
    if (paymentType === "installment" && !selectedPlanId) {
      return;
    }
    
    createPaymentIntent();
  }, [courseId, user, paymentType, selectedPlanId, toast, t]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    
    // Invalidate enrollments query to refresh user's enrollments
    queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/enrollments`] });
    
    // Show success toast
    toast({
      title: t("Payment Successful"),
      description: t("Thank you for your purchase!"),
    });
  };

  // Handle going to course
  const goToCourse = () => {
    navigate(`/courses/${courseId}`);
  };

  // Handle going to my learning
  const goToMyLearning = () => {
    navigate("/my-learning");
  };

  if (isLoadingCourse || !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </main>
        <Footer />
      </div>
    );
  }

  if (courseError || !course) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <div className="max-w-3xl mx-auto px-4 py-12">
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("Course Not Found")}</h1>
                  <p className="text-gray-600 mb-6">{t("The course you're trying to purchase doesn't exist or has been removed.")}</p>
                  <Button onClick={() => navigate("/courses")} className="bg-black hover:bg-gray-800 text-white">
                    {t("Browse Courses")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Format price from cents to dollars
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(course.price / 100);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4">
          {paymentSuccess ? (
            <Card className="shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-green-100 p-3 rounded-full">
                    <CheckCircle className="h-16 w-16 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("Payment Successful!")}</h1>
                <p className="text-gray-600 mb-8">
                  {t("Thank you for your purchase. You now have access to")} "{course.title}".
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={goToCourse} className="bg-black hover:bg-gray-800 text-white">
                    {t("Go to Course")}
                  </Button>
                  <Button onClick={goToMyLearning} variant="outline">
                    {t("My Learning Dashboard")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">{t("Checkout")}</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Order Summary and Payment Options */}
                <div className="md:col-span-1">
                  <Card className="shadow-lg mb-8">
                    <CardHeader>
                      <CardTitle>{t("Order Summary")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <div className="h-16 w-16 rounded bg-gray-200 flex-shrink-0 overflow-hidden">
                            <img 
                              src={course.imageUrl} 
                              alt={course.title} 
                              className="h-full w-full object-cover" 
                            />
                          </div>
                          <div className="ml-4">
                            <h3 className="font-medium text-gray-900">{course.title}</h3>
                            <p className="text-gray-500 text-sm">{course.category}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span>{t("Price")}</span>
                          <span>{formattedPrice}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-medium text-lg">
                          <span>{t("Total")}</span>
                          <span>
                            {paymentType === "installment" && selectedPlan ? (
                              new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format((selectedPlan.installmentAmount * selectedPlan.installments) / 100)
                            ) : (
                              formattedPrice
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Payment Options */}
                  {paymentPlans.length > 0 && (
                    <Card className="shadow-lg mb-8">
                      <CardHeader>
                        <CardTitle>{t("Payment Options")}</CardTitle>
                        <CardDescription>{t("Choose how you want to pay")}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RadioGroup 
                          value={paymentType}
                          onValueChange={(value) => {
                            setPaymentType(value as "full" | "installment");
                            if (value === "full") {
                              setSelectedPlanId(null);
                            }
                          }}
                          className="space-y-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="full" id="pay-full" />
                            <Label htmlFor="pay-full" className="flex flex-col">
                              <span className="font-medium">{t("Pay in full")}</span>
                              <span className="text-sm text-gray-500">{formattedPrice} {t("one-time payment")}</span>
                            </Label>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <RadioGroupItem value="installment" id="pay-installments" />
                            <div className="flex flex-col">
                              <Label htmlFor="pay-installments" className="font-medium mb-2">
                                {t("Pay in installments")}
                              </Label>
                              
                              {paymentType === "installment" && (
                                <div className="ml-2 space-y-3">
                                  {paymentPlans.map((plan) => (
                                    <div key={plan.id} className="flex items-center space-x-2">
                                      <RadioGroupItem 
                                        value={`plan-${plan.id}`} 
                                        id={`plan-${plan.id}`}
                                        checked={selectedPlanId === plan.id}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                      />
                                      <Label htmlFor={`plan-${plan.id}`} className="flex flex-col">
                                        <span className="font-medium">{plan.name}</span>
                                        <span className="text-sm text-gray-500">
                                          {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: 'USD',
                                          }).format(plan.installmentAmount / 100)}{" "}
                                          {t("×")} {plan.installments} {t("months")}
                                        </span>
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Payment Details */}
                <div className="md:col-span-2">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="mr-2 h-5 w-5" />
                        {t("Payment Details")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Show a different message when waiting for user to select a payment plan */}
                      {paymentType === "installment" && !selectedPlanId ? (
                        <div className="text-center py-8">
                          <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">{t("Select a Payment Plan")}</h3>
                          <p className="text-gray-600">{t("Please choose a payment plan from the options on the left")}</p>
                        </div>
                      ) : clientSecret ? (
                        <Elements
                          stripe={stripePromise}
                          options={{
                            clientSecret,
                            appearance: {
                              theme: 'stripe' as const,
                              variables: {
                                colorPrimary: '#000000',
                                colorBackground: '#ffffff',
                                colorText: '#000000',
                                colorDanger: '#df1b41',
                                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                                spacingUnit: '4px',
                                borderRadius: '4px'
                              }
                            },
                            // Enable better payment methods display
                            locale: 'auto',
                            // Support for Apple Pay & Google Pay
                            wallets: {
                              applePay: 'auto',
                              googlePay: 'auto'
                            }
                          }}
                        >
                          <CheckoutForm 
                            courseId={courseId} 
                            paymentType={paymentType}
                            paymentPlanId={selectedPlanId || undefined}
                            selectedPlan={selectedPlan}
                            handleSuccess={handlePaymentSuccess} 
                          />
                        </Elements>
                      ) : (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
