import { describe, it, expect } from 'vitest';
import { migrateContactsV1ToV2 } from '../src/lib/storage';
import { Contact } from '../src/store/types';
import { parseExcelData, mergeContacts } from '../src/lib/excel';
import { buildWhatsAppUrl } from '../src/lib/whatsapp';
import { validateBackupJson } from '../src/lib/backup';
import * as XLSX from 'xlsx';

describe('V1 to V2 Migration & End-to-End Phone Pipeline', () => {

  describe('migrateContactsV1ToV2', () => {
    it('repairs malformed "+0..." and "+220..." in existing contacts', () => {
      const v1Contacts: Contact[] = [
        {
          id: '+01012345678',
          name: 'مارك حنا',
          phones: ['+01012345678', '+220112345678'],
          sources: ['file-1'],
          lastContactAt: 1700000000000,
          lastContactType: 'whatsapp',
          createdAt: 1690000000000
        },
        {
          id: '+201212121212',
          name: 'بيشوي عادل',
          phones: ['+201212121212', '+01098765432'], // second number was malformed with bare +
          sources: ['file-1'],
          lastContactAt: null,
          lastContactType: null,
          createdAt: 1690000001000
        }
      ];

      const migrated = migrateContactsV1ToV2(v1Contacts, '20');

      expect(migrated).toHaveLength(2);

      const mark = migrated.find((c) => c.name === 'مارك حنا');
      expect(mark).toBeDefined();
      expect(mark?.id).toBe('+201012345678');
      expect(mark?.phones).toEqual(['+201012345678', '+20112345678']);
      expect(mark?.lastContactAt).toBe(1700000000000);
      expect(mark?.lastContactType).toBe('whatsapp');

      const bishoy = migrated.find((c) => c.name === 'بيشوي عادل');
      expect(bishoy).toBeDefined();
      expect(bishoy?.id).toBe('+201212121212');
      expect(bishoy?.phones).toEqual(['+201212121212', '+201098765432']);
    });

    it('merges contacts that collapse onto the same primary phone and preserves highest lastContactAt', () => {
      const duplicateContacts: Contact[] = [
        {
          id: '+201012345678',
          name: 'مينا سمير',
          phones: ['+201012345678'],
          sources: ['file-a'],
          lastContactAt: 1680000000000,
          lastContactType: 'call',
          createdAt: 1600000000000
        },
        {
          id: '+01012345678', // was malformed, normalizes to same primary phone
          name: 'مينا سمير كامل',
          phones: ['+01012345678', '+201112223334'],
          sources: ['file-b'],
          lastContactAt: 1720000000000, // newer contact time!
          lastContactType: 'whatsapp',
          createdAt: 1650000000000
        }
      ];

      const migrated = migrateContactsV1ToV2(duplicateContacts, '20');
      expect(migrated).toHaveLength(1);
      const combined = migrated[0];
      expect(combined.id).toBe('+201012345678');
      expect(combined.phones).toEqual(['+201012345678', '+201112223334']);
      expect(combined.lastContactAt).toBe(1720000000000);
      expect(combined.lastContactType).toBe('whatsapp');
      expect(combined.sources).toContain('file-a');
      expect(combined.sources).toContain('file-b');
    });
  });

  describe('Re-importing Excel file preserves lastContactAt', () => {
    it('updates stored numbers without losing lastContactAt timestamp', () => {
      // Create a mock workbook with 2 numbers in column D
      const wsData = [
        ['م', 'الاسم', 'العنوان', 'الموبايل', 'الكلية', 'الخدمة', 'تاريخ الميلاد'],
        [1, 'جورج نبيل', 'شبرا', '01212121212, 01012345678', 'هندسة', 'شباب', '1995-05-15']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      // Existing contact in storage had previous contact history
      const existing: Contact[] = [
        {
          id: '+201212121212',
          name: 'جورج نبيل',
          phones: ['+201212121212'],
          birthday: '1995-05-15',
          sources: ['file-old'],
          lastContactAt: 1715000000000,
          lastContactType: 'call',
          createdAt: 1700000000000
        }
      ];

      const parsed = parseExcelData(buffer, 'test.xlsx', '20');
      expect(parsed.rows[0].phones).toEqual(['+201212121212', '+201012345678']);

      const { updatedContacts } = mergeContacts(
        existing,
        parsed.rows,
        'file-new',
        'test.xlsx',
        parsed.errors
      );

      expect(updatedContacts).toHaveLength(1);
      const updated = updatedContacts[0];
      expect(updated.id).toBe('+201212121212');
      expect(updated.phones).toEqual(['+201212121212', '+201012345678']);
      expect(updated.lastContactAt).toBe(1715000000000);
      expect(updated.lastContactType).toBe('call');
      expect(updated.sources).toEqual(['file-old', 'file-new']);
    });
  });

  describe('End-to-end path: Excel row -> stored contact -> Visit chips -> tel: / wa.me URLs', () => {
    it('produces clean E.164 and valid wa.me and tel: links without double prefixes', () => {
      // 1. Raw excel cell with two numbers separated by comma and spaces
      const rawCell = '  +201212121212  ,   01012345678  ';
      const wsData = [
        ['م', 'الاسم', 'العنوان', 'الموبايل', 'الكلية', 'الخدمة', 'تاريخ الميلاد'],
        [1, 'كيرلس سمير', 'مصر الجديدة', rawCell, 'تجارة', 'شباب', '']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      // 2. Parse Excel
      const parsed = parseExcelData(buffer, 'test.xlsx', '20');
      expect(parsed.rows).toHaveLength(1);
      const row = parsed.rows[0];

      // Phones must be clean E.164
      expect(row.phones).toEqual(['+201212121212', '+201012345678']);

      // 3. Stored in contacts list
      const { updatedContacts } = mergeContacts([], parsed.rows, 'file-1', 'test.xlsx', []);
      const contact = updatedContacts[0];
      expect(contact.phones[0]).toBe('+201212121212');
      expect(contact.phones[1]).toBe('+201012345678');

      // 4. Test phone chips in Visit view:
      // Primary phone
      const phone1 = contact.phones[0];
      const telLink1 = `tel:${phone1}`;
      expect(telLink1).toBe('tel:+201212121212');
      expect(telLink1).not.toContain('tel:++');
      expect(telLink1).not.toContain('tel:+2+');

      const waUrl1 = buildWhatsAppUrl(phone1, 'سلام', 'auto', true);
      expect(waUrl1.url).toBe('https://wa.me/201212121212?text=%D8%B3%D9%84%D8%A7%D9%85');
      expect(waUrl1.url).not.toContain('wa.me/+');
      expect(waUrl1.url).not.toContain('wa.me/220');

      // Secondary phone
      const phone2 = contact.phones[1];
      const telLink2 = `tel:${phone2}`;
      expect(telLink2).toBe('tel:+201012345678');
      expect(telLink2).not.toContain('tel:++');
      expect(telLink2).not.toContain('tel:+2+');

      const waUrl2 = buildWhatsAppUrl(phone2, 'سلام', 'auto', true);
      expect(waUrl2.url).toBe('https://wa.me/201012345678?text=%D8%B3%D9%84%D8%A7%D9%85');
      expect(waUrl2.url).not.toContain('wa.me/+');
      expect(waUrl2.url).not.toContain('wa.me/220');
    });
  });

  describe('Backup restore auto-migration', () => {
    it('migrates schemaVersion 1 backups with malformed numbers to schemaVersion 2', () => {
      const v1BackupJson = JSON.stringify({
        schemaVersion: 1,
        exportedAt: 1700000000000,
        contacts: [
          {
            id: '+01012345678',
            name: 'مايكل سمير',
            phones: ['+01012345678', '+2201212121212'],
            sources: ['file-1'],
            lastContactAt: 1710000000000,
            lastContactType: 'call',
            createdAt: 1700000000000
          }
        ],
        filesMeta: [],
        settings: {
          whatsappMode: 'auto',
          defaultCountryCode: '20'
        }
      });

      const res = validateBackupJson(v1BackupJson);
      expect(res.valid).toBe(true);
      expect(res.payload).toBeDefined();
      expect(res.payload?.schemaVersion).toBe(2);
      expect(res.payload?.contacts[0].id).toBe('+201012345678');
      expect(res.payload?.contacts[0].phones).toEqual(['+201012345678', '+201212121212']);
      expect(res.payload?.contacts[0].lastContactAt).toBe(1710000000000);
    });
  });
});
