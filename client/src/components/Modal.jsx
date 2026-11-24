import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
