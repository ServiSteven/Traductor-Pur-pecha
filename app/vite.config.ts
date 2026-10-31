import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // Se precachea todo, incluido el paquete de datos de instalación (snapshot).
        globPatterns: ['**/*.{js,css,html,svg,json,webmanifest}'],
        navigateFallback: 'index.html',
        // Las actualizaciones de datos (API) NO pasan por la caché del SW: las controla sync.ts.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Traductor Español – Purépecha', short_name: 'Purépecha', lang: 'es-MX',
        description: 'Traductor y práctica de purépecha que funciona sin conexión.',
        theme_color: '#1F4E3D', background_color: '#F5F6F2', display: 'standalone', start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } },
  preview: { proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
});
