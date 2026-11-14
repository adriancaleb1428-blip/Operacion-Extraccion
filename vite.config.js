import { defineConfig } from 'vite';

// base './' permite publicar el build en GitHub Pages (cualquier subcarpeta) sin cambiar rutas.
export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
