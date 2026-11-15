import { useState } from 'react';
import { api, setToken } from '../api.js';

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(form.username, form.password);
      setToken(token);
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <section className="login-brand">
        <h1>Signage Control Panel</h1>
        <p>Kelola layar digital dari satu tempat. Pantau perangkat yang menyala, atur konten, dan kirim tayangan ke layar mana pun.</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <h2>Masuk sebagai admin</h2>
        <label>
          Username
          <input autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
      </form>
    </main>
  );
}
