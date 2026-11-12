import { AppSettings, BackupPayload, Contact, ImportedFileMeta } from '../store/types';
import { CURRENT_SCHEMA_VERSION, migrateContactsV1ToV2 } from './storage';

/**
 * Creates a backup payload object from the current state.
 */
export function createBackupPayload(
  contacts: Contact[],
  filesMeta: ImportedFileMeta[],
  settings: AppSettings
): BackupPayload {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    contacts,
    filesMeta,
    settings
  };
}

/**
 * Triggers a download of the JSON backup file in the browser.
 */
export function downloadBackupJson(payload: BackupPayload): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `iftaqed-backup-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  payload?: BackupPayload;
}

/**
 * Validates raw backup JSON string.
 */
export function validateBackupJson(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: 'الملف غير صالح وليس بصيغة JSON صحيحة.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'محتوى ملف النسخة الاحتياطية غير صالح.' };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'number') {
    return { valid: false, error: 'إصدار النسخة الاحتياطية مفقود أو غير معروف.' };
  }

  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `نسخة الملف (v${obj.schemaVersion}) أحدث من هذا التطبيق (v${CURRENT_SCHEMA_VERSION}). يرجى تحديث التطبيق أولاً.`
    };
  }

  if (!Array.isArray(obj.contacts)) {
    return { valid: false, error: 'قائمة جهات الاتصال مفقودة أو غير صالحة في ملف النسخة الاحتياطية.' };
  }

  // Validate contacts shape
  const validContacts: Contact[] = [];
  for (let i = 0; i < obj.contacts.length; i++) {
    const c = obj.contacts[i];
    if (!c || typeof c !== 'object') continue;
    const item = c as Partial<Contact>;
    if (!item.id || !item.name || !Array.isArray(item.phones) || item.phones.length === 0) {
      continue;
    }
    validContacts.push({
      id: String(item.id),
      name: String(item.name),
      phones: item.phones.map(String),
      birthday: item.birthday ? String(item.birthday) : undefined,
      sources: Array.isArray(item.sources) ? item.sources.map(String) : [],
      lastContactAt: typeof item.lastContactAt === 'number' ? item.lastContactAt : null,
      lastContactType:
        item.lastContactType === 'call' || item.lastContactType === 'whatsapp'
          ? item.lastContactType
          : null,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
    });
  }

  const validFilesMeta: ImportedFileMeta[] = [];
  if (Array.isArray(obj.filesMeta)) {
    for (const f of obj.filesMeta) {
      if (f && typeof f === 'object' && f.id && f.name) {
        validFilesMeta.push({
          id: String(f.id),
          name: String(f.name),
          importedAt: typeof f.importedAt === 'number' ? f.importedAt : Date.now(),
          contactCount: typeof f.contactCount === 'number' ? f.contactCount : 0
        });
      }
    }
  }

  const settings: AppSettings = {
    whatsappMode:
      obj.settings && typeof obj.settings === 'object' && 'whatsappMode' in obj.settings
        ? (obj.settings as AppSettings).whatsappMode
        : 'auto',
    defaultCountryCode:
      obj.settings && typeof obj.settings === 'object' && 'defaultCountryCode' in obj.settings
        ? String((obj.settings as AppSettings).defaultCountryCode)
        : '20'
  };

  const finalContacts =
    obj.schemaVersion < 2
      ? migrateContactsV1ToV2(validContacts, settings.defaultCountryCode)
      : validContacts;

  const payload: BackupPayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
    contacts: finalContacts,
    filesMeta: validFilesMeta,
    settings
  };

  return { valid: true, payload };
}

/**
 * Merges imported backup into current contacts and files:
 * Per contact: newest lastContactAt wins, union phones/sources.
 */
export function mergeBackupWithState(
  currentContacts: Contact[],
  currentFiles: ImportedFileMeta[],
  backup: BackupPayload
): {
  mergedContacts: Contact[];
  mergedFiles: ImportedFileMeta[];
} {
  const map = new Map<string, Contact>();
  currentContacts.forEach((c) => map.set(c.id, { ...c }));

  for (const incoming of backup.contacts) {
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
    } else {
      // Merge: newest lastContactAt wins
      let lastContactAt = existing.lastContactAt;
      let lastContactType = existing.lastContactType;

      if (incoming.lastContactAt !== null) {
        if (lastContactAt === null || incoming.lastContactAt > lastContactAt) {
          lastContactAt = incoming.lastContactAt;
          lastContactType = incoming.lastContactType;
        }
      }

      // Union phones, primary first
      const phones = [existing.phones[0]];
      for (const p of [...incoming.phones, ...existing.phones.slice(1)]) {
        if (!phones.includes(p)) {
          phones.push(p);
        }
      }

      // Union sources
      const sources = Array.from(new Set([...existing.sources, ...incoming.sources]));

      map.set(incoming.id, {
        ...existing,
        name: incoming.name || existing.name,
        birthday: incoming.birthday || existing.birthday,
        phones,
        sources,
        lastContactAt,
        lastContactType
      });
    }
  }

  // Files meta union by id
  const fileMap = new Map<string, ImportedFileMeta>();
  currentFiles.forEach((f) => fileMap.set(f.id, f));
  backup.filesMeta.forEach((f) => fileMap.set(f.id, f));

  return {
    mergedContacts: Array.from(map.values()),
    mergedFiles: Array.from(fileMap.values())
  };
}

