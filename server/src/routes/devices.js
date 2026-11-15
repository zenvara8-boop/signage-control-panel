import { Router } from 'express';
import { supabase } from '../supabase.js';
import { check, cleanString, HttpError, isUuid, validateIdParam } from '../utils/validate.js';
import { disconnectDevice, sendToDevice } from '../realtime/registry.js';
import { sendPlaylistToDevice } from '../services/playlist.js';

const router = Router();
router.param('id', validateIdParam);

const SELECT = '*, playlist:playlists(id, nama)';

function parseBody(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || 'nama' in body) out.nama = cleanString(body.nama, { field: 'Nama', max: 100, required: true });
  if ('lokasi' in body) out.lokasi = cleanString(body.lokasi, { field: 'Lokasi', max: 150 });
  if ('playlist_id' in body) {
    if (body.playlist_id !== null && !isUuid(body.playlist_id)) throw new HttpError(400, 'playlist_id tidak valid');
    out.playlist_id = body.playlist_id;
  }
  return out;
}

router.get('/', async (_req, res) => {
  res.json(check(await supabase.from('devices').select(SELECT).order('created_at')));
});

router.get('/:id', async (req, res) => {
  const data = check(await supabase.from('devices').select(SELECT).eq('id', req.params.id).maybeSingle());
  if (!data) throw new HttpError(404, 'Device tidak ditemukan');
  res.json(data);
});

router.post('/', async (req, res) => {
  const payload = parseBody(req.body);
  const data = check(await supabase.from('devices').insert(payload).select(SELECT).single());
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const payload = parseBody(req.body, { partial: true });
  if (!Object.keys(payload).length) throw new HttpError(400, 'Tidak ada data yang diubah');

  const data = check(await supabase.from('devices').update(payload).eq('id', req.params.id).select(SELECT).maybeSingle());
  if (!data) throw new HttpError(404, 'Device tidak ditemukan');

  if ('playlist_id' in payload) await sendPlaylistToDevice(data.id, data.playlist_id);
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const data = check(await supabase.from('devices').delete().eq('id', req.params.id).select('id').maybeSingle());
  if (!data) throw new HttpError(404, 'Device tidak ditemukan');
  disconnectDevice(data.id);
  res.status(204).end();
});

// Command: tampilkan konten tertentu di device sekarang juga.
router.post('/:id/push', async (req, res) => {
  const { contentId } = req.body ?? {};
  if (!isUuid(contentId)) throw new HttpError(400, 'contentId tidak valid');

  const content = check(await supabase.from('contents').select('*').eq('id', contentId).maybeSingle());
  if (!content) throw new HttpError(404, 'Konten tidak ditemukan');

  const delivered = sendToDevice(req.params.id, { type: 'content:push', content });
  res.json({ delivered });
});

// Command: kembali memutar playlist.
router.post('/:id/resume', async (req, res) => {
  const device = check(await supabase.from('devices').select('id, playlist_id').eq('id', req.params.id).maybeSingle());
  if (!device) throw new HttpError(404, 'Device tidak ditemukan');
  const delivered = await sendPlaylistToDevice(device.id, device.playlist_id);
  res.json({ delivered });
});

export default router;
