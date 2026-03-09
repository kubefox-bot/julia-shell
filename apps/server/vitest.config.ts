import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@passport': fileURLToPath(new URL('./src/domains/passport', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/domains/passport/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/domains/passport/**/*.{ts,tsx}',
        'src/widgets/terminal-agent/server/**/*.ts',
        'src/core/db/terminal-agent-repository.ts'
      ],
      exclude: [
        'src/domains/passport/**/*.d.ts',
        'src/domains/passport/**/index.ts',
        'src/domains/passport/server/runtime/**',
        'src/domains/passport/client/types.ts',
        'src/domains/passport/ui/**',
        'src/widgets/terminal-agent/server/types.ts'
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
