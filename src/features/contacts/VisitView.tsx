import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CakeIcon, CopyIcon, PhoneIcon, WaIcon } from '../../components/Icons';
import { formatRelativeLastContact, sortQueue } from '../../lib/queue';
import { formatBirthdayDisplay, isUpcomingBirthday } from '../../lib/birthday';
import { isMobileDevice } from '../../lib/device';

interface VisitViewProps {
  onOpenShareSheetForActiveContact?: () => void;
}

export const VisitView: React.FC<VisitViewProps> = () => {
  const contacts = useAppStore((s) => s.contacts);
  const activeContactId = useAppStore((s) => s.activeContactId);
  const activeContactPhone = useAppStore((s) => s.activeContactPhone);
  const setActiveContactPhone = useAppStore((s) => s.setActiveContactPhone);
  const closeVisit = useAppStore((s) => s.closeVisit);
  const goToNextInQueue = useAppStore((s) => s.goToNextInQueue);
  const goToPreviousInQueue = useAppStore((s) => s.goToPreviousInQueue);
  const recordContactActivity = useAppStore((s) => s.recordContactActivity);
  const manualUpdateContactDate = useAppStore((s) => s.manualUpdateContactDate);
  const setIsShareOpen = useAppStore((s) => s.setIsShareOpen);
  const showToast = useAppStore((s) => s.showToast);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDateVal, setCustomDateVal] = useState('');

  if (!activeContactId) return null;

  const contact = contacts.find((c) => c.id === activeContactId);
  if (!contact) return null;

  const chosenPhone = activeContactPhone || contact.phones[0] || '';
  const isMobile = isMobileDevice();

  const sorted = sortQueue(contacts);
  const currentIndex = sorted.findIndex((c) => c.id === contact.id);
  const hasNext = currentIndex >= 0 && currentIndex < sorted.length - 1;
  const hasPrev = currentIndex > 0;

  const bdayInfo = isUpcomingBirthday(contact.birthday);
  const relativeLast = formatRelativeLastContact(
    contact.lastContactAt,
    contact.lastContactType
  );

  const handleCall = () => {
    recordContactActivity(contact.id, 'call');
    showToast(`جاري الاتصال بـ ${contact.name}`);
    window.location.href = `tel:${chosenPhone}`;
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(chosenPhone);
      recordContactActivity(contact.id, 'call');
      showToast(`تم نسخ رقم ${contact.name}`);
    } catch {
      showToast('تعذر نسخ الرقم');
    }
  };

  const handleOpenWhatsApp = () => {
    setIsShareOpen(true);
  };

  const handleMarkContactedNow = () => {
    recordContactActivity(contact.id, 'call');
    showToast(`تم تسجيل الافتقاد لـ ${contact.name}`);
  };

  const handleSaveManualDate = () => {
    if (!customDateVal) {
      manualUpdateContactDate(contact.id, null);
      showToast('تمت إزالة تاريخ آخر تواصل');
    } else {
      const ts = new Date(customDateVal).getTime();
      if (!isNaN(ts)) {
        manualUpdateContactDate(contact.id, ts);
        showToast('تم تحديث تاريخ الافتقاد');
      }
    }
    setIsEditingDate(false);
  };

  return (
    <div className="active-visit-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="active-visit-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="active-visit-name">{contact.name}</span>
            {bdayInfo && bdayInfo.isUpcoming && (
              <span
                className={`birthday-badge ${bdayInfo.isToday ? 'today' : ''}`}
                style={{ fontSize: '0.75rem' }}
              >
                <CakeIcon size={12} />
                {bdayInfo.isToday ? 'عيد ميلاده اليوم!' : `الميلاد بعد ${bdayInfo.daysRemaining} أيام`}
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.85rem', color: '#c4b5fd' }}>
            {relativeLast}
            {contact.birthday && (
              <span style={{ color: '#a99cc0', marginRight: '6px' }}>
                • الميلاد: {formatBirthdayDisplay(contact.birthday)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn ghost"
          style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '999px' }}
          onClick={closeVisit}
        >
          الرجوع للطابور
        </button>
      </div>

      {/* Phone numbers chips */}
      <div style={{ marginTop: '8px' }}>
        <span style={{ fontSize: '0.8rem', color: '#a99cc0' }}>اختر الرقم المستخدم:</span>
        <div className="phone-chips">
          {contact.phones.map((p) => (
            <button
              key={p}
              type="button"
              className={`phone-chip ${p === chosenPhone ? 'selected' : ''}`}
              onClick={() => setActiveContactPhone(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Call & WhatsApp Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginTop: '12px'
        }}
      >
        {isMobile ? (
          <button type="button" className="btn call" onClick={handleCall}>
            <PhoneIcon />
            اتصال
          </button>
        ) : (
          <button type="button" className="btn call" onClick={handleCopyPhone}>
            <CopyIcon />
            نسخ الرقم
          </button>
        )}

        <button type="button" className="btn wa" onClick={handleOpenWhatsApp}>
          <WaIcon />
          رسالة واتساب
        </button>
      </div>

      {/* Manual Date Adjustment & Queue Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(240, 192, 90, 0.2)',
          fontSize: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 0,
              color: 'var(--gold)',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0
            }}
            onClick={handleMarkContactedNow}
          >
            سجل افتقاد الآن
          </button>
          <span style={{ color: 'var(--line)' }}>•</span>
          <button
            type="button"
            style={{
              background: 'none',
              border: 0,
              color: '#d9cfe9',
              cursor: 'pointer',
              padding: 0
            }}
            onClick={() => setIsEditingDate(!isEditingDate)}
          >
            تعديل التاريخ يدويًا
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="pagination-btn"
            style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            disabled={!hasPrev}
            onClick={goToPreviousInQueue}
          >
            السابق
          </button>
          <button
            type="button"
            className="pagination-btn"
            style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            disabled={!hasNext}
            onClick={goToNextInQueue}
          >
            التالي في الطابور
          </button>
        </div>
      </div>

      {/* Manual Date Picker */}
      {isEditingDate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            background: 'var(--glass)',
            padding: '8px 12px',
            borderRadius: '12px'
          }}
        >
          <input
            type="date"
            className="phone"
            style={{ padding: '6px 10px', fontSize: '0.9rem' }}
            value={customDateVal}
            onChange={(e) => setCustomDateVal(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            onClick={handleSaveManualDate}
          >
            حفظ
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            onClick={() => setIsEditingDate(false)}
          >
            إلغاء
          </button>
        </div>
      )}
    </div>
  );
};

