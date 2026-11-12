import React, { useRef, useState } from 'react';
import { CardComponent } from '../../components/CardComponent';
import { CopyIcon, DiceIcon, WaIcon } from '../../components/Icons';
import { Verse, VERSES } from '../../data/verses';
import { buildMessage } from '../../lib/whatsapp';
import { useAppStore } from '../../store/useAppStore';

export const RandomPanel: React.FC = () => {
  const showToast = useAppStore((s) => s.showToast);
  const currentVerse = useAppStore((s) => s.tabVerses.random);
  const setTabVerse = useAppStore((s) => s.setTabVerse);
  const setIsShareOpen = useAppStore((s) => s.setIsShareOpen);

  const [isFlipped, setIsFlipped] = useState(!!currentVerse);
  const [isShaking, setIsShaking] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!currentVerse);
  const isBusyRef = useRef(false);

  // Bag of random indexes
  const bagRef = useRef<number[]>([]);
  const lastIdxRef = useRef<number>(-1);

  const getNextRandomVerse = (): Verse => {
    if (!bagRef.current.length) {
      const arr = VERSES.map((_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (arr.length > 1 && arr[arr.length - 1] === lastIdxRef.current) {
        [arr[0], arr[arr.length - 1]] = [arr[arr.length - 1], arr[0]];
      }
      bagRef.current = arr;
    }
    const idx = bagRef.current.pop()!;
    lastIdxRef.current = idx;
    return VERSES[idx];
  };

  const handleDraw = async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;

    // Single source of truth: commit selected verse synchronously before any animation
    const nextV = getNextRandomVerse();
    setTabVerse('random', nextV);
    setHasDrawn(true);

    if (isFlipped) {
      setIsFlipped(false);
      await new Promise((r) => setTimeout(r, 450));
    }

    setIsShaking(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsShaking(false);

    setIsFlipped(true);
    isBusyRef.current = false;
  };

  const handleCopy = async () => {
    const v = useAppStore.getState().tabVerses.random;
    if (!v) return;
    const text = buildMessage(v);
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم النسخ');
    } catch {
      showToast('تعذر النسخ');
    }
  };

  return (
    <section className="panel" role="tabpanel" aria-labelledby="tab-random">
      <div className="stage">
        <CardComponent
          verse={currentVerse}
          isFlipped={isFlipped}
          isShaking={isShaking}
          onClick={() => {
            if (!isFlipped) handleDraw();
          }}
        />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={handleDraw}>
          <DiceIcon />
          <span>{hasDrawn ? 'اسحب آية تانية' : 'اسحب آية'}</span>
        </button>

        {hasDrawn && currentVerse && (
          <>
            <button
              type="button"
              className="btn wa"
              onClick={() => setIsShareOpen(true)}
            >
              <WaIcon />
              ابعتها واتساب
            </button>
            <button type="button" className="btn ghost" onClick={handleCopy}>
              <CopyIcon />
              نسخ
            </button>
          </>
        )}
      </div>
    </section>
  );
};
