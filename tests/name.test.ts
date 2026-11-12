import { describe, it, expect } from 'vitest';
import { getCardName } from '../src/lib/name';

describe('getCardName', () => {
  it('handles normal four-part name', () => {
    expect(getCardName('مينا حنا جرجس سمعان')).toBe('مينا حنا');
  });

  it('handles two-part name', () => {
    expect(getCardName('مينا حنا')).toBe('مينا حنا');
  });

  it('handles one-word name', () => {
    expect(getCardName('مينا')).toBe('مينا');
  });

  it('trims and collapses extra whitespace', () => {
    expect(getCardName('   مينا    حنا    جرجس   سمعان   ')).toBe('مينا حنا');
    expect(getCardName('  بيشوي   ')).toBe('بيشوي');
    expect(getCardName('')).toBe('');
    expect(getCardName(null)).toBe('');
    expect(getCardName(undefined)).toBe('');
  });

  describe('compound prefixes', () => {
    it('handles "عبد"', () => {
      expect(getCardName('عبد المسيح جرجس سمعان')).toBe('عبد المسيح جرجس');
      expect(getCardName('مينا عبد المسيح جرجس سمعان')).toBe('مينا عبد المسيح');
    });

    it('handles "أبو"', () => {
      expect(getCardName('أبو سيفين مينا حنا')).toBe('أبو سيفين مينا');
    });

    it('handles "ابو"', () => {
      expect(getCardName('ابو سيفين مينا حنا')).toBe('ابو سيفين مينا');
    });

    it('handles "أم"', () => {
      expect(getCardName('أم النور مريم يوسف')).toBe('أم النور مريم');
    });

    it('handles "ام"', () => {
      expect(getCardName('ام النور مريم يوسف')).toBe('ام النور مريم');
    });

    it('handles "ابن"', () => {
      expect(getCardName('ابن المقفع ساويرس باسيلي')).toBe('ابن المقفع ساويرس');
    });

    it('handles compound name when only compound name exists', () => {
      expect(getCardName('عبد المسيح')).toBe('عبد المسيح');
    });
  });

  describe('leading titles', () => {
    it('handles "أبونا"', () => {
      expect(getCardName('أبونا بيشوي كامل ميخائيل')).toBe('أبونا بيشوي كامل');
    });

    it('handles "ابونا"', () => {
      expect(getCardName('ابونا بيشوي كامل ميخائيل')).toBe('ابونا بيشوي كامل');
    });

    it('handles "القمص"', () => {
      expect(getCardName('القمص متى المسكين يوسف')).toBe('القمص متى المسكين');
    });

    it('handles "الأنبا"', () => {
      expect(getCardName('الأنبا أنطونيوس الكبير ميخائيل')).toBe('الأنبا أنطونيوس الكبير');
    });

    it('handles "دكتور"', () => {
      expect(getCardName('دكتور مجدي يعقوب حبيب')).toBe('دكتور مجدي يعقوب');
    });

    it('handles "د."', () => {
      expect(getCardName('د. مجدي يعقوب حبيب')).toBe('د. مجدي يعقوب');
    });

    it('handles "م."', () => {
      expect(getCardName('م. مينا سمير فايز')).toBe('م. مينا سمير');
    });

    it('handles "مهندس"', () => {
      expect(getCardName('مهندس مينا سمير فايز')).toBe('مهندس مينا سمير');
    });

    it('handles "أستاذ"', () => {
      expect(getCardName('أستاذ جرجس فهيم لبيب')).toBe('أستاذ جرجس فهيم');
    });

    it('handles title with one-word name', () => {
      expect(getCardName('ابونا بيشوي')).toBe('ابونا بيشوي');
    });
  });

  describe('title + compound together', () => {
    it('handles title with compound first name', () => {
      expect(getCardName('ابونا عبد المسيح المقاري سمعان')).toBe('ابونا عبد المسيح المقاري');
      expect(getCardName('دكتور أبو سيفين حنا جرجس')).toBe('دكتور أبو سيفين حنا');
    });

    it('handles title with compound father name', () => {
      expect(getCardName('مهندس مينا عبد المسيح بشارة')).toBe('مهندس مينا عبد المسيح');
      expect(getCardName('أبونا أبانوب أبو سيفين غالي')).toBe('أبونا أبانوب أبو سيفين');
    });
  });
});

