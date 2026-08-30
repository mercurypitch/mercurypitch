import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// `vite --mode https` serves over TLS with a self-signed cert — for LAN
// device playtests: getUserMedia needs a secure context, and only
// localhost is exempt. Accept the one-time certificate warning on the
// device; the mic prompt then works without browser flags.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [...(mode === 'https' ? [basicSsl()] : []), solid()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['solid-js'],
  },
  build: {
    target: 'es2022',
  },
}))
