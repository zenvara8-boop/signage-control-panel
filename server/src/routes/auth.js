import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { check, HttpError } from '../utils/validate.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    throw new HttpError(400, 'Username dan password wajib diisi');
  }

  const admin = check(await supabase.from('admins').select('*').eq('username', username.trim()).maybeSingle());
  const valid = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!valid) throw new HttpError(401, 'Username atau password salah');

  const token = jwt.sign({ sub: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, admin: { username: admin.username } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

export default router;
