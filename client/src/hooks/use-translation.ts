import { useCallback, useMemo, useEffect, useRef } from 'react';
import { en } from '../lib/translations/en';
import { ru } from '../lib/translations/ru';
import { ka } from '../lib/translations/ka';
import { useLanguage } from './use-language';

type TranslationKey = keyof typeof en;
type TranslationParams = Record<string, string | number>;

const translations = {
  en,
  ru,
  ka,
};

// Store missing translations for developer feedback and future additions
const missingTranslationKeys = new Set<string>();

// Known translation domains to make suggestions more relevant
const knownDomains = [
  'nav', 'home', 'courses', 'auth', 'course', 'content', 'admin', 
  'myProfile', 'notifications', 'lessonEditor', 'courseManagement'
];

/**
 * Enhanced translation hook with better fallback behavior and missing key tracking
 */
export function useTranslation() {
  const { language } = useLanguage();
  const reportedMissingKeys = useRef<Set<string>>(new Set());
  
  // Get current and fallback translations
  const { currentTranslations, fallbackTranslations } = useMemo(() => {
    return {
      currentTranslations: translations[language] || translations.en,
      // Always use English as fallback for non-English languages
      fallbackTranslations: language !== 'en' ? translations.en : null
    };
  }, [language]);
  
  // Report missing translations to console in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && missingTranslationKeys.size > 0) {
      const newMissingKeys = Array.from(missingTranslationKeys)
        .filter(key => !reportedMissingKeys.current.has(key));
      
      if (newMissingKeys.length > 0) {
        // Add to reported set so we don't repeat warnings
        newMissingKeys.forEach(key => reportedMissingKeys.current.add(key));
        
        // Group by likely domain for easier fixes
        const groupedKeys: Record<string, string[]> = {};
        newMissingKeys.forEach(key => {
          const domain = knownDomains.find(d => key.toLowerCase().includes(d.toLowerCase())) || 'other';
          if (!groupedKeys[domain]) groupedKeys[domain] = [];
          groupedKeys[domain].push(key);
        });
        
        console.group('Missing Translation Keys');
        Object.entries(groupedKeys).forEach(([domain, keys]) => {
          console.warn(`${domain} (${keys.length} keys):\n${keys.join('\n')}`);
        });
        console.groupEnd();
      }
    }
  }, [missingTranslationKeys.size]);
  
  // Enhanced translation function with smart fallbacks
  const t = useCallback((key: string, params?: TranslationParams): string => {
    // Helper to check if a value exists at a path in an object
    const getNestedValue = (obj: any, path: string[]): any => {
      let current = obj;
      for (const segment of path) {
        if (!current || typeof current !== 'object' || !(segment in current)) {
          return undefined;
        }
        current = current[segment];
      }
      return current;
    };
    
    // Split the key to handle nested objects (e.g., 'nav.home')
    const parts = key.split('.');
    
    // Try to get translation from current language
    let translation: any = getNestedValue(currentTranslations, parts);
    
    // If missing or not a string, try fallback language
    if (typeof translation !== 'string' && fallbackTranslations) {
      translation = getNestedValue(fallbackTranslations, parts);
    }
    
    // If still missing, format the key for display and track it
    if (typeof translation !== 'string') {
      // Track missing key for reporting
      missingTranslationKeys.add(key);
      
      // Format the key to be more user-friendly as a fallback
      // Convert "camelCaseKey" to "Camel Case Key" for display
      const formattedKey = key.split('.').pop() || key;
      const humanReadable = formattedKey
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();
      
      return humanReadable;
    }
    
    // If no params, return the translation directly
    if (!params) {
      return translation;
    }
    
    // Replace parameters in the translation
    let result = translation;
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      const regex = new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g');
      result = result.replace(regex, String(paramValue));
    });
    
    return result;
  }, [currentTranslations, fallbackTranslations]);
  
  // Export a function to get all missing keys (useful for admin tools)
  const getMissingTranslationKeys = useCallback(() => {
    return Array.from(missingTranslationKeys);
  }, []);
  
  return { t, getMissingTranslationKeys };
}