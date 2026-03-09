// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

const BUILD_MINIFIER = process.env.JULIAAPP_BUILD_MINIFIER === 'terser' ? 'terser' : 'esbuild';
const SHOULD_USE_TERSER = BUILD_MINIFIER === 'terser';

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
        '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
        '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
        '@passport': fileURLToPath(new URL('./src/domains/passport', import.meta.url)),
        '@lls': fileURLToPath(new URL('./src/domains/llm', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
      }
    },
    build: {
      minify: BUILD_MINIFIER,
      sourcemap: false,
      reportCompressedSize: false,
      target: 'es2022',
      terserOptions: SHOULD_USE_TERSER
        ? {
            compress: {
              passes: 2,
              drop_debugger: true
            },
            format: {
              comments: false
            }
          }
        : undefined
    }
  },
  integrations: [react()]
});
