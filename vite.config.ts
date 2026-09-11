import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const base = process.env.FLY_BASE_PATH || (mode === 'pages' ? '/single-fly/' : '/');
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('FLY_BASE_PATH must start and end with /');
  }
  return {
    base,
    define: { __FLY_ASSET_BASE__: JSON.stringify(base) },
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    build: { outDir: 'dist-pages', emptyOutDir: true },
  };
});
