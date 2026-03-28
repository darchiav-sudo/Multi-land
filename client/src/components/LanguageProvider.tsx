import { ReactNode, useState, useEffect } from 'react';
import { LanguageContext, getInitialLanguage, Language } from '@/hooks/use-language';
import { translations } from '@/lib/translations';

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage());
  
  // Save language to localStorage whenever it changes
  const setLanguage = (lang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_language', lang);
    }
    setLanguageState(lang);
  };
  
  // Translation function
  const t = (key: string, fallback?: string): string => {
    const currentTranslations = translations[language] || translations.en;
    return key.split('.').reduce((obj: any, path) => (obj && obj[path] ? obj[path] : null), currentTranslations) || fallback || key;
  };
  
  // When the component mounts, check if the language is still correct
  useEffect(() => {
    const storedLanguage = localStorage.getItem('app_language');
    if (storedLanguage && ['en', 'ru', 'ka'].includes(storedLanguage) && storedLanguage !== language) {
      setLanguageState(storedLanguage as Language);
    }
  }, []);
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}