// Audit the archived V6 Cloudway kit against its accepted deliveries and preserved V3 roots.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

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
const RUNTIME_KIT = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive/cloudway-platform-kit-v6.glb',
)
const RUNTIME_MANIFEST = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive/manifest.json',
)
const REPORT = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/proofs/runtime/cloudway-platform-kit-v6-audit.json',
)

const ROOT_NAMES = [
  'Cloudway_Crackle_Intact',
  'Cloudway_Crackle_Release',
  'Cloudway_Crackle_Warning',
  'Cloudway_Frost',
  'Cloudway_Glide',
  'Cloudway_Marble',
]
const PRESERVED_ROOT_NAMES = [
  'Cloudway_Crackle_Intact',
  'Cloudway_Crackle_Release',
  'Cloudway_Crackle_Warning',
  'Cloudway_Marble',
]
const DELIVERY_ROOTS = {
  Cloudway_Frost: FROST_DELIVERY,
  Cloudway_Glide: GLIDE_DELIVERY,
}

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

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function fileRecord(path) {
  const bytes = await readFile(path)
  return {
    path: path.slice(REPO.length + 1),
    bytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
    sha256: sha256Bytes(bytes),
  }
}

function directRoot(document, name) {
  const scene = document.getRoot().listScenes()[0]
  assert(scene, 'Document must contain a scene.')
  const matches = scene.listChildren().filter((node) => node.getName() === name)
  assert.equal(matches.length, 1, `Expected one direct root named ${name}.`)
  return matches[0]
}

function arrayHash(array) {
  if (array === null) return null
  return sha256Bytes(
    Buffer.from(array.buffer, array.byteOffset, array.byteLength),
  )
}

function accessorRecord(accessor) {
  if (accessor === null) return null
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    min: accessor.getMin([]),
    max: accessor.getMax([]),
    sha256: arrayHash(accessor.getArray()),
  }
}

function textureRecord(texture) {
  if (texture === null) return null
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    uri: texture.getURI(),
    bytes: image?.byteLength ?? 0,
    sha256: image === null ? null : sha256Bytes(image),
  }
}

function decodedRgbaMipBytes(texture) {
  const size = texture.getSize()
  assert(size, `${texture.getName()} must expose decoded image dimensions.`)
  let [width, height] = size
  let bytes = 0
  while (true) {
    bytes += width * height * 4
    if (width === 1 && height === 1) break
    width = Math.max(1, Math.floor(width / 2))
    height = Math.max(1, Math.floor(height / 2))
  }
  return bytes
}

function extensionRecord(extension) {
  switch (extension.extensionName) {
    case 'KHR_materials_clearcoat':
      return {
        name: extension.extensionName,
        factor: extension.getClearcoatFactor(),
        roughnessFactor: extension.getClearcoatRoughnessFactor(),
        normalScale: extension.getClearcoatNormalScale(),
        texture: textureRecord(extension.getClearcoatTexture()),
        roughnessTexture: textureRecord(
          extension.getClearcoatRoughnessTexture(),
        ),
        normalTexture: textureRecord(extension.getClearcoatNormalTexture()),
      }
    case 'KHR_materials_emissive_strength':
      return {
        name: extension.extensionName,
        strength: extension.getEmissiveStrength(),
      }
    case 'KHR_materials_ior':
      return { name: extension.extensionName, ior: extension.getIOR() }
    case 'KHR_materials_transmission':
      return {
        name: extension.extensionName,
        factor: extension.getTransmissionFactor(),
        texture: textureRecord(extension.getTransmissionTexture()),
      }
    case 'KHR_materials_volume':
      return {
        name: extension.extensionName,
        thicknessFactor: extension.getThicknessFactor(),
        attenuationDistance: extension.getAttenuationDistance(),
        attenuationColor: extension.getAttenuationColor(),
        thicknessTexture: textureRecord(extension.getThicknessTexture()),
      }
    default:
      return { name: extension.extensionName }
  }
}

function materialRecord(material) {
  if (material === null) return null
  return {
    name: material.getName(),
    baseColorFactor: material.getBaseColorFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    normalScale: material.getNormalScale(),
    occlusionStrength: material.getOcclusionStrength(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    baseColorTexture: textureRecord(material.getBaseColorTexture()),
    emissiveTexture: textureRecord(material.getEmissiveTexture()),
    normalTexture: textureRecord(material.getNormalTexture()),
    occlusionTexture: textureRecord(material.getOcclusionTexture()),
    metallicRoughnessTexture: textureRecord(
      material.getMetallicRoughnessTexture(),
    ),
    extensions: material
      .listExtensions()
      .map(extensionRecord)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function primitiveRecord(primitive) {
  return {
    mode: primitive.getMode(),
    indices: accessorRecord(primitive.getIndices()),
    attributes: primitive
      .listSemantics()
      .sort()
      .map((semantic) => ({
        semantic,
        accessor: accessorRecord(primitive.getAttribute(semantic)),
      })),
    material: materialRecord(primitive.getMaterial()),
  }
}

function nodeRecord(node) {
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
            primitives: mesh.listPrimitives().map(primitiveRecord),
          },
    children: node.listChildren().map(nodeRecord),
  }
}

function triangleCount(root) {
  let triangles = 0
  const visit = (node) => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      assert.equal(
        primitive.getMode(),
        4,
        `${node.getName()} must use triangles.`,
      )
      const elements =
        primitive.getIndices()?.getCount() ??
        primitive.getAttribute('POSITION')?.getCount() ??
        0
      triangles += elements / 3
    }
    node.listChildren().forEach(visit)
  }
  visit(root)
  return triangles
}

function materialSummary(root) {
  const records = []
  const visit = (node) => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const material = primitive.getMaterial()
      if (material === null) continue
      const transmission = material.getExtension('KHR_materials_transmission')
      records.push({
        name: material.getName(),
        baseColorMap: material.getBaseColorTexture() !== null,
        normalMap: material.getNormalTexture() !== null,
        metallicRoughnessMap: material.getMetallicRoughnessTexture() !== null,
        transmissionMap:
          transmission !== null &&
          transmission.getTransmissionTexture() !== null,
      })
    }
    node.listChildren().forEach(visit)
  }
  visit(root)
  return records
}

function collider(root) {
  const encoded = root.getExtras().collider_json
  assert.equal(
    typeof encoded,
    'string',
    `${root.getName()} needs collider_json.`,
  )
  const value = JSON.parse(encoded)
  assert.deepEqual(
    {
      width: value.width,
      depth: value.depth,
      height: value.height,
      topY: value.topY,
    },
    { width: 1.7, depth: 1.3, height: 0.24, topY: 0 },
  )
  return value
}

async function main() {
  const { ALL_EXTENSIONS, NodeIO, getBounds } = await gltfTransform()
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const [legacy, frost, glide, runtime] = await Promise.all([
    io.read(LEGACY_KIT),
    io.read(FROST_DELIVERY),
    io.read(GLIDE_DELIVERY),
    io.read(RUNTIME_KIT),
  ])
  const manifest = JSON.parse(await readFile(RUNTIME_MANIFEST, 'utf8'))
  const runtimeFile = await fileRecord(RUNTIME_KIT)
  assert.equal(runtimeFile.sha256, manifest.bundle.sha256)
  assert.equal(runtimeFile.bytes, manifest.bundle.bytes)

  const runtimeScene = runtime.getRoot().listScenes()[0]
  assert(runtimeScene, 'Runtime kit must contain a scene.')
  assert.deepEqual(
    runtimeScene
      .listChildren()
      .map((node) => node.getName())
      .sort(),
    [...ROOT_NAMES].sort(),
  )

  const preserved = {}
  for (const name of PRESERVED_ROOT_NAMES) {
    const sourceRoot = directRoot(legacy, name)
    const runtimeRoot = directRoot(runtime, name)
    assert.deepEqual(nodeRecord(runtimeRoot), nodeRecord(sourceRoot))
    preserved[name] = {
      triangles: triangleCount(runtimeRoot),
      geometryAndMaterialsSha256: sha256Bytes(
        JSON.stringify(nodeRecord(runtimeRoot)),
      ),
    }
  }

  const deliveryDocuments = {
    Cloudway_Frost: frost,
    Cloudway_Glide: glide,
  }
  const upgraded = {}
  for (const [name, sourcePath] of Object.entries(DELIVERY_ROOTS)) {
    const sourceRoot = directRoot(deliveryDocuments[name], name)
    const runtimeRoot = directRoot(runtime, name)
    assert.deepEqual(nodeRecord(runtimeRoot), nodeRecord(sourceRoot))
    const materials = materialSummary(runtimeRoot)
    assert(
      materials.some(
        (item) =>
          item.baseColorMap &&
          item.normalMap &&
          item.metallicRoughnessMap &&
          item.transmissionMap,
      ),
      `${name} must retain its full PBR/transmission material maps.`,
    )
    upgraded[name] = {
      source: (await fileRecord(sourcePath)).path,
      triangles: triangleCount(runtimeRoot),
      geometryAndMaterialsSha256: sha256Bytes(
        JSON.stringify(nodeRecord(runtimeRoot)),
      ),
      bounds: getBounds(runtimeRoot),
      collider: collider(runtimeRoot),
      materials,
    }
  }

  const materialNames = runtime
    .getRoot()
    .listMaterials()
    .map((material) => material.getName())
  const runtimeTextures = runtime.getRoot().listTextures()
  const textureNames = runtimeTextures.map((texture) => texture.getName())
  const decodedTextureRecords = runtimeTextures.map((texture) => ({
    name: texture.getName(),
    dimensions: texture.getSize(),
    decodedRgbaMipBytes: decodedRgbaMipBytes(texture),
  }))
  assert(
    !materialNames.some((name) =>
      /Cloudway_(?:Frost|Glide)__DonorAtlas/u.test(name),
    ),
    'The V3 Frost/Glide materials must be pruned.',
  )
  assert(
    !textureNames.some((name) => /^cloudway_(?:frost|glide)-atlas/u.test(name)),
    'The V3 Frost/Glide textures must be pruned.',
  )

  const report = {
    status: 'passed',
    purpose: 'Fresh-import audit of the public combined Cloudway runtime kit.',
    runtimeFile,
    manifestHashVerified: true,
    logicalAssetId: manifest.assetId,
    roots: ROOT_NAMES,
    extensionsUsed: runtime
      .getRoot()
      .listExtensionsUsed()
      .map((extension) => ({
        name: extension.extensionName,
        required: extension.isRequired(),
      })),
    preservedV3: preserved,
    upgradedV6: upgraded,
    prunedLegacyFrostGlideMaterials: true,
    prunedLegacyFrostGlideTextures: true,
    materialCount: materialNames.length,
    textureCount: textureNames.length,
    estimatedDecodedTextureMemory: {
      method:
        'RGBA8 bytes for every complete mip level; excludes driver overhead',
      bytes: decodedTextureRecords.reduce(
        (total, texture) => total + texture.decodedRgbaMipBytes,
        0,
      ),
      textures: decodedTextureRecords,
    },
    sourceFiles: await Promise.all(
      [LEGACY_KIT, FROST_DELIVERY, GLIDE_DELIVERY].map(fileRecord),
    ),
  }
  await mkdir(dirname(REPORT), { recursive: true })
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

await main()
