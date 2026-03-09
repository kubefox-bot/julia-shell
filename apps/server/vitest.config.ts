import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/domains/passport/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domains/passport/**/*.{ts,tsx}'],
      exclude: [
        'src/domains/passport/server/runtime.ts',
        'src/domains/passport/server/index.ts',
        'src/domains/passport/client/types.ts',
        'src/domains/passport/ui/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70
      }
    }
  }
});
