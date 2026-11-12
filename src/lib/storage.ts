/**
 * Safe localStorage wrapper with error handling, schema versioning, and migration support.
 */

import { Contact } from '../store/types';
import { normalizePhone } from './phone';

export const STORAGE_KEYS = {
  APP_STATE: 'ayat-almalak-store-v1',
  LEGACY_ORDER: 'iftaqed-order-v1'
} as const;

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migrates contacts from schema v1 to v2:
 * - Re-normalizes every phone number with normalizePhone (fixing broken prefixes like "+010..." or "+220...")
 * - Removes duplicates within a contact's phones
 * - Updates contact.id to primary phone
 * - Merges contacts if two contacts now share the same primary phone,
 *   preserving lastContactAt, sources, and metadata.
 */
export function migrateContactsV1ToV2(
  contacts: Contact[],
  defaultCountryCode: string = '20'
): Contact[] {
  if (!Array.isArray(contacts)) return [];

  const contactsMap = new Map<string, Contact>();

  for (const c of contacts) {
    if (!c) continue;

    // Collect and normalize all candidate phone numbers for this contact
    const rawList = Array.isArray(c.phones) && c.phones.length > 0 ? c.phones : [c.id];
    const validPhones: string[] = [];

    for (const p of rawList) {
      const normalized = normalizePhone(p, defaultCountryCode);
      if (normalized && !validPhones.includes(normalized)) {
        validPhones.push(normalized);
      }
    }

    // If phones were invalid but id could be normalized
    if (validPhones.length === 0 && c.id) {
      const normalizedId = normalizePhone(c.id, defaultCountryCode);
      if (normalizedId) {
        validPhones.push(normalizedId);
      }
    }

    if (validPhones.length === 0) {
      // Keep contact with existing id if present so we don't drop data unexpectedly
      if (c.id && !contactsMap.has(c.id)) {
        contactsMap.set(c.id, { ...c });
      }
      continue;
    }

    const primaryPhone = validPhones[0];
    const existing = contactsMap.get(primaryPhone);

    if (existing) {
      // Merge into existing: combine phones, preserve highest lastContactAt
      const mergedPhones = [primaryPhone];
      for (const p of [...existing.phones.slice(1), ...validPhones.slice(1)]) {
        if (!mergedPhones.includes(p)) {
          mergedPhones.push(p);
        }
      }

      let lastContactAt = existing.lastContactAt;
      let lastContactType = existing.lastContactType;
      if (
        typeof c.lastContactAt === 'number' &&
        (lastContactAt === null || c.lastContactAt > lastContactAt)
      ) {
        lastContactAt = c.lastContactAt;
        lastContactType = c.lastContactType || existing.lastContactType;
      }

      const mergedSources = Array.from(new Set([...(existing.sources || []), ...(c.sources || [])]));

      contactsMap.set(primaryPhone, {
        id: primaryPhone,
        name: existing.name || c.name,
        phones: mergedPhones,
        birthday: existing.birthday || c.birthday,
        sources: mergedSources,
        lastContactAt,
        lastContactType,
        createdAt: Math.min(existing.createdAt || Date.now(), c.createdAt || Date.now())
      });
    } else {
      contactsMap.set(primaryPhone, {
        ...c,
        id: primaryPhone,
        phones: validPhones
      });
    }
  }

  return Array.from(contactsMap.values());
}

/**
 * Safely reads a key from localStorage. Returns null on error or missing.
 */
export function safeGetItem<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[storage] Failed to read key "${key}" from localStorage:`, err);
    return null;
  }
}

/**
 * Safely writes a key to localStorage. Handles QuotaExceededError and disabled storage.
 */
export function safeSetItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (err: unknown) {
    console.error(`[storage] Failed to write key "${key}" to localStorage:`, err);
    return false;
  }
}

/**
 * Safely removes a key from localStorage.
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to remove key "${key}" from localStorage:`, err);
  }
}

/**
 * Loads the legacy shuffle order if present, or validates an order array.
 */
export function loadLegacyOrder(expectedLength: number): number[] | null {
  const saved = safeGetItem<unknown>(STORAGE_KEYS.LEGACY_ORDER);
  if (
    Array.isArray(saved) &&
    saved.length === expectedLength &&
    new Set(saved).size === expectedLength &&
    saved.every((x) => typeof x === 'number' && x >= 0 && x < expectedLength)
  ) {
    return saved as number[];
  }
  return null;
}

/**
 * Saves the legacy shuffle order for backward compatibility.
 */
export function saveLegacyOrder(order: number[]): void {
  safeSetItem(STORAGE_KEYS.LEGACY_ORDER, order);
}

