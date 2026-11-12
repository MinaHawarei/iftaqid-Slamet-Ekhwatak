import { Contact } from '../store/types';

/**
 * Sorts contacts for the visitation queue:
 * Never-contacted first (lastContactAt === null),
 * then oldest lastContactAt -> newest lastContactAt.
 * Ties broken by Arabic locale name sort.
 */
export function sortQueue(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    // Both never contacted
    if (a.lastContactAt === null && b.lastContactAt === null) {
      return a.name.localeCompare(b.name, 'ar');
    }
    // a never contacted, comes first
    if (a.lastContactAt === null) return -1;
    // b never contacted, comes first
    if (b.lastContactAt === null) return 1;

    // Both contacted: oldest first
    if (a.lastContactAt !== b.lastContactAt) {
      return a.lastContactAt - b.lastContactAt;
    }

    // Tie-break by name
    return a.name.localeCompare(b.name, 'ar');
  });
}

/**
 * Formats relative time description for last contact date in Arabic.
 */
export function formatRelativeLastContact(
  lastContactAt: number | null,
  lastContactType?: 'call' | 'whatsapp' | null,
  referenceNow: number = Date.now()
): string {
  if (lastContactAt === null || lastContactAt === undefined) {
    return 'لم يُتصل به بعد';
  }

  const prefix =
    lastContactType === 'whatsapp'
      ? 'آخر رسالة'
      : lastContactType === 'call'
      ? 'آخر اتصال'
      : 'آخر تواصل';

  const diffMs = referenceNow - lastContactAt;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return `${prefix}: الآن`;
  }
  if (diffHours < 1) {
    return `${prefix}: منذ دقائق`;
  }
  if (diffHours < 24) {
    const contactDate = new Date(lastContactAt).getDate();
    const nowDate = new Date(referenceNow).getDate();
    if (contactDate === nowDate) {
      return `${prefix}: اليوم`;
    }
    return `${prefix}: أمس`;
  }

  if (diffDays === 1) {
    return `${prefix}: أمس`;
  }
  if (diffDays === 2) {
    return `${prefix}: من يومين`;
  }
  if (diffDays >= 3 && diffDays <= 10) {
    return `${prefix}: من ${diffDays} أيام`;
  }
  if (diffDays >= 11 && diffDays < 30) {
    return `${prefix}: من ${diffDays} يوم`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) {
    return `${prefix}: من شهر`;
  }
  if (diffMonths === 2) {
    return `${prefix}: من شهرين`;
  }
  if (diffMonths >= 3 && diffMonths <= 10) {
    return `${prefix}: من ${diffMonths} شهور`;
  }
  if (diffMonths > 10 && diffMonths < 12) {
    return `${prefix}: من ${diffMonths} شهر`;
  }
  return `${prefix}: من أكثر من سنة`;
}

/**
 * Filters contacts by search query matching name or any phone number.
 */
export function filterContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;

  return contacts.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true;
    return c.phones.some((p) => p.includes(q) || p.replace(/\D/g, '').includes(q));
  });
}

