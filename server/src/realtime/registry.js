// Registry koneksi WebSocket yang aktif. Dipisah dari ws.js agar route REST
// bisa mengirim pesan tanpa circular import.

const deviceSockets = new Map(); // deviceId -> WebSocket
const adminSockets = new Set(); // WebSocket
const nowPlaying = new Map(); // deviceId -> { id, judul, tipe }

export const registry = { deviceSockets, adminSockets, nowPlaying };

export function broadcastAdmin(message) {
  const data = JSON.stringify(message);
  for (const s of adminSockets) if (s.readyState === 1) s.send(data);
}

/** @returns {boolean} true jika pesan dikirim ke socket yang sedang terbuka */
export function sendToDevice(deviceId, message) {
  const s = deviceSockets.get(deviceId);
  if (!s || s.readyState !== 1) return false;
  s.send(JSON.stringify(message));
  return true;
}

/** Putuskan device (mis. device dihapus) tanpa memicu update status. */
export function disconnectDevice(deviceId) {
  const s = deviceSockets.get(deviceId);
  deviceSockets.delete(deviceId);
  nowPlaying.delete(deviceId);
  s?.close(4404, 'device deleted');
}
