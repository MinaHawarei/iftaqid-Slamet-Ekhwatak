import React, { useEffect, useRef, useState } from 'react';
import { Verse } from '../../data/verses';
import { useAppStore } from '../../store/useAppStore';
import { CopyIcon, WaIcon } from '../../components/Icons';
import { buildMessage, buildWhatsAppUrl, DEFAULT_GREETING, openWhatsApp } from '../../lib/whatsapp';
import { renderCardImage } from '../../lib/cardImage';
import { normalizePhone } from '../../lib/phone';

interface ShareSheetProps {
  verse: Verse | null;
  isOpen: boolean;
  onClose: () => void;
  initialRecipientName?: string;
  initialPhone?: string;
  activeContactId?: string | null;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  verse,
  isOpen,
  onClose,
  initialRecipientName = '',
  initialPhone = '',
  activeContactId = null
}) => {
  const settings = useAppStore((s) => s.settings);
  const showToast = useAppStore((s) => s.showToast);
  const recordContactActivity = useAppStore((s) => s.recordContactActivity);

  const [recipient, setRecipient] = useState(initialRecipientName);
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [phone, setPhone] = useState(initialPhone);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const previewBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<number>(0);

  // Initialize or update fields when opened or initial props change
  useEffect(() => {
    if (isOpen) {
      setRecipient(initialRecipientName);
      setPhone(initialPhone);
      setGreeting(DEFAULT_GREETING);
    }
  }, [isOpen, initialRecipientName, initialPhone]);

  // Generate preview image
  const updatePreview = async (v: Verse | null, rec: string, greet: string) => {
    if (!v) return;
    const token = ++tokenRef.current;
    setIsGenerating(true);

    try {
      const blob = await renderCardImage(v, rec, greet);
      if (token !== tokenRef.current) return;

      previewBlobRef.current = blob;
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (e) {
      console.error('Error rendering card preview:', e);
    } finally {
      if (token === tokenRef.current) {
        setIsGenerating(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen || !verse) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      updatePreview(verse, recipient, greeting);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [verse, recipient, greeting, isOpen]);

  // Clean up preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen || !verse) return null;

  const getCleanPhone = (): string | false => {
    const trimmed = phone.trim();
    if (!trimmed) return '';
    const norm = normalizePhone(trimmed, settings.defaultCountryCode);
    if (!norm) {
      showToast('الرقم مش صحيح');
      return false;
    }
    return norm;
  };

  const handleSendText = () => {
    const validPhone = getCleanPhone();
    if (validPhone === false) return;

    const message = buildMessage(verse, recipient, greeting);
    const { url, isAppTarget } = buildWhatsAppUrl(
      validPhone,
      message,
      settings.whatsappMode
    );

    openWhatsApp(url, isAppTarget);

    if (activeContactId) {
      recordContactActivity(activeContactId, 'whatsapp');
    }

    onClose();
  };

  const copyImageToClipboard = async (blob: Blob): Promise<boolean> => {
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        return false;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch {
      return false;
    }
  };

  const handleSendImage = async () => {
    const validPhone = getCleanPhone();
    if (validPhone === false) return;

    let blob = previewBlobRef.current;
    if (!blob) {
      showToast('ثواني والصورة تجهز');
      blob = await renderCardImage(verse, recipient, greeting);
      if (!blob) return;
      previewBlobRef.current = blob;
    }

    const file = new File([blob], 'verse.png', { type: 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));

    if (validPhone) {
      // Direct recipient number provided
      const copied = await copyImageToClipboard(blob);
      if (copied) {
        showToast('الصورة اتنسخت — الصقيها في الشات');
        const { url, isAppTarget } = buildWhatsAppUrl(validPhone, '', settings.whatsappMode);
        openWhatsApp(url, isAppTarget);
        if (activeContactId) {
          recordContactActivity(activeContactId, 'whatsapp');
        }
        onClose();
        return;
      }

      if (canShare) {
        try {
          await navigator.share({ files: [file] });
          if (activeContactId) {
            recordContactActivity(activeContactId, 'whatsapp');
          }
          onClose();
          return;
        } catch {
          // cancelled or unsupported
        }
      }
    } else {
      // No specific phone number provided
      if (canShare) {
        try {
          await navigator.share({ files: [file] });
          onClose();
          return;
        } catch {
          // ignore share cancel
        }
      }

      const copied = await copyImageToClipboard(blob);
      if (copied) {
        showToast('الصورة اتنسخت — الصقيها في واتساب');
        const { url, isAppTarget } = buildWhatsAppUrl('', '', settings.whatsappMode);
        openWhatsApp(url, isAppTarget);
        onClose();
        return;
      }
    }

    // Fallback: download PNG file
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'verse.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    showToast('المتصفح مش بيدعم الإرسال المباشر — الصورة اتحفظت');

    if (validPhone) {
      setTimeout(() => {
        const { url, isAppTarget } = buildWhatsAppUrl(validPhone, '', settings.whatsappMode);
        openWhatsApp(url, isAppTarget);
      }, 900);
      if (activeContactId) {
        recordContactActivity(activeContactId, 'whatsapp');
      }
    }

    onClose();
  };

  return (
    <div
      className="sheet-bg open"
      role="dialog"
      aria-modal="true"
      aria-label="إرسال على واتساب"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <h2>ابعتها واتساب</h2>

        {previewUrl ? (
          <img className="preview" src={previewUrl} alt="معاينة الكارت" />
        ) : (
          <div className="preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span>{isGenerating ? 'جاري تجهيز الكارت...' : 'معاينة الكارت'}</span>
          </div>
        )}

        <label className="field" htmlFor="recipient-input">
          اسم المستلم (اختياري)
        </label>
        <input
          className="phone name"
          id="recipient-input"
          type="text"
          maxLength={30}
          autoComplete="off"
          placeholder="مثلًا: مينا"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />

        <label className="field" htmlFor="greeting-input">
          الجملة الافتتاحية
        </label>
        <input
          className="phone name"
          id="greeting-input"
          type="text"
          maxLength={60}
          autoComplete="off"
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
        />

        <label className="field" htmlFor="phone-input">
          رقم المستلم (اختياري)
        </label>
        <input
          className="phone"
          id="phone-input"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="01012345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <p className="hint">
          اكتب الرقم لو مش متسجل عندك (المصري ممكن يبدأ بـ 01، والدولي بكود الدولة). «كنص» بيتبعت علطول. «كصورة»: من غير رقم بتفتح قايمة المشاركة، ومع الرقم الصورة بتتنسخ وبتلصقها في الشات من غير ما تتحمّل.
        </p>

        <div className="row">
          <button type="button" className="btn wa" onClick={handleSendText}>
            <WaIcon />
            كنص
          </button>
          <button type="button" className="btn coral" onClick={handleSendImage}>
            <CopyIcon />
            كصورة
          </button>
        </div>

        <button type="button" className="close-link" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
};
