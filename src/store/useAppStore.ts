import { create } from 'zustand';
import { AppSettings, BackupPayload, Contact, ImportedFileMeta, ImportReport } from './types';
import {
  CURRENT_SCHEMA_VERSION,
  loadLegacyOrder,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  saveLegacyOrder,
  STORAGE_KEYS
} from '../lib/storage';
import { VERSES } from '../data/verses';
import { mergeBackupWithState } from '../lib/backup';
import { mergeContacts, parseExcelData, removeFileFromContacts } from '../lib/excel';
import { sortQueue } from '../lib/queue';

interface PersistedState {
  version: number;
  contacts: Contact[];
  filesMeta: ImportedFileMeta[];
  settings: AppSettings;
  activeContactId: string | null;
  activeContactPhone: string | null;
  order: number[];
}

interface UndoSnapshot {
  contactId: string;
  previousAt: number | null;
  previousType: 'call' | 'whatsapp' | null;
}

export interface AppState {
  // Persisted state
  contacts: Contact[];
  filesMeta: ImportedFileMeta[];
  settings: AppSettings;
  activeContactId: string | null;
  activeContactPhone: string | null;
  order: number[];

  // Ephemeral state
  seenNumbers: Set<number>;
  activeTab: 'random' | 'number' | 'custom';
  isConfigOpen: boolean;
  isQueueOpen: boolean;
  activeReport: ImportReport | null;
  toast: { text: string; id: number } | null;
  undoSnapshot: UndoSnapshot | null;

  // Actions
  setActiveTab: (tab: 'random' | 'number' | 'custom') => void;
  setIsConfigOpen: (open: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  setActiveReport: (report: ImportReport | null) => void;
  showToast: (text: string) => void;

  // Contacts & Queue
  openVisit: (contactId: string) => void;
  closeVisit: () => void;
  setActiveContactPhone: (phone: string) => void;
  goToNextInQueue: () => void;
  goToPreviousInQueue: () => void;
  recordContactActivity: (contactId: string, type: 'call' | 'whatsapp') => void;
  undoLastContact: () => void;
  manualUpdateContactDate: (contactId: string, timestamp: number | null) => void;

  // Excel & Data
  importExcelFile: (file: File) => Promise<ImportReport>;
  removeFile: (fileId: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  clearAllData: () => void;
  applyBackupReplace: (backup: BackupPayload) => void;
  applyBackupMerge: (backup: BackupPayload) => void;

  // Verses / Number Grid
  shuffleNumbers: () => void;
  markNumberSeen: (index: number) => void;
}

// Initial default shuffle order
function getInitialOrder(): number[] {
  const legacy = loadLegacyOrder(VERSES.length);
  if (legacy) return legacy;

  const defaultOrder = VERSES.map((_, i) => i);
  // Do an initial shuffle
  for (let i = defaultOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [defaultOrder[i], defaultOrder[j]] = [defaultOrder[j], defaultOrder[i]];
  }
  saveLegacyOrder(defaultOrder);
  return defaultOrder;
}

function loadPersistedState(): PersistedState {
  const saved = safeGetItem<PersistedState>(STORAGE_KEYS.APP_STATE);
  const order = getInitialOrder();

  const defaultSettings: AppSettings = {
    whatsappMode: 'auto',
    defaultCountryCode: '20'
  };

  if (!saved) {
    return {
      version: CURRENT_SCHEMA_VERSION,
      contacts: [],
      filesMeta: [],
      settings: defaultSettings,
      activeContactId: null,
      activeContactPhone: null,
      order
    };
  }

  // Schema migrations if needed in future
  return {
    version: CURRENT_SCHEMA_VERSION,
    contacts: Array.isArray(saved.contacts) ? saved.contacts : [],
    filesMeta: Array.isArray(saved.filesMeta) ? saved.filesMeta : [],
    settings: {
      whatsappMode: saved.settings?.whatsappMode || 'auto',
      defaultCountryCode: saved.settings?.defaultCountryCode || '20'
    },
    activeContactId: saved.activeContactId || null,
    activeContactPhone: saved.activeContactPhone || null,
    order: Array.isArray(saved.order) && saved.order.length === VERSES.length ? saved.order : order
  };
}

function persistState(state: PersistedState): void {
  safeSetItem(STORAGE_KEYS.APP_STATE, state);
  if (state.order) {
    saveLegacyOrder(state.order);
  }
}

const initial = loadPersistedState();

export const useAppStore = create<AppState>((set, get) => ({
  // Persisted state
  contacts: initial.contacts,
  filesMeta: initial.filesMeta,
  settings: initial.settings,
  activeContactId: initial.activeContactId,
  activeContactPhone: initial.activeContactPhone,
  order: initial.order,

  // Ephemeral state
  seenNumbers: new Set<number>(),
  activeTab: 'random',
  isConfigOpen: false,
  isQueueOpen: false,
  activeReport: null,
  toast: null,
  undoSnapshot: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsConfigOpen: (open) => set({ isConfigOpen: open }),
  setIsQueueOpen: (open) => set({ isQueueOpen: open }),
  setActiveReport: (report) => set({ activeReport: report }),

  showToast: (text) => {
    set({ toast: { text, id: Date.now() } });
  },

  openVisit: (contactId) => {
    const contact = get().contacts.find((c) => c.id === contactId);
    if (!contact) return;
    const phone = contact.phones[0] || '';
    set({
      activeContactId: contactId,
      activeContactPhone: phone,
      isQueueOpen: false
    });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: s.contacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: contactId,
      activeContactPhone: phone,
      order: s.order
    });
  },

  closeVisit: () => {
    set({
      activeContactId: null,
      activeContactPhone: null,
      isQueueOpen: true
    });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: s.contacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: null,
      activeContactPhone: null,
      order: s.order
    });
  },

  setActiveContactPhone: (phone) => {
    set({ activeContactPhone: phone });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: s.contacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: phone,
      order: s.order
    });
  },

  goToNextInQueue: () => {
    const sorted = sortQueue(get().contacts);
    const currId = get().activeContactId;
    const idx = sorted.findIndex((c) => c.id === currId);
    if (idx >= 0 && idx < sorted.length - 1) {
      const nextContact = sorted[idx + 1];
      get().openVisit(nextContact.id);
    }
  },

  goToPreviousInQueue: () => {
    const sorted = sortQueue(get().contacts);
    const currId = get().activeContactId;
    const idx = sorted.findIndex((c) => c.id === currId);
    if (idx > 0) {
      const prevContact = sorted[idx - 1];
      get().openVisit(prevContact.id);
    }
  },

  recordContactActivity: (contactId, type) => {
    const contact = get().contacts.find((c) => c.id === contactId);
    if (!contact) return;

    // Save snapshot for Undo
    const snapshot: UndoSnapshot = {
      contactId,
      previousAt: contact.lastContactAt,
      previousType: contact.lastContactType
    };

    const now = Date.now();
    const updatedContacts = get().contacts.map((c) =>
      c.id === contactId ? { ...c, lastContactAt: now, lastContactType: type } : c
    );

    set({
      contacts: updatedContacts,
      undoSnapshot: snapshot
    });

    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: updatedContacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });
  },

  undoLastContact: () => {
    const snap = get().undoSnapshot;
    if (!snap) return;

    const updatedContacts = get().contacts.map((c) =>
      c.id === snap.contactId
        ? { ...c, lastContactAt: snap.previousAt, lastContactType: snap.previousType }
        : c
    );

    set({
      contacts: updatedContacts,
      undoSnapshot: null
    });

    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: updatedContacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });

    get().showToast('تم التراجع عن تسجيل الافتقاد');
  },

  manualUpdateContactDate: (contactId, timestamp) => {
    const updatedContacts = get().contacts.map((c) =>
      c.id === contactId
        ? {
            ...c,
            lastContactAt: timestamp,
            lastContactType: timestamp ? c.lastContactType || 'call' : null
          }
        : c
    );

    set({ contacts: updatedContacts });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: updatedContacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });
  },

  importExcelFile: async (file: File) => {
    const buffer = await file.arrayBuffer();
    const parsed = parseExcelData(buffer, file.name, get().settings.defaultCountryCode);

    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { updatedContacts, report } = mergeContacts(
      get().contacts,
      parsed.rows,
      fileId,
      file.name,
      parsed.errors
    );

    const newFileMeta: ImportedFileMeta = {
      id: fileId,
      name: file.name,
      importedAt: Date.now(),
      contactCount: parsed.rows.length
    };

    const newFilesMeta = [...get().filesMeta, newFileMeta];

    set({
      contacts: updatedContacts,
      filesMeta: newFilesMeta,
      activeReport: report
    });

    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: updatedContacts,
      filesMeta: newFilesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });

    return report;
  },

  removeFile: (fileId: string) => {
    const updatedContacts = removeFileFromContacts(get().contacts, fileId);
    const updatedFiles = get().filesMeta.filter((f) => f.id !== fileId);

    // If active contact was deleted, clear active contact
    let activeId = get().activeContactId;
    let activePhone = get().activeContactPhone;
    if (activeId && !updatedContacts.some((c) => c.id === activeId)) {
      activeId = null;
      activePhone = null;
    }

    set({
      contacts: updatedContacts,
      filesMeta: updatedFiles,
      activeContactId: activeId,
      activeContactPhone: activePhone
    });

    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: updatedContacts,
      filesMeta: updatedFiles,
      settings: s.settings,
      activeContactId: activeId,
      activeContactPhone: activePhone,
      order: s.order
    });

    get().showToast('تم حذف الملف وجهات الاتصال الخاصة به');
  },

  updateSettings: (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: s.contacts,
      filesMeta: s.filesMeta,
      settings: merged,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });
  },

  clearAllData: () => {
    safeRemoveItem(STORAGE_KEYS.APP_STATE);
    set({
      contacts: [],
      filesMeta: [],
      activeContactId: null,
      activeContactPhone: null,
      isQueueOpen: false,
      isConfigOpen: false,
      undoSnapshot: null
    });
    get().showToast('تم مسح جميع البيانات بنجاح');
  },

  applyBackupReplace: (backup: BackupPayload) => {
    set({
      contacts: backup.contacts,
      filesMeta: backup.filesMeta,
      settings: backup.settings,
      activeContactId: null,
      activeContactPhone: null
    });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: backup.contacts,
      filesMeta: backup.filesMeta,
      settings: backup.settings,
      activeContactId: null,
      activeContactPhone: null,
      order: s.order
    });
    get().showToast(`تم استعادة النسخة الاحتياطية (${backup.contacts.length} جهة اتصال)`);
  },

  applyBackupMerge: (backup: BackupPayload) => {
    const { mergedContacts, mergedFiles } = mergeBackupWithState(
      get().contacts,
      get().filesMeta,
      backup
    );
    set({
      contacts: mergedContacts,
      filesMeta: mergedFiles
    });
    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: mergedContacts,
      filesMeta: mergedFiles,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: s.order
    });
    get().showToast(`تم دمج النسخة الاحتياطية (${mergedContacts.length} إجمالي جهات الاتصال)`);
  },

  shuffleNumbers: () => {
    const curr = [...get().order];
    const prev = curr.join();
    do {
      for (let i = curr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [curr[i], curr[j]] = [curr[j], curr[i]];
      }
    } while (curr.length > 1 && curr.join() === prev);

    set({ order: curr, seenNumbers: new Set<number>() });
    saveLegacyOrder(curr);

    const s = get();
    persistState({
      version: CURRENT_SCHEMA_VERSION,
      contacts: s.contacts,
      filesMeta: s.filesMeta,
      settings: s.settings,
      activeContactId: s.activeContactId,
      activeContactPhone: s.activeContactPhone,
      order: curr
    });
  },

  markNumberSeen: (index: number) => {
    const newSeen = new Set(get().seenNumbers);
    newSeen.add(index);
    set({ seenNumbers: newSeen });
  }
}));

