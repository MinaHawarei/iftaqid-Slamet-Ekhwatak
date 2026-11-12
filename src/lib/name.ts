/**
 * Utilities for formatting person names for display on cards.
 */

const COMPOUND_PREFIXES = new Set(['عبد', 'أبو', 'ابو', 'أم', 'ام', 'ابن']);

const TITLES = new Set([
  'أبونا',
  'ابونا',
  'القمص',
  'الأنبا',
  'دكتور',
  'د.',
  'م.',
  'مهندس',
  'أستاذ'
]);

/**
 * Returns a shortened two-part name (first name + father's name) for display on cards:
 * - Preserves leading titles in front of the name ("ابونا", "القمص", "دكتور", etc.).
 * - Treats compound names starting with "عبد", "أبو", "ابو", "أم", "ام", "ابن" as one part.
 * - Leaves 1-word or 2-word names intact.
 * - Collapses extra spaces while preserving Arabic text.
 */
export function getCardName(fullName: string | null | undefined): string {
  if (!fullName) return '';

  // Trim and collapse whitespace
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  const tokens = clean.split(' ');
  const titleTokens: string[] = [];

  // 1. Extract leading titles (not counted as name parts, kept in front)
  let idx = 0;
  while (idx < tokens.length && TITLES.has(tokens[idx])) {
    titleTokens.push(tokens[idx]);
    idx++;
  }

  // 2. Extract up to two name parts
  const nameParts: string[] = [];
  while (idx < tokens.length && nameParts.length < 2) {
    const currentToken = tokens[idx];
    if (COMPOUND_PREFIXES.has(currentToken) && idx + 1 < tokens.length) {
      nameParts.push(`${currentToken} ${tokens[idx + 1]}`);
      idx += 2;
    } else {
      nameParts.push(currentToken);
      idx += 1;
    }
  }

  const resultParts = [...titleTokens, ...nameParts];
  return resultParts.join(' ');
}

