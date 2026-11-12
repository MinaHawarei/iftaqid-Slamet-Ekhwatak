import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const Toast: React.FC = () => {
  const toast = useAppStore((s) => s.toast);
  const undoSnapshot = useAppStore((s) => s.undoSnapshot);
  const undoLastContact = useAppStore((s) => s.undoLastContact);

  useEffect(() => {
    if (!toast) return;
    // Auto dismiss after duration
    const duration = undoSnapshot ? 6500 : 2500;
    const timer = setTimeout(() => {
      // Clear toast
      useAppStore.setState({ toast: null, undoSnapshot: null });
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, undoSnapshot]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {undoSnapshot && (
        <button
          type="button"
          className="toast-undo-btn"
          onClick={() => {
            undoLastContact();
          }}
        >
          تراجع
        </button>
      )}
    </div>
  );
};
