import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const repositoryRoot = new URL('../../../../', import.meta.url)

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, repositoryRoot), 'utf8'))

const sha256 = async (path) =>
  createHash('sha256')
    .update(await readFile(new URL(path, repositoryRoot)))
    .digest('hex')

const receipt = async ({ assetId, file, manifestPath, manifestVersion }) => ({
  assetId,
  file,
  manifestPath,
  manifestVersion,
  sha256: await sha256(file),
})

export async function cloudwayAssetBaseline({ portrait = false } = {}) {
  const cloudwayManifestPath =
    'apps/beside-cue/public/games/cloudway-v3/manifest.json'
  const skyManifestPath =
    'apps/beside-cue/public/games/journey-map-v3/manifest.json'
  const adventureManifestPath =
    'apps/beside-cue/public/games/adventure/manifest.json'
  const [cloudwayManifest, skyManifest, adventureManifest] = await Promise.all([
    readJson(cloudwayManifestPath),
    readJson(skyManifestPath),
    readJson(adventureManifestPath),
  ])
  const assets = {
    platformKit: await receipt({
      assetId: cloudwayManifest.assetId,
      file: 'apps/beside-cue/public/games/cloudway-v3/cloudway-platform-kit-v3.glb',
      manifestPath: cloudwayManifestPath,
      manifestVersion: cloudwayManifest.version,
    }),
    skyBackdrop: await receipt({
      assetId: 'floating-museum-cloudscape-v3',
      file: 'apps/beside-cue/public/games/journey-map-v3/cloudscape.webp',
      manifestPath: skyManifestPath,
      manifestVersion: skyManifest.version,
    }),
  }
  if (portrait) {
    assets.portraitSlab = await receipt({
      assetId: 'legend-slab',
      file: 'apps/beside-cue/public/games/adventure/legend-slab.glb',
      manifestPath: adventureManifestPath,
      manifestVersion: adventureManifest.version,
    })
    assets.portraitTexture = await receipt({
      assetId: 'legend-johnny-cash',
      file: 'apps/beside-cue/public/games/adventure/legend-johnny-cash.webp',
      manifestPath: adventureManifestPath,
      manifestVersion: adventureManifest.version,
    })
  }
  return assets
}
