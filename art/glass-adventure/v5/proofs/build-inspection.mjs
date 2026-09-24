// Compile the real host/components/styles, selecting the journey only in this QA artifact.
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../../../../', import.meta.url))
await build({
  root: `${repo}/apps/beside-cue`,
  configFile: `${repo}/apps/beside-cue/vite.config.ts`,
  plugins: [
    {
      name: 'review-only-journey-selection',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/src/games/adventure/standalone.tsx')) return
        const guard = 'if (!import.meta.env.DEV) return undefined'
        if (!code.includes(guard)) throw new Error('Review entry guard changed')
        return { code: code.replace(guard, ''), map: null }
      },
    },
  ],
  build: {
    outDir:
      process.env.GLASS_INSPECTION_BUILD ||
      '/tmp/glass-gallery-inspection-build',
    emptyOutDir: true,
  },
})
