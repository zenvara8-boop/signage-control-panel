import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { initWs } from './ws.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import deviceRoutes from './routes/devices.js';
import contentRoutes from './routes/contents.js';
import playlistRoutes from './routes/playlists.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());

app.use(express.json({ limit: '1mb' }));

// Endpoint publik read-only untuk pairing device (termasuk Electron dengan origin "null").
app.use('/api/public', cors(), publicRoutes);

app.use(cors({ origin: allowedOrigins }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/devices', requireAuth, deviceRoutes);
app.use('/api/contents', requireAuth, contentRoutes);
app.use('/api/playlists', requireAuth, playlistRoutes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
await initWs(server);

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`API + WebSocket berjalan di http://localhost:${port} (ws path: /ws)`));

process.on('unhandledRejection', (err) => console.error('unhandledRejection', err));
