import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in dev so SameSite=Strict cookies work without loosening CORS.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: false }, // never ship source maps
});
