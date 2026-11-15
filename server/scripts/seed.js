import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from '../src/supabase.js';

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';

const password_hash = await bcrypt.hash(password, 10);
const { error } = await supabase.from('admins').upsert({ username, password_hash }, { onConflict: 'username' });
if (error) {
  console.error('Seed gagal:', error.message);
  process.exit(1);
}

// Contoh konten teks agar dashboard tidak kosong saat pertama dibuka.
const { count } = await supabase.from('contents').select('*', { count: 'exact', head: true });
if (!count) {
  await supabase.from('contents').insert([
    { judul: 'Selamat datang', tipe: 'text', payload: 'Selamat datang di MJ Solution' },
    { judul: 'Jam operasional', tipe: 'text', payload: 'Senin - Jumat, 08.00 - 17.00' },
  ]);
}

console.log(`Admin siap: ${username} / ${password}`);
