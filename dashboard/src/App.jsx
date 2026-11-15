import { useCallback, useEffect, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler } from './api.js';
import { useToast } from './components/ui.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DevicesPage from './pages/DevicesPage.jsx';
import ContentsPage from './pages/ContentsPage.jsx';
import PlaylistsPage from './pages/PlaylistsPage.jsx';

const PAGES = [
  ['devices', 'Perangkat'],
  ['contents', 'Konten'],
  ['playlists', 'Playlist'],
];

export default function App() {
  const toast = useToast();
  const [token, setTokenState] = useState(getToken());
  const [page, setPage] = useState('devices');

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast('Sesi berakhir, silakan masuk lagi', 'err');
    });
  }, [logout, toast]);

  if (!token) return <LoginPage onLogin={setTokenState} />;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Signage</span>
        <nav aria-label="Menu utama">
          {PAGES.map(([key, label]) => (
            <button key={key} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>Keluar</button>
      </header>
      <main className="content">
        {page === 'devices' && <DevicesPage token={token} />}
        {page === 'contents' && <ContentsPage />}
        {page === 'playlists' && <PlaylistsPage />}
      </main>
    </div>
  );
}
