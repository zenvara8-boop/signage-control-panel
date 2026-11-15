import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- Toast ---------- */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);
let toastId = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'ok') => {
    const id = ++toastId;
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Modal & Confirm ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Hapus', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <footer>
        <button onClick={onClose}>Batal</button>
        <button className="danger" onClick={run} disabled={busy}>
          {busy ? 'Memproses…' : confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}

/* ---------- Kecil-kecil ---------- */
export const Empty = ({ title, hint, children }) => (
  <div className="empty">
    <h3>{title}</h3>
    {hint && <p className="muted">{hint}</p>}
    {children}
  </div>
);

export const Loading = ({ label = 'Memuat…' }) => (
  <div className="loading" aria-busy="true">
    <span className="spinner" /> {label}
  </div>
);

export function timeAgo(iso) {
  if (!iso) return 'belum pernah terhubung';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export const TYPE_LABEL = { image: 'Gambar', video: 'Video', text: 'Teks', url: 'Tautan' };

export function ContentPreview({ content, className = '' }) {
  const { tipe, payload } = content;
  return (
    <div className={`preview ${tipe} ${className}`}>
      {tipe === 'image' && <img src={payload} alt={content.judul} loading="lazy" />}
      {tipe === 'video' && <video src={payload} muted preload="metadata" />}
      {tipe === 'text' && <p>{payload}</p>}
      {tipe === 'url' && <span>{new URL(payload).hostname}</span>}
    </div>
  );
}
