import { fileURLToPath, URL } from 'node:url'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

process.env.NODE_ENV = 'test'

export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['solid-js'],
  },
  // The app reads its own provenance from globals that vite.config.ts
  // bakes in (src/build-info.ts). Under vitest there is no such build, so
  // they are pinned to fixed values — which also means a test can assert
  // the stamp's format without depending on whoever's checkout it runs in.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __APP_COMMIT__: JSON.stringify('testsha'),
    __APP_DIRTY__: 'false',
    __APP_CHANNEL__: JSON.stringify('dev'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
