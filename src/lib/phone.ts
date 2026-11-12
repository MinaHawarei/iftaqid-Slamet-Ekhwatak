/**
 * Normalizes and validates phone numbers according to E.164 format (+[8-15 digits]).
 */

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Converts Arabic-Indic numerals (٠-٩) to Western numerals (0-9).
 */
export function convertArabicDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (c) => String(ARABIC_INDIC_DIGITS.indexOf(c)));
}

/**
 * Clean default country code to bare digits (e.g., "+20" -> "20").
 */
export function cleanCountryCode(countryCode: string | undefined): string {
  if (!countryCode) return '20';
  const digits = convertArabicDigits(countryCode).replace(/\D/g, '');
  return digits || '20';
}

/**
 * Splits a cell that may contain multiple numbers separated by:
 * - standard comma (,) or Arabic comma (،)
 * - semicolon (;)
 * - slash (/)
 * - pipe (|)
 * - newlines (\n, \r)
 * - dash surrounded by spaces (" - ") or dash between numbers (e.g. 8+ digits followed by dash and next number)
 */
export function splitPhoneCell(cellValue: unknown): string[] {
  if (cellValue === null || cellValue === undefined) return [];
  const str = String(cellValue).trim();
  if (!str) return [];

  // Match separators: commas, slashes, semicolons, pipe, newlines, " - ",
  // or a dash separating two phone numbers (e.g. 8+ digits, dash, then digit/plus)
  const regex = /[,،/;\n\r|]+|\s+-\s+|(?<=\d{8,15})-(?=[+0-9٠-٩])/;
  return str
    .split(regex)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Normalizes a single phone string/number to E.164 format (+8 to 15 digits).
 * Returns null if invalid or cannot be normalized.
 */
export function normalizePhone(
  raw: unknown,
  defaultCountryCode: string = '20'
): string | null {
  if (raw === null || raw === undefined) return null;

  let str = String(raw).trim();
  if (!str) return null;

  // Handle excel float representation e.g. 201012345678.0
  str = str.replace(/\.0+$/, '');

  // Convert Arabic-Indic digits to Western
  str = convertArabicDigits(str);

  const cc = cleanCountryCode(defaultCountryCode);
  const hasPlus = str.startsWith('+');

  // Strip spaces, dashes, parentheses, dots and other formatting
  let d = str.replace(/[^\d]/g, '');
  if (!d) return null;

  // 1. Leading international prefix "00"
  if (d.startsWith('00')) {
    d = d.slice(2);
  }
  // 2. Malformed "+0..." (where a plus was mistakenly prepended to a local number starting with 0)
  else if (hasPlus && d.startsWith('0')) {
    d = cc + d.slice(1);
  }
  // 3. Malformed double country code e.g. "+2" + "20..." -> "+220..."
  else if (cc === '20' && d.startsWith('220') && (d.length === 12 || d.length === 13)) {
    d = d.slice(1);
  }
  // 4. If it started with "+", the rest is already an international number
  else if (hasPlus) {
    // Keep international digits
  }
  // 5. Local number starting with 0 (e.g. 01012345678 in Egypt)
  else if (d.startsWith('0')) {
    d = cc + d.slice(1);
  }
  // 6. Egyptian number missing the leading 0 (10 digits starting with 10, 11, 12, 15 or general 1)
  else if (cc === '20' && /^1\d{9}$/.test(d)) {
    d = '20' + d;
  }
  // 7. If it already starts with default country code without "+" (e.g. 201012345678)
  else if (d.startsWith(cc) && d.length >= 10) {
    // Keep as is
  }

  // Validate E.164 length: between 8 and 15 digits
  if (/^\d{8,15}$/.test(d)) {
    return '+' + d;
  }

  return null;
}

export interface SkippedPhone {
  value: string;
  reason: string;
}

export interface ParsePhoneCellResult {
  phones: string[];
  skipped: SkippedPhone[];
}

/**
 * Pure function to parse an Excel phone cell:
 * - Splits first on any separator (comma, Arabic comma, slash, semicolon, newline, " - ")
 * - Trims each part independently
 * - Normalizes each part with normalizePhone
 * - Validates length 8-15 digits
 * - Dedupes numbers inside the same cell
 * - Ignores empty segments
 * - Preserves the first valid number as primary
 */
export function parsePhoneCell(
  raw: unknown,
  defaultCountryCode: string = '20'
): ParsePhoneCellResult {
  const candidates = splitPhoneCell(raw);
  const phones: string[] = [];
  const skipped: SkippedPhone[] = [];

  for (const cand of candidates) {
    const trimmed = cand.trim();
    if (!trimmed) continue;

    const normalized = normalizePhone(trimmed, defaultCountryCode);
    if (normalized) {
      if (!phones.includes(normalized)) {
        phones.push(normalized);
      }
    } else {
      skipped.push({
        value: trimmed,
        reason: 'رقم هاتف غير صالح'
      });
    }
  }

  return { phones, skipped };
}

/**
 * Returns bare digits without the leading plus sign (for wa.me links).
 */
export function toBareDigits(phoneWithPlus: string | null | undefined): string {
  if (!phoneWithPlus) return '';
  return phoneWithPlus.replace(/\D/g, '');
}

/**
 * Formats a phone number for display (keeps E.164 or readable format).
 */
export function formatPhoneDisplay(phone: string): string {
  return phone;
}
