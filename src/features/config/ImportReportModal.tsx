import React from 'react';
import { ImportReport } from '../../store/types';
import { CloseIcon } from '../../components/Icons';

interface ImportReportModalProps {
  report: ImportReport | null;
  onClose: () => void;
}

export const ImportReportModal: React.FC<ImportReportModalProps> = ({ report, onClose }) => {
  if (!report) return null;

  return (
    <div
      className="modal-container"
      role="dialog"
      aria-modal="true"
      aria-label="تقرير استيراد الملف"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h2 className="modal-title">تقرير استيراد الملف</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ color: '#d9cfe9', fontSize: '0.95rem' }}>
            الملف: <b style={{ color: 'var(--gold)' }}>{report.fileName}</b>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              textAlign: 'center',
              marginTop: '6px'
            }}
          >
            <div
              style={{
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                borderRadius: '14px',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#5be58f' }}>
                {report.addedCount}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#d9cfe9' }}>تمت إضافتهم</div>
            </div>

            <div
              style={{
                background: 'rgba(240, 192, 90, 0.15)',
                border: '1px solid rgba(240, 192, 90, 0.4)',
                borderRadius: '14px',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)' }}>
                {report.updatedCount}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#d9cfe9' }}>تم تحديثهم</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 122, 107, 0.15)',
                border: '1px solid rgba(255, 122, 107, 0.4)',
                borderRadius: '14px',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--coral)' }}>
                {report.skippedCount}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#d9cfe9' }}>تم تخطيهم</div>
            </div>
          </div>

          {report.errors.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: '8px' }}>
                الملاحظات والأخطاء ({report.errors.length}):
              </div>
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'var(--glass)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {report.errors.map((err, i) => (
                  <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--coral)', fontWeight: 700 }}>
                      سطر {err.rowNumber}:
                    </span>{' '}
                    <span>{err.reason}</span>
                    {err.rawName && (
                      <span style={{ color: '#a99cc0', marginRight: '6px' }}>({err.rawName})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button type="button" className="btn" onClick={onClose} style={{ width: '100%' }}>
              حسناً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

