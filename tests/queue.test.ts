import { describe, it, expect } from 'vitest';
import {
  filterContacts,
  formatRelativeLastContact,
  sortQueue
} from '../src/lib/queue';
import { Contact } from '../src/store/types';

describe('Queue Utilities', () => {
  describe('sortQueue', () => {
    it('sorts never-contacted first, then oldest lastContactAt -> newest, and breaks ties by Arabic name', () => {
      const contacts: Contact[] = [
        {
          id: '1',
          name: 'مينا',
          phones: ['+20101'],
          sources: [],
          lastContactAt: 2000,
          lastContactType: 'call',
          createdAt: 0
        },
        {
          id: '2',
          name: 'بولا',
          phones: ['+20102'],
          sources: [],
          lastContactAt: null, // never contacted
          lastContactType: null,
          createdAt: 0
        },
        {
          id: '3',
          name: 'أنطون',
          phones: ['+20103'],
          sources: [],
          lastContactAt: null, // never contacted
          lastContactType: null,
          createdAt: 0
        },
        {
          id: '4',
          name: 'جرجس',
          phones: ['+20104'],
          sources: [],
          lastContactAt: 1000, // older contact
          lastContactType: 'whatsapp',
          createdAt: 0
        },
        {
          id: '5',
          name: 'كيرلس',
          phones: ['+20105'],
          sources: [],
          lastContactAt: 2000, // tie with مينا
          lastContactType: 'call',
          createdAt: 0
        }
      ];

      const sorted = sortQueue(contacts);

      // Never contacted first, sorted alphabetically in Arabic:
      // أنطون comes before بولا
      expect(sorted[0].name).toBe('أنطون');
      expect(sorted[1].name).toBe('بولا');

      // Then oldest contacted: جرجس (1000)
      expect(sorted[2].name).toBe('جرجس');

      // Then 2000 ties broken alphabetically: كيرلس before مينا
      expect(sorted[3].name).toBe('كيرلس');
      expect(sorted[4].name).toBe('مينا');
    });
  });

  describe('formatRelativeLastContact', () => {
    const now = 1700000000000;

    it('returns "لم يُتصل به بعد" when null', () => {
      expect(formatRelativeLastContact(null)).toBe('لم يُتصل به بعد');
    });

    it('formats relative elapsed time accurately', () => {
      // 10 minutes ago
      expect(formatRelativeLastContact(now - 10 * 60 * 1000, 'call', now)).toBe(
        'آخر اتصال: منذ دقائق'
      );

      // 2 days ago
      expect(
        formatRelativeLastContact(now - 2 * 24 * 60 * 60 * 1000, 'call', now)
      ).toBe('آخر اتصال: من يومين');

      // 5 days ago
      expect(
        formatRelativeLastContact(now - 5 * 24 * 60 * 60 * 1000, 'whatsapp', now)
      ).toBe('آخر رسالة: من 5 أيام');

      // 15 days ago
      expect(
        formatRelativeLastContact(now - 15 * 24 * 60 * 60 * 1000, 'call', now)
      ).toBe('آخر اتصال: من 15 يوم');

      // 35 days ago (1 month)
      expect(
        formatRelativeLastContact(now - 35 * 24 * 60 * 60 * 1000, 'call', now)
      ).toBe('آخر اتصال: من شهر');
    });
  });

  describe('filterContacts', () => {
    const contacts: Contact[] = [
      {
        id: '1',
        name: 'مينا سمير',
        phones: ['+201012345678'],
        sources: [],
        lastContactAt: null,
        lastContactType: null,
        createdAt: 0
      },
      {
        id: '2',
        name: 'بيشوي عادل',
        phones: ['+201299998888', '+201155554444'],
        sources: [],
        lastContactAt: null,
        lastContactType: null,
        createdAt: 0
      }
    ];

    it('filters by name', () => {
      expect(filterContacts(contacts, 'مينا')).toHaveLength(1);
      expect(filterContacts(contacts, 'مينا')[0].name).toBe('مينا سمير');
    });

    it('filters by phone number', () => {
      expect(filterContacts(contacts, '9999')).toHaveLength(1);
      expect(filterContacts(contacts, '9999')[0].name).toBe('بيشوي عادل');
      expect(filterContacts(contacts, '5555')).toHaveLength(1);
    });

    it('returns all contacts on empty query', () => {
      expect(filterContacts(contacts, '')).toHaveLength(2);
    });
  });
});

