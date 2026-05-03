import ssl from '@vitejs/plugin-basic-ssl'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig(({ mode }) => {
  // Get environment from mode or NODE_ENV
  const env = process.env.DENO_DEPLOYMENT ? mode : (process.env.NODE_ENV || 'production')
  const isDev = env !== 'production'

  return {
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
      target: isDev ? 'esnext' : 'es2020',
      sourcemap: isDev ? 'inline' : 'hidden',
      minify: !isDev,
    },
    define: {
      'process.env': {},
      'import.meta.env.DEV': isDev,
      'import.meta.env.PROD': !isDev,
    },
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
  }
})
