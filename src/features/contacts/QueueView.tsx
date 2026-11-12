import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CakeIcon, CloseIcon } from '../../components/Icons';
import { filterContacts, formatRelativeLastContact, sortQueue } from '../../lib/queue';
import { formatBirthdayDisplay, isUpcomingBirthday } from '../../lib/birthday';

interface QueueViewProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

const PAGE_SIZE = 30;

export const QueueView: React.FC<QueueViewProps> = ({
  isOpen,
  onClose,
  onSelectContact
}) => {
  const contacts = useAppStore((s) => s.contacts);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const sortedList = useMemo(() => {
    return sortQueue(contacts);
  }, [contacts]);

  const filteredList = useMemo(() => {
    return filterContacts(sortedList, search);
  }, [sortedList, search]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, currentPage]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-container"
      role="dialog"
      aria-modal="true"
      aria-label="قائمة الافتقاد"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxHeight: '88vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="modal-title">طابور الافتقاد</h2>
            <span
              style={{
                fontSize: '0.85rem',
                color: 'var(--gold)',
                background: 'rgba(240, 192, 90, 0.15)',
                padding: '2px 8px',
                borderRadius: '999px'
              }}
            >
              {filteredList.length} مخدوم
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '16px' }}>
          {/* Search box */}
          <div className="search-box">
            <input
              type="search"
              className="search-input"
              placeholder="ابحث بالاسم أو برقم الموبايل..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Contact Queue List */}
          {filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#a99cc0' }}>
              لا يوجد نتائج مطابقة للبحث
            </div>
          ) : (
            <div className="queue-list">
              {paginatedItems.map((contact) => {
                const bdayInfo = isUpcomingBirthday(contact.birthday);
                const relativeLast = formatRelativeLastContact(
                  contact.lastContactAt,
                  contact.lastContactType
                );

                return (
                  <div
                    key={contact.id}
                    className="queue-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectContact(contact.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectContact(contact.id);
                      }
                    }}
                  >
                    <div className="queue-item-main">
                      <div className="queue-item-name">
                        <span>{contact.name}</span>
                        {bdayInfo && bdayInfo.isUpcoming && (
                          <span
                            className={`birthday-badge ${bdayInfo.isToday ? 'today' : ''}`}
                            title={
                              bdayInfo.isToday
                                ? 'عيد ميلاده اليوم!'
                                : `عيد ميلاده خلال ${bdayInfo.daysRemaining} أيام`
                            }
                          >
                            <CakeIcon size={14} />
                            {bdayInfo.isToday ? 'عيد ميلاده اليوم!' : `عيد ميلاده بعد ${bdayInfo.daysRemaining} أيام`}
                          </span>
                        )}
                      </div>

                      <div className="queue-item-meta">
                        <span
                          style={{
                            color:
                              contact.lastContactAt === null
                                ? 'var(--coral)'
                                : '#b9aed3'
                          }}
                        >
                          {relativeLast}
                        </span>
                        {contact.birthday && (
                          <span style={{ color: '#a99cc0' }}>
                            • الميلاد: {formatBirthdayDisplay(contact.birthday)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ direction: 'ltr', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 700 }}>
                      {contact.phones[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </button>
              <span style={{ fontSize: '0.9rem', color: '#a99cc0' }}>
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

