// Journey water proof scene — fixed-camera, mist-free rendering for image-difference evidence.

import { ACESFilmicToneMapping, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer, } from 'three'
import { createJourneyWater } from '../../../../../packages/glass-game/src/journey/water'

const host = document.querySelector<HTMLElement>('#water-study')
if (host === null) throw new Error('Water study host is missing.')

const renderer = new WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(1)
renderer.setSize(host.clientWidth, host.clientHeight, false)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
host.append(renderer.domElement)

const scene = new Scene()
scene.background = new Color(0x08292d)
const camera = new PerspectiveCamera(
  38,
  host.clientWidth / host.clientHeight,
  0.1,
  50,
)
camera.position.set(6.4, 4.15, 8.3)
camera.lookAt(0, 2.05, 0.2)

scene.add(new HemisphereLight(0xbce7df, 0x173334, 2.15))
const key = new DirectionalLight(0xffe6bd, 3.2)
key.position.set(-4.5, 8, 6)
scene.add(key)
const rim = new DirectionalLight(0x82e6e2, 2.4)
rim.position.set(5, 4, -3)
scene.add(rim)

const marble = new MeshStandardMaterial({
  color: 0xe8ddc6,
  roughness: 0.54,
  metalness: 0.02,
})
const brass = new MeshStandardMaterial({
  color: 0xcda85d,
  roughness: 0.26,
  metalness: 0.78,
})
const architecture = new Group()
architecture.name = 'water-study-architecture'
const ledge = new Mesh(new BoxGeometry(6.4, 0.34, 1.05), marble)
ledge.position.set(0, 4.2, -0.35)
architecture.add(ledge)
const trough = new Mesh(new BoxGeometry(5.7, 0.11, 0.24), brass)
trough.position.set(0, 4.03, 0.18)
architecture.add(trough)
for (const x of [-3.05, 3.05]) {
  const column = new Mesh(new CylinderGeometry(0.22, 0.28, 4.5, 16), marble)
  column.position.set(x, 2.05, -0.38)
  architecture.add(column)
}
const lowerPlinth = new Mesh(new BoxGeometry(6.9, 0.26, 2.8), marble)
lowerPlinth.position.set(0, 0.2, 0.45)
architecture.add(lowerPlinth)
scene.add(architecture)

const mistEnabled =
  new URLSearchParams(window.location.search).get('mist') !== '0'
const water = createJourneyWater(
  [
    {
      id: 'left-study-fall',
      position: [-1.65, 4.02, 0.18],
      width: 1.55,
      height: 3.58,
      yaw: 0,
    },
    {
      id: 'right-study-fall',
      position: [1.6, 4.02, 0.18],
      width: 1.18,
      height: 3.58,
      yaw: 0,
    },
  ],
  { mist: mistEnabled },
)
scene.add(water.root)

let visibleSeconds = 0
function advanceTo(targetSeconds: number, reducedMotion: boolean): void {
  water.setReducedMotion(reducedMotion)
  while (visibleSeconds + 1 / 120 < targetSeconds) {
    const dt = Math.min(1 / 60, targetSeconds - visibleSeconds)
    visibleSeconds += dt
    water.update(visibleSeconds, dt)
  }
  if (visibleSeconds < targetSeconds) {
    const dt = targetSeconds - visibleSeconds
    visibleSeconds = targetSeconds
    water.update(visibleSeconds, dt)
  }
  renderer.render(scene, camera)
}

advanceTo(0, false)

declare global {
  interface Window {
    waterStudy: {
      renderAt(
        seconds: number,
        reducedMotion: boolean,
      ): {
        water: ReturnType<typeof water.getMetrics>
        renderer: { calls: number; triangles: number; points: number }
      }
      dispose(): void
    }
  }
}

window.waterStudy = {
  renderAt(seconds, reducedMotion) {
    advanceTo(seconds, reducedMotion)
    return {
      water: water.getMetrics(),
      renderer: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        points: renderer.info.render.points,
      },
    }
  },
  dispose() {
    water.dispose()
    architecture.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
    })
    marble.dispose()
    brass.dispose()
    renderer.dispose()
  },
}

document.documentElement.dataset.ready = 'true'
