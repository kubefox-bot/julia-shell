// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { resolveServerAliases, resolveServerBuildConfig } from './config/vite.shared.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    resolve: {
      alias: resolveServerAliases(import.meta.url)
    },
    css: {
      transformer: 'lightningcss'
    },
    build: resolveServerBuildConfig(process.env)
  },
  integrations: [react()]
});
