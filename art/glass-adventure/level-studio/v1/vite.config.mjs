// ============================================================
// Level Studio Vite config — static whole-worktree preview without app plugins
// ============================================================

import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioDirectory = dirname(fileURLToPath(import.meta.url))
const checkoutRoot = resolve(studioDirectory, '../../../..')
const externalAssetRoot =
  process.env.CLOUDWAY_ASSET_ROOT ??
  resolve(
    homedir(),
    'Documents/root/5-Creative/besidecue/assets/glass-adventure',
  )

export default {
  appType: 'mpa',
  optimizeDeps: { noDiscovery: true },
  server: {
    hmr: false,
    watch: null,
    fs: {
      allow: [checkoutRoot, externalAssetRoot],
      strict: true,
    },
  },
}
