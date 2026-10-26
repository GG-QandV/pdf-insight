/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from https://<user>.github.io/<repo>/
const base = process.env.VITE_BASE ?? '/pdf-insight/';

export default defineConfig({
  base,
  plugins: [react()],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
