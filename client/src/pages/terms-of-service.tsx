import { useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  useEffect(() => {
    // Set page title
    document.title = t('termsOfService', 'Terms of Service');
  }, [t]);

  return (
    <div className="container max-w-4xl py-8 px-4 md:py-12">
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.history.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back', 'Back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('termsOfService', 'Terms of Service')}</h1>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          {t('lastUpdated', 'Last Updated')}: May 11, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Multi Land services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. User Accounts</h2>
          <p>
            To access certain features of our platform, you must register for an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Course Content and Licensing</h2>
          <p>
            All course content is provided for your personal, non-commercial use only. You may not reproduce, distribute, modify, create derivative works of, publicly display, or publicly perform any content from our platform without explicit permission.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Payments and Subscriptions</h2>
          <p>
            By purchasing a course or subscription, you agree to pay the fees indicated. All purchases are final unless otherwise specified in our refund policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. User Content</h2>
          <p>
            By submitting content to our platform, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute your content in connection with our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Prohibited Conduct</h2>
          <p>
            You agree not to engage in any of the following prohibited activities: (i) violating any applicable laws, (ii) infringing on intellectual property rights, (iii) attempting to interfere with the proper functioning of our services, or (iv) harassing other users.
          </p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Termination</h2>
          <p>
            We reserve the right to terminate or suspend your account and access to our services at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Disclaimer of Warranties</h2>
          <p>
            Our services are provided "as is" without warranties of any kind, either express or implied, including, but not limited to, implied warranties of merchantability and fitness for a particular purpose.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
          <p>
            In no event shall Multi Land be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, arising out of or in connection with these terms or the use of our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
          <p>
            We may modify these Terms of Service at any time. If we make material changes, we will notify you through our services or by other means. Your continued use of our services after the changes take effect constitutes your acceptance of the changed terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
          <p>
            These Terms of Service shall be governed by and construed in accordance with the laws of Georgia, without regard to its conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at: <a href="mailto:darchiav@gmail.com">darchiav@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}