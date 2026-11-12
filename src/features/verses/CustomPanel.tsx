import React, { useRef, useState } from 'react';
import { CardComponent } from '../../components/CardComponent';
import { CopyIcon, WaIcon } from '../../components/Icons';
import { Verse } from '../../data/verses';
import { buildMessage } from '../../lib/whatsapp';
import { useAppStore } from '../../store/useAppStore';

interface CustomPanelProps {
  onOpenShare: (verse: Verse) => void;
}

export const CustomPanel: React.FC<CustomPanelProps> = ({ onOpenShare }) => {
  const showToast = useAppStore((s) => s.showToast);

  const [text, setText] = useState('');
  const [ref, setRef] = useState('');
  const [customVerse, setCustomVerse] = useState<Verse | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);

  const handleMakeCard = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      showToast('اكتب النص الأول');
      return;
    }

    if (isBusyRef.current) return;
    isBusyRef.current = true;

    if (customVerse && isFlipped) {
      setIsFlipped(false);
      await new Promise((r) => setTimeout(r, 450));
    }

    const newVerse: Verse = {
      t: trimmed,
      ref: ref.trim() || undefined
    };

    setCustomVerse(newVerse);
    await new Promise((r) => setTimeout(r, 80));
    setIsFlipped(true);

    if (stageRef.current) {
      stageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    isBusyRef.current = false;
  };

  const handleCopy = async () => {
    if (!customVerse) return;
    const msg = buildMessage(customVerse);
    try {
      await navigator.clipboard.writeText(msg);
      showToast('تم النسخ');
    } catch {
      showToast('تعذر النسخ');
    }
  };

  return (
    <section className="panel" role="tabpanel" aria-labelledby="tab-custom">
      <p className="lead">اكتب أي آية أو كلمة وابعتيها ككارت</p>

      <div className="form">
        <label className="field" htmlFor="custom-text-input">
          النص
        </label>
        <textarea
          className="phone txt"
          id="custom-text-input"
          maxLength={300}
          rows={4}
          placeholder="اكتب الآية أو أي نص..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="count">
          <span>{text.length}</span>/300
        </div>

        <label className="field" htmlFor="custom-ref-input">
          الشاهد (اختياري)
        </label>
        <input
          className="phone name"
          id="custom-ref-input"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="مثلًا: مزمور 23:1"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />

        <div className="actions">
          <button type="button" className="btn" onClick={handleMakeCard}>
            اعمل الكارت
          </button>
        </div>
      </div>

      {customVerse && (
        <>
          <div ref={stageRef} className="stage" style={{ marginTop: '28px' }}>
            <CardComponent
              verse={customVerse}
              isFlipped={isFlipped}
              onClick={() => {
                if (!isFlipped) setIsFlipped(true);
              }}
            />
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn wa"
              onClick={() => onOpenShare(customVerse)}
            >
              <WaIcon />
              ابعتها واتساب
            </button>
            <button type="button" className="btn ghost" onClick={handleCopy}>
              <CopyIcon />
              نسخ
            </button>
          </div>
        </>
      )}
    </section>
  );
};

