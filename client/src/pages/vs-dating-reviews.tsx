import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, RefreshCw, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VsDatingReviews() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: review, isLoading } = useQuery({
    queryKey: ["/api/vs-dating-review"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const handleCopy = async () => {
    if (!review?.reviewText) return;

    try {
      await navigator.clipboard.writeText(review.reviewText);
      setCopied(true);
      toast({
        title: "Review copied!",
        description: "The review has been copied to your clipboard.",
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please try again or copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl border-2">
          <CardContent className="p-8">
            {/* Review Display */}
            {isLoading ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 mb-4 min-h-[200px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  <p className="text-gray-500">Loading review...</p>
                </div>
              </div>
            ) : review?.reviewText ? (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-6 mb-4 border-2 border-blue-100 dark:border-blue-900">
                {/* Copy Button - Top Right */}
                <div className="flex justify-end mb-3">
                  <Button
                    onClick={handleCopy}
                    disabled={!review?.reviewText || isLoading}
                    size="lg"
                    className="h-11 px-8 text-base font-bold shadow-lg bg-black hover:bg-gray-800 text-white"
                    data-testid="button-copy-review"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-5 w-5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[120px]">
                  {review.reviewText}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 mb-4 min-h-[200px] flex items-center justify-center">
                <p className="text-gray-500">No review available</p>
              </div>
            )}

            {/* Info Text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Each review is shown only once globally. After all reviews are used, they reset automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
