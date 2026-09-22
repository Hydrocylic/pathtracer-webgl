
import { useSyncExternalStore } from 'react';
import { productProfile } from '../engine/product-profile';
import { messages, type MessageKey } from './messages';

export type { MessageKey } from './messages';
export type Locale = 'zh' | 'en';
const STORAGE_KEY = 'pt-locale';

function readInitialLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'zh' || v === 'en') return v;
  } catch {   }
  return productProfile.defaultLocale;
}

let current: Locale = readInitialLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch {   }
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}

export function t(key: MessageKey, params?: Record<string, string>): string {
  let s: string = messages[key][current];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
