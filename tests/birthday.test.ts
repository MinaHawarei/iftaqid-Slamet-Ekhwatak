import { describe, it, expect } from 'vitest';
import {
  excelSerialToDate,
  formatBirthdayDisplay,
  isUpcomingBirthday,
  parseBirthday
} from '../src/lib/birthday';

describe('Birthday Utilities', () => {
  describe('excelSerialToDate', () => {
    it('converts excel date serials correctly', () => {
      // 35065 -> 1996-01-01
      const d = excelSerialToDate(35065);
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(1996);
      expect(d?.getMonth()).toBe(0);
      expect(d?.getDate()).toBe(1);
    });

    it('handles invalid serials', () => {
      expect(excelSerialToDate(0)).toBeNull();
      expect(excelSerialToDate(-5)).toBeNull();
    });
  });

  describe('parseBirthday', () => {
    it('parses JS Date object', () => {
      const d = new Date(1995, 4, 15);
      expect(parseBirthday(d)).toBe('1995-05-15');
    });

    it('parses Excel serial number', () => {
      const parsed = parseBirthday(35065);
      expect(parsed).toBe('1996-01-01');
    });

    it('parses ISO format YYYY-MM-DD', () => {
      expect(parseBirthday('1995-05-15')).toBe('1995-05-15');
      expect(parseBirthday('1995/05/15')).toBe('1995-05-15');
    });

    it('parses DD/MM/YYYY and D-M-YYYY with day first', () => {
      expect(parseBirthday('15/05/1995')).toBe('1995-05-15');
      expect(parseBirthday('5-8-1998')).toBe('1998-08-05');
      expect(parseBirthday('01/12/2000')).toBe('2000-12-01');
    });

    it('parses dates without year as --MM-DD', () => {
      expect(parseBirthday('15/05')).toBe('--05-15');
      expect(parseBirthday('5-8')).toBe('--08-05');
      expect(parseBirthday('--05-15')).toBe('--05-15');
    });

    it('handles Arabic-Indic digits', () => {
      expect(parseBirthday('١٥/٠٥/١٩٩٥')).toBe('1995-05-15');
      expect(parseBirthday('١٩٩٧-١١-١٢')).toBe('1997-11-12');
    });

    it('rejects invalid dates and returns null without throwing', () => {
      expect(parseBirthday('invalid-date')).toBeNull();
      expect(parseBirthday('35/15/1999')).toBeNull(); // invalid month/day
      expect(parseBirthday('')).toBeNull();
      expect(parseBirthday(null)).toBeNull();
    });
  });

  describe('isUpcomingBirthday', () => {
    const refDate = new Date(2026, 10, 12); // Nov 12, 2026

    it('identifies birthday that is today', () => {
      const res = isUpcomingBirthday('1995-11-12', refDate);
      expect(res).not.toBeNull();
      expect(res?.isToday).toBe(true);
      expect(res?.isUpcoming).toBe(true);
      expect(res?.daysRemaining).toBe(0);
    });

    it('identifies birthday within next 7 days', () => {
      const res = isUpcomingBirthday('1990-11-15', refDate); // 3 days away
      expect(res).not.toBeNull();
      expect(res?.isToday).toBe(false);
      expect(res?.isUpcoming).toBe(true);
      expect(res?.daysRemaining).toBe(3);
    });

    it('identifies birthday more than 7 days away', () => {
      const res = isUpcomingBirthday('1990-11-25', refDate); // 13 days away
      expect(res).not.toBeNull();
      expect(res?.isToday).toBe(false);
      expect(res?.isUpcoming).toBe(false);
      expect(res?.daysRemaining).toBe(13);
    });

    it('handles date without year --MM-DD', () => {
      const res = isUpcomingBirthday('--11-12', refDate);
      expect(res?.isToday).toBe(true);
    });
  });

  describe('formatBirthdayDisplay', () => {
    it('formats ISO to DD/MM/YYYY or DD/MM', () => {
      expect(formatBirthdayDisplay('1995-05-15')).toBe('15/05/1995');
      expect(formatBirthdayDisplay('--05-15')).toBe('15/05');
      expect(formatBirthdayDisplay(null)).toBe('');
    });
  });
});

