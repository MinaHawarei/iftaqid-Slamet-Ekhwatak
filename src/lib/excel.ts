import * as XLSX from 'xlsx';
import { parsePhoneCell, normalizePhone } from './phone';
import { parseBirthday } from './birthday';
import { Contact, ImportReport, ImportRowError } from '../store/types';

export interface ParsedContactRow {
  rowNumber: number;
  name: string;
  phones: string[];
  birthday?: string;
  invalidPhones: string[];
  birthdayError?: string;
}

export interface ParseExcelResult {
  fileName: string;
  totalRows: number;
  rows: ParsedContactRow[];
  errors: ImportRowError[];
}

/**
 * Trims and collapses multiple spaces into a single space.
 */
export function sanitizeName(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

/**
 * Parses an Excel file (.xlsx, .xls, .csv) buffer.
 */
export function parseExcelData(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  defaultCountryCode: string = '20'
): ParseExcelResult {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false, // get formatted text where available
    dateNF: 'yyyy-mm-dd'
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('الملف فارغ أو لا يحتوي على أي صفحات.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of strings/values
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false
  });

  const parsedRows: ParsedContactRow[] = [];
  const errors: ImportRowError[] = [];

  // Row 1 (index 0) is header -> ignore completely
  for (let r = 1; r < data.length; r++) {
    const row = data[r] || [];
    const rowNumber = r + 1; // 1-based Excel row number

    // Check if entire row is empty
    const isRowEmpty = row.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === ''
    );
    if (isRowEmpty) continue;

    // Column B (index 1) = Name
    const rawName = row[1];
    const name = sanitizeName(rawName);

    // Column D (index 3) = Mobile number(s)
    const rawPhone = row[3];

    // Column G (index 6) = Birthday
    const rawBirthday = row[6];

    // Name is required
    if (!name) {
      errors.push({
        rowNumber,
        rawName: String(rawName || ''),
        rawPhone: String(rawPhone || ''),
        reason: 'اسم الشخص غير موجود (العمود B)'
      });
      continue;
    }

    // Process phone numbers using the single unified cell parser
    const { phones: validPhones, skipped } = parsePhoneCell(rawPhone, defaultCountryCode);
    const invalidPhones = skipped.map((s) => s.value);

    // Must have at least one valid phone
    if (validPhones.length === 0) {
      errors.push({
        rowNumber,
        rawName: name,
        rawPhone: String(rawPhone || ''),
        reason:
          invalidPhones.length > 0
            ? `أرقام غير صالحة (${invalidPhones.join(', ')})`
            : 'رقم الموبايل مفقود (العمود D)'
      });
      continue;
    }

    // If there were invalid phones alongside valid ones, report note
    if (invalidPhones.length > 0) {
      errors.push({
        rowNumber,
        rawName: name,
        rawPhone: String(rawPhone || ''),
        reason: `تم تجاهل رقم غير صالح (${invalidPhones.join(', ')}) والاحتفاظ بالرقم الصالح`
      });
    }

    // Birthday parsing
    let birthday: string | undefined = undefined;
    let birthdayError: string | undefined = undefined;

    if (rawBirthday !== null && rawBirthday !== undefined && String(rawBirthday).trim() !== '') {
      const parsedBday = parseBirthday(rawBirthday);
      if (parsedBday) {
        birthday = parsedBday;
      } else {
        birthdayError = `تاريخ الميلاد غير صالح (${String(rawBirthday)})`;
        errors.push({
          rowNumber,
          rawName: name,
          reason: `تاريخ الميلاد غير صالح (${String(rawBirthday)}) — تم الاحتفاظ بالشخص بدون تاريخ ميلاد`
        });
      }
    }

    parsedRows.push({
      rowNumber,
      name,
      phones: validPhones,
      birthday,
      invalidPhones,
      birthdayError
    });
  }

  return {
    fileName,
    totalRows: Math.max(0, data.length - 1),
    rows: parsedRows,
    errors
  };
}

/**
 * Merges parsed rows into the existing contacts map.
 * Dedupe identity key = primary phone (contact.phones[0]).
 */
export function mergeContacts(
  existingContacts: Contact[],
  parsedRows: ParsedContactRow[],
  fileId: string,
  fileName: string,
  parseErrors: ImportRowError[]
): {
  updatedContacts: Contact[];
  report: ImportReport;
} {
  const contactsMap = new Map<string, Contact>();
  existingContacts.forEach((c) => {
    const normalizedKey = normalizePhone(c.id) || c.id;
    contactsMap.set(normalizedKey, { ...c, id: normalizedKey });
  });

  let addedCount = 0;
  let updatedCount = 0;

  for (const row of parsedRows) {
    const primaryPhone = row.phones[0];
    const existing = contactsMap.get(primaryPhone);

    if (existing) {
      // Update contact: merge phones, update name and birthday, union sources, preserve lastContactAt!
      const mergedPhones = [primaryPhone];
      for (const p of row.phones.slice(1)) {
        if (!mergedPhones.includes(p)) {
          mergedPhones.push(p);
        }
      }
      for (const p of existing.phones.slice(1)) {
        const norm = normalizePhone(p) || p;
        if (!mergedPhones.includes(norm)) {
          mergedPhones.push(norm);
        }
      }

      const mergedSources = Array.from(new Set([...existing.sources, fileId]));

      contactsMap.set(primaryPhone, {
        ...existing,
        name: row.name, // update with latest file's name
        phones: mergedPhones,
        birthday: row.birthday !== undefined ? row.birthday : existing.birthday,
        sources: mergedSources
      });
      updatedCount++;
    } else {
      // New contact
      const newContact: Contact = {
        id: primaryPhone,
        name: row.name,
        phones: row.phones,
        birthday: row.birthday,
        sources: [fileId],
        lastContactAt: null,
        lastContactType: null,
        createdAt: Date.now()
      };
      contactsMap.set(primaryPhone, newContact);
      addedCount++;
    }
  }

  const updatedContacts = Array.from(contactsMap.values());

  const skippedCount = parseErrors.filter((e) =>
    e.reason.includes('اسم الشخص غير موجود') ||
    e.reason.includes('أرقام غير صالحة') ||
    e.reason.includes('رقم الموبايل مفقود')
  ).length;

  const report: ImportReport = {
    fileName,
    totalRows: parsedRows.length + skippedCount,
    addedCount,
    updatedCount,
    skippedCount,
    errors: parseErrors
  };

  return {
    updatedContacts,
    report
  };
}

/**
 * Removes a file and deletes contacts that came ONLY from that file.
 * Contacts from multiple files have this file removed from sources.
 */
export function removeFileFromContacts(
  contacts: Contact[],
  fileId: string
): Contact[] {
  return contacts
    .filter((c) => {
      // If contact only belongs to this file, remove it
      if (c.sources.length === 1 && c.sources[0] === fileId) {
        return false;
      }
      return true;
    })
    .map((c) => ({
      ...c,
      sources: c.sources.filter((s) => s !== fileId)
    }));
}

