// ============================================================
// Native (Capacitor) build — Break Glass.
//
// Builds ONLY the game entry (game.html) into dist-native/, then copies it to
// index.html so Capacitor's webDir has its expected entry. The platform seam
// `@/lib/platform` is aliased to the Capacitor implementations, so the whole
// app (incl. the @/lib/haptics re-export) uses native haptics/keep-awake/
// share/status-bar with no per-component changes.
//
// Kept separate from vite.config.ts (the multi-entry web build) on purpose:
// no cookie-consent/SEO alias plugins, no dev SSL, single entry, relative to
// the capacitor:// asset root.
// ============================================================

import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const __dirname = dirname(fileURLToPath(import.meta.url))

let commitSha = 'native'
try {
  const { execSync } = await import('node:child_process')
  commitSha = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
} catch {
  commitSha = process.env.VITE_COMMIT_SHA?.slice(0, 7) ?? 'native'
}

// Glass is WASM-free at runtime (YIN via AnalyserNode, no ONNX model loaded),
// but a lazy onnxruntime-web chunk is reachable in the shared graph. The web
// build externalizes .wasm (served from R2, never fetched by glass); do the
// same here so the native bundle doesn't ship a ~26 MB ORT wasm it never runs.
function removeWasmAssetsPlugin() {
  return {
    name: 'remove-wasm-assets',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const fileName in bundle) {
        if (fileName.endsWith('.wasm')) delete bundle[fileName]
      }
    },
  }
}

// Capacitor's webDir needs index.html; our entry is game.html. Copy it after
// the bundle is fully written (mirrors mirrorAliasFilesPlugin in the web config).
function nativeIndexPlugin() {
  return {
    name: 'native-index',
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, 'dist-native')
      copyFileSync(resolve(outDir, 'game.html'), resolve(outDir, 'index.html'))
    },
  }
}

export default defineConfig({
  plugins: [
    solidPlugin(),
    typegpuPlugin({}),
    removeWasmAssetsPlugin(),
    nativeIndexPlugin(),
  ],
  base: '/',
  resolve: {
    // Exact-match first so @/lib/platform → the Capacitor impls, while every
    // other @/… still resolves to src/. (Order matters: Vite uses first match.)
    alias: [
      {
        find: /^@\/lib\/platform$/,
        replacement: resolve(__dirname, 'src/lib/platform/capacitor.ts'),
      },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  define: {
    'process.env': {},
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
  build: {
    target: 'esnext',
    outDir: 'dist-native',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: [/.*\.wasm$/],
      input: { game: resolve(__dirname, 'game.html') },
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
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
