import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ssl from '@vitejs/plugin-basic-ssl'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  plugins: [isDev ? ssl() : [], solidPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  define: {
    'process.env': {},
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
})
