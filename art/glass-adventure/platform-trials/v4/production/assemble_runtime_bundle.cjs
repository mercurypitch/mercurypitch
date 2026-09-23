#!/usr/bin/env node
/* Assemble a V4 runtime bundle while proving every retained V3 payload is unchanged. */

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

const repo = path.resolve(__dirname, '../../../../..')
const requireFromCli = createRequire(
  path.join(
    repo,
    'node_modules/.pnpm/@gltf-transform+cli@4.4.2/node_modules/@gltf-transform/cli/package.json',
  ),
)
const { NodeIO } = requireFromCli('@gltf-transform/core')
const { ALL_EXTENSIONS } = requireFromCli('@gltf-transform/extensions')
const { mergeDocuments, prune, unpartition } = requireFromCli(
  '@gltf-transform/functions',
)

const V3_SHA256 =
  'e96bb26369cb037dffcfab3d0c71911dc7e872c2b8f766db8cb73599a6d51c62'
const MARBLE_ROOT = 'Cloudway_Marble'
const EXPECTED_ROOTS = [
  'Cloudway_Crackle_Intact',
  'Cloudway_Crackle_Release',
  'Cloudway_Crackle_Warning',
  'Cloudway_Frost',
  'Cloudway_Glide',
  MARBLE_ROOT,
]
const NON_MARBLE_ROOTS = EXPECTED_ROOTS.filter((name) => name !== MARBLE_ROOT)
const V4 = path.resolve(__dirname, '..')
const EXPORTS = path.join(V4, 'exports')
const V3 = path.resolve(
  V4,
  '../v3/exports/cloudway-platform-kit-v3-runtime.glb',
)
const VARIANTS = {
  '2k': {
    standalone: path.join(EXPORTS, 'cloudway-marble-ultra-v4-2k.glb'),
    output: path.join(EXPORTS, 'cloudway-platform-kit-v4-2k.glb'),
    report: path.join(EXPORTS, 'cloudway-platform-kit-v4-2k.json'),
  },
  '4k': {
    standalone: path.join(EXPORTS, 'cloudway-marble-ultra-v4-4k.glb'),
    output: path.join(EXPORTS, 'cloudway-platform-kit-v4-4k.glb'),
    report: path.join(EXPORTS, 'cloudway-platform-kit-v4-4k.json'),
  },
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

async function fileRecord(file) {
  const bytes = await fs.readFile(file)
  return {
    path: path.relative(repo, file),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (ArrayBuffer.isView(value)) return Array.from(value, canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    )
  }
  return value
}

function stableJSON(value) {
  return JSON.stringify(canonicalize(value))
}

function semanticHash(value) {
  return sha256(Buffer.from(stableJSON(value)))
}

function namedSceneRoots(document, label) {
  const scenes = document.getRoot().listScenes()
  assert(
    scenes.length === 1,
    `${label} must contain exactly one scene; got ${scenes.length}`,
  )
  const roots = scenes[0].listChildren()
  const names = roots.map((node) => node.getName())
  assert(
    new Set(names).size === names.length,
    `${label} contains duplicate scene-root names: ${names.join(', ')}`,
  )
  return { scene: scenes[0], roots, names }
}

function mapByName(nodes) {
  return new Map(nodes.map((node) => [node.getName(), node]))
}

function extensionRecord(property, registry) {
  return property
    .listExtensions()
    .map((extension) => {
      const methods = new Map()
      let prototype = Object.getPrototypeOf(extension)
      while (
        prototype &&
        prototype.constructor &&
        prototype.constructor.name !== 'ExtensionProperty'
      ) {
        for (const name of Object.getOwnPropertyNames(prototype)) {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
          if (
            /^get[A-Z]/.test(name) &&
            name !== 'getDefaults' &&
            descriptor &&
            typeof descriptor.value === 'function' &&
            descriptor.value.length === 0
          ) {
            methods.set(name, descriptor.value)
          }
        }
        prototype = Object.getPrototypeOf(prototype)
      }

      const values = {}
      for (const [name, method] of [...methods].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        values[name] = semanticValue(method.call(extension), registry)
      }
      return {
        extensionName: extension.extensionName,
        propertyType: extension.propertyType,
        name: extension.getName(),
        extras: extension.getExtras(),
        values,
      }
    })
    .sort((a, b) => a.extensionName.localeCompare(b.extensionName))
}

function semanticValue(value, registry) {
  if (value === null || value === undefined) return value ?? null
  if (ArrayBuffer.isView(value)) return Array.from(value)
  if (Array.isArray(value))
    return value.map((item) => semanticValue(item, registry))
  if (typeof value !== 'object') return value
  if (value.propertyType === 'Texture') {
    return { texture: registry.textureId(value) }
  }
  if (value.propertyType === 'Accessor') {
    return { accessor: registry.accessorId(value) }
  }
  if (value.propertyType === 'Material') {
    return { material: registry.materialId(value) }
  }
  if (value.propertyType && value.extensionName) {
    return {
      extensionName: value.extensionName,
      propertyType: value.propertyType,
      name: value.getName(),
      extras: value.getExtras(),
    }
  }
  if (value.propertyType) {
    return {
      propertyType: value.propertyType,
      name: typeof value.getName === 'function' ? value.getName() : '',
      extras: typeof value.getExtras === 'function' ? value.getExtras() : {},
    }
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, semanticValue(value[key], registry)]),
  )
}

class FingerprintRegistry {
  constructor() {
    this.nodeObjects = new Set()
    this.meshObjects = new Map()
    this.materialObjects = new Map()
    this.textureObjects = new Map()
    this.accessorObjects = new Map()
    this.meshes = []
    this.materials = []
    this.textures = []
    this.accessors = []
  }

  accessorId(accessor) {
    if (this.accessorObjects.has(accessor))
      return this.accessorObjects.get(accessor)
    const id = this.accessors.length
    this.accessorObjects.set(accessor, id)
    this.accessors.push(null)
    const array = accessor.getArray()
    assert(array, `Accessor ${accessor.getName() || id} has no typed array`)
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
    this.accessors[id] = {
      id,
      name: accessor.getName(),
      extras: accessor.getExtras(),
      type: accessor.getType(),
      componentType: accessor.getComponentType(),
      normalized: accessor.getNormalized(),
      sparse: accessor.getSparse(),
      count: accessor.getCount(),
      elementSize: accessor.getElementSize(),
      arrayType: array.constructor.name,
      arrayByteLength: array.byteLength,
      arraySha256: sha256(bytes),
      extensions: extensionRecord(accessor, this),
    }
    return id
  }

  textureId(texture) {
    if (this.textureObjects.has(texture))
      return this.textureObjects.get(texture)
    const id = this.textures.length
    this.textureObjects.set(texture, id)
    this.textures.push(null)
    const image = texture.getImage()
    assert(
      image,
      `Texture ${texture.getName() || id} has no encoded image payload`,
    )
    this.textures[id] = {
      id,
      name: texture.getName(),
      extras: texture.getExtras(),
      mimeType: texture.getMimeType(),
      uri: texture.getURI(),
      imageBytes: image.byteLength,
      imageSha256: sha256(
        Buffer.from(image.buffer, image.byteOffset, image.byteLength),
      ),
      imageSize: texture.getSize(),
      extensions: extensionRecord(texture, this),
    }
    return id
  }

  textureInfo(info) {
    if (!info) return null
    return {
      extras: info.getExtras(),
      texCoord: info.getTexCoord(),
      magFilter: info.getMagFilter(),
      minFilter: info.getMinFilter(),
      wrapS: info.getWrapS(),
      wrapT: info.getWrapT(),
      extensions: extensionRecord(info, this),
    }
  }

  materialId(material) {
    if (this.materialObjects.has(material))
      return this.materialObjects.get(material)
    const id = this.materials.length
    this.materialObjects.set(material, id)
    this.materials.push(null)
    const slots = {}
    for (const [name, textureGetter, infoGetter] of [
      ['baseColor', 'getBaseColorTexture', 'getBaseColorTextureInfo'],
      ['emissive', 'getEmissiveTexture', 'getEmissiveTextureInfo'],
      ['normal', 'getNormalTexture', 'getNormalTextureInfo'],
      ['occlusion', 'getOcclusionTexture', 'getOcclusionTextureInfo'],
      [
        'metallicRoughness',
        'getMetallicRoughnessTexture',
        'getMetallicRoughnessTextureInfo',
      ],
    ]) {
      const texture = material[textureGetter]()
      slots[name] = texture
        ? {
            texture: this.textureId(texture),
            info: this.textureInfo(material[infoGetter]()),
          }
        : null
    }
    this.materials[id] = {
      id,
      name: material.getName(),
      extras: material.getExtras(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      baseColorFactor: material.getBaseColorFactor(),
      emissiveFactor: material.getEmissiveFactor(),
      normalScale: material.getNormalScale(),
      occlusionStrength: material.getOcclusionStrength(),
      roughnessFactor: material.getRoughnessFactor(),
      metallicFactor: material.getMetallicFactor(),
      slots,
      extensions: extensionRecord(material, this),
    }
    return id
  }

  targetRecord(target) {
    return {
      name: target.getName(),
      extras: target.getExtras(),
      attributes: Object.fromEntries(
        target
          .listSemantics()
          .sort()
          .map((semantic) => [
            semantic,
            this.accessorId(target.getAttribute(semantic)),
          ]),
      ),
      extensions: extensionRecord(target, this),
    }
  }

  primitiveRecord(primitive) {
    const indices = primitive.getIndices()
    const material = primitive.getMaterial()
    return {
      name: primitive.getName(),
      extras: primitive.getExtras(),
      mode: primitive.getMode(),
      indices: indices ? this.accessorId(indices) : null,
      attributes: Object.fromEntries(
        primitive
          .listSemantics()
          .sort()
          .map((semantic) => [
            semantic,
            this.accessorId(primitive.getAttribute(semantic)),
          ]),
      ),
      material: material ? this.materialId(material) : null,
      targets: primitive
        .listTargets()
        .map((target) => this.targetRecord(target)),
      extensions: extensionRecord(primitive, this),
    }
  }

  meshId(mesh) {
    if (this.meshObjects.has(mesh)) return this.meshObjects.get(mesh)
    const id = this.meshes.length
    this.meshObjects.set(mesh, id)
    this.meshes.push(null)
    this.meshes[id] = {
      id,
      name: mesh.getName(),
      extras: mesh.getExtras(),
      weights: mesh.getWeights(),
      primitives: mesh
        .listPrimitives()
        .map((primitive) => this.primitiveRecord(primitive)),
      extensions: extensionRecord(mesh, this),
    }
    return id
  }

  nodeRecord(node) {
    assert(!this.nodeObjects.has(node), `Node graph repeats ${node.getName()}`)
    this.nodeObjects.add(node)
    assert(!node.getCamera(), `Unsupported camera on ${node.getName()}`)
    assert(!node.getSkin(), `Unsupported skin on ${node.getName()}`)
    const mesh = node.getMesh()
    return {
      name: node.getName(),
      extras: node.getExtras(),
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
      weights: node.getWeights(),
      mesh: mesh ? this.meshId(mesh) : null,
      children: node.listChildren().map((child) => this.nodeRecord(child)),
      extensions: extensionRecord(node, this),
    }
  }

  build(roots) {
    const state = canonicalize({
      roots: roots.map((node) => this.nodeRecord(node)),
      meshes: this.meshes,
      materials: this.materials,
      textures: this.textures,
      accessors: this.accessors,
    })
    return {
      sha256: semanticHash(state),
      state,
      registry: this,
    }
  }
}

function fingerprintRoots(roots) {
  return new FingerprintRegistry().build(roots)
}

function fingerprintReport(fingerprint) {
  return {
    sha256: fingerprint.sha256,
    rootNames: fingerprint.state.roots.map((root) => root.name),
    counts: {
      nodes: fingerprint.registry.nodeObjects.size,
      meshes: fingerprint.state.meshes.length,
      materials: fingerprint.state.materials.length,
      textures: fingerprint.state.textures.length,
      accessors: fingerprint.state.accessors.length,
    },
    canonicalState: fingerprint.state,
  }
}

function compareFingerprints(authority, candidate, label) {
  assert(
    authority.sha256 === candidate.sha256,
    `${label} semantic fingerprint changed: ${authority.sha256} != ${candidate.sha256}`,
  )
  return {
    authoritySha256: authority.sha256,
    candidateSha256: candidate.sha256,
    match: true,
  }
}

function documentContract(document) {
  const root = document.getRoot()
  const scenes = root.listScenes()
  return canonicalize({
    rootName: root.getName(),
    asset: root.getAsset(),
    extras: root.getExtras(),
    defaultScene: root.getDefaultScene()?.getName() ?? null,
    scenes: scenes.map((scene) => ({
      name: scene.getName(),
      extras: scene.getExtras(),
    })),
  })
}

function extensionContract(document) {
  return document
    .getRoot()
    .listExtensionsUsed()
    .map((extension) => ({
      name: extension.extensionName,
      required: extension.isRequired(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function validateRetainedExtensions(authorityExtensions, candidate, label) {
  const candidateExtensions = extensionContract(candidate)
  const candidateByName = new Map(
    candidateExtensions.map((extension) => [extension.name, extension]),
  )
  for (const extension of authorityExtensions) {
    const retained = candidateByName.get(extension.name)
    assert(retained, `${label} dropped V3 extension ${extension.name}`)
    assert(
      retained.required === extension.required,
      `${label} changed required status for V3 extension ${extension.name}`,
    )
  }
  return {
    match: true,
    authority: authorityExtensions,
    candidate: candidateExtensions,
  }
}

function trianglesForPrimitive(primitive) {
  const indices = primitive.getIndices()
  const position = primitive.getAttribute('POSITION')
  const count = indices ? indices.getCount() : (position?.getCount() ?? 0)
  if (primitive.getMode() === 4) return Math.floor(count / 3)
  if (primitive.getMode() === 5 || primitive.getMode() === 6) {
    return Math.max(0, count - 2)
  }
  return 0
}

function transformPoint(matrix, point) {
  const [x, y, z] = point
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]
  const denominator = w && w !== 1 ? w : 1
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / denominator,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / denominator,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / denominator,
  ]
}

function comparePoint(a, b) {
  for (let axis = 0; axis < 3; axis += 1) {
    if (a[axis] !== b[axis]) return a[axis] - b[axis]
  }
  return 0
}

function compareTriangle(a, b) {
  for (let vertex = 0; vertex < 3; vertex += 1) {
    const compared = comparePoint(a[vertex], b[vertex])
    if (compared) return compared
  }
  return 0
}

function roundHalfEven(value) {
  const lower = Math.floor(value)
  const fraction = value - lower
  if (fraction < 0.5) return lower
  if (fraction > 0.5) return lower + 1
  return lower % 2 === 0 ? lower : lower + 1
}

/** Match the V3 public manifest's Blender-axis, micrometre triangle digest. */
function geometryDigest(meshNodes) {
  const checksum = crypto.createHash('sha256')
  for (const node of [...meshNodes].sort((a, b) =>
    a.getName().localeCompare(b.getName()),
  )) {
    checksum.update(Buffer.from(node.getName()))
    const matrix = node.getWorldMatrix()
    const triangles = []
    for (const primitive of node.getMesh().listPrimitives()) {
      assert(
        primitive.getMode() === 4,
        `${node.getName()} geometry digest requires TRIANGLES mode`,
      )
      const position = primitive.getAttribute('POSITION')
      assert(position, `${node.getName()} geometry digest requires POSITION`)
      const indices = primitive.getIndices()
      const count = indices ? indices.getCount() : position.getCount()
      assert(count % 3 === 0, `${node.getName()} index count is not triangular`)
      const point = []
      for (let offset = 0; offset < count; offset += 3) {
        const triangle = []
        for (let corner = 0; corner < 3; corner += 1) {
          const index = indices
            ? indices.getScalar(offset + corner)
            : offset + corner
          position.getElement(index, point)
          const [x, y, z] = transformPoint(matrix, point)
          triangle.push(
            [x, -z, y].map((value) => roundHalfEven(value * 1_000_000)),
          )
        }
        triangles.push(triangle.sort(comparePoint))
      }
    }
    for (const triangle of triangles.sort(compareTriangle)) {
      for (const point of triangle) {
        const packed = Buffer.allocUnsafe(24)
        point.forEach((value, axis) =>
          packed.writeBigInt64LE(BigInt(value), axis * 8),
        )
        checksum.update(packed)
      }
    }
  }
  return checksum.digest('hex')
}

function summarizeRoot(root) {
  const nodeNames = []
  const meshNodes = []
  const meshNames = new Set()
  const materialNames = new Set()
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  let triangles = 0
  let meshInstances = 0

  const visit = (node) => {
    nodeNames.push(node.getName())
    const mesh = node.getMesh()
    if (mesh) {
      meshNodes.push(node)
      meshInstances += 1
      meshNames.add(mesh.getName())
      const matrix = node.getWorldMatrix()
      for (const primitive of mesh.listPrimitives()) {
        triangles += trianglesForPrimitive(primitive)
        const material = primitive.getMaterial()
        if (material) materialNames.add(material.getName())
        const position = primitive.getAttribute('POSITION')
        if (!position) continue
        assert(
          position.getElementSize() === 3,
          `${node.getName()} POSITION accessor must be VEC3`,
        )
        const point = []
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, point)
          const transformed = transformPoint(matrix, point)
          for (let axis = 0; axis < 3; axis += 1) {
            minimum[axis] = Math.min(minimum[axis], transformed[axis])
            maximum[axis] = Math.max(maximum[axis], transformed[axis])
          }
        }
      }
    }
    node.listChildren().forEach(visit)
  }
  visit(root)
  const hasBounds =
    minimum.every(Number.isFinite) && maximum.every(Number.isFinite)
  return {
    name: root.getName(),
    extras: root.getExtras(),
    nodeNames,
    nodes: nodeNames.length,
    meshInstances,
    descendantMeshes: meshNodes.map((node) => node.getName()),
    meshNames: [...meshNames].sort(),
    triangles,
    geometrySha256: geometryDigest(meshNodes),
    materialNames: [...materialNames].sort(),
    worldBoundsMetres: hasBounds ? { min: minimum, max: maximum } : null,
  }
}

function validateUsedPayloads(document, sceneRoots, fingerprint, label) {
  const root = document.getRoot()
  const counts = {
    scenes: root.listScenes().length,
    buffers: root.listBuffers().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    accessors: root.listAccessors().length,
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    cameras: root.listCameras().length,
  }
  assert(counts.scenes === 1, `${label} must have one scene`)
  assert(
    counts.buffers === 1,
    `${label} must have one buffer after unpartition`,
  )
  assert(counts.animations === 0, `${label} must not contain animations`)
  assert(counts.skins === 0, `${label} must not contain skins`)
  assert(counts.cameras === 0, `${label} must not contain cameras`)
  assert(
    counts.nodes === fingerprint.registry.nodeObjects.size,
    `${label} retains unreachable nodes`,
  )
  assert(
    counts.meshes === fingerprint.registry.meshObjects.size,
    `${label} retains unreachable meshes`,
  )
  assert(
    counts.materials === fingerprint.registry.materialObjects.size,
    `${label} retains unreachable materials`,
  )
  assert(
    counts.textures === fingerprint.registry.textureObjects.size,
    `${label} retains unreachable textures`,
  )
  assert(
    counts.accessors === fingerprint.registry.accessorObjects.size,
    `${label} retains unreachable accessors`,
  )
  assert(
    sceneRoots.length === EXPECTED_ROOTS.length,
    `${label} must expose exactly six roots`,
  )
  return { ...counts, allGraphPayloadsReachableFromSceneRoots: true }
}

function disposeNodeSubtree(node) {
  for (const child of [...node.listChildren()]) disposeNodeSubtree(child)
  node.dispose()
}

/** Merge copies a separate scene; move only its mapped marble into the V3 scene. */
function replaceMarble(target, standalone) {
  const targetScene = namedSceneRoots(target, 'V3 authority')
  assert(
    stableJSON([...targetScene.names].sort()) ===
      stableJSON([...EXPECTED_ROOTS].sort()),
    `V3 root contract changed: ${targetScene.names.join(', ')}`,
  )
  const targetByName = mapByName(targetScene.roots)
  const oldMarble = targetByName.get(MARBLE_ROOT)
  assert(oldMarble, `V3 authority is missing ${MARBLE_ROOT}`)

  const sourceScene = namedSceneRoots(standalone, 'standalone marble')
  assert(
    sourceScene.roots.length === 1 && sourceScene.names[0] === MARBLE_ROOT,
    `Standalone must contain only ${MARBLE_ROOT}; got ${sourceScene.names.join(', ')}`,
  )
  const sourceMarble = sourceScene.roots[0]
  const merged = mergeDocuments(target, standalone)
  const mappedScene = merged.get(sourceScene.scene)
  const mappedMarble = merged.get(sourceMarble)
  assert(
    mappedScene && mappedMarble,
    'mergeDocuments did not map the marble scene',
  )
  mappedScene.removeChild(mappedMarble)
  mappedScene.dispose()

  for (const node of [...targetScene.scene.listChildren()]) {
    targetScene.scene.removeChild(node)
  }
  for (const node of targetScene.roots) {
    targetScene.scene.addChild(node === oldMarble ? mappedMarble : node)
  }
  disposeNodeSubtree(oldMarble)
}

async function readFresh(io, file, label) {
  try {
    return await io.read(file)
  } catch (error) {
    throw new Error(`${label} could not be read as GLB: ${error.message}`, {
      cause: error,
    })
  }
}

async function buildVariant(io, variant, paths, v3Record) {
  const standaloneRecord = await fileRecord(paths.standalone)
  const authority = await readFresh(io, V3, 'V3 authority')
  const standalone = await readFresh(
    io,
    paths.standalone,
    `${variant} standalone`,
  )
  const authorityScene = namedSceneRoots(authority, 'V3 authority')
  const authorityDocumentContract = documentContract(authority)
  const authorityExtensionContract = extensionContract(authority)
  const authorityByName = mapByName(authorityScene.roots)
  const standaloneScene = namedSceneRoots(standalone, `${variant} standalone`)
  const standaloneMarble = standaloneScene.roots[0]

  const nonMarbleAuthority = fingerprintRoots(
    authorityScene.roots.filter((node) => node.getName() !== MARBLE_ROOT),
  )
  const oldMarble = fingerprintRoots([authorityByName.get(MARBLE_ROOT)])
  const marbleAuthority = fingerprintRoots([standaloneMarble])
  const rootAuthorities = Object.fromEntries(
    NON_MARBLE_ROOTS.map((name) => [
      name,
      fingerprintRoots([authorityByName.get(name)]),
    ]),
  )
  const oldNonMarbleTextureHashes = new Set(
    nonMarbleAuthority.state.textures.map((texture) => texture.imageSha256),
  )
  const oldMarbleOnlyImages = oldMarble.state.textures.filter(
    (texture) => !oldNonMarbleTextureHashes.has(texture.imageSha256),
  )

  replaceMarble(authority, standalone)
  await authority.transform(
    prune({
      keepLeaves: true,
      keepAttributes: true,
      keepSolidTextures: true,
      keepExtras: true,
    }),
    unpartition(),
  )

  const temporaryOutput = `${paths.output}.${process.pid}.tmp.glb`
  await io.write(temporaryOutput, authority)
  const outputRecord = await fileRecord(temporaryOutput)
  const candidate = await readFresh(
    io,
    temporaryOutput,
    `${variant} combined candidate`,
  )
  const candidateScene = namedSceneRoots(
    candidate,
    `${variant} combined candidate`,
  )
  const candidateDocumentContract = documentContract(candidate)
  assert(
    stableJSON(candidateDocumentContract) ===
      stableJSON(authorityDocumentContract),
    `${variant} changed the retained V3 document or scene metadata`,
  )
  const retainedExtensionContract = validateRetainedExtensions(
    authorityExtensionContract,
    candidate,
    variant,
  )
  assert(
    stableJSON(candidateScene.names) === stableJSON(authorityScene.names),
    `${variant} root order changed: ${candidateScene.names.join(', ')}`,
  )
  assert(
    stableJSON([...candidateScene.names].sort()) ===
      stableJSON([...EXPECTED_ROOTS].sort()),
    `${variant} combined root contract changed`,
  )
  const candidateByName = mapByName(candidateScene.roots)
  const nonMarbleCandidate = fingerprintRoots(
    candidateScene.roots.filter((node) => node.getName() !== MARBLE_ROOT),
  )
  const marbleCandidate = fingerprintRoots([candidateByName.get(MARBLE_ROOT)])
  const fullCandidate = fingerprintRoots(candidateScene.roots)

  const unchangedRoots = {}
  for (const name of NON_MARBLE_ROOTS) {
    const result = fingerprintRoots([candidateByName.get(name)])
    unchangedRoots[name] = compareFingerprints(
      rootAuthorities[name],
      result,
      `${variant} ${name}`,
    )
  }
  const unchangedAggregate = compareFingerprints(
    nonMarbleAuthority,
    nonMarbleCandidate,
    `${variant} non-marble aggregate sharing topology`,
  )
  const marbleMatch = compareFingerprints(
    marbleAuthority,
    marbleCandidate,
    `${variant} replacement marble`,
  )
  const outputTextureHashes = new Set(
    fullCandidate.state.textures.map((texture) => texture.imageSha256),
  )
  for (const texture of oldMarbleOnlyImages) {
    assert(
      !outputTextureHashes.has(texture.imageSha256),
      `${variant} still embeds old V3 marble image ${texture.name} ${texture.imageSha256}`,
    )
  }
  const payloadCounts = validateUsedPayloads(
    candidate,
    candidateScene.roots,
    fullCandidate,
    `${variant} combined candidate`,
  )
  const sourceAfter = await fileRecord(V3)
  assert(
    sourceAfter.sha256 === V3_SHA256,
    'V3 authority changed during assembly',
  )

  const report = {
    schema: 1,
    assetId: `cloudway-platform-kit-v4-${variant}`,
    status: 'validated combined runtime candidate',
    toolchain: {
      node: process.version,
      gltfTransform: '4.4.2',
      extensions: 'ALL_EXTENSIONS',
      operations: [
        'mergeDocuments',
        'prune(keepLeaves:true,keepAttributes:true,keepSolidTextures:true,keepExtras:true)',
        'unpartition',
      ],
      forbiddenOperationsApplied: [],
    },
    inputs: {
      v3Authority: v3Record,
      standaloneMarble: standaloneRecord,
    },
    output: {
      path: path.relative(repo, paths.output),
      bytes: outputRecord.bytes,
      sha256: outputRecord.sha256,
      semanticFingerprintSha256: fullCandidate.sha256,
    },
    roots: candidateScene.roots.map(summarizeRoot),
    validation: {
      freshNodeIORead: true,
      retainedV3DocumentContract: {
        match: true,
        authority: authorityDocumentContract,
        candidate: candidateDocumentContract,
      },
      retainedV3Extensions: retainedExtensionContract,
      rootOrder: candidateScene.names,
      expectedRoots: EXPECTED_ROOTS,
      v3AuthorityUnchanged: sourceAfter.sha256 === v3Record.sha256,
      payloadCounts,
      unchangedRoots: {
        ...unchangedRoots,
        aggregateSharingTopology: unchangedAggregate,
        authorityManifest: fingerprintReport(nonMarbleAuthority),
      },
      replacementMarble: {
        ...marbleMatch,
        standaloneManifest: fingerprintReport(marbleAuthority),
      },
      oldV3MarbleImagesRemoved: {
        match: true,
        images: oldMarbleOnlyImages.map(
          ({ name, mimeType, imageBytes, imageSha256 }) => ({
            name,
            mimeType,
            bytes: imageBytes,
            sha256: imageSha256,
          }),
        ),
      },
      allTypedIndexAndAttributeArraysFingerprintMatched: true,
      allEncodedTextureBytesAndMaterialSemanticsFingerprintMatched: true,
      weldQuantizeDecimateRetextureRecompressApplied: false,
    },
  }
  return { variant, paths, temporaryOutput, report }
}

async function publish(result) {
  const temporaryReport = `${result.paths.report}.${process.pid}.tmp`
  await fs.writeFile(
    temporaryReport,
    `${JSON.stringify(result.report, null, 2)}\n`,
  )
  await fs.rename(result.temporaryOutput, result.paths.output)
  await fs.rename(temporaryReport, result.paths.report)
}

async function main() {
  const selection = process.argv[2] || 'all'
  assert(
    selection === 'all' || Object.hasOwn(VARIANTS, selection),
    'usage: assemble_runtime_bundle.cjs [all|2k|4k]',
  )
  const review = JSON.parse(
    await fs.readFile(
      path.join(V4, 'proofs/marble-direct-238k-visual-rejection.json'),
      'utf8',
    ),
  )
  assert(
    review.acceptedForRuntimeOrCombinedBundle === true,
    'V4 marble failed visual review; assembly is blocked. Preserve this rejected trial and produce a separately reviewed successor.',
  )
  await fs.mkdir(EXPORTS, { recursive: true })
  const v3Record = await fileRecord(V3)
  assert(
    v3Record.sha256 === V3_SHA256,
    `V3 authority hash changed: ${v3Record.sha256}`,
  )
  const chosen = selection === 'all' ? Object.keys(VARIANTS) : [selection]
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const pending = []
  try {
    for (const variant of chosen) {
      pending.push(await buildVariant(io, variant, VARIANTS[variant], v3Record))
    }
    const v3After = await fileRecord(V3)
    assert(v3After.sha256 === V3_SHA256, 'V3 authority changed during assembly')
    for (const result of pending) await publish(result)
    process.stdout.write(
      `${JSON.stringify({
        status: 'validated',
        outputs: pending.map((result) => ({
          variant: result.variant,
          glb: result.report.output,
          report: path.relative(repo, result.paths.report),
        })),
      })}\n`,
    )
  } catch (error) {
    await Promise.all(
      chosen.flatMap((variant) => [
        fs.rm(`${VARIANTS[variant].output}.${process.pid}.tmp.glb`, {
          force: true,
        }),
        fs.rm(`${VARIANTS[variant].report}.${process.pid}.tmp`, {
          force: true,
        }),
      ]),
    )
    throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
