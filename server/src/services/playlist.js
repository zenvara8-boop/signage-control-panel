import { supabase } from '../supabase.js';
import { check } from '../utils/validate.js';
import { sendToDevice } from '../realtime/registry.js';

export async function getPlaylistItems(playlistId) {
  if (!playlistId) return [];
  const rows = check(
    await supabase
      .from('playlist_items')
      .select('id, urutan, durasi_detik, content:contents(*)')
      .eq('playlist_id', playlistId)
      .order('urutan')
  );
  return rows.filter((r) => r.content);
}

export async function sendPlaylistToDevice(deviceId, playlistId) {
  const items = await getPlaylistItems(playlistId);
  return sendToDevice(deviceId, { type: 'playlist:update', playlistId, items });
}

/** Kirim ulang playlist ke semua device yang memakainya. */
export async function syncPlaylistDevices(playlistId) {
  const devices = check(await supabase.from('devices').select('id').eq('playlist_id', playlistId));
  if (!devices.length) return;
  const items = await getPlaylistItems(playlistId);
  for (const d of devices) sendToDevice(d.id, { type: 'playlist:update', playlistId, items });
}

export async function playlistIdsUsingContent(contentId) {
  const rows = check(await supabase.from('playlist_items').select('playlist_id').eq('content_id', contentId));
  return [...new Set(rows.map((r) => r.playlist_id))];
}
