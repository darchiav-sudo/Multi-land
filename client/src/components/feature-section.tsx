import { Search, CreditCard, GraduationCap } from "lucide-react";

export function FeatureSection() {
  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">How It Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">Learn at your own pace with our simple learning platform</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="bg-gray-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-gray-800" />
            </div>
            <h3 className="text-xl font-semibold mb-2">1. Find Your Course</h3>
            <p className="text-gray-600">Browse our catalog of professional courses to find the perfect match for your goals.</p>
          </div>

          <div className="text-center">
            <div className="bg-gray-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-gray-800" />
            </div>
            <h3 className="text-xl font-semibold mb-2">2. Purchase Access</h3>
            <p className="text-gray-600">Secure payment options for lifetime access to course materials and updates.</p>
          </div>

          <div className="text-center">
            <div className="bg-gray-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-gray-800" />
            </div>
            <h3 className="text-xl font-semibold mb-2">3. Learn & Succeed</h3>
            <p className="text-gray-600">Learn at your own pace with video lessons, downloadable resources, and practical exercises.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
