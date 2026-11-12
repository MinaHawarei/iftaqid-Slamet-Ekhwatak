import { create } from 'zustand';
import { AppSettings, BackupPayload, Contact, ImportedFileMeta, ImportReport } from './types';
import {
  CURRENT_SCHEMA_VERSION,
  loadLegacyOrder,
  migrateContactsV1ToV2,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  saveLegacyOrder,
  STORAGE_KEYS
} from '../lib/storage';
import { normalizePhone } from '../lib/phone';
import { Verse, VERSES } from '../data/verses';
import { mergeBackupWithState } from '../lib/backup';
import { mergeContacts, parseExcelData, removeFileFromContacts } from '../lib/excel';
import { sortQueue } from '../lib/queue';

export interface TabVerses {
  random: Verse | null;
  number: Verse | null;
  custom: Verse | null;
}

interface PersistedState {
  version: number;
  contacts: Contact[];
  filesMeta: ImportedFileMeta[];
  settings: AppSettings;
  activeContactId: string | null;
  activeContactPhone: string | null;
  order: number[];
  tabVerses: TabVerses;
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
  tabVerses: TabVerses;

  // Ephemeral state
  seenNumbers: Set<number>;
  activeTab: 'random' | 'number' | 'custom';
  isConfigOpen: boolean;
  isQueueOpen: boolean;
  isShareOpen: boolean;
  activeReport: ImportReport | null;
  toast: { text: string; id: number } | null;
  undoSnapshot: UndoSnapshot | null;

  // Actions
  setActiveTab: (tab: 'random' | 'number' | 'custom') => void;
  setIsConfigOpen: (open: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  setIsShareOpen: (open: boolean) => void;
  setActiveReport: (report: ImportReport | null) => void;
  showToast: (text: string) => void;

  // Verses
  setTabVerse: (tab: 'random' | 'number' | 'custom', verse: Verse | null) => void;
  getActiveVerse: () => Verse | null;

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

  const defaultTabVerses: TabVerses = {
    random: null,
    number: null,
    custom: null
  };

  if (!saved) {
    return {
      version: CURRENT_SCHEMA_VERSION,
      contacts: [],
      filesMeta: [],
      settings: defaultSettings,
      activeContactId: null,
      activeContactPhone: null,
      order,
      tabVerses: defaultTabVerses
    };
  }

  const defaultCountryCode = saved.settings?.defaultCountryCode || '20';
  let rawContacts = Array.isArray(saved.contacts) ? saved.contacts : [];

  // Migration from v1 to v2: repair broken phone numbers in contacts
  const needsMigration = typeof saved.version !== 'number' || saved.version < 2;
  if (needsMigration && rawContacts.length > 0) {
    rawContacts = migrateContactsV1ToV2(rawContacts, defaultCountryCode);
  }

  let activeContactPhone = saved.activeContactPhone || null;
  let activeContactId = saved.activeContactId || null;

  if (activeContactPhone) {
    activeContactPhone = normalizePhone(activeContactPhone, defaultCountryCode) || activeContactPhone;
  }
  if (activeContactId) {
    activeContactId = normalizePhone(activeContactId, defaultCountryCode) || activeContactId;
  }

  const result: PersistedState = {
    version: CURRENT_SCHEMA_VERSION,
    contacts: rawContacts,
    filesMeta: Array.isArray(saved.filesMeta) ? saved.filesMeta : [],
    settings: {
      whatsappMode: saved.settings?.whatsappMode || 'auto',
      defaultCountryCode
    },
    activeContactId,
    activeContactPhone,
    order: Array.isArray(saved.order) && saved.order.length === VERSES.length ? saved.order : order,
    tabVerses: {
      random: saved.tabVerses?.random || null,
      number: saved.tabVerses?.number || null,
      custom: saved.tabVerses?.custom || null
    }
  };

  if (needsMigration) {
    persistState(result);
  }

  return result;
}

function persistState(state: PersistedState): void {
  safeSetItem(STORAGE_KEYS.APP_STATE, state);
  if (state.order) {
    saveLegacyOrder(state.order);
  }
}

function saveAppState(s: AppState): void {
  persistState({
    version: CURRENT_SCHEMA_VERSION,
    contacts: s.contacts,
    filesMeta: s.filesMeta,
    settings: s.settings,
    activeContactId: s.activeContactId,
    activeContactPhone: s.activeContactPhone,
    order: s.order,
    tabVerses: s.tabVerses
  });
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
  tabVerses: initial.tabVerses,

  // Ephemeral state
  seenNumbers: new Set<number>(),
  activeTab: 'random',
  isConfigOpen: false,
  isQueueOpen: false,
  isShareOpen: false,
  activeReport: null,
  toast: null,
  undoSnapshot: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsConfigOpen: (open) => set({ isConfigOpen: open }),
  setIsQueueOpen: (open) => set({ isQueueOpen: open }),
  setIsShareOpen: (open) => set({ isShareOpen: open }),
  setActiveReport: (report) => set({ activeReport: report }),

  showToast: (text) => {
    set({ toast: { text, id: Date.now() } });
  },

  setTabVerse: (tab, verse) => {
    const updated = {
      ...get().tabVerses,
      [tab]: verse
    };
    set({ tabVerses: updated });
    saveAppState(get());
  },

  getActiveVerse: () => {
    const s = get();
    return s.tabVerses[s.activeTab];
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
    saveAppState(get());
  },

  closeVisit: () => {
    set({
      activeContactId: null,
      activeContactPhone: null,
      isQueueOpen: true
    });
    saveAppState(get());
  },

  setActiveContactPhone: (phone) => {
    set({ activeContactPhone: phone });
    saveAppState(get());
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

    saveAppState(get());
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

    saveAppState(get());

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
    saveAppState(get());
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

    saveAppState(get());

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

    saveAppState(get());

    get().showToast('تم حذف الملف وجهات الاتصال الخاصة به');
  },

  updateSettings: (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });
    saveAppState(get());
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
      isShareOpen: false,
      undoSnapshot: null,
      tabVerses: { random: null, number: null, custom: null }
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
    saveAppState(get());
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
    saveAppState(get());
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
    saveAppState(get());
  },

  markNumberSeen: (index: number) => {
    const newSeen = new Set(get().seenNumbers);
    newSeen.add(index);
    set({ seenNumbers: newSeen });
  }
}));
