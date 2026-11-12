import { convertArabicDigits } from './phone';

/**
 * Parses an Excel serial date number into a Date object.
 * Excel 1900 epoch starts Jan 1, 1900, with the 1900 leap year bug (day 60 is Feb 29, 1900).
 */
export function excelSerialToDate(serial: number): Date | null {
  if (typeof serial !== 'number' || isNaN(serial) || serial <= 0) return null;
  // Excel date serial number integer part is days since 1899-12-30
  // (taking the 1900 leap year bug into account)
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const dateInfo = new Date(utcValue);
  if (isNaN(dateInfo.getTime())) return null;
  return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
}

/**
 * Validates day for given month and optional year.
 */
function isValidDay(year: number | null, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const daysInMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonths[month - 1]) return false;
  if (month === 2 && day === 29 && year !== null) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap;
  }
  return true;
}

/**
 * Parses a birthday value (Date, Excel serial number, or string) into ISO format:
 * 'YYYY-MM-DD' or '--MM-DD' (if year missing).
 * Returns null if invalid or unparseable.
 */
export function parseBirthday(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Real JS Date
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Numeric serial from Excel
  if (typeof raw === 'number') {
    // If it's a 4-digit number like 1995 or 2000, it's just a year or invalid as full birthday
    if (raw > 59 && raw < 100000) {
      const d = excelSerialToDate(raw);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  let str = String(raw).trim();
  if (!str) return null;

  // If numeric string like "35065"
  if (/^\d{4,5}$/.test(str)) {
    const num = Number(str);
    if (num > 59 && num < 100000) {
      const d = excelSerialToDate(num);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  str = convertArabicDigits(str).replace(/[^\d\-/.]/g, '').trim();
  if (!str) return null;

  // Match --MM-DD
  const noYearMatch = str.match(/^--?(\d{1,2})[-/.](\d{1,2})$/);
  if (noYearMatch) {
    const m = parseInt(noYearMatch[1], 10);
    const d = parseInt(noYearMatch[2], 10);
    if (isValidDay(null, m, d)) {
      return `--${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (y >= 1900 && y <= 2100 && isValidDay(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  // Match DD/MM/YYYY or D-M-YYYY (day first for ambiguous text per spec)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (y >= 1900 && y <= 2100 && isValidDay(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  // Match DD/MM or D-M (no year)
  const dmMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10);
    const m = parseInt(dmMatch[2], 10);
    if (isValidDay(null, m, d)) {
      return `--${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

export interface UpcomingBirthdayResult {
  isToday: boolean;
  isUpcoming: boolean;
  daysRemaining: number;
}

/**
 * Checks if a birthday is today or within the next 7 days.
 */
export function isUpcomingBirthday(
  birthdayStr?: string | null,
  referenceDate: Date = new Date()
): UpcomingBirthdayResult | null {
  if (!birthdayStr) return null;

  let month = 0;
  let day = 0;

  if (birthdayStr.startsWith('--')) {
    const parts = birthdayStr.slice(2).split('-');
    if (parts.length !== 2) return null;
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
  } else {
    const parts = birthdayStr.split('-');
    if (parts.length !== 3) return null;
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const currentYear = referenceDate.getFullYear();
  const todayAtMidnight = new Date(currentYear, referenceDate.getMonth(), referenceDate.getDate()).getTime();

  // Handle Feb 29 for non-leap years
  function getCandidateDate(y: number): Date {
    if (month === 2 && day === 29) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return isLeap ? new Date(y, 1, 29) : new Date(y, 1, 28);
    }
    return new Date(y, month - 1, day);
  }

  let candidate = getCandidateDate(currentYear);
  let diffDays = Math.round((candidate.getTime() - todayAtMidnight) / (1000 * 60 * 60 * 24));

  // If it already passed in the current year, check next year
  if (diffDays < 0) {
    candidate = getCandidateDate(currentYear + 1);
    diffDays = Math.round((candidate.getTime() - todayAtMidnight) / (1000 * 60 * 60 * 24));
  }

  const isToday = diffDays === 0;
  const isUpcoming = diffDays >= 0 && diffDays <= 7;

  return {
    isToday,
    isUpcoming,
    daysRemaining: diffDays
  };
}

/**
 * Formats birthday for human display in Arabic.
 */
export function formatBirthdayDisplay(birthdayStr?: string | null): string {
  if (!birthdayStr) return '';
  if (birthdayStr.startsWith('--')) {
    const [m, d] = birthdayStr.slice(2).split('-');
    return `${d}/${m}`;
  }
  const [y, m, d] = birthdayStr.split('-');
  return `${d}/${m}/${y}`;
}
