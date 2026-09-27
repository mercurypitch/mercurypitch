import { ACESFilmicToneMapping, Clock, DirectionalLight, HemisphereLight, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer, } from 'three'
import type { Material, Object3D, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { PlatformDefinition } from '../../../../../packages/glass-game/src/contracts'
import { createCloudwayScrollAdapter } from '../../../../../packages/glass-game/src/render/cloudway-scroll-adapter'
import type { CrystalInteriorCost, CrystalInteriorEffect, } from '../../../../../packages/glass-game/src/render/crystal-interior'
import { createCrystalInterior } from '../../../../../packages/glass-game/src/render/crystal-interior'
import type { CrystalInteriorPreset } from '../../../../../packages/glass-game/src/render/crystal-interior-config'
import { fitSkyBackdrop } from '../../../../../packages/glass-game/src/render/sky-backdrop'

const SCROLL_SIZE = 2.205964088
const INTERIOR_ENVELOPE = {
  width: 2.1,
  height: 0.08,
  depth: 2.1,
  center: [0, -0.05, 0] as const,
  inset: 0.006,
}
const MATERIAL_BINDINGS = {
  ScrollDeckGeometry: 'glass',
  ScrollDeckGoldStarDetailLayer: 'opaque',
  ScrollDeckFrostEtchDetailLayer: 'glass',
  ScrollRollerNegativeGeometry: 'opaque',
  ScrollRollerPositiveGeometry: 'opaque',
} as const

interface RuntimeProofApi {
  readonly ready: boolean
  readonly costs: Readonly<
    Record<
      CrystalInteriorPreset,
      { high: CrystalInteriorCost; mobile: CrystalInteriorCost }
    >
  >
  readonly renderer: Readonly<Record<string, unknown>>
  readonly shell: Readonly<Record<string, unknown>>
  setPaused(value: boolean): void
  setReducedMotion(value: boolean): void
  setResonanceRetraction(value: number): void
  reset(): void
  states(): readonly ReturnType<CrystalInteriorEffect['snapshot']>[]
}

declare global {
  interface Window {
    __CRYSTAL_INTERIOR_PROOF__?: RuntimeProofApi
  }
}

const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 0.9
renderer.transmissionResolutionScale = 0.5
document.body.prepend(renderer.domElement)

const scene = new Scene()
let skyBackdrop: Texture | null = null
const camera = new PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.05,
  60,
)
camera.position.set(0, 6.2, 6.8)
camera.lookAt(0, -0.09, 0)
scene.add(new HemisphereLight(0xc9eaff, 0x21182f, 2.4))
const key = new DirectionalLight(0xffd7ad, 5.2)
key.position.set(4, 7, 5)
scene.add(key)
const rim = new DirectionalLight(0x768cff, 3.8)
rim.position.set(-5, 3, -4)
scene.add(rim)

function meshMaterial(object: Object3D): MeshStandardMaterial {
  const mesh = object as Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material))
    throw new Error(`${object.name}: expected one loaded PBR material.`)
  const material = mesh.material as Material & MeshStandardMaterial
  if (!material.isMeshStandardMaterial)
    throw new Error(`${object.name}: GLTFLoader did not create a PBR material.`)
  return material
}

function platformAt(id: string, centerX: number): PlatformDefinition {
  return {
    id,
    minX: centerX - SCROLL_SIZE / 2,
    maxX: centerX + SCROLL_SIZE / 2,
    minZ: -SCROLL_SIZE / 2,
    maxZ: SCROLL_SIZE / 2,
    top: 0,
    thickness: 0.1,
    kind: 'bridge',
    material: 'brass',
    renderQuarterTurns: 0,
    behavior: {
      kind: 'scroll',
      axis: 'x',
      edgeSupports: {
        negative: {
          outwardLength: 0.189,
          minCrossAxis: -1.05,
          maxCrossAxis: 1.05,
          topOffset: 0.05,
          thickness: 0.05,
        },
        positive: {
          outwardLength: 0.1885,
          minCrossAxis: -1.05,
          maxCrossAxis: 1.05,
          topOffset: 0.05,
          thickness: 0.05,
        },
      },
      minLengthRatio: 0.25,
      extendedSeconds: 4,
      retractedSeconds: 3,
      transitionSeconds: 1.5,
      initialState: 'extended',
    },
  }
}

function rendererIdentity(): Record<string, unknown> {
  const context = renderer.getContext()
  const extension = context.getExtension('WEBGL_debug_renderer_info')
  return {
    webglVersion: context.getParameter(context.VERSION),
    vendor: extension
      ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL)
      : context.getParameter(context.VENDOR),
    renderer: extension
      ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER),
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    transmissionResolutionScale: renderer.transmissionResolutionScale,
  }
}

async function run(): Promise<void> {
  skyBackdrop = await new TextureLoader().loadAsync('/cloudscape.webp')
  skyBackdrop.colorSpace = SRGBColorSpace
  fitSkyBackdrop(skyBackdrop, window.innerWidth, window.innerHeight)
  scene.background = skyBackdrop
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const loaded = await loader.loadAsync('/scroll-runtime.glb')
  const source = loaded.scene.getObjectByName(
    'Cloudway_GiltScrollBridge_RuntimeV1',
  )
  if (source === undefined)
    throw new Error('Certified runtime scroll root is absent.')
  const materials = Object.entries(MATERIAL_BINDINGS).map(([mesh, kind]) => {
    const object = source.getObjectByName(mesh)
    if (object === undefined)
      throw new Error(`Missing reviewed scroll mesh ${mesh}.`)
    return { mesh, kind, material: meshMaterial(object) }
  })

  const definitions: readonly {
    readonly preset: CrystalInteriorPreset
    readonly seed: number
    readonly x: number
  }[] = [
    { preset: 'resonance-veins', seed: 4051, x: -2.62 },
    { preset: 'frost-roots', seed: 771, x: 0 },
    { preset: 'aurora-heart', seed: 1209, x: 2.62 },
  ]
  const installed = definitions.map((definition) => {
    const platform = platformAt(`proof-${definition.preset}`, definition.x)
    const adapter = createCloudwayScrollAdapter({ source, platform, materials })
    const effect = createCrystalInterior({
      preset: definition.preset,
      seed: definition.seed,
      envelope: INTERIOR_ENVELOPE,
      quality: 'high',
    })
    adapter.root.add(effect.root)
    scene.add(adapter.root)
    const update = (ratio: number) => {
      adapter.update({
        id: platform.id,
        offset: { x: 0, y: 0, z: 0 },
        phase:
          ratio === 1
            ? 'extended'
            : ratio === 0.25
              ? 'retracted'
              : 'retracting',
        phaseProgress: 0,
        collisionEnabled: true,
        lengthRatio: ratio,
      })
    }
    update(1)
    return { ...definition, adapter, effect, update }
  })

  const costs = Object.fromEntries(
    definitions.map((definition) => {
      const mobile = createCrystalInterior({
        preset: definition.preset,
        seed: definition.seed,
        envelope: INTERIOR_ENVELOPE,
        quality: 'mobile',
      })
      const mobileCost = mobile.snapshot().cost
      mobile.dispose()
      return [
        definition.preset,
        {
          high: installed
            .find((item) => item.preset === definition.preset)!
            .effect.snapshot().cost,
          mobile: mobileCost,
        },
      ]
    }),
  ) as Record<
    CrystalInteriorPreset,
    { high: CrystalInteriorCost; mobile: CrystalInteriorCost }
  >

  let paused = false
  let resonanceRetraction = 1
  const clock = new Clock()
  const frame = (): void => {
    const delta = Math.min(clock.getDelta(), 0.05)
    for (const item of installed)
      item.effect.update({
        deltaSeconds: delta,
        paused,
        scrollVisibleFraction:
          item.preset === 'resonance-veins' ? resonanceRetraction : 1,
      })
    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }

  const deckMaterial = meshMaterial(
    source.getObjectByName('ScrollDeckGeometry')!,
  )
  const physical = deckMaterial as MeshPhysicalMaterial
  const firstEffectMesh = installed[0]!.effect.root.getObjectByName(
    'resonance-veins__batched-static-tubes',
  ) as Mesh
  const effectMaterial = firstEffectMesh.material as Material
  window.__CRYSTAL_INTERIOR_PROOF__ = {
    ready: true,
    costs,
    renderer: rendererIdentity(),
    shell: {
      source: source.name,
      dimensions: [SCROLL_SIZE, 0.1, SCROLL_SIZE],
      envelope: INTERIOR_ENVELOPE,
      deckMaterial: {
        isPhysical: Boolean(physical.isMeshPhysicalMaterial),
        transmission: physical.isMeshPhysicalMaterial
          ? physical.transmission
          : 0,
        metalness: deckMaterial.metalness,
        transparent: deckMaterial.transparent,
      },
      interiorMaterial: {
        transparent: effectMaterial.transparent,
        depthTest: effectMaterial.depthTest,
        depthWrite: effectMaterial.depthWrite,
        toneMapped: effectMaterial.toneMapped,
      },
      background: {
        source: 'journey-map-v3/cloudscape.webp',
        colorSpace: skyBackdrop.colorSpace,
        framing: 'fitSkyBackdrop',
      },
    },
    setPaused(value) {
      paused = value
    },
    setReducedMotion(value) {
      installed.forEach((item) =>
        item.effect.configure({ reducedMotion: value }),
      )
    },
    setResonanceRetraction(value) {
      resonanceRetraction = value
      installed[0]!.update(value)
    },
    reset() {
      installed.forEach((item) => {
        item.effect.configure({ reducedMotion: false })
        item.effect.reset()
        item.update(1)
      })
      paused = false
      resonanceRetraction = 1
    },
    states() {
      return installed.map((item) => item.effect.snapshot())
    },
  }
  frame()
  document.body.dataset.ready = 'true'
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  document.body.dataset.error = message
  console.error(error)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  if (skyBackdrop !== null)
    fitSkyBackdrop(skyBackdrop, window.innerWidth, window.innerHeight)
})
