export interface Contact {
  id: string; // normalized primary phone as dedupe key
  name: string;
  phones: string[]; // E.164 strings (+20...), primary first
  birthday?: string; // ISO 'YYYY-MM-DD' or '--MM-DD'
  sources: string[]; // file ids
  lastContactAt: number | null; // timestamp ms
  lastContactType: 'call' | 'whatsapp' | null;
  createdAt: number; // timestamp ms
}

export interface ImportedFileMeta {
  id: string; // unique id
  name: string;
  importedAt: number; // timestamp ms
  contactCount: number;
}

export type WhatsAppMode = 'auto' | 'app' | 'web';

export interface AppSettings {
  whatsappMode: WhatsAppMode;
  defaultCountryCode: string; // e.g. '20' or '+20'
}

export interface ImportRowError {
  rowNumber: number;
  rawName?: string;
  rawPhone?: string;
  reason: string;
}

export interface ImportReport {
  fileName: string;
  totalRows: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: ImportRowError[];
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: number;
  contacts: Contact[];
  filesMeta: ImportedFileMeta[];
  settings: AppSettings;
}

