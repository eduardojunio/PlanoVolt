import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Each build owns its complete asset cache; active editors stay on their current worker.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'offline-worker',
      writeBundle(options, bundle) {
        const assets = [
          ...new Set([
            '/',
            '/index.html',
            '/manifest.webmanifest',
            '/icon.svg',
            '/fonts/NotoSans-Regular.ttf',
            ...Object.keys(bundle).map((p) => '/' + p),
          ]),
        ];
        const version = `planovolt-${Date.now()}`;
        writeFileSync(
          resolve(options.dir ?? 'dist', 'sw.js'),
          `
const CACHE=${JSON.stringify(version)}, ASSETS=${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('message', event => { if(event.data === 'ACTIVATE') self.skipWaiting(); });
// Retain prior build assets for other tabs still editing with an older engine.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
 if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
 // Static, same-origin assets only. Ignore server Vary: Origin on precached fonts/modules.
 event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request,{ignoreVary:true})) || (event.request.mode === 'navigate' ? await cache.match('/index.html',{ignoreVary:true}) : (await caches.match(event.request,{ignoreVary:true})) || await fetch(event.request))));
});`,
        );
      },
    },
  ],
});
