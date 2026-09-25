// Cloudway review server serves source proofs and an optional private authoring tool.
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const checkoutRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
)
const externalAssetRoot =
  process.env.CLOUDWAY_ASSET_ROOT ??
  resolve(
    homedir(),
    'Documents/root/5-Creative/besidecue/assets/glass-adventure',
  )
const privateStudioRoot =
  process.env.CLOUDWAY_STUDIO_ROOT ??
  resolve(
    homedir(),
    '.dotfiles/personal/besidecue/glass-adventure/tools/cloudway-level-studio/v1',
  )

export default {
  appType: 'mpa',
  optimizeDeps: { noDiscovery: true },
  server: {
    hmr: false,
    watch: null,
    fs: {
      allow: [checkoutRoot, externalAssetRoot, privateStudioRoot],
      strict: true,
    },
  },
}
