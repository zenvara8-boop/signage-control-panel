import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase.js';
import { isUuid } from './utils/validate.js';
import { registry, broadcastAdmin } from './realtime/registry.js';
import { sendPlaylistToDevice } from './services/playlist.js';

const HEARTBEAT_MS = 15_000;
const { deviceSockets, adminSockets, nowPlaying } = registry;

async function setStatus(id, status) {
  const last_seen = new Date().toISOString();
  try {
    await supabase.from('devices').update({ status, last_seen }).eq('id', id);
  } catch (err) {
    console.error('[ws] gagal menyimpan status', err.message);
  }
  broadcastAdmin({ type: 'device:status', id, status, last_seen });
}

function handleAdmin(ws, params) {
  try {
    jwt.verify(params.get('token') || '', process.env.JWT_SECRET);
  } catch {
    return ws.close(4401, 'unauthorized');
  }
  adminSockets.add(ws);
  ws.on('close', () => adminSockets.delete(ws));
  ws.send(JSON.stringify({ type: 'presence:snapshot', playing: Object.fromEntries(nowPlaying) }));
}

function handleDevice(ws, params) {
  const id = params.get('deviceId');
  let registered = false;

  // Handler dipasang sinkron sebelum await apa pun agar tidak ada event yang terlewat.
  ws.on('message', (raw) => {
    if (!registered) return;
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'now_playing') {
      const content = msg.content ? { id: msg.content.id, judul: msg.content.judul, tipe: msg.content.tipe } : null;
      content ? nowPlaying.set(id, content) : nowPlaying.delete(id);
      broadcastAdmin({ type: 'device:playing', id, content });
    }
  });

  ws.on('close', () => {
    // Abaikan jika socket ini sudah digantikan koneksi yang lebih baru.
    if (!registered || deviceSockets.get(id) !== ws) return;
    deviceSockets.delete(id);
    nowPlaying.delete(id);
    setStatus(id, 'offline');
  });

  (async () => {
    if (!isUuid(id)) return ws.close(4404, 'device not found');
    const { data: device } = await supabase.from('devices').select('id, playlist_id').eq('id', id).maybeSingle();
    if (!device) return ws.close(4404, 'device not found');
    if (ws.readyState !== 1) return; // sudah putus saat validasi

    deviceSockets.get(id)?.terminate(); // satu device = satu koneksi aktif
    deviceSockets.set(id, ws);
    registered = true;

    await setStatus(id, 'online');
    await sendPlaylistToDevice(id, device.playlist_id);
  })().catch((err) => {
    console.error('[ws] error device', err.message);
    ws.close(1011, 'server error');
  });
}

export async function initWs(server) {
  // Setelah restart tidak ada socket yang hidup, jadi semua device harus offline.
  await supabase.from('devices').update({ status: 'offline' }).neq('status', 'offline');

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('error', (err) => console.error('[ws] socket error', err.message));

    const params = new URL(req.url, 'http://localhost').searchParams;
    const role = params.get('role');
    if (role === 'admin') return handleAdmin(ws, params);
    if (role === 'device') return handleDevice(ws, params);
    ws.close(4400, 'invalid role');
  });

  // Heartbeat: socket yang tidak membalas ping di putaran berikutnya dianggap mati.
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on('close', () => clearInterval(timer));
}
