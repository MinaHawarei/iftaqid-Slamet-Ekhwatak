/**
 * Safe localStorage wrapper with error handling, schema versioning, and migration support.
 */

export const STORAGE_KEYS = {
  APP_STATE: 'ayat-almalak-store-v1',
  LEGACY_ORDER: 'iftaqed-order-v1'
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

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

