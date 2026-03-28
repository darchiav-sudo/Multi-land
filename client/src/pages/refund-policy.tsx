import { useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function RefundPolicyPage() {
  const { t } = useLanguage();

  useEffect(() => {
    // Set page title
    document.title = t('refundPolicy', 'Refund Policy');
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
        <h1 className="text-3xl font-bold">{t('refundPolicy', 'Refund Policy')}</h1>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          {t('lastUpdated', 'Last Updated')}: May 11, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Standard Refund Policy</h2>
          <p>
            At Multi Land, we strive to provide high-quality educational content. However, we understand that there may be instances where a refund is warranted. Our standard refund policy is as follows:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-4">
            <li>Refund requests must be submitted within 14 days of purchase.</li>
            <li>If you have completed less than 20% of a course, you may be eligible for a full refund.</li>
            <li>If you have completed between 20% and 50% of a course, you may be eligible for a partial refund.</li>
            <li>No refunds will be issued for courses where more than 50% of the content has been accessed.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Installment Payment Plans</h2>
          <p>
            For courses purchased through installment payment plans:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-4">
            <li>Refunds will be issued in proportion to the amount paid at the time of the refund request.</li>
            <li>If you cancel a payment plan, you will lose access to the course, but will not be charged for future installments.</li>
            <li>No refunds will be processed for payments already made if you have accessed more than 50% of the course content.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Webinar Refunds</h2>
          <p>
            For webinar purchases:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-4">
            <li>Full refunds are available up to 24 hours before the scheduled start time of a webinar.</li>
            <li>If you're unable to attend a live webinar you've purchased, you'll still have access to the recording (if available) and no refund will be issued.</li>
            <li>If a webinar is canceled by Multi Land, a full refund will be automatically processed.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Technical Difficulties</h2>
          <p>
            If you experience persistent technical difficulties that prevent you from accessing or completing a course, and our support team is unable to resolve these issues within a reasonable timeframe, you may be eligible for a full refund regardless of how much content you've accessed.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. How to Request a Refund</h2>
          <p>
            To request a refund:
          </p>
          <ol className="list-decimal pl-5 space-y-2 mt-4">
            <li>Contact our support team at <a href="mailto:darchiav@gmail.com">darchiav@gmail.com</a></li>
            <li>Include your order number, the course or webinar title, and the reason for your refund request.</li>
            <li>Our team will review your request and respond within 3-5 business days.</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Refund Processing</h2>
          <p>
            Approved refunds will be processed using the original payment method. Please allow 5-10 business days for the refund to appear on your statement, depending on your payment provider's policies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Changes to Refund Policy</h2>
          <p>
            We reserve the right to modify this refund policy at any time. Any changes will be effective immediately upon posting the updated policy on our website. Your continued use of our services after such changes constitutes your acceptance of the new refund policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
          <p>
            If you have any questions about our refund policy, please contact us at: <a href="mailto:darchiav@gmail.com">darchiav@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}