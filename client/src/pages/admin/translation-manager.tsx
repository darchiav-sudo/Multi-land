import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, Search, Plus, Layers, RefreshCw, LogOut, User, ChevronLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

type MissingTranslation = {
  key: string;
  domain: string;
  suggestion: string;
};

/**
 * Translation Manager for Administrators
 * 
 * This page allows admins to:
 * 1. View missing translations across the application
 * 2. Export missing translations to JSON
 * 3. Add new translations directly in the interface
 */
const TranslationManager = () => {
  const { t, getMissingTranslationKeys } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [missingTranslations, setMissingTranslations] = useState<MissingTranslation[]>([]);
  const [filteredTranslations, setFilteredTranslations] = useState<MissingTranslation[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ka' | 'ru'>(language);
  const [refreshCount, setRefreshCount] = useState(0);

  // Known domains for categorization
  const knownDomains = [
    'nav', 'home', 'courses', 'auth', 'course', 'content', 'admin', 
    'myProfile', 'notifications', 'lessonEditor', 'courseManagement'
  ];

  // Load missing translations
  useEffect(() => {
    const missingKeys = getMissingTranslationKeys();
    
    // Process and categorize keys
    const processedTranslations = missingKeys.map(key => {
      // Determine likely domain
      const domain = knownDomains.find(d => 
        key.toLowerCase().includes(d.toLowerCase())
      ) || 'other';
      
      // Create a suggestion based on the key
      const keyPart = key.split('.').pop() || key;
      const suggestion = keyPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      
      return {
        key,
        domain,
        suggestion
      };
    });
    
    setMissingTranslations(processedTranslations);
  }, [getMissingTranslationKeys, refreshCount]);

  // Filter translations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTranslations(missingTranslations);
      return;
    }
    
    const filtered = missingTranslations.filter(item => 
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.suggestion.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredTranslations(filtered);
  }, [searchQuery, missingTranslations]);

  // Group translations by domain
  const groupedTranslations = filteredTranslations.reduce((acc, item) => {
    if (!acc[item.domain]) {
      acc[item.domain] = [];
    }
    acc[item.domain].push(item);
    return acc;
  }, {} as Record<string, MissingTranslation[]>);

  // Export translations to JSON
  const exportTranslations = () => {
    const exportObj: Record<string, Record<string, string>> = {};
    
    // Group by domain first
    missingTranslations.forEach(({ key, suggestion }) => {
      const parts = key.split('.');
      const mainDomain = parts[0] || 'other';
      
      if (!exportObj[mainDomain]) {
        exportObj[mainDomain] = {};
      }
      
      if (parts.length === 1) {
        exportObj[mainDomain][key] = suggestion;
      } else {
        // Handle nested keys (e.g., 'admin.lessonEditor.title')
        const subKey = parts.slice(1).join('.');
        exportObj[mainDomain][subKey] = suggestion;
      }
    });
    
    // Convert to JSON
    const jsonStr = JSON.stringify(exportObj, null, 2);
    
    // Create and download file
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing_translations_${selectedLanguage}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Force refresh to detect new missing translations
  const refreshTranslations = () => {
    // Change language temporarily to force re-render throughout the app
    const currentLang = language;
    setLanguage(currentLang === 'en' ? 'ka' : 'en');
    
    // Wait briefly and switch back
    setTimeout(() => {
      setLanguage(currentLang);
      // Increment refresh counter to trigger useEffect
      setRefreshCount(prev => prev + 1);
    }, 500);
  };

  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Verify user is admin
    if (!user.isAdmin) {
      console.error('User is not admin, redirecting:', user?.email);
      navigate('/');
    }
  }, [user, navigate]);

  // If still loading or not authenticated, show nothing
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex h-14 items-center border-b border-gray-200 dark:border-gray-800 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Layers className="h-6 w-6 text-primary" />
            <span className="text-primary">Multi Land</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t('admin.management')}
            </h2>
            <div className="space-y-1">
              <Link 
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>{t('common.back')}</span>
              </Link>
            </div>
          </div>
        </nav>
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 truncate">
              <div className="font-medium">{user.username || "Admin"}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </div>
            </div>
          </div>
          <Button
            variant="outline" 
            className="mt-2 w-full justify-start"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed inset-x-0 top-0 z-50 h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex h-full items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-1">
            <ChevronLeft className="h-5 w-5" />
            <span>{t('common.back')}</span>
          </Link>
          <div className="font-bold">
            {t('admin.translationManager')}
          </div>
          <div className="w-5"></div>
        </div>
      </div>
      
      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="container max-w-7xl mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">{t('admin.translationManager')}</h1>
              <p className="text-muted-foreground">{t('admin.translationManagerDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshTranslations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('admin.refreshTranslations')}
              </Button>
              <Button onClick={exportTranslations}>
                <Download className="h-4 w-4 mr-2" />
                {t('admin.exportTranslations')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Translation Language Selection */}
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.translationLanguage')}</CardTitle>
                <CardDescription>{t('admin.selectLanguageDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  defaultValue={selectedLanguage}
                  onValueChange={(value) => setSelectedLanguage(value as 'en' | 'ka' | 'ru')}
                  className="grid grid-cols-3 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="en" id="en" />
                    <Label htmlFor="en">English</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ka" id="ka" />
                    <Label htmlFor="ka">ქართული</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ru" id="ru" />
                    <Label htmlFor="ru">Русский</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Search and Filters */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchTranslations')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Badge variant="outline" className="py-2">
                {filteredTranslations.length} {t('admin.missingTranslations')}
              </Badge>
            </div>

            {/* Missing Translations */}
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">{t('admin.allDomains')}</TabsTrigger>
                {Object.keys(groupedTranslations).map(domain => (
                  <TabsTrigger key={domain} value={domain}>
                    {domain} ({groupedTranslations[domain].length})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-4">
                {filteredTranslations.length === 0 ? (
                  <Alert>
                    <AlertTitle>{t('admin.noMissingTranslations')}</AlertTitle>
                    <AlertDescription>
                      {searchQuery 
                        ? t('admin.noTranslationsMatchSearch') 
                        : t('admin.allTranslationsComplete')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTranslations.map((item, index) => (
                      <Card key={index}>
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-sm font-medium">
                              {item.key}
                            </CardTitle>
                            <Badge>{item.domain}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2">
                          <p className="text-sm text-muted-foreground">
                            {t('admin.suggestedTranslation')}: <span className="font-medium">{item.suggestion}</span>
                          </p>
                        </CardContent>
                        <CardFooter className="py-2">
                          <Button variant="ghost" size="sm" className="ml-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            {t('admin.addTranslation')}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {Object.keys(groupedTranslations).map(domain => (
                <TabsContent key={domain} value={domain} className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupedTranslations[domain].map((item, index) => (
                      <Card key={index}>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm font-medium">
                            {item.key}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2">
                          <p className="text-sm text-muted-foreground">
                            {t('admin.suggestedTranslation')}: <span className="font-medium">{item.suggestion}</span>
                          </p>
                        </CardContent>
                        <CardFooter className="py-2">
                          <Button variant="ghost" size="sm" className="ml-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            {t('admin.addTranslation')}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TranslationManager;