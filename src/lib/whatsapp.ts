import { Verse } from '../data/verses';
import { WhatsAppMode } from '../store/types';
import { toBareDigits } from './phone';
import { isMobileDevice } from './device';

export const DEFAULT_GREETING = 'يسوع بيقولك انهارده';

/**
 * Returns formatted reference text for verse.
 */
export function getVerseReference(v: Verse): string {
  if (v.ref !== undefined) return v.ref;
  if (v.b && v.c !== undefined && v.v !== undefined) {
    return `${v.b} ${v.c}:${v.v}`;
  }
  return '';
}

/**
 * Builds the WhatsApp message text, preserving the exact copy and layout from the original app.
 */
export function buildMessage(
  v: Verse,
  name?: string,
  greeting: string = DEFAULT_GREETING
): string {
  const r = getVerseReference(v);
  const trimmedName = (name || '').trim();
  const trimmedGreeting = (greeting || '').trim();

  const headParts: string[] = [];
  if (trimmedName) headParts.push(trimmedName + '،');
  if (trimmedGreeting) headParts.push(trimmedGreeting);
  const head = headParts.join('\n');

  const refPart = r ? ` (${r})` : '';
  const body = `"${v.t}${refPart}"`;

  return `${head ? head + '\n' : ''}${body}\n\nاجتماع شباب الملاك`;
}

/**
 * Determines whether WhatsApp link should target wa.me (app) or web.whatsapp.com (web).
 */
export function shouldTargetApp(mode: WhatsAppMode, isMobile: boolean = isMobileDevice()): boolean {
  if (mode === 'app') return true;
  if (mode === 'web') return false;
  return isMobile;
}

/**
 * Builds the device-aware WhatsApp URL.
 */
export function buildWhatsAppUrl(
  phoneOrDigits: string | null | undefined,
  text: string = '',
  mode: WhatsAppMode = 'auto',
  isMobile: boolean = isMobileDevice()
): { url: string; isAppTarget: boolean } {
  const digits = toBareDigits(phoneOrDigits);
  const isApp = shouldTargetApp(mode, isMobile);

  if (isApp) {
    const encodedText = text ? '?text=' + encodeURIComponent(text) : '';
    const url = `https://wa.me/${digits}${encodedText}`;
    return { url, isAppTarget: true };
  } else {
    // WhatsApp Web
    const params: string[] = [];
    if (digits) {
      params.push(`phone=${digits}`);
    }
    if (text) {
      params.push(`text=${encodeURIComponent(text)}`);
    }
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `https://web.whatsapp.com/send${query}`;
    return { url, isAppTarget: false };
  }
}

/**
 * Opens WhatsApp link respecting device and target constraints.
 */
export function openWhatsApp(
  url: string,
  isAppTarget: boolean,
  isMobile: boolean = isMobileDevice()
): void {
  if (isAppTarget && isMobile) {
    // On mobile, same-tab navigation is the most reliable way to launch the native app
    window.location.href = url;
    return;
  }

  // On desktop or web mode, open in a new tab
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    window.location.href = url;
  }
}

