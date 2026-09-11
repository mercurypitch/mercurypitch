import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

process.env.NODE_ENV = 'test'

// Same alias as the build, for the same reason: a test that resolved `@`
// differently from the bundle would be testing a different application.
const ROOT_SRC = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../src',
)

// The shell's own suites, and the only ones that need a document. Everything
// else this package tests — the bundle manifest, the storage port, the back
// button, define parity — is plumbing with no DOM in it, and every jsdom
// instance costs real time (the root config's split is measured: more than
// half its CPU was spent building documents for suites that never used one).
//
// The two projects below are exact complements, so no file runs twice and
// none is dropped.
const SHELL_TESTS = ['src/shell/**/*.test.ts', 'src/shell/**/*.test.tsx']
const ALL_TESTS = ['src/**/*.test.ts', 'src/**/*.test.tsx']
const SHARED_EXCLUDE = ['**/node_modules/**', '**/dist/**']

export default defineConfig({
  // Mirrors the root config, including the cast: the plugin's own Vite types
  // and the one vitest/config resolves are two copies of the same shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [solidPlugin({ hot: false }) as any],
  resolve: {
    alias: { '@': ROOT_SRC },
    // One copy of Solid, or reactivity stops crossing the boundary.
    dedupe: ['solid-js'],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ALL_TESTS,
          exclude: [...SHARED_EXCLUDE, ...SHELL_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: SHELL_TESTS,
          exclude: SHARED_EXCLUDE,
        },
      },
    ],
  },
})
