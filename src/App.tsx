import React, { useEffect } from 'react';
import logoImg from './assets/logo.png';
import { CrossIcon, GearIcon, UsersIcon } from './components/Icons';
import { Toast } from './components/Toast';
import { useAppStore } from './store/useAppStore';
import { RandomPanel } from './features/verses/RandomPanel';
import { NumberPanel } from './features/verses/NumberPanel';
import { CustomPanel } from './features/verses/CustomPanel';
import { ShareSheet } from './features/share/ShareSheet';
import { ConfigModal } from './features/config/ConfigModal';
import { QueueView } from './features/contacts/QueueView';
import { VisitView } from './features/contacts/VisitView';
import { ImportReportModal } from './features/config/ImportReportModal';
import { preloadLogo } from './lib/cardImage';
import { getCardName } from './lib/name';

export const App: React.FC = () => {
  const contacts = useAppStore((s) => s.contacts);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isConfigOpen = useAppStore((s) => s.isConfigOpen);
  const setIsConfigOpen = useAppStore((s) => s.setIsConfigOpen);
  const isQueueOpen = useAppStore((s) => s.isQueueOpen);
  const setIsQueueOpen = useAppStore((s) => s.setIsQueueOpen);
  const isShareOpen = useAppStore((s) => s.isShareOpen);
  const setIsShareOpen = useAppStore((s) => s.setIsShareOpen);
  const activeReport = useAppStore((s) => s.activeReport);
  const setActiveReport = useAppStore((s) => s.setActiveReport);
  const activeContactId = useAppStore((s) => s.activeContactId);
  const activeContactPhone = useAppStore((s) => s.activeContactPhone);
  const openVisit = useAppStore((s) => s.openVisit);

  // Preload logo for canvas renderer
  useEffect(() => {
    preloadLogo(logoImg);
  }, []);

  const activeContact = contacts.find((c) => c.id === activeContactId);

  return (
    <div className="wrap">
      {/* Header */}
      <header>
        <button
          type="button"
          className="header-btn"
          aria-label="الإعدادات والملفات"
          title="الإعدادات وإدارة الملفات"
          onClick={() => setIsConfigOpen(true)}
        >
          <GearIcon />
        </button>

        <div className="brand">
          <img alt="اجتماع شباب الملاك" src={logoImg} />
        </div>
        <h1>افتقد سلامة اخوتك</h1>
        <p className="sub">كلمة من الله لكل واحد فينا</p>
        <div className="divider">
          <CrossIcon style={{ color: 'var(--gold)' }} size={16} />
        </div>

        {/* Visitation button appears ONLY when at least one contact exists */}
        {contacts.length > 0 && (
          <div className="visitation-banner">
            <button
              type="button"
              className="btn-visitation"
              onClick={() => setIsQueueOpen(true)}
            >
              <UsersIcon size={22} />
              <span>الافتقاد</span>
              <span className="badge-count">{contacts.length}</span>
            </button>
          </div>
        )}

        {/* Active Contact Visit Session Bar */}
        {activeContact && <VisitView />}
      </header>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="طريقة اختيار الآية">
        <button
          type="button"
          className="tab"
          role="tab"
          id="tab-random"
          aria-selected={activeTab === 'random'}
          onClick={() => setActiveTab('random')}
        >
          سحب عشوائي
        </button>
        <button
          type="button"
          className="tab"
          role="tab"
          id="tab-number"
          aria-selected={activeTab === 'number'}
          onClick={() => setActiveTab('number')}
        >
          اختيار رقم
        </button>
        <button
          type="button"
          className="tab"
          role="tab"
          id="tab-custom"
          aria-selected={activeTab === 'custom'}
          onClick={() => setActiveTab('custom')}
        >
          مخصص
        </button>
      </div>

      {/* Main Panels */}
      {activeTab === 'random' && <RandomPanel />}
      {activeTab === 'number' && <NumberPanel />}
      {activeTab === 'custom' && <CustomPanel />}

      {/* Footer */}
      <footer>
        <b>افتقد سلامة اخوتك</b>
        <br />
        اجتماع شباب الملاك
      </footer>

      {/* Modals & Overlays */}
      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        initialRecipientName={activeContact ? getCardName(activeContact.name) : ''}
        initialPhone={activeContact ? activeContactPhone || activeContact.phones[0] : ''}
        activeContactId={activeContact ? activeContact.id : null}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <QueueView
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSelectContact={(contactId) => openVisit(contactId)}
      />

      <ImportReportModal
        report={activeReport}
        onClose={() => setActiveReport(null)}
      />

      <Toast />
    </div>
  );
};
