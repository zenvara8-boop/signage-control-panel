import { useEffect, useState } from 'react';
import { API_URL } from './config.js';

export default function Pairing({ onPair }) {
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  const load = () => {
    setError('');
    fetch(`${API_URL}/api/public/devices`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDevices)
      .catch(() => setError('Tidak dapat mengambil daftar perangkat. Periksa koneksi ke server.'));
  };
  useEffect(load, []);

  return (
    <main className="pairing">
      <h1>Pilih perangkat untuk layar ini</h1>
      <p>Layar akan mengingat pilihan ini. Tekan Shift + P kapan saja untuk memilih ulang.</p>

      {error && (
        <div className="notice">
          {error} <button onClick={load}>Coba lagi</button>
        </div>
      )}
      {devices?.length === 0 && <p>Belum ada perangkat. Tambahkan dulu lewat dashboard admin.</p>}

      <ul>
        {devices?.map((d) => (
          <li key={d.id}>
            <button onClick={() => onPair(d.id)}>
              <strong>{d.nama}</strong>
              <span>{d.lokasi || 'Lokasi belum diisi'}</span>
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => { e.preventDefault(); manual.trim() && onPair(manual.trim()); }}>
        <input placeholder="atau tempel ID perangkat" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button>Sambungkan</button>
      </form>
    </main>
  );
}
