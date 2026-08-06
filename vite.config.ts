import ssl from '@vitejs/plugin-basic-ssl'
import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig, loadEnv } from 'vite'
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
} catch {
  // Fallback to environment variables if git command fails (common in CI/CD like Deno Deploy)
  const envSha = [
    process.env.VITE_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.COMMIT_SHA,
    process.env.GIT_SHA,
    process.env.DENO_DEPLOYMENT_ID,
    process.env.DENO_DEPLOY_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
  ].find((value): value is string => value !== undefined && value !== '')

  if (envSha !== undefined) {
    commitSha = envSha.substring(0, 7)
  }
}

// Production has real HTML entries for Voice Mirror, the vocal-range test,
// Karaoke Night and Guitar Night. Dev and preview servers need equivalent
// clean-path rewrites; the tone-deaf legacy entry is a redirect because this
// product measures pitch matching and cannot diagnose amusia
// (public/_redirects handles prod).
const MIRROR_PATHS = new Set(['/mirror'])
const VOCAL_RANGE_PATHS = new Set(['/vocal-range-test'])
const TONE_DEAF_PATH = '/tone-deaf-test'
const KARAOKE_PATHS = new Set(['/karaoke-night', '/karaoke'])
const GUITAR_NIGHT_PATHS = new Set(['/guitar-night'])
// Glass aliases are worker-routed in production (wrangler `run_worker_first`
// + src/worker.ts) — deliberately NO alias HTML files are emitted for them.
const GLASS_PATHS = new Set([
  '/glass',
  '/break-glass-with-your-voice',
  '/high-note-test',
  '/shatter',
])

function standaloneEntryRewritePlugin() {
  const rewrite = (server: {
    middlewares: {
      use: (
        fn: (
          req: { url?: string },
          res: {
            statusCode: number
            setHeader(name: string, value: string): void
            end(): void
          },
          next: () => void,
        ) => void,
      ) => void
    }
  }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url !== undefined) {
        const queryAt = req.url.indexOf('?')
        const pathname = queryAt === -1 ? req.url : req.url.slice(0, queryAt)
        const search = queryAt === -1 ? '' : req.url.slice(queryAt)
        const path =
          pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
        if (path === TONE_DEAF_PATH) {
          res.statusCode = 301
          res.setHeader('Location', `/mirror${search}`)
          res.end()
          return
        }
        if (MIRROR_PATHS.has(path)) req.url = '/mirror.html'
        else if (VOCAL_RANGE_PATHS.has(path)) req.url = '/vocal-range-test.html'
        else if (KARAOKE_PATHS.has(path)) req.url = '/karaoke.html'
        else if (GUITAR_NIGHT_PATHS.has(path)) req.url = '/guitar-night.html'
        else if (GLASS_PATHS.has(path)) req.url = '/glass.html'
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

// Production: the Cloudflare asset layer serves files directly, so every
// distinct search landing is a real Rollup HTML input. The only byte copy left
// is /karaoke-night: /karaoke is the source entry filename while the campaign
// URL is the canonical path. base:'/' keeps absolute asset URLs stable.
//
// Glass takes the newer route instead: its aliases are listed in wrangler's
// `assets.run_worker_first`, which invokes src/worker.ts BEFORE the asset
// layer for those exact paths — the worker serves glass.html content at the
// alias URL. One HTML file, no byte copies. (/glass itself needs neither:
// Cloudflare's html_handling maps it to glass.html, like /karaoke.)
function standaloneAliasFilesPlugin() {
  return {
    name: 'standalone-alias-files',
    // writeBundle runs after every file is on disk. (generateBundle is too
    // early: Vite emits the HTML assets after this plugin's hook.)
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, 'dist')
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

export default defineConfig(({ mode }) => {
  const modeEnv = loadEnv(mode, __dirname, '')
  const configuredApiBase =
    process.env.VITE_API_BASE_URL ?? modeEnv.VITE_API_BASE_URL
  const guidedMediaTarget =
    configuredApiBase === undefined || configuredApiBase === ''
      ? 'http://localhost:8788'
      : configuredApiBase

  return {
    plugins: [
      isDev ? ssl() : [],
      qrcode(),
      solidPlugin(),
      // Embeds TGSL shader metadata for typegpu (the glass TypeGPU renderer's
      // vertexFn/fragmentFn closures) — same setup as chaos-master.
      typegpuPlugin({}),
      standaloneEntryRewritePlugin(),
      standaloneAliasFilesPlugin(),
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
        '/api/guided-media': {
          target: guidedMediaTarget,
          changeOrigin: true,
        },
        '/api/jam': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          ws: true,
        },
        '/api/uvr': {
          // 127.0.0.1, not localhost: node resolves localhost to ::1 first,
          // and the docker container only publishes on IPv4 — the proxy
          // would hang on the unreachable IPv6 socket.
          target: `http://127.0.0.1:${Number(process.env.VITE_UVR_PROXY_PORT) || 8000}`,
          changeOrigin: true,
          // The FastAPI container serves /process at its root — strip the
          // prefix. The Cloudflare worker (wrangler dev; VITE_UVR_WORKER=1)
          // serves the full /api/uvr/* paths — keep it, so the real
          // auth/metering/RunPod chain can be exercised locally.
          ...(process.env.VITE_UVR_WORKER === '1'
            ? {}
            : { rewrite: (path) => path.replace(/^\/api\/uvr/, '') }),
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
        '/api/guided-media': {
          target: guidedMediaTarget,
          changeOrigin: true,
        },
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
          vocalRangeTest: resolve(__dirname, 'vocal-range-test.html'),
          karaoke: resolve(__dirname, 'karaoke.html'),
          guitarNight: resolve(__dirname, 'guitar-night.html'),
          glass: resolve(__dirname, 'glass.html'),
        },
        output: {
          manualChunks(id) {
            // Vite's own virtual helpers, above every other rule.
            //
            // `__vitePreload` is imported by EVERY chunk that contains a
            // dynamic import, so wherever it lands, the whole graph points
            // at that chunk. Falling through the rules below, it was
            // grouped into 'pitch-core' — and because pitch-core imports
            // 'vendor' for real, that closed a chunk cycle:
            //   Circular chunk: vendor -> pitch-core -> vendor
            // Rollup emits both halves of a cycle and the app can die at
            // first paint on "Cannot access 'X' before initialization",
            // which only a production build shows and only E2E catches.
            // The helper depends on nothing but the DOM, so its own chunk
            // has no back-edge for anything to close a cycle through.
            if (id.startsWith('\0vite/') || id.includes('vite/preload-helper'))
              return 'vite-helpers'
            if (id.includes('node_modules')) {
              if (id.includes('onnxruntime')) return undefined
              // GPU stack rides its own chunk: only the lazily-imported glass
              // TypeGPU backend (and, later, tab-3d's) pulls it — the generic
              // vendor chunk must never drag typegpu into first paints, and
              // vendor must never be dragged in BY the gpu backend.
              if (id.includes('typegpu') || id.includes('wgpu-matrix'))
                return 'vendor-gpu'
              // VexFlow is only needed after a user opens a notation surface.
              // Keep its engraving/font payload out of the initial app vendor
              // chunk so adding sheet music does not tax every first visit.
              if (id.includes('vexflow')) return 'vendor-vexflow'
              // The YAML parser, reached only when somebody opens a
              // .lyricsfile. `parseLyricsfile` imports it dynamically for
              // exactly that reason, and the generic vendor chunk IS first
              // paint — landing there would undo the split entirely.
              if (id.includes('node_modules/yaml')) return 'vendor-yaml'
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
            // `mic-lock`, `mic-level`, `input-health` and `id` are here for a
            // second reason on top of payload size: `mic-manager` and
            // `pitch-f0-stream` import them, and leaving them in 'library'
            // made the two chunks import each other. A cycle across a chunk
            // boundary is not a warning — Rollup emits both halves and the
            // app dies at first paint on "Cannot access 'ge' before
            // initialization", with no clue which module 'ge' was. Whatever
            // pitch-core reaches has to be in pitch-core.
            if (
              /src\/lib\/(mirror\/|glass\/|pitch-f0-stream|pitch-detector|swift-f0-detector|scale-data|note-utils|mic-manager|mic-lock|mic-level|input-health|id\.|defaults|frequency-to-note|vocal-analyzer|legal-links|storage\.|analytics\.|consent\.)/.test(
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
            if (
              id.includes('LibraryModal') ||
              id.includes('SessionLibraryModal')
            )
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
        drafts: { nesting: true } as Record<string, unknown>,
      },
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
  }
})
