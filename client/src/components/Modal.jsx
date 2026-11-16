import { useEffect } from 'react';
import Icon from './Icons.jsx';

// Glass dialog: bottom sheet on phones, centred card on larger screens.
export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        className={`glass-strong gradient-border max-h-[92vh] w-full animate-scale-in overflow-y-auto rounded-t-[28px] p-6 sm:rounded-[28px] ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button className="icon-btn -mr-2 h-9 w-9" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
