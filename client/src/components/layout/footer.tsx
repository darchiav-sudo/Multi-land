import { Link } from "wouter";
import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin 
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="bg-black text-white border-t border-gray-800">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-gray-400 mb-4">© 2025 Multi Land. All rights reserved.</p>
          
          {/* Policy links */}
          <div className="flex flex-wrap justify-center space-x-4 mb-4">
            <Link href="/privacy-policy" className="text-gray-400 hover:text-white underline text-sm">
              {t('privacyPolicy', 'Privacy Policy')}
            </Link>
            <Link href="/terms-of-service" className="text-gray-400 hover:text-white underline text-sm">
              {t('termsOfService', 'Terms of Service')}
            </Link>
            <Link href="/refund-policy" className="text-gray-400 hover:text-white underline text-sm">
              {t('refundPolicy', 'Refund Policy')}
            </Link>
          </div>
          
          {/* Social media links */}
          <div className="flex space-x-4 mb-6">
            <a href="#" className="text-gray-400 hover:text-white">
              <Facebook size={20} />
              <span className="sr-only">Facebook</span>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <Twitter size={20} />
              <span className="sr-only">Twitter</span>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <Instagram size={20} />
              <span className="sr-only">Instagram</span>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <Linkedin size={20} />
              <span className="sr-only">LinkedIn</span>
            </a>
          </div>
          
          {/* Admin dashboard link */}
          <div className="flex items-center justify-center mt-2">
            <Link href="/auth?admin=true" className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md transition duration-200">
              Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
