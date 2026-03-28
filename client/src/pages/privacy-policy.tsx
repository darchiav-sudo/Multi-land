import { useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();
  const [_, navigate] = useLocation();

  useEffect(() => {
    // Set page title
    document.title = t('privacyPolicy');
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
          {t('back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('privacyPolicy')}</h1>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          {t('lastUpdated')}: April 7, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacyIntro')}</h2>
          <p>
            {t('privacyIntroText')}
          </p>
          <p>
            {t('privacyExplanation')}
          </p>
          <p>
            {t('privacyAgeRestriction')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('infoWeCollect')}</h2>
          
          <h3 className="text-xl font-medium mb-2">{t('infoYouProvide')}</h3>
          <p>{t('infoYouProvideIntro')}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>{t('accountInfo')}:</strong> {t('accountInfoDesc')}</li>
            <li><strong>{t('profileInfo')}:</strong> {t('profileInfoDesc')}</li>
            <li><strong>{t('paymentInfo')}:</strong> {t('paymentInfoDesc')}</li>
            <li><strong>{t('courseInteraction')}:</strong> {t('courseInteractionDesc')}</li>
            <li><strong>{t('communications')}:</strong> {t('communicationsDesc')}</li>
          </ul>
          
          <h3 className="text-xl font-medium mt-6 mb-2">{t('infoCollectedAuto')}</h3>
          <p>{t('infoCollectedAutoIntro')}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>{t('usageInfo')}:</strong> {t('usageInfoDesc')}</li>
            <li><strong>{t('deviceInfo')}:</strong> {t('deviceInfoDesc')}</li>
            <li><strong>{t('locationInfo')}:</strong> {t('locationInfoDesc')}</li>
            <li><strong>{t('logInfo')}:</strong> {t('logInfoDesc')}</li>
            <li><strong>{t('cookiesInfo')}:</strong> {t('cookiesInfoDesc')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('howWeUseInfo')}</h2>
          <p>{t('howWeUseInfoIntro')}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>{t('useInfoService')}</li>
            <li>{t('useInfoTransactions')}</li>
            <li>{t('useInfoNotices')}</li>
            <li>{t('useInfoRespond')}</li>
            <li>{t('useInfoTrends')}</li>
            <li>{t('useInfoPersonalize')}</li>
            <li>{t('useInfoContests')}</li>
            <li>{t('useInfoProtect')}</li>
            <li>{t('useInfoComply')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('sharingInfo')}</h2>
          <p>{t('sharingInfoIntro')}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>{t('serviceProviders')}:</strong> {t('serviceProvidersDesc')}</li>
            <li><strong>{t('paymentProcessors')}:</strong> {t('paymentProcessorsDesc')}</li>
            <li><strong>{t('legalRequirements')}:</strong> {t('legalRequirementsDesc')}</li>
            <li><strong>{t('businessTransfers')}:</strong> {t('businessTransfersDesc')}</li>
            <li><strong>{t('consent')}:</strong> {t('consentDesc')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('dataSecurity')}</h2>
          <p>
            {t('dataSecurityText')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('yourChoices')}</h2>
          <p>{t('yourChoicesIntro')}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>{t('accountInfoChoices')}:</strong> {t('accountInfoChoicesDesc')}</li>
            <li><strong>{t('cookiesChoices')}:</strong> {t('cookiesChoicesDesc')}</li>
            <li><strong>{t('promotionalChoices')}:</strong> {t('promotionalChoicesDesc')}</li>
            <li><strong>{t('pushNotifications')}:</strong> {t('pushNotificationsDesc')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('internationalTransfers')}</h2>
          <p>
            {t('internationalTransfersText')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('policyChanges')}</h2>
          <p>
            {t('policyChangesText')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t('contactUs')}</h2>
          <p>
            {t('contactUsText')} <a href="mailto:darchiav@gmail.com" className="text-primary hover:underline">darchiav@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}