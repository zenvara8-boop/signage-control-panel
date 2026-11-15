import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' agar hasil build bisa dibuka lewat file:// di Electron.
export default defineConfig({ base: './', plugins: [react()] });
