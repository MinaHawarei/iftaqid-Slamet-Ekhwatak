import React, { useState } from 'react';
import { CardComponent } from '../../components/CardComponent';
import { CloseIcon, CopyIcon, DiceIcon, WaIcon } from '../../components/Icons';
import { VERSES } from '../../data/verses';
import { buildMessage } from '../../lib/whatsapp';
import { useAppStore } from '../../store/useAppStore';

export const NumberPanel: React.FC = () => {
  const order = useAppStore((s) => s.order);
  const seenNumbers = useAppStore((s) => s.seenNumbers);
  const markNumberSeen = useAppStore((s) => s.markNumberSeen);
  const shuffleNumbers = useAppStore((s) => s.shuffleNumbers);
  const showToast = useAppStore((s) => s.showToast);
  const activeModalVerse = useAppStore((s) => s.tabVerses.number);
  const setTabVerse = useAppStore((s) => s.setTabVerse);
  const setIsShareOpen = useAppStore((s) => s.setIsShareOpen);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFlipped, setModalFlipped] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  const openNumber = async (index: number) => {
    markNumberSeen(index);
    const verseIdx = order[index];
    const verse = VERSES[verseIdx];

    // Single source of truth: commit selected verse synchronously before animation
    setTabVerse('number', verse);

    setModalFlipped(false);
    setIsModalOpen(true);

    await new Promise((r) => setTimeout(r, 350));
    setModalFlipped(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalFlipped(false);
  };

  const handleShuffle = async () => {
    shuffleNumbers();
    setIsShuffling(true);
    await new Promise((r) => setTimeout(r, 1100));
    setIsShuffling(false);
    showToast('الأرقام اتلخبطت');
  };

  const handleCopy = async () => {
    const v = useAppStore.getState().tabVerses.number;
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
    <section className="panel" role="tabpanel" aria-labelledby="tab-number">
      <p className="lead">اختار رقم وشوف الآية اللي مستنياك</p>

      <div className={`grid ${isShuffling ? 'shuffling' : ''}`}>
        {order.map((_, i) => {
          const isSeen = seenNumbers.has(i);
          return (
            <button
              key={i}
              type="button"
              className={`num ${isSeen ? 'seen' : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              aria-label={`الرقم ${i + 1}`}
              onClick={() => openNumber(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" className="btn coral" onClick={handleShuffle}>
          <DiceIcon />
          لخبط الأرقام
        </button>
      </div>

      {/* Modal for picked number */}
      {isModalOpen && activeModalVerse && (
        <div
          className="overlay open"
          role="dialog"
          aria-modal="true"
          aria-label="الآية"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="stage" style={{ width: '100%' }}>
            <CardComponent
              verse={activeModalVerse}
              isFlipped={modalFlipped}
              onClick={() => {
                if (!modalFlipped) setModalFlipped(true);
              }}
            />
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn wa"
              onClick={() => {
                closeModal();
                setIsShareOpen(true);
              }}
            >
              <WaIcon />
              ابعتها واتساب
            </button>
            <button type="button" className="btn ghost" onClick={handleCopy}>
              <CopyIcon />
              نسخ
            </button>
            <button type="button" className="btn" onClick={closeModal}>
              <CloseIcon />
              إغلاق
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
