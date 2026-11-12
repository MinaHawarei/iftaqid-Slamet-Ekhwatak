import { describe, it, expect } from 'vitest';
import {
  cleanCountryCode,
  convertArabicDigits,
  normalizePhone,
  splitPhoneCell,
  toBareDigits
} from '../src/lib/phone';

describe('Phone Utilities', () => {
  describe('convertArabicDigits', () => {
    it('converts Arabic-Indic digits to Western digits', () => {
      expect(convertArabicDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
      expect(convertArabicDigits('رقم ٠١٠١٢٣٤٥٦٧٨')).toBe('رقم 01012345678');
    });
  });

  describe('splitPhoneCell', () => {
    it('handles null, undefined, empty', () => {
      expect(splitPhoneCell(null)).toEqual([]);
      expect(splitPhoneCell(undefined)).toEqual([]);
      expect(splitPhoneCell('')).toEqual([]);
      expect(splitPhoneCell('   ')).toEqual([]);
    });

    it('splits multiple numbers separated by commas, slashes, semicolons, or newlines', () => {
      expect(splitPhoneCell('01011112222, 01233334444')).toEqual([
        '01011112222',
        '01233334444'
      ]);
      expect(splitPhoneCell('01011112222، 01233334444')).toEqual([
        '01011112222',
        '01233334444'
      ]);
      expect(splitPhoneCell('01011112222 / 01233334444')).toEqual([
        '01011112222',
        '01233334444'
      ]);
      expect(splitPhoneCell("01011112222\n01233334444")).toEqual([
        '01011112222',
        '01233334444'
      ]);
    });
  });

  describe('cleanCountryCode', () => {
    it('cleans country code to digits', () => {
      expect(cleanCountryCode('+20')).toBe('20');
      expect(cleanCountryCode('20')).toBe('20');
      expect(cleanCountryCode('+966')).toBe('966');
      expect(cleanCountryCode('٢٠')).toBe('20');
      expect(cleanCountryCode(undefined)).toBe('20');
    });
  });

  describe('normalizePhone', () => {
    it('normalizes standard E.164 with plus', () => {
      expect(normalizePhone('+201212121212')).toBe('+201212121212');
      expect(normalizePhone('+14155552671')).toBe('+14155552671');
    });

    it('handles leading 00 as international', () => {
      expect(normalizePhone('00201212121212')).toBe('+201212121212');
      expect(normalizePhone('00966501234567')).toBe('+966501234567');
    });

    it('converts local Egyptian number starting with 0', () => {
      expect(normalizePhone('01012345678')).toBe('+201012345678');
      expect(normalizePhone('01123456789')).toBe('+201123456789');
      expect(normalizePhone('01223456789')).toBe('+201223456789');
      expect(normalizePhone('01523456789')).toBe('+201523456789');
    });

    it('handles Egyptian number missing leading 0 (10 digits starting with 1)', () => {
      expect(normalizePhone('1012345678')).toBe('+201012345678');
      expect(normalizePhone('1123456789')).toBe('+201123456789');
    });

    it('handles Arabic-Indic digits', () => {
      expect(normalizePhone('٠١٠١٢٣٤٥٦٧٨')).toBe('+201012345678');
      expect(normalizePhone('+٢٠١٢١٢١٢١٢١٢')).toBe('+201212121212');
    });

    it('handles numeric input and float strings from Excel', () => {
      expect(normalizePhone(201012345678)).toBe('+201012345678');
      expect(normalizePhone('201012345678.0')).toBe('+201012345678');
    });

    it('strips spaces, dashes, dots, parentheses', () => {
      expect(normalizePhone('+20 (101) 234-5678')).toBe('+201012345678');
      expect(normalizePhone('010-1234-5678')).toBe('+201012345678');
    });

    it('validates length between 8 and 15 digits', () => {
      expect(normalizePhone('12345')).toBeNull(); // too short
      expect(normalizePhone('123456789012345678')).toBeNull(); // too long
      expect(normalizePhone('abcd')).toBeNull();
      expect(normalizePhone('')).toBeNull();
    });
  });

  describe('toBareDigits', () => {
    it('returns digits without plus', () => {
      expect(toBareDigits('+201012345678')).toBe('201012345678');
      expect(toBareDigits('01012345678')).toBe('01012345678');
      expect(toBareDigits(null)).toBe('');
    });
  });
});

