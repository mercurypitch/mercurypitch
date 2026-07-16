import ssl from '@vitejs/plugin-basic-ssl'
import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { qrcode } from 'vite-plugin-qrcode'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Only use SSL in dev mode - production builds don't need it
const isDev = process.env.NODE_ENV !== 'production'

let commitSha = 'unknown'
try {
  const { execSync } = await import('node:child_process')
  commitSha = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
} catch (e) {
  // Fallback to environment variables if git command fails (common in CI/CD like Deno Deploy)
  const envSha =
    process.env.VITE_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    process.env.GIT_SHA ||
    process.env.DENO_DEPLOYMENT_ID ||
    process.env.DENO_DEPLOY_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA

  if (envSha) {
    commitSha = envSha.substring(0, 7)
  }
}

// The Cloudflare worker rewrites the standalone-entry paths (/mirror +
// aliases, /karaoke-night + alias) to their HTML entries in production; dev
// and preview servers have no worker, so mirror the rewrites here or the
// links would land on the SPA shell instead.
const MIRROR_PATHS = new Set(['/mirror', '/vocal-range-test', '/tone-deaf-test'])
const KARAOKE_PATHS = new Set(['/karaoke-night', '/karaoke'])

function standaloneEntryRewritePlugin() {
  const rewrite = (server: {
    middlewares: {
      use: (
        fn: (
          req: { url?: string },
          res: unknown,
          next: () => void,
        ) => void,
      ) => void
    }
  }) => {
    server.middlewares.use((req, _res, next) => {
      if (req.url !== undefined) {
        const path = req.url.split('?')[0]
        if (MIRROR_PATHS.has(path)) req.url = '/mirror.html'
        else if (KARAOKE_PATHS.has(path)) req.url = '/karaoke.html'
      }
      next()
    })
  }
  return {
    name: 'standalone-entry-rewrite',
    configureServer: rewrite,
    configurePreviewServer: rewrite,
  }
}

// Production: the Cloudflare asset layer serves files directly, and with
// `not_found_handling: single-page-application` it returns index.html for any
// path without a matching file *before the worker runs* — so the worker's
// /vocal-range-test → mirror.html rewrite never fires for real browser
// navigations (it only fires for fetch/XHR, which fooled earlier checks). Emit
// the SEO aliases as real HTML files (byte copies of the built mirror.html) so
// Cloudflare serves the Voice Mirror for them directly — ad clicks, browser
// navigations and crawlers alike. base:'/' keeps the copied HTML's absolute
// asset URLs resolving correctly from any path.
function mirrorAliasFilesPlugin() {
  return {
    name: 'mirror-alias-files',
    // writeBundle runs after every file is on disk, so dist/mirror.html exists
    // to copy. (generateBundle is too early: Vite emits the HTML assets after
    // this plugin's hook, so the mirror.html bundle entry isn't there yet.)
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, 'dist')
      for (const fileName of ['vocal-range-test.html', 'tone-deaf-test.html']) {
        copyFileSync(resolve(outDir, 'mirror.html'), resolve(outDir, fileName))
      }
      // /karaoke maps to karaoke.html via Cloudflare's html_handling; the
      // canonical /karaoke-night needs its own real file.
      copyFileSync(
        resolve(outDir, 'karaoke.html'),
        resolve(outDir, 'karaoke-night.html'),
      )
    },
  }
}

function removeWasmAssetsPlugin() {
  return {
    name: 'remove-wasm-assets',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const fileName in bundle) {
        if (fileName.endsWith('.wasm')) {
          delete bundle[fileName]
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    isDev ? ssl() : [],
    qrcode(),
    solidPlugin(),
    standaloneEntryRewritePlugin(),
    mirrorAliasFilesPlugin(),
    removeWasmAssetsPlugin(),
  ],
  // Absolute base so asset URLs resolve from the site root. Required for
  // path-based deep-links (e.g. /exercises/<slug>): a relative './' base would
  // resolve ./assets/* against /exercises/, 404, and fall back to the SPA
  // shell (text/html) — blocked by X-Content-Type-Options: nosniff.
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: Number(process.env.VITE_DEV_PORT) || 3000,
    headers: {
      // Cross-origin isolation for multi-threaded WASM (ONNX Runtime)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api/jam': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
      '/api/uvr': {
        target: `http://localhost:${Number(process.env.VITE_UVR_PROXY_PORT) || 8000}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uvr/, ''), // Removes prefix before sending to API
      },
      // Proxy the large model to bypass CORS during development
      '/models/UVR-MDX-NET-Inst_HQ_3.onnx': {
        target: 'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/models/UVR-MDX-NET-Inst_HQ_3.onnx': {
        target: 'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      external: [/.*\.wasm$/],
      // Voice Mirror is a second, standalone entry (mirror.html) so its
      // bundle stays tiny — it must not pull in the app shell or ONNX.
      input: {
        index: resolve(__dirname, 'index.html'),
        mirror: resolve(__dirname, 'mirror.html'),
        karaoke: resolve(__dirname, 'karaoke.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('onnxruntime')) return undefined
            // solid-js gets its own chunk so the standalone mirror entry
            // (which uses nothing else from node_modules) doesn't drag the
            // whole app vendor bundle onto mobile 4G.
            if (id.includes('solid-js')) return 'vendor-solid'
            return 'vendor'
          }
          // Small pitch/mic/consent modules shared by the app and the
          // standalone entries (mirror, karaoke). Without this, Rollup
          // co-locates them with app chunks and the standalone entries
          // transitively load the whole app vendor bundle — legal-links
          // landing in the 'advanced' chunk once dragged ~2.7 MB of static
          // JS into the mirror's first paint via ConsentBanner.
          if (
            /src\/lib\/(mirror\/|pitch-detector|swift-f0-detector|scale-data|note-utils|mic-manager|defaults|frequency-to-note|vocal-analyzer|legal-links|storage\.|analytics\.|consent\.)/.test(
              id,
            ) ||
            /src\/stores\/notifications-store/.test(id) ||
            /src\/db\/services\/(auth-service|user-service|billing-service)/.test(
              id,
            )
          ) {
            // These are all app-store-free leaves shared by the app and the
            // standalone entries (the toast host, the karaoke account chip +
            // server-mode toggle). Without pinning them here Rollup co-locates
            // them in the heavy 'library' chunk — which also holds app-store —
            // and the karaoke entry statically pulls the whole thing.
            return 'pitch-core'
          }
          if (
            id.includes('CommunityShare') ||
            id.includes('CommunityLeaderboard')
          )
            return 'community'
          if (
            id.includes('PitchTestingTab') ||
            id.includes('PitchAlgorithmTester') ||
            id.includes('VocalChallenges') ||
            id.includes('VocalAnalysis') ||
            id.includes('UvrPanel') ||
            id.includes('UvrGuide') ||
            id.includes('uvr-api') ||
            id.includes('StemMixer')
          )
            return 'advanced'
          if (id.includes('LibraryModal') || id.includes('SessionLibraryModal'))
            return 'library'
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  define: {
    'process.env': {},
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      drafts: { nesting: true } as Record<string, unknown>,
    },
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
})
