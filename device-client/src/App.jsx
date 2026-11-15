import { useCallback, useEffect, useState } from 'react';
import { useDeviceSocket } from './useDeviceSocket.js';
import Pairing from './Pairing.jsx';
import Player from './Player.jsx';

const ID_KEY = 'signage_device_id';

function initialDeviceId() {
  const fromUrl = new URLSearchParams(window.location.search).get('id');
  if (fromUrl) localStorage.setItem(ID_KEY, fromUrl);
  return localStorage.getItem(ID_KEY);
}

export default function App() {
  const [deviceId, setDeviceId] = useState(initialDeviceId);

  const pair = (id) => {
    localStorage.setItem(ID_KEY, id);
    setDeviceId(id);
  };
  const unpair = useCallback(() => {
    localStorage.removeItem(ID_KEY);
    window.history.replaceState(null, '', window.location.pathname);
    setDeviceId(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.shiftKey && e.key.toLowerCase() === 'p' && unpair();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unpair]);

  return deviceId ? <Screen key={deviceId} deviceId={deviceId} onInvalid={unpair} /> : <Pairing onPair={pair} />;
}

function Screen({ deviceId, onInvalid }) {
  const cacheKey = `signage_playlist_${deviceId}`;
  // Playlist terakhir disimpan lokal supaya layar tetap tayang saat server tidak terjangkau.
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey)) || []; } catch { return []; }
  });
  const [override, setOverride] = useState(null);
  const [current, setCurrent] = useState(null);

  const onMessage = useCallback((msg) => {
    if (msg.type === 'playlist:update') {
      setItems(msg.items);
      setOverride(null);
      localStorage.setItem(cacheKey, JSON.stringify(msg.items));
    } else if (msg.type === 'content:push') {
      setOverride(msg.content);
    }
  }, [cacheKey]);

  const { connected, attempt, send } = useDeviceSocket(deviceId, { onMessage, onInvalid });

  // Laporkan tayangan saat ini ke dashboard, juga setiap kali koneksi pulih.
  useEffect(() => {
    if (connected) send({ type: 'now_playing', content: current && { id: current.id, judul: current.judul, tipe: current.tipe } });
  }, [current?.id, connected, send]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <Player items={items} override={override} onChange={setCurrent} />
      {!current && (
        <div className="idle">
          <h1>Menunggu tayangan</h1>
          <p>Pasang playlist atau kirim konten dari dashboard admin.</p>
        </div>
      )}
      {!connected && (
        <div className="conn" role="status">
          <span className="dot" />
          {attempt > 0 ? `Terputus dari server. Mencoba lagi (percobaan ${attempt})` : 'Menyambungkan ke server'}
        </div>
      )}
    </div>
  );
}
