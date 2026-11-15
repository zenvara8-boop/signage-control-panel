import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL } from './config.js';

const MAX_DELAY = 30_000;

/**
 * Koneksi WebSocket device dengan reconnect otomatis:
 * - exponential backoff + jitter (1s, 2s, 4s ... maks 30s)
 * - langsung mencoba lagi saat browser kembali online
 * - berhenti jika server menolak device (kode 4404: device tidak ada / dihapus)
 */
export function useDeviceSocket(deviceId, { onMessage, onInvalid }) {
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef(null);
  const handlers = useRef({});
  handlers.current = { onMessage, onInvalid };

  useEffect(() => {
    let timer;
    let tries = 0;
    let stopped = false;

    const connect = () => {
      clearTimeout(timer);
      const ws = new WebSocket(`${WS_URL}?role=device&deviceId=${encodeURIComponent(deviceId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        tries = 0;
        setAttempt(0);
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          handlers.current.onMessage?.(JSON.parse(e.data));
        } catch {
          /* abaikan pesan rusak */
        }
      };
      ws.onclose = (e) => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (stopped) return;
        if (e.code === 4404) return handlers.current.onInvalid?.();
        const delay = Math.min(1000 * 2 ** tries, MAX_DELAY) * (0.8 + Math.random() * 0.4);
        tries += 1;
        setAttempt(tries);
        timer = setTimeout(connect, delay);
      };
    };

    const onOnline = () => {
      if (!wsRef.current) connect();
    };
    window.addEventListener('online', onOnline);

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [deviceId]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
  }, []);

  return { connected, attempt, send };
}
