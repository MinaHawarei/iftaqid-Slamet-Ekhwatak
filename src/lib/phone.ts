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
 * Splits a cell that may contain multiple numbers separated by comma, Arabic comma, slash, semicolon, or newline.
 */
export function splitPhoneCell(cellValue: unknown): string[] {
  if (cellValue === null || cellValue === undefined) return [];
  const str = String(cellValue).trim();
  if (!str) return [];

  // Split on commas (standard and Arabic), slashes, semicolons, pipe, or newlines
  const parts = str.split(/[,،/;\n\r|]+/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
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

  // Strip spaces, dashes, parentheses, dots
  let d = str.replace(/[^\d+]/g, '');
  if (!d) return null;

  const cc = cleanCountryCode(defaultCountryCode);

  if (d.startsWith('+')) {
    d = d.slice(1);
  } else if (d.startsWith('00')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    // Local number starting with 0 (e.g. 01012345678 in Egypt)
    d = cc + d.slice(1);
  } else if (cc === '20' && /^1\d{9}$/.test(d)) {
    // Egyptian local number missing the leading 0 (e.g. 1012345678)
    d = '20' + d;
  }

  // Validate: between 8 and 15 digits
  if (/^\d{8,15}$/.test(d)) {
    return '+' + d;
  }

  return null;
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

