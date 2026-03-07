// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { VitePWA } from 'vite-plugin-pwa';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
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
  integrations: [
    react(),
    {
      name: 'pwa-setup',
      hooks: {
        'astro:config:setup': ({ updateConfig }) => {
          updateConfig({
            vite: {
              plugins: [
                VitePWA({
                  registerType: 'autoUpdate',
                  includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
                  manifest: {
                    name: 'Yulia Personal Assistant',
                    short_name: 'Yulia Assistant',
                    description: 'Automation for Yulia (Sorting downloads, HR search, English)',
                    theme_color: '#fafaf9',
                    background_color: '#fafaf9',
                    display: 'standalone',
                    icons: [
                      {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                      },
                      {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                      }
                    ]
                  }
                })
              ]
            }
          });
        }
      }
    }
  ]
});
