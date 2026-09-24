// Assemble the accepted V6 Frost and Glide deliveries with the untouched V3 Marble and Crackle runtime roots.

import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, rename, rm, stat, writeFile, } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const LEGACY_KIT = join(
  REPO,
  'apps/beside-cue/public/games/cloudway-v3/cloudway-platform-kit-v3.glb',
)
const FROST_DELIVERY = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/exports/delivery/cloudway-frost-v6-delivery-2k.glb',
)
const GLIDE_DELIVERY = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/exports/delivery/cloudway-glide-v6-delivery-2k.glb',
)
const OUTPUT_DIR = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive',
)
const OUTPUT_KIT = join(OUTPUT_DIR, 'cloudway-platform-kit-v6.glb')
const OUTPUT_MANIFEST = join(OUTPUT_DIR, 'manifest.json')

const LOGICAL_ASSET_ID = 'cloudway-platform-kit-v1'
const ROOT_NAMES = [
  'Cloudway_Crackle_Intact',
  'Cloudway_Crackle_Release',
  'Cloudway_Crackle_Warning',
  'Cloudway_Frost',
  'Cloudway_Glide',
  'Cloudway_Marble',
]
const REPLACED_ROOT_NAMES = ['Cloudway_Frost', 'Cloudway_Glide']
const PRESERVED_ROOT_NAMES = ROOT_NAMES.filter(
  (name) => !REPLACED_ROOT_NAMES.includes(name),
)
const COLLIDER = Object.freeze({
  shape: 'box',
  width: 1.7,
  depth: 1.3,
  height: 0.24,
  topY: 0,
  center: [0, -0.12, 0],
})

async function requireGltfTransform() {
  const cliPackage = join(
    REPO,
    'apps/beside-cue/node_modules/@gltf-transform/cli/package.json',
  )
  const require = createRequire(await realpath(cliPackage))
  return {
    ...require('@gltf-transform/core'),
    ...require('@gltf-transform/extensions'),
    ...require('@gltf-transform/functions'),
  }
}

function directChild(scene, name) {
  const matches = scene.listChildren().filter((node) => node.getName() === name)
  if (matches.length !== 1)
    throw new Error(
      `Expected one direct scene root named ${name}; found ${matches.length}.`,
    )
  return matches[0]
}

function colliderFrom(node) {
  const encoded = node.getExtras().collider_json
  if (typeof encoded !== 'string')
    throw new Error(`${node.getName()} does not provide collider_json.`)
  return JSON.parse(encoded)
}

function assertCollider(node) {
  const collider = colliderFrom(node)
  for (const key of ['width', 'depth', 'height', 'topY'])
    if (collider[key] !== COLLIDER[key])
      throw new Error(
        `${node.getName()} collider ${key}=${collider[key]}; expected ${COLLIDER[key]}.`,
      )
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

function installRuntimeExtras(node, legacy) {
  const source = node.getExtras()
  const colliderSize = source.colliderSizeMetres
  if (
    !Array.isArray(colliderSize) ||
    colliderSize[0] !== COLLIDER.width ||
    colliderSize[1] !== COLLIDER.height ||
    colliderSize[2] !== COLLIDER.depth
  )
    throw new Error(
      `${node.getName()} delivery does not retain the 1.70 x 1.30 collider envelope.`,
    )
  node.setExtras({
    ...source,
    assetId: LOGICAL_ASSET_ID,
    assetRevision: 6,
    status: 'runtime-delivery',
    sourceAssetId: source.assetId,
    platformFamily: legacy.platformFamily,
    state: legacy.state,
    units: legacy.units,
    upAxis: legacy.upAxis,
    origin: legacy.origin,
    landingPlaneY: legacy.landingPlaneY,
    landing_json: legacy.landing_json,
    collider_json: JSON.stringify(COLLIDER),
  })
  assertCollider(node)
}

async function main() {
  const { ALL_EXTENSIONS, NodeIO, mergeDocuments, prune, unpartition } =
    await requireGltfTransform()
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const [kit, frost, glide] = await Promise.all([
    io.read(LEGACY_KIT),
    io.read(FROST_DELIVERY),
    io.read(GLIDE_DELIVERY),
  ])
  const scene = kit.getRoot().listScenes()[0]
  if (scene === undefined) throw new Error('The V3 runtime kit has no scene.')
  const legacyRoots = new Map(
    REPLACED_ROOT_NAMES.map((name) => [name, directChild(scene, name)]),
  )
  const legacyContracts = new Map(
    [...legacyRoots].map(([name, node]) => [name, node.getExtras()]),
  )

  for (const node of legacyRoots.values()) node.dispose()
  await kit.transform(
    prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }),
  )

  for (const source of [frost, glide]) {
    const sourceScene = source.getRoot().listScenes()[0]
    if (sourceScene === undefined)
      throw new Error('A V6 delivery candidate has no scene.')
    const sourceRoot = sourceScene.listChildren()[0]
    if (sourceRoot === undefined || sourceScene.listChildren().length !== 1)
      throw new Error('Each V6 delivery must contain exactly one scene root.')
    const expectedName = sourceRoot.getName()
    if (!REPLACED_ROOT_NAMES.includes(expectedName))
      throw new Error(`Unexpected V6 root ${expectedName}.`)

    const map = mergeDocuments(kit, source)
    const mergedScene = map.get(sourceScene)
    const mergedRoot = map.get(sourceRoot)
    if (mergedScene === undefined || mergedRoot === undefined)
      throw new Error(`Could not merge ${expectedName}.`)
    scene.addChild(mergedRoot)
    mergedScene.dispose()
    installRuntimeExtras(mergedRoot, legacyContracts.get(expectedName))
  }

  await kit.transform(
    unpartition(),
    prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }),
  )

  const finalRoots = scene
    .listChildren()
    .map((node) => node.getName())
    .sort()
  if (JSON.stringify(finalRoots) !== JSON.stringify([...ROOT_NAMES].sort()))
    throw new Error(`Unexpected combined kit roots: ${finalRoots.join(', ')}`)
  for (const name of ROOT_NAMES) assertCollider(directChild(scene, name))

  await rm(OUTPUT_DIR, { recursive: true, force: true })
  await mkdir(OUTPUT_DIR, { recursive: true })
  // Keep .glb as the final suffix so NodeIO embeds buffers and textures.
  const temporary = join(OUTPUT_DIR, '.cloudway-platform-kit-v6.tmp.glb')
  await io.write(temporary, kit)
  await rename(temporary, OUTPUT_KIT)

  // Fresh-import the exact public bytes before recording them in the manifest.
  const written = await io.read(OUTPUT_KIT)
  const writtenScene = written.getRoot().listScenes()[0]
  if (writtenScene === undefined)
    throw new Error('Written V6 kit has no scene.')
  for (const name of ROOT_NAMES) assertCollider(directChild(writtenScene, name))

  const sources = await Promise.all(
    [LEGACY_KIT, FROST_DELIVERY, GLIDE_DELIVERY].map(async (path) => ({
      path: path.slice(REPO.length + 1),
      bytes: (await stat(path)).size,
      sha256: await sha256(path),
    })),
  )
  const manifest = {
    version: 6,
    assetId: LOGICAL_ASSET_ID,
    status: 'integrated runtime delivery',
    description:
      'Accepted V6 Frost and Glide PBR deliveries combined with unchanged V3 Marble and Crackle roots.',
    coordinates: 'glTF +Y up; metres; root origins at landing plane y=0',
    collider: COLLIDER,
    bundle: {
      id: LOGICAL_ASSET_ID,
      file: 'cloudway-platform-kit-v6.glb',
      bytes: (await stat(OUTPUT_KIT)).size,
      sha256: await sha256(OUTPUT_KIT),
    },
    roots: ROOT_NAMES,
    preservedV3Roots: PRESERVED_ROOT_NAMES,
    replacedV6Roots: REPLACED_ROOT_NAMES,
    sources,
    runtimeContract: {
      loader: 'plain Three.js GLTFLoader',
      requiredExtensions: ['EXT_texture_webp', 'KHR_mesh_quantization'],
      decoderRequired: false,
      topologyReduction: false,
    },
  }
  await writeFile(OUTPUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify(manifest, null, 2))
}

await main()
