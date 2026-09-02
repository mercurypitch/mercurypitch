import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// Build provenance, baked in. See src/build-info.ts for why.
//
// Every lookup here is allowed to fail: the app is also built from
// release tarballs and inside containers with no git, and a missing sha
// is a worse reason to fail a build than it is a thing to know.
const git = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

const pkgVersion = (): string => {
  try {
    const raw = readFileSync(
      fileURLToPath(new URL('./package.json', import.meta.url)),
      'utf8',
    )
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// GITHUB_SHA is the commit a CI run actually checked out, which on a PR
// is the merge commit rather than anything `git rev-parse` would report.
const commit = (): string =>
  (process.env.GITHUB_SHA ?? '').slice(0, 7) ||
  git('rev-parse', '--short=7', 'HEAD') ||
  'unknown'

const dirty = (): boolean => {
  if (process.env.GITHUB_SHA !== undefined) return false
  const status = git('status', '--porcelain')
  return status !== null && status !== ''
}

const channel = (mode: string): 'dev' | 'ci' | 'release' => {
  if ((process.env.GITHUB_REF ?? '').startsWith('refs/tags/')) return 'release'
  if (process.env.CI === 'true') return 'ci'
  return mode === 'production' ? 'ci' : 'dev'
}

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
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion()),
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_DIRTY__: JSON.stringify(dirty()),
    __APP_CHANNEL__: JSON.stringify(channel(mode)),
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
  optimizeDeps: {
    // Out of the optimizer, as in the main app's vite config. Vite
    // bundles a dependency the first time something imports it and then
    // RELOADS THE PAGE for the new module graph. onnxruntime-web is
    // reached only from the detector worker, the first time a
    // microphone starts -- so on a cold cache (fresh install, cleared
    // node_modules/.vite, a config change) the tap that starts the mic
    // is answered by a fresh document at the same URL, no error shown.
    // Served raw from node_modules it is never discovered late.
    exclude: ['onnxruntime-web'],
  },
}))
