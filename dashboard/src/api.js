export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';
export const DEVICE_URL = import.meta.env.VITE_DEVICE_URL || 'http://localhost:5174';

const TOKEN_KEY = 'signage_token';
let onUnauthorized = () => {};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  devices: {
    list: () => request('/api/devices'),
    create: (body) => request('/api/devices', { method: 'POST', body }),
    update: (id, body) => request(`/api/devices/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/api/devices/${id}`, { method: 'DELETE' }),
    push: (id, contentId) => request(`/api/devices/${id}/push`, { method: 'POST', body: { contentId } }),
    resume: (id) => request(`/api/devices/${id}/resume`, { method: 'POST' }),
  },
  contents: {
    list: () => request('/api/contents'),
    create: (body) => request('/api/contents', { method: 'POST', body }),
    upload: (file, judul) => {
      const form = new FormData();
      form.append('file', file);
      if (judul) form.append('judul', judul);
      return request('/api/contents/upload', { method: 'POST', form });
    },
    update: (id, body) => request(`/api/contents/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/api/contents/${id}`, { method: 'DELETE' }),
  },
  playlists: {
    list: () => request('/api/playlists'),
    get: (id) => request(`/api/playlists/${id}`),
    create: (body) => request('/api/playlists', { method: 'POST', body }),
    update: (id, body) => request(`/api/playlists/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/api/playlists/${id}`, { method: 'DELETE' }),
  },
};
