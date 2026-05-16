import ssl from '@vitejs/plugin-basic-ssl'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [
    isDev ? ssl() : [],
    solidPlugin(),
    // removeLargeUvrModelPlugin(), // Disabled to allow same-origin model serving
  ],
  base: './',
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
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('onnxruntime')) return undefined
            return 'vendor'
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
            id.includes('VocalAnalysis')
          )
            return 'vocal'
          if (
            id.includes('UvrPanel') ||
            id.includes('UvrGuide') ||
            id.includes('uvr-api') ||
            id.includes('StemMixer')
          )
            return 'uvr'
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
