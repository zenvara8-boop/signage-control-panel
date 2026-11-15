import { useCallback, useEffect, useState } from 'react';
import { api, DEVICE_URL } from '../api.js';
import { useAdminSocket } from '../useAdminSocket.js';
import { Confirm, ContentPreview, Empty, Loading, Modal, TYPE_LABEL, timeAgo, useToast } from '../components/ui.jsx';

export default function DevicesPage({ token }) {
  const toast = useToast();
  const [devices, setDevices] = useState(null);
  const [contents, setContents] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playing, setPlaying] = useState({});
  const [live, setLive] = useState(false);
  const [form, setForm] = useState(null); // null | {} (baru) | device (edit)
  const [pushFor, setPushFor] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [, tick] = useState(0);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await api.devices.list());
    } catch (e) {
      toast(e.message, 'err');
      setDevices((d) => d ?? []);
    }
  }, [toast]);

  useEffect(() => {
    loadDevices();
    api.contents.list().then(setContents).catch(() => {});
    api.playlists.list().then(setPlaylists).catch(() => {});
    const t = setInterval(() => tick((n) => n + 1), 30000); // segarkan teks "x menit lalu"
    return () => clearInterval(t);
  }, [loadDevices]);

  const onMessage = useCallback((m) => {
    if (m.type === 'device:status') {
      setDevices((l) => l && l.map((d) => (d.id === m.id ? { ...d, status: m.status, last_seen: m.last_seen } : d)));
      if (m.status === 'offline') setPlaying((p) => omit(p, m.id));
    } else if (m.type === 'device:playing') {
      setPlaying((p) => (m.content ? { ...p, [m.id]: m.content } : omit(p, m.id)));
    } else if (m.type === 'presence:snapshot') {
      setPlaying(m.playing);
    }
  }, []);

  // Saat socket tersambung kembali, muat ulang agar tidak ada update yang terlewat.
  useAdminSocket({ token, onMessage, onOpen: () => { setLive(true); loadDevices(); }, onClose: () => setLive(false) });

  const replace = (d) => setDevices((l) => l.map((x) => (x.id === d.id ? { ...x, ...d, status: x.status, last_seen: x.last_seen } : x)));

  const save = async (values) => {
    try {
      if (values.id) {
        replace(await api.devices.update(values.id, { nama: values.nama, lokasi: values.lokasi }));
        toast('Perangkat diperbarui');
      } else {
        const d = await api.devices.create({ nama: values.nama, lokasi: values.lokasi });
        setDevices((l) => [...l, d]);
        toast('Perangkat ditambahkan');
      }
      setForm(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const remove = async () => {
    try {
      await api.devices.remove(toDelete.id);
      setDevices((l) => l.filter((d) => d.id !== toDelete.id));
      toast('Perangkat dihapus');
      setToDelete(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const assign = async (device, playlistId) => {
    try {
      replace(await api.devices.update(device.id, { playlist_id: playlistId || null }));
      toast(playlistId ? 'Playlist dipasang ke perangkat' : 'Playlist dilepas dari perangkat');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const push = async (contentId) => {
    try {
      const { delivered } = await api.devices.push(pushFor.id, contentId);
      toast(delivered ? `Konten dikirim ke ${pushFor.nama}` : 'Perangkat sedang offline, konten tidak terkirim', delivered ? 'ok' : 'err');
      if (delivered) setPushFor(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const resume = async (d) => {
    try {
      const { delivered } = await api.devices.resume(d.id);
      toast(delivered ? 'Perangkat kembali memutar playlist' : 'Perangkat sedang offline', delivered ? 'ok' : 'err');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      toast('ID perangkat disalin');
    } catch {
      toast(id);
    }
  };

  const online = devices?.filter((d) => d.status === 'online').length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Perangkat</h1>
          <p className="muted">
            {devices ? `${online} dari ${devices.length} perangkat sedang online` : 'Memuat perangkat'}
          </p>
        </div>
        <div className="head-actions">
          <span className={`sync ${live ? 'on' : ''}`} title="Koneksi real-time ke server">
            {live ? 'Real-time aktif' : 'Menyambungkan…'}
          </span>
          <button className="primary" onClick={() => setForm({})}>Tambah perangkat</button>
        </div>
      </div>

      {devices === null && <Loading />}
      {devices?.length === 0 && (
        <Empty title="Belum ada perangkat" hint="Tambahkan perangkat, lalu buka layar perangkat untuk menyambungkannya.">
          <button className="primary" onClick={() => setForm({})}>Tambah perangkat</button>
        </Empty>
      )}

      <ul className="devices">
        {devices?.map((d) => {
          const isOnline = d.status === 'online';
          const now = playing[d.id];
          return (
            <li key={d.id} className={`device ${d.status}`}>
              <span className="lamp" aria-hidden="true" />
              <div className="device-main">
                <h3>{d.nama}</h3>
                <p className="muted">{d.lokasi || 'Lokasi belum diisi'}</p>
              </div>
              <div className="device-state">
                <strong>{isOnline ? 'Online' : 'Offline'}</strong>
                <span className="muted">
                  {isOnline ? (now ? `Memutar: ${now.judul}` : 'Belum ada tayangan') : `Terakhir terlihat ${timeAgo(d.last_seen)}`}
                </span>
              </div>
              <label className="device-playlist">
                <span className="muted">Playlist</span>
                <select value={d.playlist_id || ''} onChange={(e) => assign(d, e.target.value)}>
                  <option value="">Tanpa playlist</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              </label>
              <div className="row-actions">
                <button disabled={!isOnline} onClick={() => setPushFor(d)} title={isOnline ? '' : 'Perangkat offline'}>Kirim konten</button>
                <button disabled={!isOnline || !d.playlist_id} onClick={() => resume(d)}>Putar playlist</button>
                <a className="btn" href={`${DEVICE_URL}?id=${d.id}`} target="_blank" rel="noreferrer">Buka layar</a>
                <button onClick={() => copyId(d.id)}>Salin ID</button>
                <button onClick={() => setForm(d)}>Ubah</button>
                <button className="danger-text" onClick={() => setToDelete(d)}>Hapus</button>
              </div>
            </li>
          );
        })}
      </ul>

      {form && <DeviceForm initial={form} onSave={save} onClose={() => setForm(null)} />}
      {pushFor && <PushModal device={pushFor} contents={contents} onPush={push} onClose={() => setPushFor(null)} />}
      {toDelete && (
        <Confirm
          title="Hapus perangkat"
          message={`Perangkat "${toDelete.nama}" akan dihapus dan layarnya diputus. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      )}
    </>
  );
}

const omit = (obj, key) => {
  const { [key]: _removed, ...rest } = obj;
  return rest;
};

function DeviceForm({ initial, onSave, onClose }) {
  const [v, setV] = useState({ id: initial.id, nama: initial.nama || '', lokasi: initial.lokasi || '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSave(v);
    setBusy(false);
  };
  return (
    <Modal title={v.id ? 'Ubah perangkat' : 'Tambah perangkat'} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Nama perangkat
          <input autoFocus required maxLength={100} placeholder="Layar Lobby" value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} />
        </label>
        <label>
          Lokasi
          <input maxLength={150} placeholder="Lantai 1, dekat resepsionis" value={v.lokasi} onChange={(e) => setV({ ...v, lokasi: e.target.value })} />
        </label>
        <footer>
          <button type="button" onClick={onClose}>Batal</button>
          <button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </footer>
      </form>
    </Modal>
  );
}

function PushModal({ device, contents, onPush, onClose }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    await onPush(selected);
    setBusy(false);
  };
  return (
    <Modal title={`Kirim konten ke ${device.nama}`} onClose={onClose} wide>
      <p className="muted">Konten tampil langsung di layar dan menggantikan playlist sampai kamu memilih "Putar playlist".</p>
      {contents.length === 0 ? (
        <Empty title="Belum ada konten" hint="Tambahkan konten di menu Konten terlebih dahulu." />
      ) : (
        <div className="pick-grid">
          {contents.map((c) => (
            <button key={c.id} className={`pick ${selected === c.id ? 'selected' : ''}`} onClick={() => setSelected(c.id)} aria-pressed={selected === c.id}>
              <ContentPreview content={c} />
              <strong>{c.judul}</strong>
              <span className="muted">{TYPE_LABEL[c.tipe]}</span>
            </button>
          ))}
        </div>
      )}
      <footer>
        <button onClick={onClose}>Batal</button>
        <button className="primary" disabled={!selected || busy} onClick={send}>{busy ? 'Mengirim…' : 'Kirim ke layar'}</button>
      </footer>
    </Modal>
  );
}
