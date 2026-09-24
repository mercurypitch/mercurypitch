// Build the V7 Cloudway runtime kit with the accepted dense Marble and unchanged V6 families.

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, stat, writeFile, } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

import { discardStagedCandidate, promoteStagedCandidate, stageCandidateForAtomicPromotion, verifyAcceptedFile, } from './runtime_build_guards.mjs'

const runFile = promisify(execFile)
const REPO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
)
const V6_KIT = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive/cloudway-platform-kit-v6.glb',
)
const V6_MANIFEST = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive/manifest.json',
)
const MARBLE_RAW_2K = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/exports/cloudway-marble-v7-dense-baseline-2k.glb',
)
const MARBLE_DELIVERY_2K = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/exports/delivery/cloudway-marble-v7-dense-baseline-delivery-2k.glb',
)
const GLTF_TRANSFORM = join(
  REPO,
  'apps/beside-cue/node_modules/.bin/gltf-transform',
)
const MARBLE_TEXTURE_MAX = Number(
  process.env.CLOUDWAY_MARBLE_TEXTURE_MAX ?? '1024',
)
assert(
  MARBLE_TEXTURE_MAX === 1024 || MARBLE_TEXTURE_MAX === 2048,
  'CLOUDWAY_MARBLE_TEXTURE_MAX must be 1024 or 2048.',
)
const OUTPUT_DIR = process.env.CLOUDWAY_V7_OUTPUT_DIR
  ? resolve(process.env.CLOUDWAY_V7_OUTPUT_DIR)
  : join(REPO, 'art/glass-adventure/platform-trials/v7/runtime/master')
const OUTPUT_KIT = join(OUTPUT_DIR, 'cloudway-platform-kit-v7.glb')
const OUTPUT_MANIFEST = join(OUTPUT_DIR, 'manifest.json')
const ACCEPTED_INPUTS_PATH = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/production/accepted-inputs.json',
)
const ACCEPTED = JSON.parse(await readFile(ACCEPTED_INPUTS_PATH, 'utf8'))

const LOGICAL_ASSET_ID = 'cloudway-platform-kit-v1'
const ROOT_NAMES = [
  'Cloudway_Crackle_Intact',
  'Cloudway_Crackle_Release',
  'Cloudway_Crackle_Warning',
  'Cloudway_Frost',
  'Cloudway_Glide',
  'Cloudway_Marble',
]
const PRESERVED_V6_ROOTS = ROOT_NAMES.filter(
  (name) => name !== 'Cloudway_Marble',
)
const COLLIDER = Object.freeze({
  shape: 'box',
  width: 1.7,
  depth: 1.3,
  height: 0.24,
  topY: 0,
  center: [0, -0.12, 0],
})

async function gltfTransform() {
  const cliPackage = await realpath(
    join(REPO, 'apps/beside-cue/node_modules/@gltf-transform/cli/package.json'),
  )
  const require = createRequire(cliPackage)
  return {
    ...require('@gltf-transform/core'),
    ...require('@gltf-transform/extensions'),
    ...require('@gltf-transform/functions'),
  }
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

async function fileRecord(path) {
  return {
    path: path.slice(REPO.length + 1),
    bytes: (await stat(path)).size,
    sha256: await sha256(path),
  }
}

async function formatJson(value) {
  const config = (await resolveConfig(join(REPO, 'package.json'))) ?? {}
  return format(JSON.stringify(value), {
    ...config,
    parser: 'json',
    plugins: [],
  })
}

function directRoot(document, name) {
  const scene = document.getRoot().listScenes()[0]
  assert(scene, 'Document must have one default scene.')
  const matches = scene.listChildren().filter((node) => node.getName() === name)
  assert.equal(matches.length, 1, `Expected one direct root named ${name}.`)
  return matches[0]
}

function hashArray(accessor) {
  const array = accessor.getArray()
  assert(array, 'Every runtime accessor must expose an array.')
  return createHash('sha256')
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest('hex')
}

function geometryRecord(node) {
  const mesh = node.getMesh()
  return {
    name: node.getName(),
    translation: node.getTranslation(),
    rotation: node.getRotation(),
    scale: node.getScale(),
    mesh:
      mesh === null
        ? null
        : {
            name: mesh.getName(),
            primitives: mesh.listPrimitives().map((primitive) => ({
              mode: primitive.getMode(),
              indices:
                primitive.getIndices() === null
                  ? null
                  : {
                      count: primitive.getIndices().getCount(),
                      componentType: primitive.getIndices().getComponentType(),
                      normalized: primitive.getIndices().getNormalized(),
                      sha256: hashArray(primitive.getIndices()),
                    },
              attributes: primitive
                .listSemantics()
                .sort()
                .map((semantic) => {
                  const accessor = primitive.getAttribute(semantic)
                  assert(accessor, `Missing ${semantic} accessor.`)
                  return {
                    semantic,
                    count: accessor.getCount(),
                    componentType: accessor.getComponentType(),
                    normalized: accessor.getNormalized(),
                    sha256: hashArray(accessor),
                  }
                }),
            })),
          },
    children: node.listChildren().map(geometryRecord),
  }
}

function collider(node) {
  const encoded = node.getExtras().collider_json
  assert.equal(
    typeof encoded,
    'string',
    `${node.getName()} needs collider_json.`,
  )
  return JSON.parse(encoded)
}

function assertCollider(node) {
  const actual = collider(node)
  assert.deepEqual(
    {
      shape: actual.shape,
      width: actual.width,
      depth: actual.depth,
      height: actual.height,
      topY: actual.topY,
      center: actual.center,
    },
    COLLIDER,
    `${node.getName()} collider drifted from the simulation contract.`,
  )
}

async function runTransform(args, timeout = 1_200_000) {
  const result = await runFile(GLTF_TRANSFORM, args, {
    cwd: REPO,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.stdout.trim() !== '') process.stdout.write(result.stdout)
  if (result.stderr.trim() !== '') process.stderr.write(result.stderr)
}

function repoRelative(path) {
  return path.slice(REPO.length + 1)
}

async function verifyBuildInputs() {
  for (const [path, label] of [
    [V6_KIT, 'archived V6 runtime kit'],
    [V6_MANIFEST, 'archived V6 manifest'],
    [MARBLE_RAW_2K, 'V7 raw 2K Marble'],
    [MARBLE_DELIVERY_2K, 'V7 accepted 2K Marble delivery'],
  ])
    await verifyAcceptedFile(path, ACCEPTED.files[repoRelative(path)], label)

  const result = await runFile(GLTF_TRANSFORM, ['--version'], {
    cwd: REPO,
    timeout: 30_000,
  })
  assert.equal(
    result.stdout.trim(),
    ACCEPTED.gltfTransformVersion,
    'Review the glTF Transform version before changing an accepted delivery.',
  )
  const output = ACCEPTED.outputs[String(MARBLE_TEXTURE_MAX)]
  assert(
    output,
    `No accepted ${MARBLE_TEXTURE_MAX}px V7 runtime output is recorded.`,
  )
  return output
}

async function packageOneKTextures(work) {
  const resized = join(work, '1-resized.glb')
  const webp = join(work, '2-webp.glb')
  const deduped = join(work, '3-deduped.glb')
  const pruned = join(work, '4-pruned.glb')
  const delivery = join(work, 'cloudway-marble-v7-dense-runtime-1k.glb')
  await runTransform([
    'resize',
    MARBLE_RAW_2K,
    resized,
    '--width',
    '1024',
    '--height',
    '1024',
    '--filter',
    'lanczos3',
  ])
  await runTransform([
    'webp',
    resized,
    webp,
    '--quality',
    '94',
    '--near-lossless',
    'true',
    '--effort',
    '90',
  ])
  await runTransform(['dedup', webp, deduped])
  await runTransform([
    'prune',
    deduped,
    pruned,
    '--keep-attributes',
    'true',
    '--keep-indices',
    'true',
    '--keep-leaves',
    'true',
  ])
  await runTransform([
    'quantize',
    pruned,
    delivery,
    '--quantization-volume',
    'mesh',
    '--quantize-position',
    '16',
    '--quantize-normal',
    '16',
    '--quantize-texcoord',
    '16',
  ])
  await runTransform(['validate', delivery], 600_000)
  return delivery
}

function installRuntimeExtras(node, legacyExtras) {
  const sourceExtras = node.getExtras()
  assert.deepEqual(sourceExtras.colliderSizeMetres, [1.7, 0.24, 1.3])
  assert.equal(sourceExtras.landingWidthMetres, 1.7)
  assert.equal(sourceExtras.landingDepthMetres, 1.3)
  assert.equal(sourceExtras.landingTopGlTfYMetres, 0)
  node.setExtras({
    ...sourceExtras,
    assetId: LOGICAL_ASSET_ID,
    assetRevision: 7,
    status: 'runtime-delivery',
    sourceAssetId: sourceExtras.assetId,
    platformFamily: legacyExtras.platformFamily,
    state: legacyExtras.state,
    units: legacyExtras.units,
    upAxis: legacyExtras.upAxis,
    origin: legacyExtras.origin,
    landingPlaneY: legacyExtras.landingPlaneY,
    landing_json: legacyExtras.landing_json,
    collider_json: JSON.stringify(COLLIDER),
  })
  assertCollider(node)
}

async function main() {
  const acceptedOutput = await verifyBuildInputs()
  const work = await mkdtemp(join(tmpdir(), 'cloudway-v7-runtime-'))
  try {
    const packagedMarble =
      MARBLE_TEXTURE_MAX === 1024
        ? await packageOneKTextures(work)
        : MARBLE_DELIVERY_2K
    const {
      ALL_EXTENSIONS,
      NodeIO,
      getBounds,
      mergeDocuments,
      prune,
      unpartition,
    } = await gltfTransform()
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    const [kit, acceptedMarble, marble] = await Promise.all([
      io.read(V6_KIT),
      io.read(MARBLE_DELIVERY_2K),
      io.read(packagedMarble),
    ])
    const kitScene = kit.getRoot().listScenes()[0]
    const marbleScene = marble.getRoot().listScenes()[0]
    assert(kitScene, 'V6 runtime kit must have a scene.')
    assert(marbleScene, 'V7 Marble delivery must have a scene.')
    const legacyMarble = directRoot(kit, 'Cloudway_Marble')
    const acceptedRoot = directRoot(acceptedMarble, 'Cloudway_Marble')
    const marbleRoot = directRoot(marble, 'Cloudway_Marble')
    const legacyExtras = legacyMarble.getExtras()

    assert.deepEqual(
      geometryRecord(marbleRoot),
      geometryRecord(acceptedRoot),
      'Texture packaging must not alter topology or the quantized normal basis.',
    )
    const legacyBounds = getBounds(legacyMarble)
    const marbleBounds = getBounds(marbleRoot)
    for (const edge of ['min', 'max'])
      for (let axis = 0; axis < 3; axis++)
        assert(
          Math.abs(legacyBounds[edge][axis] - marbleBounds[edge][axis]) <
            0.00001,
          `Marble ${edge}[${axis}] left the accepted V3 world envelope.`,
        )

    for (const texture of marble.getRoot().listTextures())
      texture.setName(
        texture.getName().replace(/-2k$/, `-${MARBLE_TEXTURE_MAX / 1024}k`),
      )
    for (const material of marble.getRoot().listMaterials())
      material.setName(
        `Cloudway Marble V7 Runtime ${MARBLE_TEXTURE_MAX / 1024}K`,
      )

    legacyMarble.dispose()
    await kit.transform(
      prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }),
    )
    const map = mergeDocuments(kit, marble)
    const mergedScene = map.get(marbleScene)
    const mergedRoot = map.get(marbleRoot)
    assert(mergedScene && mergedRoot, 'Could not merge the V7 Marble root.')
    kitScene.addChild(mergedRoot)
    mergedScene.dispose()
    installRuntimeExtras(mergedRoot, legacyExtras)
    await kit.transform(
      unpartition(),
      prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }),
    )

    assert.deepEqual(
      kitScene
        .listChildren()
        .map((node) => node.getName())
        .sort(),
      [...ROOT_NAMES].sort(),
    )
    for (const name of ROOT_NAMES) assertCollider(directRoot(kit, name))

    const candidateKit = join(work, 'cloudway-platform-kit-v7.glb')
    await io.write(candidateKit, kit)

    const written = await io.read(candidateKit)
    assert.deepEqual(
      geometryRecord(directRoot(written, 'Cloudway_Marble')),
      geometryRecord(acceptedRoot),
      'Fresh public import changed the accepted Marble geometry.',
    )
    for (const name of ROOT_NAMES) assertCollider(directRoot(written, name))
    await runTransform(['validate', candidateKit], 600_000)
    await verifyAcceptedFile(
      candidateKit,
      acceptedOutput,
      'V7 runtime candidate',
    )

    const sources = await Promise.all(
      [V6_KIT, MARBLE_RAW_2K, MARBLE_DELIVERY_2K].map(fileRecord),
    )
    const manifest = {
      version: 7,
      assetId: LOGICAL_ASSET_ID,
      status: 'accepted runtime master',
      description: `Accepted source-preserved V7 Marble with ${MARBLE_TEXTURE_MAX / 1024}K maps, accepted V6 Frost and Glide, and unchanged Crackle states.`,
      coordinates: 'glTF +Y up; metres; root origins at landing plane y=0',
      collider: COLLIDER,
      bundle: {
        id: LOGICAL_ASSET_ID,
        file: 'cloudway-platform-kit-v7.glb',
        bytes: (await stat(candidateKit)).size,
        sha256: await sha256(candidateKit),
      },
      roots: ROOT_NAMES,
      preservedV6Roots: PRESERVED_V6_ROOTS,
      replacedV7Roots: ['Cloudway_Marble'],
      sources,
      marbleDelivery: {
        triangles: 1_256_556,
        textureMaximumDimension: MARBLE_TEXTURE_MAX,
        geometryReduction: false,
        quantizedAccessorRecordSha256: createHash('sha256')
          .update(JSON.stringify(geometryRecord(acceptedRoot)))
          .digest('hex'),
      },
      runtimeContract: {
        loader: 'plain Three.js GLTFLoader',
        requiredExtensions: ['EXT_texture_webp', 'KHR_mesh_quantization'],
        decoderRequired: false,
        topologyReduction: false,
      },
    }
    const candidateManifest = join(work, 'manifest.json')
    await writeFile(candidateManifest, await formatJson(manifest))
    let stagedKit = null
    let stagedManifest = null
    try {
      stagedKit = await stageCandidateForAtomicPromotion(
        candidateKit,
        OUTPUT_KIT,
        acceptedOutput,
        'V7 runtime candidate',
      )
      stagedManifest = await stageCandidateForAtomicPromotion(
        candidateManifest,
        OUTPUT_MANIFEST,
        null,
        'V7 runtime manifest',
      )
      if (await promoteStagedCandidate(stagedKit, OUTPUT_KIT)) stagedKit = null
      if (await promoteStagedCandidate(stagedManifest, OUTPUT_MANIFEST))
        stagedManifest = null
    } finally {
      await discardStagedCandidate(stagedKit)
      await discardStagedCandidate(stagedManifest)
    }
    console.log(JSON.stringify(manifest, null, 2))
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

await main()
