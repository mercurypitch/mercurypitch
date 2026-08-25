import path from 'path'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Vitest only defaults NODE_ENV to "test" when the host has not set it.
// Force a stable test runtime before Vite resolves Solid's conditional exports.
process.env.NODE_ENV = 'test'

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [solidPlugin({ hot: false }) as any],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'cloudflare:workers': path.resolve(
        __dirname,
        './workers/jam-worker/test-support/cloudflare-workers.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Tests must not inherit machine-local API config (.env.local) —
    // they would otherwise run the HybridAdapter against a live worker.
    env: { VITE_API_BASE_URL: '' },
    setupFiles: ['./src/tests/setup.ts'],
    // One glob for src, rather than a per-directory list. The list silently
    // dropped whole categories: src/components/__tests__ matched only .test.tsx,
    // so a .test.ts placed there ran nowhere and reported nothing — a test file
    // that cannot fail is worse than no test file. It also blocked the move to
    // colocated tests (docs/agent/TESTING.md §3.1), because a test next to its
    // module was only picked up under src/features, src/lib or src/tests.
    //
    // Playwright specs are .spec.ts and live in src/e2e or src/e2e-cloud, so
    // they stay out of this by naming; both directories are excluded below as
    // well, so a .test.ts placed there is still not swept in. The beside-cue
    // workspaces are deliberately absent: they are a separate Vitest project,
    // run by `pnpm beside-cue:test`.
    include: [
      'tools/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'workers/db-worker/src/**/*.test.ts',
      'workers/db-worker/node-tests/**/*.test.ts',
      'workers/jam-worker/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/e2e/**',
      'src/e2e-cloud/**',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/**/*.ts',
        'src/stores/**/*.ts',
        'src/components/**/*.tsx',
        'src/db/**/*.ts',
      ],
      exclude: ['src/tests/**', '**/*.d.ts'],
    },
  },
})
