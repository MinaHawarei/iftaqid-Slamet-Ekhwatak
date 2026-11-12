import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  mergeContacts,
  parseExcelData,
  removeFileFromContacts,
  sanitizeName
} from '../src/lib/excel';
import { Contact } from '../src/store/types';

describe('Excel Parsing and Contact Merging', () => {
  const sampleFilePath = path.resolve(__dirname, '../sample/contacts-sample.xlsx');
  const sampleBuffer = fs.readFileSync(sampleFilePath);

  describe('sanitizeName', () => {
    it('trims and collapses whitespace', () => {
      expect(sanitizeName('   مينا   سمير  ')).toBe('مينا سمير');
      expect(sanitizeName(null)).toBe('');
    });
  });

  describe('parseExcelData with sample/contacts-sample.xlsx', () => {
    it('skips header row and maps columns B (Name), D (Mobile), G (Birthday)', () => {
      const result = parseExcelData(sampleBuffer, 'contacts-sample.xlsx', '20');

      expect(result.fileName).toBe('contacts-sample.xlsx');
      // Header row (row 1) must be ignored completely
      expect(result.rows.every((r) => r.name !== 'الاسم')).toBe(true);

      // Row 2: مينا سمير, +201212121212, 1995-05-15
      const rowMina = result.rows.find((r) => r.name === 'مينا سمير');
      expect(rowMina).toBeDefined();
      expect(rowMina?.phones).toEqual(['+201212121212']);
      expect(rowMina?.birthday).toBe('1995-05-15');

      // Row 3: بيشوي عادل has two numbers in one cell
      const rowBishoy = result.rows.find((r) => r.name === 'بيشوي عادل');
      expect(rowBishoy).toBeDefined();
      expect(rowBishoy?.phones).toEqual(['+201098765432', '+201123456789']);
      expect(rowBishoy?.birthday).toBe('1998-08-20');

      // Row 4: كيرلس مجدي has numeric phone and excel date serial
      const rowKirollos = result.rows.find((r) => r.name === 'كيرلس مجدي');
      expect(rowKirollos).toBeDefined();
      expect(rowKirollos?.phones).toEqual(['+201055554444']);
      expect(rowKirollos?.birthday).toBe('1996-01-01');

      // Row 5: مريم يوسف has missing birthday -> kept with undefined birthday
      const rowMariam = result.rows.find((r) => r.name === 'مريم يوسف');
      expect(rowMariam).toBeDefined();
      expect(rowMariam?.phones).toEqual(['+201200001111']);
      expect(rowMariam?.birthday).toBeUndefined();

      // Row 6: ديفيد نبيل with Arabic digits
      const rowDavid = result.rows.find((r) => r.name === 'ديفيد نبيل');
      expect(rowDavid).toBeDefined();
      expect(rowDavid?.phones).toEqual(['+201512345678']);
      expect(rowDavid?.birthday).toBe('1997-11-12');

      // Row 7: شخص برقم خاطئ (bad phone 123) should be skipped entirely
      const rowBadPhone = result.rows.find((r) => r.name === 'شخص برقم خاطئ');
      expect(rowBadPhone).toBeUndefined();
      const badPhoneError = result.errors.find((e) => e.rawName === 'شخص برقم خاطئ');
      expect(badPhoneError).toBeDefined();
      expect(badPhoneError?.reason).toContain('أرقام غير صالحة');

      // Row 8: جورج فايز has invalid birthday -> contact is kept, birthday omitted
      const rowGeorge = result.rows.find((r) => r.name === 'جورج فايز');
      expect(rowGeorge).toBeDefined();
      expect(rowGeorge?.phones).toEqual(['+201088887777']);
      expect(rowGeorge?.birthday).toBeUndefined();
      const bdayError = result.errors.find((e) => e.rawName === 'جورج فايز');
      expect(bdayError).toBeDefined();
    });
  });

  describe('mergeContacts', () => {
    it('merges new contacts and updates existing ones while preserving lastContactAt', () => {
      const existing: Contact[] = [
        {
          id: '+201212121212',
          name: 'مينا القديم',
          phones: ['+201212121212'],
          birthday: '1995-05-15',
          sources: ['file-1'],
          lastContactAt: 1700000000000,
          lastContactType: 'call',
          createdAt: 1690000000000
        }
      ];

      const parsed = parseExcelData(sampleBuffer, 'contacts-sample.xlsx', '20');
      const { updatedContacts, report } = mergeContacts(
        existing,
        parsed.rows,
        'file-2',
        'contacts-sample.xlsx',
        parsed.errors
      );

      // Contact '+201212121212' was updated: name updated to 'مينا سمير', lastContactAt preserved!
      const mina = updatedContacts.find((c) => c.id === '+201212121212');
      expect(mina).toBeDefined();
      expect(mina?.name).toBe('مينا سمير');
      expect(mina?.lastContactAt).toBe(1700000000000); // preserved!
      expect(mina?.lastContactType).toBe('call'); // preserved!
      expect(mina?.sources).toContain('file-1');
      expect(mina?.sources).toContain('file-2');

      // Report counts
      expect(report.updatedCount).toBe(1);
      expect(report.addedCount).toBeGreaterThanOrEqual(4);
      expect(report.skippedCount).toBe(1); // Row 7 skipped
    });
  });

  describe('removeFileFromContacts', () => {
    it('deletes contacts belonging ONLY to that file, and preserves shared contacts', () => {
      const contacts: Contact[] = [
        {
          id: '+201000000001',
          name: 'شخص خاص بملف 1 فقط',
          phones: ['+201000000001'],
          sources: ['file-1'],
          lastContactAt: null,
          lastContactType: null,
          createdAt: 1
        },
        {
          id: '+201000000002',
          name: 'شخص مشترك بين ملفين',
          phones: ['+201000000002'],
          sources: ['file-1', 'file-2'],
          lastContactAt: null,
          lastContactType: null,
          createdAt: 1
        }
      ];

      const afterRemoval = removeFileFromContacts(contacts, 'file-1');

      // Contact 1 must be deleted
      expect(afterRemoval.find((c) => c.id === '+201000000001')).toBeUndefined();

      // Contact 2 must remain, but without file-1 in sources
      const c2 = afterRemoval.find((c) => c.id === '+201000000002');
      expect(c2).toBeDefined();
      expect(c2?.sources).toEqual(['file-2']);
    });
  });
});

