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
  // The pitch stream's detector worker imports the detector, which is big
  // enough that Rollup splits it into a chunk — and Vite's default `iife`
  // worker format cannot express a code-split build. ES workers are what
  // the main app already ships, and `audioWorklet.addModule` loads its
  // file as a module regardless, so this is the only format that serves
  // both. Requires a module-worker-capable engine, which every WebView
  // above our minimum is.
  worker: {
    format: 'es',
  },
}))
