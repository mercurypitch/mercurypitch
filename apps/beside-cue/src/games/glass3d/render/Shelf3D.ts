// The Top Shelf's room, in three.
// ============================================================
//
// Line3D's sibling, forked on purpose as the Line forked the chamber's
// (docs/games/top-shelf.md §8): the renderer, the environment, the rig,
// the exit and the portrait lens are the Line's, and the plates, grates
// and wedges are gone. What is new is a staircase, drawn from the sim's
// own tops (`levels/shelf`) and nothing else, so what the eye judges is
// what the catch and the walls stand him on -- the probe's rule (6a).
//
// THE CAMERA STANDS ON HIS LEFT. The Line's chase stands on his right,
// and a staircase rises to his right: from there the next step's near
// corner hid half of him at every riser, face included, and every riser
// faced away from the lens, catch and all. The probe found it and this
// keeps it, with him turned 0.35 toward the lens rather than the Line's
// walking 1.05, which from the left is a profile.
//
// IT FOLLOWS THE SHELF, NOT THE LEAP. The chase eases up to the top of
// the shelf he last stood on, the eye and what it looks at riding
// together so the pitch of the view never changes (§5). It does not ride
// the leap itself: a camera that rose with him would flatten the one
// thing a player is watching, how high he went against the riser.

import { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BoxGeometry, CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SpotLight, SRGBColorSpace, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import type { ShelfLevel } from '../levels/shelf'
import { CATCH, MAX_LEAP, RISE_PER_SEMI, topsOf } from '../levels/shelf'
import { intervalName } from '../sim/shelf-voice'
import type { World3DConfig } from '../world3d-config'
import { aimFromRig, buildCabinetEnvironment, buildRadialFalloff, createBackdrop, RIG, } from './environment'
import type { MercActor } from './merc'
import { createMerc } from './merc'

const CUSTARD = 0xf2c84b
const TURQUOISE = 0x00777d
const PAPER = 0xfff4e2

const DESIGN_FOV_DEG = 42
const DESIGN_ASPECT = 1.5
const MAX_FOV_DEG = 64

// The Line's chase camera, MIRRORED, as the probe stood it: 1.1 m to his
// LEFT of what it looks at, which is 0.15 m ahead of him, and 1.0 m over
// the shelf looking down to 0.42 m over it.
const CHASE_AHEAD = 1.1
const CHASE_LEAD = 0.15
const EYE_ABOVE = 1.0
const LOOK_ABOVE = 0.42
const CAMERA_Z = 2.9
/** The chase's easing rate, per second: the Line's, for x and y alike. */
const CHASE_RATE = 3.2
/** Turned toward the riser, but only this far: see the header. */
const TURN = 0.35

/** How far a shelf runs across the room toward the camera, and away.
 * The near face stands just in front of him rather than a corridor's
 * half-width out: a face 0.55 m nearer the lens than he is reads 1.2
 * times the rise it is, and the rise beside him is what is judged (6a). */
const SPAN_NEAR = 0.25
const SPAN_FAR = 0.6
const SPAN = SPAN_NEAR + SPAN_FAR
const SPAN_Z = (SPAN_NEAR - SPAN_FAR) / 2
/** How far the boxes reach below the floor, so the floor is a box too. */
const SLAB = 0.05

/** How far he squashes, readying (§3.3): a crouch, not a puddle. */
const CROUCH_WIDTH = 0.06
const CROUCH_HEIGHT = 0.12

// The ruler (§6). One stands on the shelf below each riser, against it,
// so the ticks from the shelf he leaps from up to the lip he leaps for
// are in front of the lens, never behind the riser's box. It stands a
// quarter metre behind him rather than at the shelf's back edge: from
// this eye a tick at the back edge, 0.6 m behind him, reads 6 cm low
// against his feet at a fifth's height, more than the catch; at 0.25 m
// it is under 3 cm. He hides its lower ticks while he stands at the
// riser, and uncovers them as he leaps, which is the shot.
const RULER_Z = -0.25
/** Ticks a semitone apart up to the octave, the widest interval a room
 * names. His spring, `MAX_LEAP`, is marked, and the ticks above it are
 * dim: no leap reaches them (D2), and room 3's octave is up there. */
const RULER_SEMIS = 12
const RULER_W = 0.3
const RULER_H = RULER_SEMIS * RISE_PER_SEMI + 0.08
/** The intervals the rooms use, labelled (§6). */
const RULER_NAMED: readonly number[] = [3, 4, 5, 7, 12]
/** Canvas pixels per metre, for the ruler and the flash. */
const RULER_PX = 600
/** A label's type, in canvas pixels: 6.7 cm, the size that still read
 * at 390 px wide; the first cut, 5 cm, came out 8 px tall. Each sits on
 * a dark pill, so it reads on a pale riser and across the custard lip,
 * which crossed "P5" at every fifth. */
const RULER_TYPE = 40
/**
 * The flash at a leap's apex (§6): a short custard line at the height
 * reached, over the ruler's ticks, and the interval sung just under it,
 * held a beat and let go. A portrait screen is about 0.9 m wide at the
 * ruler's depth, with him in the middle of it: the first cut hung the
 * words 0.9 m out to the left and a headless phone lost all but the
 * last glyph off the edge, and its line, run across the labels, struck
 * through "P5". So the line stays on the ticks, and the words sit under
 * it and left of the labels, below his feet at the apex.
 */
/** Wide enough for the words left of where they end, `P5 +12¢` at full
 * size; anything longer is set smaller rather than cut off. */
const FLASH_W = 0.62
const FLASH_H = 0.12
/** The plane's right edge past the riser, and the line's reach back
 * from the spine: over the ticks, short of the labels. */
const FLASH_PAST = 0.04
const FLASH_LINE = 0.085
/** Where the words end, left of the riser: 3.6 cm clear of the label
 * pills, which the first placement, at 0.21, touched -- it read as
 * "P5 +12¢ P5". */
const FLASH_WORDS_END = 0.24
/** The words' type, a little under the labels', so they fit the 0.9 m a
 * portrait screen has at this depth with a margin at its edge. */
const FLASH_TYPE = 34
const FLASH_HOLD = 0.7
const FLASH_FADE = 0.9

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/** The ruler, drawn once: every riser's reads the same from the shelf
 * below it, so one texture serves them all. */
const drawRuler = (): CanvasTexture => {
  const w = Math.round(RULER_W * RULER_PX)
  const h = Math.round(RULER_H * RULER_PX)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const texture = new CanvasTexture(c)
  texture.colorSpace = SRGBColorSpace
  if (g === null) return texture
  const yAt = (m: number): number => h - m * RULER_PX
  const spine = w - 3
  const spring = Math.round(MAX_LEAP / RISE_PER_SEMI)
  g.lineCap = 'round'
  g.strokeStyle = 'rgba(207, 214, 220, 0.75)'
  g.lineWidth = 4
  g.beginPath()
  g.moveTo(spine, yAt(0))
  g.lineTo(spine, yAt(RULER_SEMIS * RISE_PER_SEMI))
  g.stroke()
  g.font = `700 ${String(RULER_TYPE)}px ${MONO}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  for (let s = 1; s <= RULER_SEMIS; s++) {
    const y = yAt(s * RISE_PER_SEMI)
    const named = RULER_NAMED.includes(s)
    const beyond = s > spring
    g.strokeStyle =
      s === spring
        ? '#f2c84b'
        : beyond
          ? 'rgba(207, 214, 220, 0.3)'
          : 'rgba(207, 214, 220, 0.9)'
    g.lineWidth = named || s === spring ? 5 : 3
    g.beginPath()
    g.moveTo(spine, y)
    g.lineTo(spine - (s === spring ? 70 : named ? 46 : 24), y)
    g.stroke()
    if (named) {
      const word = intervalName(s)
      const right = spine - 54
      const width = g.measureText(word).width
      g.fillStyle = beyond ? 'rgba(11, 13, 16, 0.35)' : 'rgba(11, 13, 16, 0.7)'
      g.beginPath()
      g.roundRect(
        right - width - 8,
        y - RULER_TYPE * 0.62,
        width + 16,
        RULER_TYPE * 1.24,
        8,
      )
      g.fill()
      g.fillStyle = beyond
        ? 'rgba(255, 244, 226, 0.4)'
        : 'rgba(255, 244, 226, 0.95)'
      g.fillText(word, right, y)
    }
  }
  texture.needsUpdate = true
  return texture
}

/** Merc's torso on the screen, in CSS pixels, as the last frame drew
 * him: what the e2e holds the frame to on a portrait phone (M3). */
export interface ShelfScreenBox {
  left: number
  right: number
  top: number
  bottom: number
  viewport: { w: number; h: number }
  /** The chase has come to rest: a measurement mid-glide would frame a
   * moment, not the pose. */
  settled: boolean
}

export interface ShelfView {
  mercX: number
  mercY: number
  mercFacing: 1 | -1
  /** The top of the shelf he last stood on: what the chase follows. */
  shelfY: number
  /** The top of whatever is under his centre right now: where the pool
   * of light under him lies. */
  surfaceY: number
  /** 0..1, how far he has crouched, readying for a leap (§3.3). */
  crouch: number
  /** Whether he is on the top shelf, which lights the way out. */
  exitOpen: boolean
}

export interface Shelf3D {
  init(): Promise<void>
  /** Put a different room in front of him, keeping everything that is
   * not the room -- the renderer, the environment, Merc, the mic. */
  load(room: ShelfLevel): void
  render(view: ShelfView, dt: number): void
  /** The line at a leap's apex (§6): at the riser's ruler `x`, at the
   * height reached, with the interval sung beside it. */
  flash(x: number, y: number, label: string): void
  mercScreenBox(): ShelfScreenBox | null
  merc(): MercActor | null
  camera(): PerspectiveCamera
  resize(width: number, height: number, pixelRatio: number): void
  backend(): string
  dispose(): void
}

export const createShelf3D = (
  canvas: HTMLCanvasElement,
  cfg: World3DConfig,
  room: ShelfLevel,
): Shelf3D => {
  void cfg
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
  // A little over the Line's fill, so a shelf the key does not reach
  // still has an edge. The shelves are dark on purpose: Merc is chrome,
  // and a pale shelf under him turns him into a white shape on a white
  // shape (6a).
  scene.add(new AmbientLight(0xffffff, 0.12))

  const shelfMaterial = new MeshStandardMaterial({
    color: 0x2e3837,
    roughness: 0.8,
    metalness: 0,
  })
  // The lip is where his mitts catch, so it is drawn; the band under it
  // is the catch itself, the 5 cm a leap may fall short by and still
  // land -- half a semitone.
  const lipMaterial = new MeshBasicMaterial({ color: CUSTARD })
  const catchMaterial = new MeshBasicMaterial({
    color: TURQUOISE,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })

  // The pool of light under him, the Line's, squeezed to the shelf's
  // depth so it does not hang in the air past the near edge.
  const poolMaterial = new MeshBasicMaterial({
    color: CUSTARD,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.12,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const pool = new Mesh(new CircleGeometry(0.5, 48), poolMaterial)
  pool.rotation.x = -Math.PI / 2
  pool.scale.set(1, 0.5, 1)
  scene.add(pool)

  // The way out: the chamber's light (slice 3d), on the top shelf and
  // sized to it.
  const exitMaterial = new MeshBasicMaterial({
    color: TURQUOISE,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.06,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const exitPool = new Mesh(new CircleGeometry(0.75, 48), exitMaterial)
  exitPool.rotation.x = -Math.PI / 2
  exitPool.scale.set(0.55, SPAN / 2 / 0.75, 1)
  const exitGlow = new Mesh(new PlaneGeometry(0.62, 2.6), exitMaterial)
  scene.add(exitPool, exitGlow)

  const rulerMaterial = new MeshBasicMaterial({
    map: drawRuler(),
    transparent: true,
    depthWrite: false,
  })

  const flashCanvas = document.createElement('canvas')
  flashCanvas.width = Math.round(FLASH_W * RULER_PX)
  flashCanvas.height = Math.round(FLASH_H * RULER_PX)
  const flashTexture = new CanvasTexture(flashCanvas)
  flashTexture.colorSpace = SRGBColorSpace
  const flashMaterial = new MeshBasicMaterial({
    map: flashTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const flashMesh = new Mesh(new PlaneGeometry(FLASH_W, FLASH_H), flashMaterial)
  flashMesh.visible = false
  scene.add(flashMesh)
  let flashAge = 0

  const drawFlash = (label: string): void => {
    const g = flashCanvas.getContext('2d')
    if (g === null) return
    const w = flashCanvas.width
    const h = flashCanvas.height
    g.clearRect(0, 0, w, h)
    // The line: the plane's top edge is 2 cm over the apex, so the line
    // is 2 cm down it, from the spine's side of the ticks to the riser.
    const lineY = 0.02 * RULER_PX
    const spineX = w - (FLASH_PAST + 0.004) * RULER_PX
    g.lineCap = 'round'
    g.strokeStyle = '#f2c84b'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(spineX - FLASH_LINE * RULER_PX, lineY)
    g.lineTo(w - 3, lineY)
    g.stroke()
    // The words, 2 cm under the line to 7 cm under it: below his feet at
    // the apex, allowing for the 2 cm the ruler's depth puts between them
    // on the screen.
    const right = w - (FLASH_PAST + FLASH_WORDS_END) * RULER_PX
    const top = 0.035 * RULER_PX
    // Set smaller until it fits the room left of `right`: a leap sung
    // past the octave names itself in semitones, and must not be cut.
    let size = FLASH_TYPE
    g.font = `700 ${String(size)}px ${MONO}`
    while (g.measureText(label).width > right - 24 && size > 20) {
      size -= 2
      g.font = `700 ${String(size)}px ${MONO}`
    }
    const width = g.measureText(label).width
    g.fillStyle = 'rgba(11, 13, 16, 0.72)'
    g.beginPath()
    g.roundRect(right - width - 10, top, width + 20, size * 1.3, 10)
    g.fill()
    g.fillStyle = '#fff4e2'
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    g.fillText(label, right, top + size * 0.65)
    flashTexture.needsUpdate = true
  }

  const roomGroup = new Group()
  scene.add(roomGroup)
  let current = room

  const clearRoom = (): void => {
    for (const child of [...roomGroup.children]) {
      roomGroup.remove(child)
      ;(child as Mesh).geometry.dispose()
    }
  }

  const buildRoom = (): void => {
    const tops = topsOf(current)
    const last = current.shelves.length - 1
    current.shelves.forEach((shelf, i) => {
      const top = tops[i]!
      const tall = top + SLAB
      // Each box runs a few millimetres on under the next, inside it, so
      // two front faces never meet edge to edge: a shared edge let the
      // backdrop through as a dotted hairline on the headless renderer.
      const tuck = i < last ? 0.003 : 0
      const box = new Mesh(
        new BoxGeometry(shelf.to - shelf.from + tuck, tall, SPAN),
        shelfMaterial,
      )
      box.position.set(
        (shelf.from + shelf.to + tuck) / 2,
        top - tall / 2,
        SPAN_Z,
      )
      roomGroup.add(box)
      if (i > 0) {
        const lip = new Mesh(new BoxGeometry(0.014, 0.014, SPAN), lipMaterial)
        lip.position.set(shelf.from, top, SPAN_Z)
        const band = new Mesh(
          new BoxGeometry(0.004, CATCH, SPAN),
          catchMaterial,
        )
        band.position.set(shelf.from - 0.003, top - CATCH / 2, SPAN_Z)
        roomGroup.add(lip, band)
        // The ruler, zeroed on the shelf below this riser: the one he
        // leaps from, so its tick at the lip is this riser's ask.
        const ruler = new Mesh(
          new PlaneGeometry(RULER_W, RULER_H),
          rulerMaterial,
        )
        ruler.position.set(
          shelf.from - 0.004 - RULER_W / 2,
          tops[i - 1]! + RULER_H / 2,
          RULER_Z,
        )
        roomGroup.add(ruler)
      }
    })
    const top = tops[tops.length - 1]!
    exitPool.position.set(current.exitX, top + 0.003, SPAN_Z)
    exitGlow.position.set(current.exitX, top + 0.95, SPAN_Z)
  }

  /** Where the chase wants to be for him at `x`, on a shelf at `y`. */
  const markFor = (x: number, facing: 1 | -1, y: number) => ({
    x: x + CHASE_LEAD * facing - CHASE_AHEAD,
    y: y + EYE_ABOVE,
  })

  const place = (x: number, y: number): void => {
    const mark = markFor(x, 1, y)
    camera.position.set(mark.x, mark.y, CAMERA_Z)
  }

  let mercActor: MercActor | null = null
  let disposed = false
  let clock = 0
  /** The canvas's CSS size, for the screen box. */
  let cssW = 1
  let cssH = 1
  /** Where the chase was last headed, for "settled". */
  const lastMark = { x: 0, y: 0 }

  buildRoom()
  place(room.startX, 0)

  return {
    async init(): Promise<void> {
      await renderer.init()
      if (disposed) return
      const actor = await createMerc(0.55, environment)
      if (disposed) {
        actor.dispose()
        return
      }
      mercActor = actor
      scene.add(actor.root)
    },

    load(next): void {
      if (disposed) return
      current = next
      clearRoom()
      buildRoom()
      flashMesh.visible = false
      // Put the camera where the chase would have eased it to, rather
      // than letting it fly there across the handover (slice 3's fix).
      place(next.startX, 0)
    },

    flash(x: number, y: number, label: string): void {
      if (disposed) return
      drawFlash(label)
      // Right edge FLASH_PAST past the riser; top edge 2 cm over the apex.
      flashMesh.position.set(
        x + FLASH_PAST - FLASH_W / 2,
        y + 0.02 - FLASH_H / 2,
        RULER_Z + 0.004,
      )
      flashMaterial.opacity = 1
      flashMesh.visible = true
      flashAge = 0
    },

    mercScreenBox(): ShelfScreenBox | null {
      const actor = mercActor
      if (actor === null) return null
      // POSED, as the probes measure him: a skinned mesh caches the box
      // of whatever pose it was first asked in.
      actor.root.updateWorldMatrix(true, true)
      actor.root.traverse((o) => {
        const skin = o as {
          isSkinnedMesh?: boolean
          computeBoundingBox?: () => void
        }
        if (skin.isSkinnedMesh === true) skin.computeBoundingBox?.()
      })
      const body = actor.root.getObjectByName('merc_body') ?? actor.root
      const box = new Box3().setFromObject(body)
      const out = {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity,
      }
      const p = new Vector3()
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            p.set(x, y, z).project(camera)
            const sx = ((p.x + 1) / 2) * cssW
            const sy = ((1 - p.y) / 2) * cssH
            out.left = Math.min(out.left, sx)
            out.right = Math.max(out.right, sx)
            out.top = Math.min(out.top, sy)
            out.bottom = Math.max(out.bottom, sy)
          }
      return {
        ...out,
        viewport: { w: cssW, h: cssH },
        settled:
          Math.abs(camera.position.x - lastMark.x) < 0.002 &&
          Math.abs(camera.position.y - lastMark.y) < 0.002,
      }
    },

    render(view: ShelfView, dt: number): void {
      if (disposed) return
      clock += Math.min(dt, 0.1)

      const actor = mercActor
      if (actor !== null) {
        actor.root.position.x = view.mercX
        // His TORSO stands on the shelf, the Line's way: `feetBelowRoot`
        // is the torso's bottom, held still across every shape.
        actor.root.position.y = view.mercY + actor.metrics().feetBelowRoot
        actor.root.rotation.y = TURN * view.mercFacing
        actor.setShape(
          1 + CROUCH_WIDTH * view.crouch,
          1 - CROUCH_HEIGHT * view.crouch,
        )
        actor.update(dt)
      }
      rig.position.set(view.mercX, view.mercY, 0)

      pool.position.set(view.mercX, view.surfaceY + 0.001, 0)
      poolMaterial.opacity =
        0.12 * Math.max(0, Math.min(1, 1 - (view.mercY - view.surfaceY) * 1.6))

      if (flashMesh.visible) {
        flashAge += Math.min(dt, 0.1)
        const fade =
          flashAge <= FLASH_HOLD
            ? 1
            : Math.max(0, 1 - (flashAge - FLASH_HOLD) / FLASH_FADE)
        flashMaterial.opacity = fade
        if (fade <= 0) flashMesh.visible = false
      }

      const mark = markFor(view.mercX, view.mercFacing, view.shelfY)
      lastMark.x = mark.x
      lastMark.y = mark.y
      const k = 1 - Math.exp(-CHASE_RATE * dt)
      camera.position.x += (mark.x - camera.position.x) * k
      camera.position.y += (mark.y - camera.position.y) * k
      camera.lookAt(
        camera.position.x + CHASE_AHEAD,
        camera.position.y - (EYE_ABOVE - LOOK_ABOVE),
        0,
      )

      const breath = 0.5 + 0.5 * Math.sin(clock * 2.2)
      exitMaterial.color.setHex(view.exitOpen ? CUSTARD : TURQUOISE)
      exitMaterial.opacity = view.exitOpen ? 0.26 + breath * 0.2 : 0.15

      renderer.render(scene, camera)
    },

    merc(): MercActor | null {
      return mercActor
    },

    camera(): PerspectiveCamera {
      return camera
    },

    resize(width: number, height: number, pixelRatio: number): void {
      cssW = width
      cssH = height
      const aspect = width / Math.max(height, 1)
      camera.aspect = aspect
      // three's fov is VERTICAL; a portrait screen keeps the vertical
      // angle and throws the horizontal away, and the horizontal is the
      // axis the room runs along. Widen to hold it, never narrow.
      const designHalfH = (DESIGN_FOV_DEG * Math.PI) / 360
      const halfW = Math.atan(Math.tan(designHalfH) * DESIGN_ASPECT)
      const wanted = (2 * Math.atan(Math.tan(halfW) / aspect) * 180) / Math.PI
      camera.fov = Math.min(MAX_FOV_DEG, Math.max(DESIGN_FOV_DEG, wanted))
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
    },

    backend(): string {
      const b = renderer.backend as { isWebGPUBackend?: boolean }
      return b.isWebGPUBackend === true ? 'WebGPU' : 'WebGL2'
    },

    dispose(): void {
      disposed = true
      clearRoom()
      mercActor?.dispose()
      backdrop.dispose()
      environment.dispose()
      shelfMaterial.dispose()
      lipMaterial.dispose()
      catchMaterial.dispose()
      rulerMaterial.map?.dispose()
      rulerMaterial.dispose()
      flashMesh.geometry.dispose()
      flashTexture.dispose()
      flashMaterial.dispose()
      pool.geometry.dispose()
      poolMaterial.dispose()
      exitPool.geometry.dispose()
      exitGlow.geometry.dispose()
      exitMaterial.dispose()
      renderer.dispose()
    },
  }
}
