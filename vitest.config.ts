import { createRequire } from 'node:module'
import path from 'path'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Which suites can run without a DOM.
//
// Why it exists: every jsdom instance costs real time. The single-project run
// reported `environment 555.82s` against `tests 212.28s` — more than half the
// CPU spent building 921 documents, most of them for suites that never touch
// one. Splitting the run took that to 209.75s locally with an identical
// 921-file / 10,987-test result.
//
// The list was seeded by grepping for DOM globals and then narrowed by
// running it: 26 files that read as DOM-free reached `Audio`, `window` or a
// canvas *through their imports*, so a static scan alone cannot produce this
// list and it is not regenerated automatically.
//
// It is safe in every direction it can be wrong. A new test file is absent
// from this list and lands in jsdom, which is the superset. A listed file
// that later grows a DOM dependency fails loudly under `node` rather than
// silently degrading. A deleted file leaves a glob that matches nothing. The
// two projects below are exact complements, so no file runs twice and none is
// dropped — `--project node` and `--project jsdom` must sum to the full count.
const require = createRequire(import.meta.url)
const NODE_TESTS = require('./vitest.node-tests.json') as string[]

const ALL_TESTS = [
  'tools/**/*.test.ts',
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'workers/db-worker/src/**/*.test.ts',
  'workers/db-worker/node-tests/**/*.test.ts',
  'workers/jam-worker/src/**/*.test.ts',
]

const SHARED_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  'src/e2e/**',
  'src/e2e-cloud/**',
]

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
    globals: true,
    // Tests must not inherit machine-local API config (.env.local) —
    // they would otherwise run the HybridAdapter against a live worker.
    env: { VITE_API_BASE_URL: '' },
    // ALL_TESTS is one glob set for src, rather than a per-directory list. The
    // old list silently dropped whole categories: src/components/__tests__
    // matched only .test.tsx, so a .test.ts placed there ran nowhere and
    // reported nothing — a test file that cannot fail is worse than no test
    // file. It also blocked the move to colocated tests
    // (docs/agent/TESTING.md §3.1), because a test next to its module was only
    // picked up under src/features, src/lib or src/tests.
    //
    // Playwright specs are .spec.ts and live in src/e2e or src/e2e-cloud, so
    // they stay out of this by naming; both directories are excluded as well,
    // so a .test.ts placed there is still not swept in. The beside-cue
    // workspaces are deliberately absent: they are a separate Vitest project,
    // run by `pnpm beside-cue:test`.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['./src/tests/setup-node.ts'],
          include: NODE_TESTS,
          exclude: SHARED_EXCLUDE,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/tests/setup.ts'],
          include: ALL_TESTS,
          // The exact complement of the node project: a file listed there is
          // excluded here, so nothing runs twice and nothing is dropped.
          exclude: [...SHARED_EXCLUDE, ...NODE_TESTS],
        },
      },
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
