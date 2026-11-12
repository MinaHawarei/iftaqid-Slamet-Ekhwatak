import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';
import { VERSES } from '../src/data/verses';

describe('Verse Selection and Single Source of Truth', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      activeTab: 'random',
      isShareOpen: false,
      tabVerses: {
        random: null,
        number: null,
        custom: null
      }
    });
  });

  it('updates active verse synchronously on draw so subsequent draw overrides immediately', () => {
    const store = useAppStore.getState();

    // 1. Reveal verse A
    store.setTabVerse('random', VERSES[1]);
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[1]);

    // 2. Reveal verse B
    store.setTabVerse('random', VERSES[5]);

    // Active verse must be B immediately, not A
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[5]);
  });

  it('preserves per-tab verse separation when switching tabs', () => {
    const store = useAppStore.getState();

    // Random tab has verse 2
    store.setActiveTab('random');
    store.setTabVerse('random', VERSES[2]);
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[2]);

    // Switch to Custom tab and set custom verse
    store.setActiveTab('custom');
    const customV = { t: 'آية مخصصة', ref: 'شاهد' };
    store.setTabVerse('custom', customV);
    expect(useAppStore.getState().getActiveVerse()).toEqual(customV);

    // Switch to Number tab and set number verse
    store.setActiveTab('number');
    store.setTabVerse('number', VERSES[10]);
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[10]);

    // Switch back to Random tab -> returns verse 2
    store.setActiveTab('random');
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[2]);

    // Switch back to Custom tab -> returns custom verse
    store.setActiveTab('custom');
    expect(useAppStore.getState().getActiveVerse()).toEqual(customV);
  });

  it('custom tab immediately updates verse on re-submit', () => {
    const store = useAppStore.getState();
    store.setActiveTab('custom');

    const v1 = { t: 'النص الأول', ref: 'شاهد 1' };
    store.setTabVerse('custom', v1);
    expect(useAppStore.getState().getActiveVerse()).toEqual(v1);

    const v2 = { t: 'النص المحدث', ref: 'شاهد 2' };
    store.setTabVerse('custom', v2);
    expect(useAppStore.getState().getActiveVerse()).toEqual(v2);
  });

  it('number tab immediately updates verse on number pick', () => {
    const store = useAppStore.getState();
    store.setActiveTab('number');

    store.setTabVerse('number', VERSES[3]);
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[3]);

    store.setTabVerse('number', VERSES[7]);
    expect(useAppStore.getState().getActiveVerse()).toEqual(VERSES[7]);
  });

  it('returns null when no verse has been revealed on active tab', () => {
    const store = useAppStore.getState();
    store.setActiveTab('random');
    expect(store.getActiveVerse()).toBeNull();
  });
});

