// Runner look — one bounded light profile and an owned scene reflection capture at preparation.
import type { Object3D, Scene, WebGLRenderer } from 'three'
import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, } from 'three'
import type { createMuseumEnvironment } from './environment'
import type { GlassRenderQualityPolicy } from './render-quality'

export const RUNNER_LOOK = Object.freeze({
  exposure: 0.92,
  environmentIntensity: 0.75,
  key: { color: 0xffdfac, intensity: 3.2, position: [-6, 8, -8] as const },
  fill: { sky: 0xc5e4e9, ground: 0x304744, intensity: 0.28 },
  rim: { color: 0xa6e0df, intensity: 0.52, position: [5, 3, 3] as const },
  shadow: {
    halfExtent: 8,
    near: 0.5,
    far: 34,
    bias: -0.00012,
    normalBias: 0.017,
  },
  reflectionPosition: [0, 1.3, -6] as const,
  reflectionCards: [
    {
      position: [-4, 3.5, -5] as const,
      width: 1.1,
      height: 5,
      intensity: 2.4,
      color: 0xffecd0,
    },
    {
      position: [4, 3, -8] as const,
      width: 0.65,
      height: 4.5,
      intensity: 1.7,
      color: 0xe0f9ff,
    },
  ],
})

/** Cards appear only in glass/chrome reflections, never as visible stage lights. */
export function captureRunnerImageLight(
  environment: ReturnType<typeof createMuseumEnvironment>,
  renderer: WebGLRenderer,
  scene: Scene,
  hidden: Object3D[],
  quality: GlassRenderQualityPolicy,
) {
  const cards = new Group()
  const position = new Vector3(...RUNNER_LOOK.reflectionPosition)
  const geometry = new PlaneGeometry(1, 1)
  const materials: MeshBasicMaterial[] = []
  try {
    for (const card of RUNNER_LOOK.reflectionCards) {
      const material = new MeshBasicMaterial({
        color: new Color(card.color).multiplyScalar(card.intensity),
        side: DoubleSide,
        toneMapped: false,
      })
      materials.push(material)
      const mesh = new Mesh(geometry, material)
      mesh.position.fromArray(card.position)
      mesh.scale.set(card.width, card.height, 1)
      mesh.lookAt(position)
      cards.add(mesh)
    }
    scene.add(cards)
    // The cube pass is the first shadow receiver draw on a fresh renderer.
    // Initialize its comparison texture before a shader samples the light.
    renderer.shadowMap.needsUpdate = true
    environment.capture(
      position,
      hidden,
      quality.profile === 'balanced' ? 128 : 256,
    )
  } finally {
    scene.remove(cards)
    geometry.dispose()
    materials.forEach((material) => material.dispose())
  }
}
