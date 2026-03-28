import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Languages } from '@/lib/translations';

type LanguageContextType = {
  language: Languages;
  setLanguage: (lang: Languages) => void;
  t: (key: string, options?: Record<string, any>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Get the language from localStorage or default to 'en'
  const [language, setLanguageState] = useState<Languages>(() => {
    const savedLanguage = localStorage.getItem('language') as Languages;
    return savedLanguage || 'en';
  });

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Languages) => {
    setLanguageState(lang);
  };

  // Translation function
  const t = (key: string, options?: Record<string, any>): string => {
    // Split the key to navigate the nested structure
    const keys = key.split('.');
    
    let value: any = translations[language];
    
    // Navigate through the nested structure
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }
    
    // Replace placeholders with values
    if (options) {
      return value.replace(/{{([^{}]*)}}/g, (match, placeholder) => {
        return options[placeholder] !== undefined ? options[placeholder] : match;
      });
    }
    
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}