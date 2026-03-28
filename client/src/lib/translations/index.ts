import { en } from './en';
import { ru } from './ru';
import { ka } from './ka';

export type TranslationKey = keyof typeof en;
export type Languages = 'en' | 'ru' | 'ka';

export const translations = {
  en,
  ru,
  ka
};