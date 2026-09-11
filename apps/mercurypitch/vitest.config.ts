import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

process.env.NODE_ENV = 'test'

// Same alias as the build, for the same reason: a test that resolved `@`
// differently from the bundle would be testing a different application.
const ROOT_SRC = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../src',
)

export default defineConfig({
  resolve: {
    alias: { '@': ROOT_SRC },
    // One copy of Solid, or reactivity stops crossing the boundary.
    dedupe: ['solid-js'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
