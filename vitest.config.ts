import path from 'path'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [solidPlugin({ hot: false }) as any],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Tests must not inherit machine-local API config (.env.local) —
    // they would otherwise run the HybridAdapter against a live worker.
    env: { VITE_API_BASE_URL: '' },
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx', 'src/lib/**/*.test.ts', 'src/components/__tests__/**/*.test.tsx'],
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

