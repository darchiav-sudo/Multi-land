import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { translations } from '@/lib/translations';

// Define supported languages
export type Language = 'en' | 'ru' | 'ka';

// Define context type
export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

// Create the context with a default value
export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

// Custom hook to use the language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  
  // Translation function
  const t = (key: string, fallback?: string): string => {
    const currentTranslations = translations[context.language] || translations.en;
    return key.split('.').reduce((obj: any, path) => (obj && obj[path] ? obj[path] : null), currentTranslations) || fallback || key;
  };
  
  return {
    ...context,
    t
  };
}

// Helper function to get initial language
export function getInitialLanguage(): Language {
  // In browser environment
  if (typeof window !== 'undefined') {
    // Try to get language from localStorage first
    const savedLanguage = localStorage.getItem('app_language');
    if (savedLanguage && ['en', 'ru', 'ka'].includes(savedLanguage)) {
      return savedLanguage as Language;
    }
    
    // If no saved language, try to detect from browser
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      
      // Only support the languages we have translations for
      if (['en', 'ru', 'ka'].includes(browserLang)) {
        return browserLang as Language;
      }
    }
  }
  
  // Default to English
  return 'en';
}