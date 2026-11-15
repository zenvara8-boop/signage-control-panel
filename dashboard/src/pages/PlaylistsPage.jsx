import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Confirm, ContentPreview, Empty, Loading, TYPE_LABEL, useToast } from '../components/ui.jsx';

export default function PlaylistsPage() {
  const toast = useToast();
  const [playlists, setPlaylists] = useState(null);
  const [contents, setContents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null); // { id, nama, items: [{ key, content, durasi_detik }] }
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setPlaylists(await api.playlists.list());
    } catch (e) {
      toast(e.message, 'err');
      setPlaylists((p) => p ?? []);
    }
  }, [toast]);

  useEffect(() => {
    loadList();
    api.contents.list().then(setContents).catch(() => {});
  }, [loadList]);

  const open = async (id) => {
    if (dirty && !window.confirm('Perubahan belum disimpan. Tetap pindah playlist?')) return;
    try {
      const p = await api.playlists.get(id);
      setActiveId(id);
      setDraft({ id: p.id, nama: p.nama, items: p.items.map((i) => ({ key: i.id, content: i.content, durasi_detik: i.durasi_detik })) });
      setDirty(false);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const create = async () => {
    const nama = window.prompt('Nama playlist baru');
    if (!nama?.trim()) return;
    try {
      const p = await api.playlists.create({ nama });
      await loadList();
      await open(p.id);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const edit = (fn) => { setDraft((d) => fn(d)); setDirty(true); };
  const move = (i, dir) => edit((d) => {
    const items = [...d.items];
    [items[i], items[i + dir]] = [items[i + dir], items[i]];
    return { ...d, items };
  });

  const addContent = (id) => {
    const content = contents.find((c) => c.id === id);
    if (content) edit((d) => ({ ...d, items: [...d.items, { key: `${id}-${Date.now()}`, content, durasi_detik: content.tipe === 'video' ? 30 : 10 }] }));
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.playlists.update(draft.id, { nama: draft.nama, items: draft.items.map((i) => ({ content_id: i.content.id, durasi_detik: Number(i.durasi_detik) })) });
      setDirty(false);
      await loadList();
      toast('Playlist disimpan dan dikirim ke perangkat terkait');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.playlists.remove(draft.id);
      setDraft(null); setActiveId(null); setDirty(false); setToDelete(false);
      await loadList();
      toast('Playlist dihapus');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const total = draft?.items.reduce((s, i) => s + Number(i.durasi_detik || 0), 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Playlist</h1>
          <p className="muted">Susun urutan tayangan, lalu pasang ke perangkat dari menu Perangkat.</p>
        </div>
        <button className="primary" onClick={create}>Buat playlist</button>
      </div>

      {playlists === null && <Loading />}
      {playlists?.length === 0 && <Empty title="Belum ada playlist" hint="Buat playlist pertama untuk memutar beberapa konten bergantian." />}

      {playlists?.length > 0 && (
        <div className="split">
          <ul className="list" aria-label="Daftar playlist">
            {playlists.map((p) => (
              <li key={p.id}>
                <button className={`list-item ${p.id === activeId ? 'active' : ''}`} onClick={() => open(p.id)}>
                  <strong>{p.nama}</strong>
                  <span className="muted">{p.item_count} item, {p.device_count} perangkat</span>
                </button>
              </li>
            ))}
          </ul>

          <section className="editor">
            {!draft && <p className="muted">Pilih playlist di sebelah kiri untuk mulai mengedit.</p>}
            {draft && (
              <>
                <label>
                  Nama playlist
                  <input value={draft.nama} maxLength={100} onChange={(e) => edit((d) => ({ ...d, nama: e.target.value }))} />
                </label>

                {draft.items.length === 0 && <p className="muted">Playlist masih kosong. Tambahkan konten di bawah.</p>}
                <ol className="items">
                  {draft.items.map((it, i) => (
                    <li key={it.key}>
                      <ContentPreview content={it.content} className="thumb" />
                      <div className="item-title">
                        <strong>{it.content.judul}</strong>
                        <span className="muted">{TYPE_LABEL[it.content.tipe]}</span>
                      </div>
                      <label className="duration">
                        <input type="number" min={1} max={3600} value={it.durasi_detik} aria-label={`Durasi ${it.content.judul} dalam detik`}
                          onChange={(e) => edit((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, durasi_detik: e.target.value } : x)) }))} />
                        <span className="muted">detik</span>
                      </label>
                      <div className="row-actions">
                        <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naikkan">↑</button>
                        <button disabled={i === draft.items.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan">↓</button>
                        <button className="danger-text" onClick={() => edit((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}>Lepas</button>
                      </div>
                    </li>
                  ))}
                </ol>

                <label>
                  Tambah konten
                  <select value="" onChange={(e) => addContent(e.target.value)}>
                    <option value="">Pilih konten…</option>
                    {contents.map((c) => <option key={c.id} value={c.id}>{c.judul} ({TYPE_LABEL[c.tipe]})</option>)}
                  </select>
                </label>

                <footer className="editor-foot">
                  <span className="muted">Total satu putaran: {total} detik</span>
                  <div className="row-actions">
                    <button className="danger-text" onClick={() => setToDelete(true)}>Hapus playlist</button>
                    <button className="primary" disabled={!dirty || busy || !draft.nama.trim()} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan playlist'}</button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      )}

      {toDelete && (
        <Confirm title="Hapus playlist" message={`Playlist "${draft.nama}" akan dihapus. Perangkat yang memakainya akan berhenti memutar tayangan.`} onConfirm={remove} onClose={() => setToDelete(false)} />
      )}
    </>
  );
}
