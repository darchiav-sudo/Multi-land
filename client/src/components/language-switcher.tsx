import { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
// Define language type locally to avoid import issues
type Language = 'en' | 'ru' | 'ka';

const languageNames: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  ka: 'ქართული'
};

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelectLanguage = (lang: Language) => {
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Select language">
          <Globe className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <div className="py-2">
          {(Object.keys(languageNames) as Language[]).map((lang) => (
            <button
              key={lang}
              className={cn(
                "flex w-full items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                language === lang && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSelectLanguage(lang)}
            >
              <span className="mr-2 flex-1">{languageNames[lang]}</span>
              {language === lang && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}