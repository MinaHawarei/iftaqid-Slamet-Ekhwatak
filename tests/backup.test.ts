import { describe, it, expect } from 'vitest';
import {
  createBackupPayload,
  mergeBackupWithState,
  validateBackupJson
} from '../src/lib/backup';
import { AppSettings, BackupPayload, Contact, ImportedFileMeta } from '../src/store/types';

describe('Backup and Restore', () => {
  const sampleSettings: AppSettings = {
    whatsappMode: 'auto',
    defaultCountryCode: '20'
  };

  const sampleContacts: Contact[] = [
    {
      id: '+201011112222',
      name: 'مينا سمير',
      phones: ['+201011112222'],
      sources: ['file-1'],
      lastContactAt: 1000,
      lastContactType: 'call',
      createdAt: 500
    }
  ];

  const sampleFiles: ImportedFileMeta[] = [
    {
      id: 'file-1',
      name: 'خدام.xlsx',
      importedAt: 500,
      contactCount: 1
    }
  ];

  describe('createBackupPayload and validateBackupJson', () => {
    it('creates and validates valid backup payload', () => {
      const payload = createBackupPayload(sampleContacts, sampleFiles, sampleSettings);
      const jsonStr = JSON.stringify(payload);

      const val = validateBackupJson(jsonStr);
      expect(val.valid).toBe(true);
      expect(val.payload).toBeDefined();
      expect(val.payload?.contacts).toHaveLength(1);
      expect(val.payload?.contacts[0].name).toBe('مينا سمير');
    });

    it('rejects invalid JSON', () => {
      const val = validateBackupJson('not a json');
      expect(val.valid).toBe(false);
      expect(val.error).toContain('JSON');
    });

    it('rejects newer schema versions', () => {
      const newerPayload = {
        schemaVersion: 999,
        contacts: [],
        filesMeta: [],
        settings: sampleSettings
      };
      const val = validateBackupJson(JSON.stringify(newerPayload));
      expect(val.valid).toBe(false);
      expect(val.error).toContain('أحدث من هذا التطبيق');
    });
  });

  describe('mergeBackupWithState', () => {
    it('merges contacts where newest lastContactAt wins, and unions phones and sources', () => {
      const currentContacts: Contact[] = [
        {
          id: '+201011112222',
          name: 'مينا القديم',
          phones: ['+201011112222'],
          sources: ['file-1'],
          lastContactAt: 5000, // Newer lastContactAt
          lastContactType: 'call',
          createdAt: 100
        },
        {
          id: '+201099998888',
          name: 'بيشوي القديم',
          phones: ['+201099998888'],
          sources: ['file-1'],
          lastContactAt: 1000, // Older lastContactAt
          lastContactType: 'call',
          createdAt: 100
        }
      ];

      const backup: BackupPayload = {
        schemaVersion: 1,
        exportedAt: 2000,
        contacts: [
          {
            id: '+201011112222',
            name: 'مينا الجديد',
            phones: ['+201011112222', '+201122223333'],
            sources: ['file-2'],
            lastContactAt: 3000, // Older than current 5000
            lastContactType: 'whatsapp',
            createdAt: 100
          },
          {
            id: '+201099998888',
            name: 'بيشوي الجديد',
            phones: ['+201099998888'],
            sources: ['file-2'],
            lastContactAt: 8000, // Newer than current 1000
            lastContactType: 'whatsapp',
            createdAt: 100
          },
          {
            id: '+201077776666',
            name: 'كيرلس الجديد',
            phones: ['+201077776666'],
            sources: ['file-2'],
            lastContactAt: null,
            lastContactType: null,
            createdAt: 100
          }
        ],
        filesMeta: [
          {
            id: 'file-2',
            name: 'جديد.xlsx',
            importedAt: 200,
            contactCount: 3
          }
        ],
        settings: sampleSettings
      };

      const { mergedContacts, mergedFiles } = mergeBackupWithState(
        currentContacts,
        sampleFiles,
        backup
      );

      // Contact 1: current lastContactAt 5000 wins against backup 3000
      const c1 = mergedContacts.find((c) => c.id === '+201011112222');
      expect(c1).toBeDefined();
      expect(c1?.lastContactAt).toBe(5000);
      expect(c1?.lastContactType).toBe('call');
      expect(c1?.phones).toEqual(['+201011112222', '+201122223333']);
      expect(c1?.sources).toContain('file-1');
      expect(c1?.sources).toContain('file-2');

      // Contact 2: backup lastContactAt 8000 wins against current 1000
      const c2 = mergedContacts.find((c) => c.id === '+201099998888');
      expect(c2).toBeDefined();
      expect(c2?.lastContactAt).toBe(8000);
      expect(c2?.lastContactType).toBe('whatsapp');

      // Contact 3: new contact added
      const c3 = mergedContacts.find((c) => c.id === '+201077776666');
      expect(c3).toBeDefined();

      // Files merged
      expect(mergedFiles).toHaveLength(2);
    });
  });
});

