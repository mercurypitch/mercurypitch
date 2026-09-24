// Audit the V7 Cloudway runtime kit, exact source lineage and current crescent cost.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { verifyExternalDelivery } from './external_gltf_delivery.mjs'

const REPO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
)
const V6_KIT = join(
  REPO,
  'art/glass-adventure/platform-trials/v6/runtime/archive/cloudway-platform-kit-v6.glb',
)
const MARBLE_DELIVERY_2K = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/exports/delivery/cloudway-marble-v7-dense-baseline-delivery-2k.glb',
)
const MASTER_KIT = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/master/cloudway-platform-kit-v7.glb',
)
const RUNTIME_KIT = join(
  REPO,
  'apps/beside-cue/public/games/cloudway-v7/cloudway-platform-kit-v7.gltf',
)
const RUNTIME_MANIFEST = join(
  REPO,
  'apps/beside-cue/public/games/cloudway-v7/manifest.json',
)
const REPORT = join(
  REPO,
  'art/glass-adventure/platform-trials/v7/runtime/proofs/cloudway-platform-kit-v7-audit.json',
)

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
const CURRENT_CRESCENT_INSTANCE_COUNTS = Object.freeze({
  Cloudway_Marble: 6,
  Cloudway_Frost: 2,
  Cloudway_Glide: 1,
  Cloudway_Crackle_Intact: 2,
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

function accessorRecord(accessor) {
  if (accessor === null) return null
  const array = accessor.getArray()
  assert(array, 'Every runtime accessor must expose an array.')
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    payloadBytes: array.byteLength,
    min: accessor.getMin([]),
    max: accessor.getMax([]),
    sha256: sha256Bytes(
      Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    ),
  }
}

function textureRecord(texture) {
  if (texture === null) return null
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    dimensions: texture.getSize(),
    encodedBytes: image?.byteLength ?? 0,
    sha256: image === null ? null : sha256Bytes(image),
  }
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

function primitiveRecord(primitive, includeMaterial = true) {
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
    ...(includeMaterial
      ? { material: materialRecord(primitive.getMaterial()) }
      : {}),
  }
}

function nodeRecord(node, includeMaterial = true) {
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
            primitives: mesh
              .listPrimitives()
              .map((primitive) => primitiveRecord(primitive, includeMaterial)),
          },
    children: node
      .listChildren()
      .map((child) => nodeRecord(child, includeMaterial)),
  }
}

function triangleCount(root) {
  let triangles = 0
  root.traverse((node) => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      assert.equal(
        primitive.getMode(),
        4,
        `${node.getName()} must use triangles.`,
      )
      triangles +=
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute('POSITION')?.getCount() ??
          0) / 3
    }
  })
  return triangles
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
      center: value.center,
    },
    { width: 1.7, depth: 1.3, height: 0.24, topY: 0, center: [0, -0.12, 0] },
  )
  return value
}

function decodedRgbaMipBytes(texture) {
  const size = texture.getSize()
  assert(size, `${texture.getName()} must expose dimensions.`)
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

function geometryMemory(document) {
  const accessors = document.getRoot().listAccessors()
  const records = accessors.map((accessor) => ({
    name: accessor.getName(),
    ...accessorRecord(accessor),
  }))
  return {
    bytes: records.reduce((total, record) => total + record.payloadBytes, 0),
    accessorCount: records.length,
    accessors: records,
  }
}

function texturesMemory(document) {
  const textures = document
    .getRoot()
    .listTextures()
    .map((texture) => ({
      ...textureRecord(texture),
      decodedRgbaMipBytes: decodedRgbaMipBytes(texture),
    }))
  return {
    bytes: textures.reduce(
      (total, texture) => total + texture.decodedRgbaMipBytes,
      0,
    ),
    textureCount: textures.length,
    textures,
  }
}

function marbleMaterialContract(root) {
  const records = []
  root.traverse((node) => {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const material = primitive.getMaterial()
      if (material === null) continue
      records.push({
        name: material.getName(),
        baseColorMap: material.getBaseColorTexture() !== null,
        normalMap: material.getNormalTexture() !== null,
        metallicRoughnessMap: material.getMetallicRoughnessTexture() !== null,
        clearcoat: material.getExtension('KHR_materials_clearcoat') !== null,
      })
    }
  })
  return records
}

async function main() {
  const { ALL_EXTENSIONS, NodeIO, getBounds } = await gltfTransform()
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const manifest = JSON.parse(await readFile(RUNTIME_MANIFEST, 'utf8'))
  assert.equal(manifest.bundle.file, 'cloudway-platform-kit-v7.gltf')
  const dependencyPaths = manifest.bundle.dependencies.map((dependency) =>
    join(dirname(RUNTIME_KIT), dependency.file),
  )
  const [masterBytes, runtimeDocument, ...dependencyBytes] = await Promise.all([
    readFile(MASTER_KIT),
    readFile(RUNTIME_KIT, 'utf8'),
    ...dependencyPaths.map((path) => readFile(path)),
  ])
  const externalDelivery = verifyExternalDelivery(
    masterBytes,
    JSON.parse(runtimeDocument),
    dependencyBytes,
  )
  const [v6, acceptedMarble, runtime] = await Promise.all([
    io.read(V6_KIT),
    io.read(MARBLE_DELIVERY_2K),
    io.read(RUNTIME_KIT),
  ])
  const runtimeFile = await fileRecord(RUNTIME_KIT)
  assert.equal(runtimeFile.sha256, manifest.bundle.sha256)
  assert.equal(runtimeFile.bytes, manifest.bundle.bytes)
  const runtimeDependencies = await Promise.all(dependencyPaths.map(fileRecord))
  assert.deepEqual(
    runtimeDependencies.map(({ path, bytes, sha256 }) => ({
      file: path.slice(path.lastIndexOf('/') + 1),
      bytes,
      sha256,
    })),
    manifest.bundle.dependencies,
  )

  const runtimeScene = runtime.getRoot().listScenes()[0]
  assert(runtimeScene, 'Runtime kit must contain a scene.')
  assert.deepEqual(
    runtimeScene
      .listChildren()
      .map((node) => node.getName())
      .sort(),
    [...ROOT_NAMES].sort(),
  )

  const preservedV6 = {}
  for (const name of PRESERVED_V6_ROOTS) {
    const source = directRoot(v6, name)
    const installed = directRoot(runtime, name)
    assert.deepEqual(nodeRecord(installed), nodeRecord(source))
    preservedV6[name] = {
      triangles: triangleCount(installed),
      geometryAndMaterialsSha256: sha256Bytes(
        JSON.stringify(nodeRecord(installed)),
      ),
    }
  }

  const sourceMarble = directRoot(acceptedMarble, 'Cloudway_Marble')
  const runtimeMarble = directRoot(runtime, 'Cloudway_Marble')
  assert.deepEqual(
    nodeRecord(runtimeMarble, false),
    nodeRecord(sourceMarble, false),
    'V7 Marble topology, transforms or quantized normal basis changed.',
  )
  assert.equal(triangleCount(runtimeMarble), 1_256_556)
  assert.deepEqual(getBounds(runtimeMarble), getBounds(sourceMarble))
  const marbleMaterials = marbleMaterialContract(runtimeMarble)
  assert(
    marbleMaterials.some(
      (material) =>
        material.baseColorMap &&
        material.normalMap &&
        material.metallicRoughnessMap &&
        material.clearcoat,
    ),
    'V7 Marble lost an accepted PBR channel.',
  )
  const marbleTextures = runtime
    .getRoot()
    .listTextures()
    .filter((texture) => texture.getName().startsWith('cloudway-marble-v7-'))
  assert.equal(marbleTextures.length, 3)
  for (const texture of marbleTextures)
    assert.deepEqual(texture.getSize(), [1024, 1024])

  const rootTriangles = Object.fromEntries(
    ROOT_NAMES.map((name) => [name, triangleCount(directRoot(runtime, name))]),
  )
  const currentCrescentMainPassTriangles = Object.entries(
    CURRENT_CRESCENT_INSTANCE_COUNTS,
  ).reduce(
    (total, [name, instances]) => total + rootTriangles[name] * instances,
    0,
  )
  assert.equal(currentCrescentMainPassTriangles, 8_960_554)

  for (const name of ROOT_NAMES) collider(directRoot(runtime, name))
  const geometry = geometryMemory(runtime)
  const textures = texturesMemory(runtime)
  assert.equal(textures.bytes, 218_103_788)

  const report = {
    status: 'passed',
    purpose:
      'Fresh-import audit of the public external-buffer V7 kit, accepted source lineage and current crescent submission cost.',
    runtimeFile,
    runtimeDependencies,
    acceptedMaster: await fileRecord(MASTER_KIT),
    externalDelivery: {
      byteIdenticalBufferViews: true,
      bufferViewCount: externalDelivery.bufferViews.length,
      bufferViewBytes: externalDelivery.bufferViews.reduce(
        (total, view) => total + view.bytes,
        0,
      ),
      limitBytes: externalDelivery.limitBytes,
    },
    manifestHashVerified: true,
    logicalAssetId: manifest.assetId,
    roots: ROOT_NAMES,
    preservedV6,
    upgradedV7: {
      Cloudway_Marble: {
        source: (await fileRecord(MARBLE_DELIVERY_2K)).path,
        triangles: triangleCount(runtimeMarble),
        bounds: getBounds(runtimeMarble),
        collider: collider(runtimeMarble),
        geometrySha256: sha256Bytes(
          JSON.stringify(nodeRecord(runtimeMarble, false)),
        ),
        acceptedGeometrySha256: sha256Bytes(
          JSON.stringify(nodeRecord(sourceMarble, false)),
        ),
        quantizedNormalBasisPreserved: true,
        materialContract: marbleMaterials,
        textures: marbleTextures.map((texture) => ({
          ...textureRecord(texture),
          decodedRgbaMipBytes: decodedRgbaMipBytes(texture),
        })),
      },
    },
    uniqueRuntimeResources: {
      triangles: runtime
        .getRoot()
        .listMeshes()
        .reduce(
          (total, mesh) =>
            total +
            mesh
              .listPrimitives()
              .reduce(
                (meshTotal, primitive) =>
                  meshTotal +
                  (primitive.getIndices()?.getCount() ??
                    primitive.getAttribute('POSITION')?.getCount() ??
                    0) /
                    3,
                0,
              ),
          0,
        ),
      geometry,
      textures,
      combinedGeometryAndTexturesBytes: geometry.bytes + textures.bytes,
    },
    currentCrescentCost: {
      note: 'Static unculled maximum for the current crescent. The renderer compacts complete transformed donor bounds beyond the fully opaque radial fog plus its shadow margin; actual colour, shadow and transmission submissions are measured in the browser proof.',
      instanceCounts: CURRENT_CRESCENT_INSTANCE_COUNTS,
      rootTriangles,
      runtimeCulling: {
        fogNearMetres: 9,
        fogFarMetres: 14,
        shadowMarginMetres: 2,
        cullDistanceMetres: 16,
        proof:
          'art/glass-adventure/platform-trials/v7/runtime/proofs/browser/cloudway-v7-platform-submissions.json',
      },
      maximumUnculledMainPassTriangles: currentCrescentMainPassTriangles,
      maximumUnculledMarbleMainPassTriangles:
        rootTriangles.Cloudway_Marble *
        CURRENT_CRESCENT_INSTANCE_COUNTS.Cloudway_Marble,
      maximumUnculledWarningPhaseTriangles:
        currentCrescentMainPassTriangles -
        rootTriangles.Cloudway_Crackle_Intact * 2 +
        rootTriangles.Cloudway_Crackle_Warning * 2,
      maximumUnculledReleasePhaseTriangles:
        currentCrescentMainPassTriangles -
        rootTriangles.Cloudway_Crackle_Intact * 2 +
        rootTriangles.Cloudway_Crackle_Release * 2,
    },
    extensionsUsed: runtime
      .getRoot()
      .listExtensionsUsed()
      .map((extension) => ({
        name: extension.extensionName,
        required: extension.isRequired(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sources: await Promise.all([V6_KIT, MARBLE_DELIVERY_2K].map(fileRecord)),
  }
  assert.equal(report.uniqueRuntimeResources.triangles, 2_041_018)
  await mkdir(dirname(REPORT), { recursive: true })
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

await main()
