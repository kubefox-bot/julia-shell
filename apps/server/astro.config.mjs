// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@passport': fileURLToPath(new URL('./src/domains/passport', import.meta.url))
      }
    },
    build: {
      minify: 'terser',
      sourcemap: false,
      reportCompressedSize: false,
      terserOptions: {
        compress: {
          passes: 2,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      }
    }
  },
  integrations: [react()]
});
