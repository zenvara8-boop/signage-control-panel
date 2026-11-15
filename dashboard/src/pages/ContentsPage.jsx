import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Confirm, ContentPreview, Empty, Loading, Modal, TYPE_LABEL, useToast } from '../components/ui.jsx';

export default function ContentsPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.contents.list());
    } catch (e) {
      toast(e.message, 'err');
      setItems((i) => i ?? []);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await api.contents.remove(toDelete.id);
      setItems((l) => l.filter((c) => c.id !== toDelete.id));
      toast('Konten dihapus');
      setToDelete(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Konten</h1>
          <p className="muted">{items ? `${items.length} konten tersimpan` : 'Memuat konten'}</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>Tambah konten</button>
      </div>

      {items === null && <Loading />}
      {items?.length === 0 && (
        <Empty title="Belum ada konten" hint="Unggah gambar atau video, atau buat konten teks dan tautan.">
          <button className="primary" onClick={() => setAdding(true)}>Tambah konten</button>
        </Empty>
      )}

      <ul className="content-grid">
        {items?.map((c) => (
          <li key={c.id} className="content-card">
            <ContentPreview content={c} />
            <div className="content-body">
              <h3 title={c.judul}>{c.judul}</h3>
              <span className={`tag ${c.tipe}`}>{TYPE_LABEL[c.tipe]}</span>
            </div>
            <div className="row-actions">
              <button onClick={() => setEditing(c)}>Ubah</button>
              <button className="danger-text" onClick={() => setToDelete(c)}>Hapus</button>
            </div>
          </li>
        ))}
      </ul>

      {adding && <AddContent onClose={() => setAdding(false)} onCreated={(c) => { setItems((l) => [c, ...l]); setAdding(false); toast('Konten ditambahkan'); }} />}
      {editing && <EditContent content={editing} onClose={() => setEditing(null)} onSaved={(c) => { setItems((l) => l.map((x) => (x.id === c.id ? c : x))); setEditing(null); toast('Konten diperbarui'); }} />}
      {toDelete && (
        <Confirm
          title="Hapus konten"
          message={`"${toDelete.judul}" akan dihapus dari semua playlist dan file-nya dihapus dari storage.`}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      )}
    </>
  );
}

const TABS = [['file', 'Unggah file'], ['text', 'Teks'], ['url', 'Tautan']];

function AddContent({ onClose, onCreated }) {
  const toast = useToast();
  const [tab, setTab] = useState('file');
  const [judul, setJudul] = useState('');
  const [payload, setPayload] = useState('');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const pick = (f) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast('Hanya file gambar atau video yang diperbolehkan', 'err');
    if (f.size > 50 * 1024 * 1024) return toast('Ukuran file maksimal 50 MB', 'err');
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (tab === 'file' && !file) return toast('Pilih file terlebih dahulu', 'err');
    setBusy(true);
    try {
      onCreated(tab === 'file' ? await api.contents.upload(file, judul) : await api.contents.create({ tipe: tab, judul, payload }));
    } catch (err) {
      toast(err.message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title="Tambah konten" onClose={onClose}>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label>
          Judul {tab === 'file' && <span className="muted">(opsional, default nama file)</span>}
          <input maxLength={150} required={tab !== 'file'} value={judul} onChange={(e) => setJudul(e.target.value)} />
        </label>

        {tab === 'file' && (
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => input.current.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
          >
            <input ref={input} type="file" accept="image/*,video/*" hidden onChange={(e) => pick(e.target.files[0])} />
            {file ? <strong>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</strong> : <><strong>Tarik file ke sini</strong><span className="muted">atau klik untuk memilih. Gambar atau video, maksimal 50 MB.</span></>}
          </div>
        )}
        {tab === 'text' && (
          <label>
            Isi teks
            <textarea rows={4} maxLength={2000} required value={payload} onChange={(e) => setPayload(e.target.value)} />
          </label>
        )}
        {tab === 'url' && (
          <label>
            Tautan halaman
            <input type="url" required placeholder="https://contoh.com/promo" value={payload} onChange={(e) => setPayload(e.target.value)} />
            <span className="muted">Sebagian situs menolak ditampilkan di dalam layar (X-Frame-Options).</span>
          </label>
        )}

        <footer>
          <button type="button" onClick={onClose}>Batal</button>
          <button className="primary" disabled={busy}>{busy ? (tab === 'file' ? 'Mengunggah…' : 'Menyimpan…') : 'Simpan'}</button>
        </footer>
      </form>
    </Modal>
  );
}

function EditContent({ content, onClose, onSaved }) {
  const toast = useToast();
  const editable = content.tipe === 'text' || content.tipe === 'url';
  const [judul, setJudul] = useState(content.judul);
  const [payload, setPayload] = useState(content.payload);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await api.contents.update(content.id, editable ? { judul, payload } : { judul }));
    } catch (err) {
      toast(err.message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title="Ubah konten" onClose={onClose}>
      <form onSubmit={submit}>
        <ContentPreview content={content} className="wide" />
        <label>
          Judul
          <input autoFocus required maxLength={150} value={judul} onChange={(e) => setJudul(e.target.value)} />
        </label>
        {content.tipe === 'text' && (
          <label>Isi teks<textarea rows={4} maxLength={2000} required value={payload} onChange={(e) => setPayload(e.target.value)} /></label>
        )}
        {content.tipe === 'url' && (
          <label>Tautan<input type="url" required value={payload} onChange={(e) => setPayload(e.target.value)} /></label>
        )}
        {!editable && <p className="muted">File {TYPE_LABEL[content.tipe].toLowerCase()} tidak dapat diganti. Hapus dan unggah ulang jika perlu.</p>}
        <footer>
          <button type="button" onClick={onClose}>Batal</button>
          <button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </footer>
      </form>
    </Modal>
  );
}
