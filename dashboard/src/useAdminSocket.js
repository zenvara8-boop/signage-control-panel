import { useEffect, useRef } from 'react';
import { WS_URL } from './api.js';

/**
 * Koneksi WebSocket admin dengan auto-reconnect (exponential backoff).
 * Handler disimpan di ref agar socket tidak dibuat ulang tiap render.
 */
export function useAdminSocket({ token, onMessage, onOpen, onClose }) {
  const handlers = useRef({});
  handlers.current = { onMessage, onOpen, onClose };

  useEffect(() => {
    let ws;
    let timer;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      ws = new WebSocket(`${WS_URL}?role=admin&token=${encodeURIComponent(token)}`);
      ws.onopen = () => {
        attempt = 0;
        handlers.current.onOpen?.();
      };
      ws.onmessage = (e) => {
        try {
          handlers.current.onMessage?.(JSON.parse(e.data));
        } catch {
          /* abaikan pesan rusak */
        }
      };
      ws.onclose = (e) => {
        handlers.current.onClose?.();
        if (stopped || e.code === 4401) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [token]);
}
