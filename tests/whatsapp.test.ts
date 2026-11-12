import { describe, it, expect } from 'vitest';
import {
  buildMessage,
  buildWhatsAppUrl,
  DEFAULT_GREETING,
  getVerseReference,
  shouldTargetApp
} from '../src/lib/whatsapp';
import { Verse } from '../src/data/verses';

describe('WhatsApp Utilities', () => {
  const sampleVerse: Verse = {
    t: 'إنما خير ورحمة يتبعانني كل أيام حياتي',
    b: 'مزمور',
    c: 23,
    v: 6
  };

  const customVerse: Verse = {
    t: 'كل شيء مستطاع للمؤمن',
    ref: 'مرقس 9:23'
  };

  describe('getVerseReference', () => {
    it('returns book chapter:verse or custom ref', () => {
      expect(getVerseReference(sampleVerse)).toBe('مزمور 23:6');
      expect(getVerseReference(customVerse)).toBe('مرقس 9:23');
    });
  });

  describe('buildMessage', () => {
    it('builds message with name and default greeting', () => {
      const msg = buildMessage(sampleVerse, 'مينا', DEFAULT_GREETING);
      expect(msg).toContain('مينا،');
      expect(msg).toContain('يسوع بيقولك انهارده');
      expect(msg).toContain('"إنما خير ورحمة يتبعانني كل أيام حياتي (مزمور 23:6)"');
      expect(msg).toContain('اجتماع شباب الملاك');
    });

    it('builds message without name', () => {
      const msg = buildMessage(sampleVerse, '', DEFAULT_GREETING);
      expect(msg).not.toContain('،');
      expect(msg).toContain('يسوع بيقولك انهارده');
      expect(msg).toContain('"إنما خير ورحمة يتبعانني كل أيام حياتي (مزمور 23:6)"');
    });

    it('builds message with custom greeting', () => {
      const msg = buildMessage(customVerse, 'مريم', 'صباح الخير والبركة');
      expect(msg).toContain('مريم،');
      expect(msg).toContain('صباح الخير والبركة');
      expect(msg).toContain('"كل شيء مستطاع للمؤمن (مرقس 9:23)"');
    });
  });

  describe('shouldTargetApp and buildWhatsAppUrl', () => {
    it('respects force app mode', () => {
      expect(shouldTargetApp('app', false)).toBe(true);
      expect(shouldTargetApp('app', true)).toBe(true);
      const res = buildWhatsAppUrl('+201012345678', 'hello', 'app', false);
      expect(res.isAppTarget).toBe(true);
      expect(res.url).toContain('https://wa.me/201012345678?text=hello');
    });

    it('respects force web mode', () => {
      expect(shouldTargetApp('web', false)).toBe(false);
      expect(shouldTargetApp('web', true)).toBe(false);
      const res = buildWhatsAppUrl('+201012345678', 'hello', 'web', true);
      expect(res.isAppTarget).toBe(false);
      expect(res.url).toContain('https://web.whatsapp.com/send?phone=201012345678&text=hello');
    });

    it('handles auto mode: mobile uses wa.me, desktop uses web', () => {
      // Mobile
      const mobileRes = buildWhatsAppUrl('+201012345678', 'hello', 'auto', true);
      expect(mobileRes.isAppTarget).toBe(true);
      expect(mobileRes.url).toBe('https://wa.me/201012345678?text=hello');

      // Desktop
      const desktopRes = buildWhatsAppUrl('+201012345678', 'hello', 'auto', false);
      expect(desktopRes.isAppTarget).toBe(false);
      expect(desktopRes.url).toBe('https://web.whatsapp.com/send?phone=201012345678&text=hello');
    });

    it('handles URL without phone number', () => {
      const res = buildWhatsAppUrl('', 'hello', 'auto', true);
      expect(res.url).toBe('https://wa.me/?text=hello');

      const webRes = buildWhatsAppUrl('', 'hello', 'auto', false);
      expect(webRes.url).toBe('https://web.whatsapp.com/send?text=hello');
    });
  });
});
