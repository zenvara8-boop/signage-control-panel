import { Router } from 'express';
import { supabase } from '../supabase.js';
import { check } from '../utils/validate.js';

const router = Router();

// Dipakai layar pairing di device client (tanpa login). Hanya data minimal.
router.get('/devices', async (_req, res) => {
  const data = check(await supabase.from('devices').select('id, nama, lokasi').order('nama'));
  res.json(data);
});

export default router;
