import React, { useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CloseIcon } from '../../components/Icons';
import { createBackupPayload, downloadBackupJson, validateBackupJson } from '../../lib/backup';
import { BackupPayload, WhatsAppMode } from '../../store/types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const contacts = useAppStore((s) => s.contacts);
  const filesMeta = useAppStore((s) => s.filesMeta);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const importExcelFile = useAppStore((s) => s.importExcelFile);
  const removeFile = useAppStore((s) => s.removeFile);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const applyBackupReplace = useAppStore((s) => s.applyBackupReplace);
  const applyBackupMerge = useAppStore((s) => s.applyBackupMerge);
  const showToast = useAppStore((s) => s.showToast);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleExcelFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await importExcelFile(files[i]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء قراءة الملف';
      showToast(msg);
    } finally {
      setIsImporting(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = validateBackupJson(text);
      if (!result.valid || !result.payload) {
        showToast(result.error || 'الملف غير صالح');
        return;
      }
      setPendingBackup(result.payload);
    } catch {
      showToast('تعذر قراءة ملف النسخة الاحتياطية');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const handleExportBackup = () => {
    const payload = createBackupPayload(contacts, filesMeta, settings);
    downloadBackupJson(payload);
    showToast('تم تصدير النسخة الاحتياطية بنجاح');
  };

  const handleClearAll = () => {
    const confirm1 = window.confirm('هل أنت متأكد من مسح جميع البيانات؟');
    if (!confirm1) return;
    const confirm2 = window.confirm('تحذير نهائي: سيتم حذف كافة جهات الاتصال والإعدادات. هل تريد الاستمرار؟');
    if (!confirm2) return;

    clearAllData();
    onClose();
  };

  return (
    <div
      className="modal-container"
      role="dialog"
      aria-modal="true"
      aria-label="لوحة الإعدادات والبيانات"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">الإعدادات وإدارة البيانات</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {/* Section A: Contact files */}
          <div className="modal-section">
            <h3 className="modal-section-title">ملفات جهات الاتصال (Excel)</h3>

            <input
              ref={excelInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleExcelFilesChange}
            />

            <button
              type="button"
              className="btn"
              disabled={isImporting}
              onClick={() => excelInputRef.current?.click()}
            >
              {isImporting ? 'جاري الاستيراد...' : 'استيراد ملف(ات) إكسيل'}
            </button>

            {filesMeta.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px'
                }}
              >
                {filesMeta.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--glass)',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--cream)' }}>{file.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#a99cc0' }}>
                        {file.contactCount} جهة اتصال • {new Date(file.importedAt).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn danger"
                      style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '10px' }}
                      onClick={() => {
                        const ok = window.confirm(
                          `هل أنت متأكد من حذف الملف "${file.name}"؟ سيتم حذف جهات الاتصال المرتبطة به فقط.`
                        );
                        if (ok) removeFile(file.id);
                      }}
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr style={{ border: 0, height: '1px', background: 'var(--line)', margin: '4px 0' }} />

          {/* Section B: Data Backup & Restore */}
          <div className="modal-section">
            <h3 className="modal-section-title">النسخ الاحتياطي والبيانات</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button type="button" className="btn ghost" onClick={handleExportBackup}>
                تصدير نسخة (JSON)
              </button>

              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleBackupFileChange}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() => backupInputRef.current?.click()}
              >
                استيراد نسخة
              </button>
            </div>

            {/* Backup Import Choice Dialog */}
            {pendingBackup && (
              <div
                style={{
                  background: 'rgba(240, 192, 90, 0.12)',
                  border: '1.5px solid var(--gold)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginTop: '10px'
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: '4px' }}>
                  معاينة النسخة الاحتياطية:
                </div>
                <div style={{ fontSize: '0.88rem', color: '#e9e0f5', marginBottom: '10px' }}>
                  تحتوي على {pendingBackup.contacts.length} جهة اتصال و {pendingBackup.filesMeta.length} ملفات.
                  اختر طريقة الاستيراد:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '10px', fontSize: '0.92rem' }}
                    onClick={() => {
                      applyBackupMerge(pendingBackup);
                      setPendingBackup(null);
                    }}
                  >
                    دمج مع الحالي
                  </button>
                  <button
                    type="button"
                    className="btn coral"
                    style={{ padding: '10px', fontSize: '0.92rem' }}
                    onClick={() => {
                      applyBackupReplace(pendingBackup);
                      setPendingBackup(null);
                    }}
                  >
                    استبدال بالكامل
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 0,
                      color: '#a99cc0',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                    onClick={() => setPendingBackup(null)}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn danger"
              style={{ marginTop: '4px' }}
              onClick={handleClearAll}
            >
              مسح جميع البيانات
            </button>
          </div>

          <hr style={{ border: 0, height: '1px', background: 'var(--line)', margin: '4px 0' }} />

          {/* Section C: Settings */}
          <div className="modal-section">
            <h3 className="modal-section-title">إعدادات الإرسال</h3>

            <label className="field" htmlFor="setting-whatsapp-mode">
              وضع واتساب
            </label>
            <select
              id="setting-whatsapp-mode"
              className="phone name"
              style={{ cursor: 'pointer' }}
              value={settings.whatsappMode}
              onChange={(e) =>
                updateSettings({ whatsappMode: e.target.value as WhatsAppMode })
              }
            >
              <option value="auto" style={{ background: '#241a45' }}>
                تلقائي (تطبيق للموبايل / ويب للكمبيوتر)
              </option>
              <option value="app" style={{ background: '#241a45' }}>
                إجبار تطبيق واتساب (wa.me)
              </option>
              <option value="web" style={{ background: '#241a45' }}>
                إجبار واتساب ويب (web.whatsapp.com)
              </option>
            </select>

            <label className="field" htmlFor="setting-country-code">
              كود الدولة الافتراضي (لتصحيح الأرقام المحلية)
            </label>
            <input
              id="setting-country-code"
              className="phone"
              type="text"
              value={settings.defaultCountryCode}
              placeholder="20"
              onChange={(e) => updateSettings({ defaultCountryCode: e.target.value })}
            />
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: '10px',
              fontSize: '0.82rem',
              color: 'var(--gold)',
              opacity: 0.85
            }}
          >
            🔒 البيانات محفوظة على جهازك فقط
          </div>
        </div>
      </div>
    </div>
  );
};

