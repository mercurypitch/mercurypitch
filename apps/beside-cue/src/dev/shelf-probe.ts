// The Top Shelf's rooms, stood up, on a page that needs no stage and no mic.
// ============================================================
//
// Dev only: this file is reached from /shelf-probe.html, which Vite
// serves in dev and does not build (the production input is index.html
// alone). It is step 6a of docs/games/top-shelf.md: before a stage
// exists, maff judges the scale on his phone -- whether three semitones
// of riser reads as a step and a fifth as a leap beside a 0.55 m droplet,
// and whether a 2.4 m room is something a portrait screen can hold.
//
//   /shelf-probe.html?room=2&shelf=3   which room, and which shelf he is on
//
// Keys `[` and `]` step down and up the shelves and `1` `2` `3` switch
// rooms; the buttons along the bottom do the same for a thumb. The page
// keeps its URL in step, so a pose can be reloaded or sent on. The HUD
// names the shelf, its height and the ask to the next one, so a
// screenshot documents itself.
//
// THE BOXES ARE THE SIM'S TOPS. Every shelf is drawn from
// `levels/shelf.ts` and nothing else, so what is judged here is what the
// catch and the walls will stand him on. He is stood the Line's way,
// torso on the shelf (`Line3D`), with his mitt against the next riser
// where the wall pins him before a leap -- the riser's height beside him
// is the thing being judged -- and at the exit on the top shelf.

import { ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SpotLight, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import type { ShelfLevel } from '../games/glass3d/levels/shelf'
import { CATCH, MITT_SPAN, RISE_PER_SEMI, SHELVES, topsOf, } from '../games/glass3d/levels/shelf'
import { aimFromRig, buildCabinetEnvironment, createBackdrop, RIG, } from '../games/glass3d/render/environment'
import type { MercActor } from '../games/glass3d/render/merc'
import { createMerc } from '../games/glass3d/render/merc'

const CUSTARD = 0xf2c84b
const TURQUOISE = 0x00777d
const PAPER = 0xfff4e2

// The Line's lens and its portrait rule, copied rather than imported:
// `Line3D` keeps them private, and this page must not be the reason it
// changes.
const DESIGN_FOV_DEG = 42
const DESIGN_ASPECT = 1.5
const MAX_FOV_DEG = 64

// The Line's chase camera, MIRRORED: it stands 1.1 m to his LEFT of what
// it looks at, and looks 0.15 m ahead of him. The Line's stands on his
// right, and a staircase rises to his right: from there the next step's
// near corner hid half of him, face included, at every riser, and every
// riser faced away from the lens, catch and all. Here it also follows
// his height the way it follows his x (§5), the eye and what it looks at
// riding up together, so the pitch of the view never changes.
const CHASE_AHEAD = 1.1
const CHASE_LEAD = 0.15
const EYE_ABOVE = 1.0
const LOOK_ABOVE = 0.42
const CAMERA_Z = 2.9
/** The chase's easing rate, per second: the Line's. */
const CHASE_RATE = 3.2
/** Close enough to its mark that a measurement will not move under it. */
const SETTLED = 0.002

/** How far a shelf runs across the room toward the camera, and away.
 * The near face stands just in front of him rather than a corridor's
 * half-width out: a face 0.55 m nearer the lens than he is reads 1.2
 * times the rise it is, and the rise beside him is what is judged. */
const SPAN_NEAR = 0.25
const SPAN_FAR = 0.6
/** How far the boxes reach below the floor, so the floor is a box too
 * and every shelf, the floor included, has a top to measure. */
const SLAB = 0.05

const HALF = MITT_SPAN / 2

/** The names the ruler will use (§6), for the rises the rooms use. */
const INTERVAL: Record<number, string> = {
  3: 'm3',
  4: 'M3',
  5: 'P4',
  7: 'P5',
  12: '8ve',
}
const named = (semis: number): string => INTERVAL[semis] ?? `${semis} st`

const params = new URLSearchParams(window.location.search)
const pick = (raw: string | null, fallback: number, hi: number): number => {
  const n = Math.round(Number(raw ?? fallback))
  return Number.isFinite(n) ? Math.min(hi, Math.max(0, n)) : fallback
}

let roomIndex = pick(params.get('room'), 1, SHELVES.length) - 1
if (roomIndex < 0) roomIndex = 0
let room: ShelfLevel = SHELVES[roomIndex]!
let tops = topsOf(room)
let shelfIndex = pick(params.get('shelf'), 0, room.shelves.length - 1)

const canvas = document.querySelector('canvas')!
const hud = document.querySelector<HTMLDivElement>('#hud')!

const renderer = new WebGPURenderer({ canvas, antialias: true })
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

const scene = new Scene()
const camera = new PerspectiveCamera(DESIGN_FOV_DEG, 1, 0.05, 40)

const backdrop = createBackdrop(13)
scene.add(backdrop.mesh)
const environment = buildCabinetEnvironment()
scene.environment = environment

// The Line's rig, verbatim, hung on a group that goes where he goes: a
// rig left at floor level would light the top shelf from below.
const rig = new Group()
scene.add(rig)
const key = new SpotLight(CUSTARD, 55, 12, Math.PI / 10, 0.85, 1.6)
aimFromRig(key, RIG.key, new Vector3(0, 0.5, 0), 2.8)
const glint = new SpotLight(TURQUOISE, 30, 9, Math.PI / 7, 0.7, 1.6)
aimFromRig(glint, RIG.glint, new Vector3(0, 0.6, 0), 2.24)
const rim = new SpotLight(PAPER, 16, 7, Math.PI / 6, 0.8, 1.5)
aimFromRig(rim, RIG.back, new Vector3(0, 0.45, 0.4), 2.09)
rig.add(key, key.target, glint, glint.target, rim, rim.target)
// A little over the Line's fill, so a shelf the key does not reach still
// has an edge. The shelves are dark on purpose: Merc is chrome, and a
// pale shelf under him turns him into a white shape on a white shape.
scene.add(new AmbientLight(0xffffff, 0.12))

const shelfMaterial = new MeshStandardMaterial({
  color: 0x2e3837,
  roughness: 0.8,
  metalness: 0,
})
// The lip is where his mitts catch, so it is drawn; the band under it is
// the catch itself, the 5 cm a leap may fall short by and still land --
// half a semitone, at the scale being judged.
const lipMaterial = new MeshBasicMaterial({ color: CUSTARD })
const catchMaterial = new MeshBasicMaterial({
  color: TURQUOISE,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
})

const roomGroup = new Group()
scene.add(roomGroup)
/** One box per shelf, the floor's first, for the e2e to measure. */
let shelfBoxes: Mesh[] = []

const clearRoom = (): void => {
  for (const child of [...roomGroup.children]) {
    roomGroup.remove(child)
    ;(child as Mesh).geometry.dispose()
  }
  shelfBoxes = []
}

const buildRoom = (): void => {
  clearRoom()
  shelfBoxes = room.shelves.map((shelf, i) => {
    const top = tops[i]!
    const tall = top + SLAB
    const span = SPAN_NEAR + SPAN_FAR
    const z = (SPAN_NEAR - SPAN_FAR) / 2
    const box = new Mesh(
      new BoxGeometry(shelf.to - shelf.from, tall, span),
      shelfMaterial,
    )
    box.position.set((shelf.from + shelf.to) / 2, top - tall / 2, z)
    roomGroup.add(box)
    if (i > 0) {
      const lip = new Mesh(new BoxGeometry(0.014, 0.014, span), lipMaterial)
      lip.position.set(shelf.from, top, z)
      const band = new Mesh(new BoxGeometry(0.004, CATCH, span), catchMaterial)
      band.position.set(shelf.from - 0.003, top - CATCH / 2, z)
      roomGroup.add(lip, band)
    }
    return box
  })
}

/** Where he stands: his mitt against the next riser, as the wall pins
 * him before a leap; on the top shelf, at the exit. */
const standX = (): number =>
  shelfIndex < room.shelves.length - 1
    ? room.shelves[shelfIndex + 1]!.from - HALF
    : room.exitX
const standY = (): number => tops[shelfIndex]!

const cameraMark = (): { x: number; y: number } => ({
  x: standX() + CHASE_LEAD - CHASE_AHEAD,
  y: standY() + EYE_ABOVE,
})

const resize = (): void => {
  const width = window.innerWidth
  const height = window.innerHeight
  const aspect = width / Math.max(height, 1)
  camera.aspect = aspect
  // three's fov is VERTICAL; a portrait screen keeps the vertical angle
  // and throws the horizontal away, and the horizontal is the axis the
  // room runs along. Widen to hold it, never narrow (`Line3D.resize`).
  const designHalfH = (DESIGN_FOV_DEG * Math.PI) / 360
  const halfW = Math.atan(Math.tan(designHalfH) * DESIGN_ASPECT)
  const wanted = (2 * Math.atan(Math.tan(halfW) / aspect) * 180) / Math.PI
  camera.fov = Math.min(MAX_FOV_DEG, Math.max(DESIGN_FOV_DEG, wanted))
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
}
resize()
addEventListener('resize', resize)

// Controls: keys for a desk, buttons for a thumb, the URL for both.
// ============================================================

const bar = document.createElement('div')
bar.style.cssText =
  'position:fixed;left:0;right:0;bottom:14px;display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:0 8px'
document.body.append(bar)

const button = (label: string, press: () => void): HTMLButtonElement => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.style.cssText =
    'font:14px monospace;min-height:44px;padding:0 14px;border-radius:8px;border:1px solid rgba(207,214,220,0.35);background:rgba(11,13,16,0.82);color:#cfd6dc;touch-action:manipulation'
  b.addEventListener('click', press)
  bar.append(b)
  return b
}

const syncUrl = (): void => {
  const url = new URL(window.location.href)
  url.searchParams.set('room', String(roomIndex + 1))
  url.searchParams.set('shelf', String(shelfIndex))
  history.replaceState(null, '', url)
}

const setShelf = (next: number): void => {
  shelfIndex = Math.min(room.shelves.length - 1, Math.max(0, next))
  syncUrl()
}

const roomButtons: HTMLButtonElement[] = []
const paintControls = (): void => {
  roomButtons.forEach((b, i) => {
    b.style.borderColor = i === roomIndex ? '#f2c84b' : 'rgba(207,214,220,0.35)'
  })
}

const setRoom = (next: number): void => {
  roomIndex = Math.min(SHELVES.length - 1, Math.max(0, next))
  room = SHELVES[roomIndex]!
  tops = topsOf(room)
  // Kept where it can be, so the same shelf of two rooms can be compared.
  shelfIndex = Math.min(shelfIndex, room.shelves.length - 1)
  buildRoom()
  paintControls()
  syncUrl()
}

SHELVES.forEach((_, i) => {
  roomButtons.push(button(`Room ${i + 1}`, () => setRoom(i)))
})
button('Down', () => setShelf(shelfIndex - 1))
button('Up', () => setShelf(shelfIndex + 1))

addEventListener('keydown', (e) => {
  if (e.key === '[') setShelf(shelfIndex - 1)
  else if (e.key === ']') setShelf(shelfIndex + 1)
  else {
    const n = Number(e.key)
    if (Number.isInteger(n) && n >= 1 && n <= SHELVES.length) setRoom(n - 1)
  }
})

buildRoom()
paintControls()
syncUrl()

await renderer.init()
const merc: MercActor = await createMerc(0.55, environment)
scene.add(merc.root)
merc.play('listen', { loop: true, fade: 0 })

// Where he is on the screen, for the e2e.
// ============================================================

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

const toScreen = (p: Vector3): { x: number; y: number } => {
  const q = p.clone().project(camera)
  return {
    x: ((q.x + 1) / 2) * window.innerWidth,
    y: ((1 - q.y) / 2) * window.innerHeight,
  }
}

const screenRect = (b: Box3): Rect => {
  const r: Rect = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
  }
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z]) {
        const p = toScreen(new Vector3(x, y, z))
        r.left = Math.min(r.left, p.x)
        r.right = Math.max(r.right, p.x)
        r.top = Math.min(r.top, p.y)
        r.bottom = Math.max(r.bottom, p.y)
      }
  return r
}

/**
 * His torso against the shelf he stands on, in CSS pixels, as the frame
 * last drawn saw them. POSED, as the Merc probe measures him: a skinned
 * mesh caches the box of whatever pose it was first asked in, so each
 * skin's box is recomputed from the bones as they are. The feet are the
 * torso's bottom and the shelf's top is the drawn box's, both projected
 * as points under his centre, so the two can only differ by a hover or
 * a sink, never by perspective.
 */
const mercScreenBox = () => {
  merc.root.updateWorldMatrix(true, true)
  merc.root.traverse((o) => {
    const skin = o as {
      isSkinnedMesh?: boolean
      computeBoundingBox?: () => void
    }
    if (skin.isSkinnedMesh === true) skin.computeBoundingBox?.()
  })
  const whole = new Box3().setFromObject(merc.root)
  const body = merc.root.getObjectByName('merc_body')
  const torso = body === undefined ? whole : new Box3().setFromObject(body)
  const shelf = new Box3().setFromObject(shelfBoxes[shelfIndex]!)
  const at = merc.root.position
  const mark = cameraMark()
  return {
    room: roomIndex + 1,
    shelf: shelfIndex,
    whole: screenRect(whole),
    torso: screenRect(torso),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    feetY: torso.min.y,
    shelfTopY: shelf.max.y,
    feetPx: toScreen(new Vector3(at.x, torso.min.y, at.z)),
    shelfTopPx: toScreen(new Vector3(at.x, shelf.max.y, at.z)),
    settled:
      Math.abs(camera.position.x - mark.x) < SETTLED &&
      Math.abs(camera.position.y - mark.y) < SETTLED,
  }
}

const hook = {
  get room(): number {
    return roomIndex + 1
  },
  get shelf(): number {
    return shelfIndex
  },
  mercScreenBox,
}
;(window as unknown as { __shelf: typeof hook }).__shelf = hook

const backendName = (): string => {
  const b = renderer.backend as { isWebGPUBackend?: boolean }
  return b.isWebGPUBackend === true ? 'WebGPU' : 'WebGL2'
}

const describeShelf = (): string => {
  const last = room.shelves.length - 1
  const semis = Math.round(tops[shelfIndex]! / RISE_PER_SEMI)
  const here =
    shelfIndex === 0
      ? 'the floor'
      : `shelf ${shelfIndex} of ${last}, ${tops[shelfIndex]!.toFixed(2)} m, ${semis} st up`
  if (shelfIndex === last) return `${here}\nthe top shelf, and the exit`
  const rise = room.shelves[shelfIndex + 1]!.rise
  const lip = tops[shelfIndex + 1]!
  return `${here}\nnext riser +${rise} ${named(rise)} to ${lip.toFixed(2)} m, caught from ${(lip - CATCH).toFixed(2)} m`
}

// The frame.
// ============================================================

let last = performance.now()
let placed = false
const tick = (now: number): void => {
  const dt = Math.max(0, (now - last) / 1000)
  last = now

  const x = standX()
  const y = standY()
  merc.root.position.set(x, y + merc.metrics().feetBelowRoot, 0)
  // Turned toward the riser, but less than the Line's walking 1.05: that
  // was set against a lens on his right, and from the left it is a
  // profile. This keeps his face to the lens he is judged through.
  merc.root.rotation.y = 0.35
  merc.update(Math.min(dt, 0.1))
  rig.position.set(x, y, 0)

  const mark = cameraMark()
  if (!placed) {
    // Where the chase would have eased it to: the first frame should not
    // fly in from the origin.
    camera.position.set(mark.x, mark.y, CAMERA_Z)
    placed = true
  } else {
    const k = 1 - Math.exp(-CHASE_RATE * dt)
    camera.position.x += (mark.x - camera.position.x) * k
    camera.position.y += (mark.y - camera.position.y) * k
  }
  camera.lookAt(
    camera.position.x + CHASE_AHEAD,
    camera.position.y - (EYE_ABOVE - LOOK_ABOVE),
    0,
  )

  renderer.render(scene, camera)
  hud.textContent = `${backendName()}  ${room.id}  ${room.teaches}\n${describeShelf()}\n[ ] shelf   1 2 3 room`
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
