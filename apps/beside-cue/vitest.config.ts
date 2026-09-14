import { fileURLToPath, URL } from 'node:url'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

process.env.NODE_ENV = 'test'

export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: {
    alias: [
      // Tests run as the v1 store build does, without the B-side games
      // (src/games/entry.ts).
      {
        find: /^@\/games\/entry$/u,
        replacement: fileURLToPath(
          new URL('./src/games/entry-off.ts', import.meta.url),
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
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
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        // Real Vite builds use esbuild, which needs Node's byte-array realm.
        extends: true,
        test: {
          name: 'build',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
    ],
  },
})
