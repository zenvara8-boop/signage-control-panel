import { Router } from 'express';
import multer from 'multer';
import { supabase, BUCKET } from '../supabase.js';
import { check, cleanHttpUrl, cleanString, HttpError, validateIdParam } from '../utils/validate.js';
import { playlistIdsUsingContent, syncPlaylistDevices } from '../services/playlist.js';

const router = Router();
router.param('id', validateIdParam);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const STORAGE_MARKER = `/object/public/${BUCKET}/`;

const storagePathFromUrl = (url) => {
  const i = url.indexOf(STORAGE_MARKER);
  return i === -1 ? null : decodeURIComponent(url.slice(i + STORAGE_MARKER.length));
};

router.get('/', async (_req, res) => {
  res.json(check(await supabase.from('contents').select('*').order('created_at', { ascending: false })));
});

// Konten teks atau tautan
router.post('/', async (req, res) => {
  const { tipe } = req.body ?? {};
  if (!['text', 'url'].includes(tipe)) throw new HttpError(400, 'tipe harus "text" atau "url" (gunakan /upload untuk file)');

  const judul = cleanString(req.body.judul, { field: 'Judul', max: 150, required: true });
  const raw = cleanString(req.body.payload, { field: 'Isi konten', max: 2000, required: true });
  const payload = tipe === 'url' ? cleanHttpUrl(raw, 'Tautan') : raw;

  res.status(201).json(check(await supabase.from('contents').insert({ judul, tipe, payload }).select().single()));
});

// Upload gambar/video -> Supabase Storage
router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'File wajib diunggah (field "file")');

  const tipe = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('video/') ? 'video' : null;
  if (!tipe) throw new HttpError(400, 'Hanya file gambar atau video yang diperbolehkan');

  const judul = cleanString(req.body.judul, { field: 'Judul', max: 150 }) || file.originalname.replace(/\.[^.]+$/, '');
  const safeName = file.originalname.replace(/[^\w.-]/g, '_');
  const path = `${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new HttpError(502, `Upload ke storage gagal: ${error.message}`);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { data, error: dbError } = await supabase
    .from('contents')
    .insert({ judul, tipe, payload: pub.publicUrl })
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([path]); // rollback file yatim
    throw dbError;
  }
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const existing = check(await supabase.from('contents').select('*').eq('id', req.params.id).maybeSingle());
  if (!existing) throw new HttpError(404, 'Konten tidak ditemukan');

  const patch = {};
  if ('judul' in req.body) patch.judul = cleanString(req.body.judul, { field: 'Judul', max: 150, required: true });
  if ('payload' in req.body) {
    if (!['text', 'url'].includes(existing.tipe)) throw new HttpError(400, 'Isi file gambar/video tidak dapat diubah');
    const raw = cleanString(req.body.payload, { field: 'Isi konten', max: 2000, required: true });
    patch.payload = existing.tipe === 'url' ? cleanHttpUrl(raw, 'Tautan') : raw;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'Tidak ada data yang diubah');

  const data = check(await supabase.from('contents').update(patch).eq('id', existing.id).select().single());
  for (const pid of await playlistIdsUsingContent(existing.id)) await syncPlaylistDevices(pid);
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const existing = check(await supabase.from('contents').select('*').eq('id', req.params.id).maybeSingle());
  if (!existing) throw new HttpError(404, 'Konten tidak ditemukan');

  const affected = await playlistIdsUsingContent(existing.id);
  check(await supabase.from('contents').delete().eq('id', existing.id));

  const path = ['image', 'video'].includes(existing.tipe) ? storagePathFromUrl(existing.payload) : null;
  if (path) await supabase.storage.from(BUCKET).remove([path]);

  for (const pid of affected) await syncPlaylistDevices(pid);
  res.status(204).end();
});

export default router;
