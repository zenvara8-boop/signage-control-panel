import { Router } from 'express';
import { supabase } from '../supabase.js';
import { check, cleanString, HttpError, isUuid, validateIdParam } from '../utils/validate.js';
import { getPlaylistItems, syncPlaylistDevices } from '../services/playlist.js';
import { sendToDevice } from '../realtime/registry.js';

const router = Router();
router.param('id', validateIdParam);

function parseItems(items) {
  if (!Array.isArray(items)) throw new HttpError(400, 'items harus berupa array');
  if (items.length > 100) throw new HttpError(400, 'Maksimal 100 item per playlist');
  return items.map((it, i) => {
    const durasi = Number(it?.durasi_detik ?? 10);
    if (!isUuid(it?.content_id)) throw new HttpError(400, `Item #${i + 1}: content_id tidak valid`);
    if (!Number.isInteger(durasi) || durasi < 1 || durasi > 3600) {
      throw new HttpError(400, `Item #${i + 1}: durasi harus 1-3600 detik`);
    }
    return { content_id: it.content_id, durasi_detik: durasi, urutan: i };
  });
}

router.get('/', async (_req, res) => {
  const rows = check(
    await supabase.from('playlists').select('*, playlist_items(count), devices(count)').order('created_at')
  );
  res.json(
    rows.map(({ playlist_items, devices, ...p }) => ({
      ...p,
      item_count: playlist_items?.[0]?.count ?? 0,
      device_count: devices?.[0]?.count ?? 0,
    }))
  );
});

router.get('/:id', async (req, res) => {
  const playlist = check(await supabase.from('playlists').select('*').eq('id', req.params.id).maybeSingle());
  if (!playlist) throw new HttpError(404, 'Playlist tidak ditemukan');
  res.json({ ...playlist, items: await getPlaylistItems(playlist.id) });
});

router.post('/', async (req, res) => {
  const nama = cleanString(req.body?.nama, { field: 'Nama', max: 100, required: true });
  const items = req.body.items?.length ? parseItems(req.body.items) : [];
  const playlist = check(await supabase.from('playlists').insert({ nama }).select().single());
  if (items.length) {
    check(await supabase.from('playlist_items').insert(items.map((it) => ({ ...it, playlist_id: playlist.id }))));
  }
  res.status(201).json(playlist);
});

// Simpan nama + seluruh item (urutan mengikuti urutan array)
router.put('/:id', async (req, res) => {
  const body = req.body ?? {};
  const id = req.params.id;
  const existing = check(await supabase.from('playlists').select('id').eq('id', id).maybeSingle());
  if (!existing) throw new HttpError(404, 'Playlist tidak ditemukan');

  const nama = 'nama' in body ? cleanString(body.nama, { field: 'Nama', max: 100, required: true }) : null;
  const items = 'items' in body ? parseItems(body.items) : null; // validasi dulu sebelum menulis apa pun

  if (nama) check(await supabase.from('playlists').update({ nama }).eq('id', id));
  if (items) {
    check(await supabase.from('playlist_items').delete().eq('playlist_id', id));
    if (items.length) check(await supabase.from('playlist_items').insert(items.map((it) => ({ ...it, playlist_id: id }))));
  }

  await syncPlaylistDevices(id);
  const playlist = check(await supabase.from('playlists').select('*').eq('id', id).single());
  res.json({ ...playlist, items: await getPlaylistItems(id) });
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const devices = check(await supabase.from('devices').select('id').eq('playlist_id', id));
  const removed = check(await supabase.from('playlists').delete().eq('id', id).select('id').maybeSingle());
  if (!removed) throw new HttpError(404, 'Playlist tidak ditemukan');

  // devices.playlist_id menjadi null otomatis (on delete set null); kosongkan layar device.
  for (const d of devices) sendToDevice(d.id, { type: 'playlist:update', playlistId: null, items: [] });
  res.status(204).end();
});

export default router;
