// ============================================================
// Canvas2dTabRenderer — shared fret-grid and string-highway projection
// ============================================================
//
// A real perspective camera (wgpu-matrix). Grid keeps the original upright
// fretboard at Z=0; Highway maps the strings across a continuous runway and
// encodes frets inside each target. Both share timing, notes, feedback, camera,
// and the receding beat plane.
//
// Readability layer: imminent notes are emphasised (glow + size, far ones fade),
// simultaneous notes are bound by a chord spine, each note flashes a ring on its
// cell as it lands, the next event pulses, and labels stay legible on any lane.
//
// Coordinates: +X right, +Y up, +Z toward viewer (depth into screen = −Z).

import { mat4 } from 'wgpu-matrix'
import type { GuitarBendType } from '@/lib/guitar/guitar-notation'
import type { GuitarSlideType } from '@/lib/guitar/guitar-notation'
import type { CameraState } from '../camera'
import { cameraEye, DEFAULT_CAMERA } from '../camera'
import { nextTabEvent, visibleTabEvents, visibleTabNotes, } from '../compile-tab-notes'
import { beatsToDepth } from '../projection'
import type { TabRenderer, TabScene, TabSceneEvent, TabSceneNote, } from '../TabRenderer'
import { colorForString, labelInk, lighten, withAlpha } from './color'
import { cellKey, cellNoteName, isDoubleFretMarker, isFretMarker, } from './FretboardStrip'
import { TAB_FLOOR_DEPTH as FLOOR_DEPTH, TAB_LANE_HEIGHT as LANE_HEIGHT, TAB_WALL_BOTTOM as Y_BOTTOM, TAB_WALL_TOP as WALL_TOP, tabConvergedX, tabFlightPoint, tabFretStringY, tabFretX, tabStringLaneX, tabTransverseWorldSpan, } from './highway-geometry'

// ── Scene constants (world units) ──────────────────────────

// ── Camera (orbit; defaults reproduce the verified fixed view) ─────
const UP: [number, number, number] = [0, 1, 0]
const FOVY = (55 * Math.PI) / 180
const NEAR = 0.1
const FAR = 300

// ── Readability tuning (beats) ─────────────────────────────
const NEAR_BEATS = 1.0 // imminence ramp: full emphasis at the hit line
const FLASH_IN = 0.05 // strike flash starts just before the hit
const FLASH_OUT = 0.3 // and fades out this many beats after
const BEATS_PER_BAR = 4 // for downbeat emphasis (assume 4/4)
const HIT_FLASH_MS = 500 // scored-hit ring fade duration
const PORTRAIT_HIGHWAY_FAR_SCALE = 0.45

export function bendAmountLabel(semitones: number): string {
  const amount = Math.abs(semitones)
  if (Math.abs(amount - 0.5) < 0.05) return '¼'
  if (Math.abs(amount - 1) < 0.05) return '½'
  if (Math.abs(amount - 2) < 0.05) return 'full'
  return `${amount.toFixed(1)} st`
}

export type BendVisualMotion = 'up' | 'down' | 'up-down' | 'hold'

export function bendVisualMotion(bendType: GuitarBendType): BendVisualMotion {
  if (bendType === 'release' || bendType === 'prebend-release') return 'down'
  if (bendType === 'bend-release') return 'up-down'
  if (bendType === 'hold') return 'hold'
  return 'up'
}

export function linkedTechniqueTargetFret(
  authoredFret: number | undefined,
  resolvedTargetFret: number | undefined,
): number | undefined {
  return resolvedTargetFret ?? authoredFret
}

export function slideInSourceFret(
  slideType: GuitarSlideType,
  currentFret: number,
  maxFret: number,
): number | undefined {
  if (slideType === 'into-from-below') return Math.max(0, currentFret - 2)
  if (slideType === 'into-from-above') {
    return Math.min(maxFret, currentFret + 2)
  }
  return undefined
}

export function slideOutTargetFret(
  slideType: GuitarSlideType,
  currentFret: number,
  maxFret: number,
): number | undefined {
  if (slideType === 'out-up' || slideType === 'pick-slide-up') {
    return Math.min(maxFret, currentFret + 2)
  }
  if (slideType === 'out-down' || slideType === 'pick-slide-down') {
    return Math.max(0, currentFret - 2)
  }
  return undefined
}

export function slideMarkLabel(slideType: GuitarSlideType): string {
  return slideType === 'pick-slide-up' || slideType === 'pick-slide-down'
    ? 'P.S.'
    : 'SL'
}

interface Projected {
  x: number
  y: number
  scale: number
  w: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export class Canvas2dTabRenderer implements TabRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private cssWidth = 0
  private cssHeight = 0
  private vp: Float32Array = new Float32Array(16)
  private vpW = 0
  private vpH = 0
  private camera: CameraState = DEFAULT_CAMERA
  private cameraDirty = true

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.cssWidth = canvas.clientWidth
    this.cssHeight = canvas.clientHeight
  }

  setCamera(camera: CameraState): void {
    if (
      camera.yaw === this.camera.yaw &&
      camera.pitch === this.camera.pitch &&
      camera.radius === this.camera.radius &&
      camera.target[0] === this.camera.target[0] &&
      camera.target[1] === this.camera.target[1] &&
      camera.target[2] === this.camera.target[2]
    ) {
      return
    }
    this.camera = camera
    this.cameraDirty = true
  }

  resize(width: number, height: number, dpr: number): void {
    this.cssWidth = width
    this.cssHeight = height
    if (this.canvas === null || this.ctx === null) return
    const effectiveDpr = Math.max(1, Math.min(2, dpr))
    this.canvas.width = Math.max(1, Math.round(width * effectiveDpr))
    this.canvas.height = Math.max(1, Math.round(height * effectiveDpr))
    this.ctx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0)
  }

  private ensureCamera(): void {
    if (
      !this.cameraDirty &&
      this.vpW === this.cssWidth &&
      this.vpH === this.cssHeight
    )
      return
    const aspect = this.cssHeight > 0 ? this.cssWidth / this.cssHeight : 1
    const eye = cameraEye(this.camera)
    const target = this.camera.target as [number, number, number]
    const view = mat4.lookAt(eye, target, UP)
    const proj = mat4.perspective(FOVY, aspect, NEAR, FAR)
    this.vp = mat4.multiply(proj, view) as Float32Array
    this.vpW = this.cssWidth
    this.vpH = this.cssHeight
    this.cameraDirty = false
  }

  private project(x: number, y: number, z: number): Projected {
    const m = this.vp
    const W = this.cssWidth
    const H = this.cssHeight
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12]
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13]
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]
    const inv = cw !== 0 ? 1 / cw : 0
    return {
      x: (cx * inv * 0.5 + 0.5) * W,
      y: (1 - (cy * inv * 0.5 + 0.5)) * H,
      scale: inv,
      w: cw,
    }
  }

  private fretX(f: number, maxFret: number, leftHanded = false): number {
    return tabFretX(f, maxFret, leftHanded)
  }

  private stringY(s: number, n: number): number {
    return tabFretStringY(s, n)
  }

  /** Project a note through the selected visual geometry without changing time. */
  private notePos(
    scene: TabScene,
    s: number,
    f: number,
    t: number,
    n: number,
    maxFret: number,
  ): [number, number, number] {
    const point = tabFlightPoint(
      scene.presentation,
      s,
      f,
      t,
      n,
      maxFret,
      scene.display.leftHanded,
    )
    point[0] = this.depthAdjustedX(scene, point[0], t)
    return point
  }

  private depthAdjustedX(
    scene: TabScene,
    x: number,
    depthRatio: number,
  ): number {
    if (
      scene.presentation !== 'string-highway' ||
      this.cssWidth > 720 ||
      this.cssHeight <= this.cssWidth
    ) {
      return x
    }
    return tabConvergedX(x, depthRatio, PORTRAIT_HIGHWAY_FAR_SCALE)
  }

  private reducedMotion(scene: TabScene): boolean {
    return scene.display.motion === 'reduced'
  }

  private reducedEffects(scene: TabScene): boolean {
    return scene.display.effects === 'reduced'
  }

  /** Projected spacing across the active fret cells or string lanes. */
  private targetSpanPx(
    scene: TabScene,
    stringIndex: number,
    fret: number,
    depthRatio: number,
    stringCount: number,
    maxFret: number,
  ): number {
    const [x, y, z] = this.notePos(
      scene,
      stringIndex,
      fret,
      depthRatio,
      stringCount,
      maxFret,
    )
    let span = tabTransverseWorldSpan(
      scene.presentation,
      stringIndex,
      fret,
      stringCount,
      maxFret,
    )
    if (scene.presentation === 'string-highway') {
      span = Math.abs(this.depthAdjustedX(scene, span, depthRatio))
    }
    return Math.abs(
      this.project(x + span / 2, y, z).x - this.project(x - span / 2, y, z).x,
    )
  }

  private line(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    style: string,
    width: number,
  ): void {
    const a = this.project(ax, ay, az)
    const b = this.project(bx, by, bz)
    if (a.w <= NEAR || b.w <= NEAR) return
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.stroke()
  }

  render(scene: TabScene): void {
    const ctx = this.ctx
    if (ctx === null || this.cssWidth === 0 || this.cssHeight === 0) return
    this.ensureCamera()
    const N = Math.max(1, scene.stringCount)
    const maxFret = scene.maxFret
    const ph = scene.playheadBeat
    const beatWindow = Math.max(1, scene.visibleBeatWindow)

    this.drawBackground(ctx, scene)

    // ── Readability scaffolding ──────────────────────────────
    const nextEvent = nextTabEvent(scene)
    const nextNoteIds = new Set(nextEvent?.notes.map((note) => note.id) ?? [])
    const visibleNotes = visibleTabNotes(scene)
    const upcomingCells = new Set<string>() // cells with a note arriving soon
    for (const note of visibleNotes) {
      if (note.isBacking) continue
      const ba = note.startBeat - ph
      if (ba > -0.1 && ba < 0.6) {
        upcomingCells.add(cellKey(note.stringIndex, note.fret))
      }
    }

    this.drawHighway(ctx, scene, N, maxFret)
    if (scene.showFretboard) {
      if (scene.presentation === 'string-highway') {
        this.drawStringLanding(ctx, scene, N)
      } else {
        this.drawFretboard(ctx, scene, N, maxFret, upcomingCells)
      }
      this.drawTargetFeedback(
        ctx,
        scene,
        N,
        maxFret,
        nextEvent?.notes ?? [],
        visibleNotes,
      )
      this.drawHits(ctx, scene, N, maxFret)
      this.drawDetected(ctx, scene, N, maxFret)
    }

    const visible = visibleNotes
      .map((note) => ({
        note,
        t0: beatsToDepth(note.startBeat - ph, beatWindow),
        t1: beatsToDepth(note.startBeat + note.durationBeats - ph, beatWindow),
      }))
      .filter((o) => o.t1 > -0.05 && o.t0 < 1.04)
      .sort((a, b) => b.t0 - a.t0)

    // Chord spines (bind simultaneous main-track notes) — behind the chips.
    this.drawChordSpines(ctx, scene, visibleTabEvents(scene), N, maxFret)

    for (const { note, t0, t1 } of visible) {
      const isNext = !note.isBacking && nextNoteIds.has(note.id)
      this.drawNote(ctx, scene, note, t0, t1, N, maxFret, beatWindow, isNext)
    }
    this.drawTechniqueMarks(ctx, scene, visible, N, maxFret)
  }

  private drawBackground(ctx: CanvasRenderingContext2D, scene: TabScene): void {
    const W = this.cssWidth
    const H = this.cssHeight
    ctx.clearRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    if (scene.display.theme === 'velvet') {
      // The room owns the photographic world. Keep the highway legible while
      // allowing that environment to breathe through the canvas.
      grad.addColorStop(0, 'rgba(9, 8, 6, 0.18)')
      grad.addColorStop(0.62, 'rgba(23, 17, 13, 0.3)')
      grad.addColorStop(1, 'rgba(13, 11, 9, 0.5)')
    } else {
      grad.addColorStop(0, '#05050a')
      grad.addColorStop(1, '#0e0e17')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  // Highway floor (Y=0) receding to −Z behind the fretboard.
  private drawHighway(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
  ): void {
    const velvet = scene.display.theme === 'velvet'
    const laneColor = velvet ? 'rgba(224,164,93,0.16)' : 'rgba(120,150,220,0.1)'
    const isStringHighway = scene.presentation === 'string-highway'
    const floorY = isStringHighway ? LANE_HEIGHT : Y_BOTTOM
    const left = isStringHighway
      ? tabStringLaneX(0, n, false)
      : this.fretX(0, maxFret, scene.display.leftHanded)
    const right = isStringHighway
      ? tabStringLaneX(n - 1, n, false)
      : this.fretX(maxFret, maxFret, scene.display.leftHanded)

    if (isStringHighway) {
      const nearLeft = this.project(left - 0.45, floorY - 0.04, 0)
      const nearRight = this.project(right + 0.45, floorY - 0.04, 0)
      const farRight = this.project(
        this.depthAdjustedX(scene, right + 0.45, 1),
        floorY - 0.04,
        -FLOOR_DEPTH,
      )
      const farLeft = this.project(
        this.depthAdjustedX(scene, left - 0.45, 1),
        floorY - 0.04,
        -FLOOR_DEPTH,
      )
      if (
        [nearLeft, nearRight, farRight, farLeft].every(
          (point) => point.w > NEAR,
        )
      ) {
        const runway = this.reducedEffects(scene)
          ? 'rgba(31, 24, 19, 0.34)'
          : ctx.createLinearGradient(0, farLeft.y, 0, nearLeft.y)
        if (typeof runway !== 'string') {
          runway.addColorStop(0, 'rgba(26, 22, 18, 0.08)')
          runway.addColorStop(1, 'rgba(31, 24, 19, 0.54)')
        }
        ctx.beginPath()
        ctx.moveTo(nearLeft.x, nearLeft.y)
        ctx.lineTo(nearRight.x, nearRight.y)
        ctx.lineTo(farRight.x, farRight.y)
        ctx.lineTo(farLeft.x, farLeft.y)
        ctx.closePath()
        ctx.fillStyle = runway
        ctx.fill()
      }
      for (let stringIndex = 0; stringIndex < n; stringIndex += 1) {
        const x = tabStringLaneX(stringIndex, n, scene.display.leftHanded)
        const stringColor = colorForString(
          scene.display.stringColors,
          stringIndex,
        )
        this.line(
          ctx,
          x,
          floorY,
          0,
          this.depthAdjustedX(scene, x, 1),
          floorY,
          -FLOOR_DEPTH,
          velvet ? withAlpha(lighten(stringColor, 0.56), 0.38) : laneColor,
          1 + ((n - 1 - stringIndex) / Math.max(1, n - 1)) * 0.85,
        )
      }
    } else {
      for (let f = 0; f <= maxFret; f++) {
        const x = this.fretX(f, maxFret, scene.display.leftHanded)
        this.line(ctx, x, floorY, 0, x, floorY, -FLOOR_DEPTH, laneColor, 1)
      }
    }
    const beatWindow = Math.max(1, scene.visibleBeatWindow)
    const startBeat = Math.ceil(scene.playheadBeat)
    for (
      let beat = startBeat;
      beat <= scene.playheadBeat + beatWindow;
      beat++
    ) {
      const t = beatsToDepth(beat - scene.playheadBeat, beatWindow)
      if (t < 0 || t > 1) continue
      const z = -t * FLOOR_DEPTH
      const beatLeft = this.depthAdjustedX(scene, left, t)
      const beatRight = this.depthAdjustedX(scene, right, t)
      const downbeat =
        ((beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0
      this.line(
        ctx,
        beatLeft,
        floorY,
        z,
        beatRight,
        floorY,
        z,
        downbeat
          ? velvet
            ? 'rgba(106,202,189,0.32)'
            : 'rgba(140,170,235,0.22)'
          : velvet
            ? 'rgba(224,164,93,0.1)'
            : 'rgba(120,150,220,0.07)',
        downbeat ? 2 : 1,
      )
    }

    if (velvet) {
      this.line(
        ctx,
        left,
        floorY,
        0,
        right,
        floorY,
        0,
        'rgba(242,201,143,0.86)',
        3,
      )
      const now = this.project(
        isStringHighway ? (left + right) / 2 : right,
        floorY,
        0,
      )
      if (now.w > NEAR) {
        ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = isStringHighway ? 'center' : 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = 'rgba(242,201,143,0.9)'
        ctx.fillText('NOW', now.x, now.y - 7)
      }
    }
  }

  // Upright fretboard wall on Z=0.
  private drawFretboard(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
    upcomingCells: ReadonlySet<string>,
  ): void {
    // Fret wires (vertical).
    for (let f = 0; f <= maxFret; f++) {
      const x = this.fretX(f, maxFret, scene.display.leftHanded)
      this.line(
        ctx,
        x,
        Y_BOTTOM,
        0,
        x,
        WALL_TOP,
        0,
        f === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)',
        f === 0 ? 2 : 1,
      )
    }

    // Inlay markers (mid height).
    const yMid = this.stringY((n - 1) / 2, n)
    for (let f = 1; f <= maxFret; f++) {
      if (!isFretMarker(f)) continue
      const x = this.fretX(f, maxFret, scene.display.leftHanded)
      const offs = isDoubleFretMarker(f) ? [-0.5, 0.5] : [0]
      for (const dy of offs) {
        const p = this.project(x, yMid + dy, 0)
        if (p.w <= NEAR) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fill()
      }
    }

    const xL = this.fretX(0, maxFret, scene.display.leftHanded)
    const xR = this.fretX(maxFret, maxFret, scene.display.leftHanded)

    // Strings (horizontal, coloured) + open labels + decluttered cell names.
    for (let s = 0; s < n; s++) {
      const y = this.stringY(s, n)
      const color = colorForString(scene.display.stringColors, s)
      this.line(
        ctx,
        xL,
        y,
        0,
        xR,
        y,
        0,
        withAlpha(color, 0.7),
        1 + (n - 1 - s) * 0.3,
      )
      const open = scene.openMidi[s] ?? 40
      const lp = this.project(xL, y, 0)
      if (lp.w > NEAR) {
        ctx.fillStyle = withAlpha(color, 0.95)
        ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = scene.display.leftHanded ? 'left' : 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          cellNoteName(open, 0),
          lp.x + (scene.display.leftHanded ? 8 : -8),
          lp.y,
        )
      }
      // Per-cell names only where a note is incoming soon (declutter the grid).
      if (scene.showNoteLabels) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
        for (let f = 0; f <= maxFret; f++) {
          if (!upcomingCells.has(cellKey(s, f))) continue
          const p = this.project(
            this.fretX(f, maxFret, scene.display.leftHanded),
            y,
            0,
          )
          if (p.w <= NEAR) continue
          ctx.fillStyle = 'rgba(255,255,255,0.32)'
          ctx.fillText(cellNoteName(open, f), p.x, p.y)
        }
      }
    }

    // Fret numbers below the nut line.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let f = 0; f <= maxFret; f++) {
      const p = this.project(
        this.fretX(f, maxFret, scene.display.leftHanded),
        Y_BOTTOM - 0.3,
        0,
      )
      if (p.w <= NEAR) continue
      ctx.fillStyle = isFretMarker(f)
        ? scene.display.theme === 'velvet'
          ? 'rgba(242,201,143,0.9)'
          : 'rgba(120,170,255,0.9)'
        : 'rgba(255,255,255,0.4)'
      ctx.font = `${isFretMarker(f) ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(String(f), p.x, p.y)
    }
  }

  /** Quiet labels at the arrival rail keep string identity visible in Flow. */
  private drawStringLanding(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
  ): void {
    for (let stringIndex = 0; stringIndex < n; stringIndex += 1) {
      const x = tabStringLaneX(stringIndex, n, scene.display.leftHanded)
      const p = this.project(x, LANE_HEIGHT, 0)
      if (p.w <= NEAR) continue
      const color = colorForString(scene.display.stringColors, stringIndex)
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = withAlpha(lighten(color, 0.46), 0.78)
      ctx.fillText(
        cellNoteName(scene.openMidi[stringIndex] ?? 40, 0),
        p.x,
        p.y + 9,
      )
    }
  }

  /** Shared next-note and strike feedback follows whichever geometry is active. */
  private drawTargetFeedback(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
    nextNotes: readonly TabSceneNote[],
    visibleNotes: readonly TabSceneNote[],
  ): void {
    if (nextNotes.length > 0) {
      const pulse = this.reducedMotion(scene)
        ? 0.64
        : 0.4 + 0.3 * Math.sin(scene.playheadBeat * Math.PI * 2)
      for (const note of nextNotes) {
        const [x, y, z] = this.notePos(
          scene,
          note.stringIndex,
          note.fret,
          0,
          n,
          maxFret,
        )
        const p = this.project(x, y, z)
        if (p.w <= NEAR) continue
        const span = this.targetSpanPx(
          scene,
          note.stringIndex,
          note.fret,
          0,
          n,
          maxFret,
        )
        const uncappedRadius = Math.max(
          scene.display.theme === 'velvet' ? 18 : 5,
          span * (scene.display.theme === 'velvet' ? 0.38 : 0.3),
        )
        const r =
          scene.presentation === 'string-highway'
            ? Math.min(32, uncappedRadius)
            : uncappedRadius
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = withAlpha(
          colorForString(scene.display.stringColors, note.stringIndex),
          pulse,
        )
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    ctx.save()
    if (!this.reducedEffects(scene)) ctx.globalCompositeOperation = 'lighter'
    for (const note of visibleNotes) {
      if (note.isBacking) continue
      const distance = scene.playheadBeat - note.startBeat
      if (distance < -FLASH_IN || distance > FLASH_OUT) continue
      const [x, y, z] = this.notePos(
        scene,
        note.stringIndex,
        note.fret,
        0,
        n,
        maxFret,
      )
      const p = this.project(x, y, z)
      if (p.w <= NEAR) continue
      const color = colorForString(scene.display.stringColors, note.stringIndex)
      const span = this.targetSpanPx(
        scene,
        note.stringIndex,
        note.fret,
        0,
        n,
        maxFret,
      )
      const baseR =
        scene.presentation === 'string-highway'
          ? Math.min(30, Math.max(6, span * 0.3))
          : Math.max(6, span * 0.42)
      const progress = clamp01((distance + FLASH_IN) / (FLASH_OUT + FLASH_IN))
      const coreAlpha = 1 - clamp01((distance + FLASH_IN) / 0.2)
      if (coreAlpha > 0) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(color, 0.85 * coreAlpha)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, baseR * (1 + progress * 1.8), 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha(color, 0.7 * (1 - progress))
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()
  }

  // Bind simultaneous main-track notes with a translucent "strum" spine.
  private drawChordSpines(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    visibleEvents: readonly TabSceneEvent[],
    n: number,
    maxFret: number,
  ): void {
    for (const event of visibleEvents) {
      if (event.notes.length === 0) continue
      const t = beatsToDepth(
        event.startBeat - scene.playheadBeat,
        scene.visibleBeatWindow,
      )
      const near = clamp01(1 - (t * scene.visibleBeatWindow) / NEAR_BEATS)
      const pts = event.notes
        .map((note) => {
          const [x, y, z] = this.notePos(
            scene,
            note.stringIndex,
            note.fret,
            Math.max(t, 0),
            n,
            maxFret,
          )
          return this.project(x, y, z)
        })
        .filter((p) => p.w > NEAR)
        .sort((a, b) =>
          scene.presentation === 'string-highway' ? a.x - b.x : a.y - b.y,
        )
      if (pts.length === 0) continue
      if (pts.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.strokeStyle = `rgba(255,255,255,${(0.12 + 0.22 * near).toFixed(3)})`
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.stroke()
      }
      if (event.chordLabel !== undefined) {
        const anchor = pts[0]
        if (anchor === undefined) continue
        const label = event.chordLabel.slice(0, 18)
        ctx.font = '650 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        const width = Math.max(28, ctx.measureText(label).width + 12)
        const x =
          scene.presentation === 'string-highway'
            ? (pts[0]!.x + pts[pts.length - 1]!.x) / 2
            : Math.min(...pts.map((point) => point.x)) - width / 2 - 7
        const y = Math.min(...pts.map((point) => point.y)) - 10
        roundRect(ctx, x - width / 2, y - 15, width, 16, 5)
        ctx.fillStyle = this.reducedEffects(scene)
          ? 'rgba(23,17,13,0.92)'
          : 'rgba(23,17,13,0.78)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(242,201,143,0.42)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = 'rgba(253,243,228,0.9)'
        ctx.fillText(label, x, y - 2)
      }
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    note: TabSceneNote,
    t0: number,
    t1: number,
    n: number,
    maxFret: number,
    beatWindow: number,
    isNext: boolean,
  ): void {
    const stringColor = colorForString(
      scene.display.stringColors,
      note.stringIndex,
    )
    const color =
      scene.display.theme === 'velvet' && isNext ? '#f2c98f' : stringColor
    const headT = Math.max(t0, -0.03)
    const [hx, hy, hz] = this.notePos(
      scene,
      note.stringIndex,
      note.fret,
      headT,
      n,
      maxFret,
    )
    const head = this.project(hx, hy, hz)
    if (head.w <= NEAR) return
    const cell = this.targetSpanPx(
      scene,
      note.stringIndex,
      note.fret,
      headT,
      n,
      maxFret,
    )

    // Backing notes: quiet hollow ghost dots (clearly "not yours to play").
    if (note.isBacking) {
      ctx.beginPath()
      const radius =
        scene.presentation === 'string-highway'
          ? Math.min(8, Math.max(2, cell * 0.12))
          : Math.max(2, cell * 0.16)
      ctx.arc(head.x, head.y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha(color, 0.32)
      ctx.lineWidth = 1.5
      ctx.stroke()
      return
    }

    const ba = note.startBeat - scene.playheadBeat
    const near = clamp01(1 - ba / NEAR_BEATS)
    const far = clamp01((ba - 0.6 * beatWindow) / (0.4 * beatWindow))
    let alpha = 1 - far * 0.7
    if (t0 < 0) alpha *= clamp01(1 + t0 / 0.06) // fade just-passed notes out

    // Sustain ribbon along the flight line.
    if (t1 - t0 > 0.04) {
      const tEnd = Math.min(t1, 1)
      const [tx, ty, tz] = this.notePos(
        scene,
        note.stringIndex,
        note.fret,
        tEnd,
        n,
        maxFret,
      )
      const tail = this.project(tx, ty, tz)
      if (tail.w > NEAR) {
        const palmMuted =
          note.notation?.techniques?.some(
            (technique) => technique.kind === 'palm-mute',
          ) === true
        const letRing =
          note.notation?.techniques?.some(
            (technique) => technique.kind === 'let-ring',
          ) === true
        ctx.beginPath()
        ctx.moveTo(head.x, head.y)
        ctx.lineTo(tail.x, tail.y)
        ctx.strokeStyle = withAlpha(color, 0.3 * alpha)
        ctx.lineWidth =
          scene.presentation === 'string-highway'
            ? Math.min(12, Math.max(2, cell * (palmMuted ? 0.07 : 0.11)))
            : Math.max(2, cell * (palmMuted ? 0.2 : 0.32))
        ctx.lineCap = 'round'
        ctx.setLineDash(palmMuted ? [4, 4] : [])
        ctx.stroke()
        ctx.setLineDash([])
        if (letRing) {
          ctx.beginPath()
          ctx.arc(tail.x, tail.y, 3.5, 0, Math.PI * 2)
          ctx.strokeStyle = withAlpha(lighten(color, 0.45), 0.72 * alpha)
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }

    const w =
      scene.presentation === 'string-highway'
        ? this.stringHighwayTargetWidth(cell, near, isNext)
        : Math.max(
            scene.display.theme === 'velvet' && isNext
              ? Math.min(42, Math.max(34, this.cssWidth * 0.065))
              : 5,
            cell * 0.82 * (1 + near * 0.12) * (isNext ? 1.12 : 1),
          )
    const h = w * 0.66
    ctx.save()
    if (near > 0 && !this.reducedEffects(scene)) {
      ctx.shadowColor = color
      ctx.shadowBlur = 16 * near * near
    }
    const x0 = head.x - w / 2
    const y0 = head.y - h / 2
    if (far > 0) {
      // Distant notes: outline only, so the near ones read as solid.
      roundRect(ctx, x0, y0, w, h, Math.min(5, h / 3))
      ctx.strokeStyle = withAlpha(color, alpha)
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      ctx.fillStyle = withAlpha(color, alpha)
      roundRect(ctx, x0, y0, w, h, Math.min(5, h / 3))
      ctx.fill()
      if (isNext) {
        ctx.strokeStyle = lighten(color, 0.5)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
    ctx.restore()

    const fontPx = Math.max(
      7,
      Math.min(scene.display.theme === 'velvet' && isNext ? 16 : 13, w * 0.5),
    )
    if (fontPx >= 8 && far === 0) {
      const label =
        scene.presentation === 'string-highway' || !scene.showNoteLabels
          ? String(note.fret)
          : note.noteName
      ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = withAlpha(luminanceInkInverse(color), 0.5)
      ctx.lineWidth = 2
      ctx.strokeText(label, head.x, head.y)
      ctx.fillStyle = labelInk(color)
      ctx.fillText(label, head.x, head.y)
    }
  }

  /** Source-authored technique marks stay restrained and never invent intent. */
  private drawTechniqueMarks(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    visible: readonly { note: TabSceneNote; t0: number; t1: number }[],
    n: number,
    maxFret: number,
  ): void {
    ctx.save()
    ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const entry of visible) {
      const techniques = entry.note.notation?.techniques
      if (entry.note.isBacking || techniques === undefined) continue
      const headT = Math.max(entry.t0, -0.03)
      const [hx, hy, hz] = this.notePos(
        scene,
        entry.note.stringIndex,
        entry.note.fret,
        headT,
        n,
        maxFret,
      )
      const head = this.project(hx, hy, hz)
      if (head.w <= NEAR) continue
      const ink = 'rgba(253,243,228,0.84)'
      const line = 'rgba(242,201,143,0.72)'
      let textRow = 0

      for (const technique of techniques) {
        if (
          technique.kind === 'hammer-on' ||
          technique.kind === 'pull-off' ||
          technique.kind === 'slide'
        ) {
          const slideInFret =
            technique.kind === 'slide'
              ? slideInSourceFret(technique.slideType, entry.note.fret, maxFret)
              : undefined
          const slideOutFret =
            technique.kind === 'slide'
              ? slideOutTargetFret(
                  technique.slideType,
                  entry.note.fret,
                  maxFret,
                )
              : undefined
          const target =
            technique.toNoteId === undefined
              ? undefined
              : scene.noteById.get(technique.toNoteId)
          const targetFret =
            linkedTechniqueTargetFret(technique.toFret, target?.fret) ??
            slideOutFret
          const targetStart = target?.startBeat
          let tx = head.x + 22
          let ty = head.y - 12
          if (slideInFret !== undefined && technique.kind === 'slide') {
            const sourceT = beatsToDepth(
              entry.note.startBeat - 0.35 - scene.playheadBeat,
              scene.visibleBeatWindow,
            )
            const [worldX, worldY, worldZ] = this.notePos(
              scene,
              entry.note.stringIndex,
              slideInFret,
              Math.max(-0.03, sourceT),
              n,
              maxFret,
            )
            const projectedSource = this.project(worldX, worldY, worldZ)
            if (projectedSource.w > NEAR) {
              tx = projectedSource.x
              ty = projectedSource.y
            }
            if (scene.presentation === 'string-highway') {
              const pitchDirection =
                technique.slideType === 'into-from-below' ? -1 : 1
              const handedDirection = scene.display.leftHanded ? -1 : 1
              tx = head.x + pitchDirection * handedDirection * 22
              ty = head.y + 12
            }
          } else if (targetFret !== undefined) {
            const targetT = beatsToDepth(
              (targetStart ?? entry.note.startBeat + 0.35) - scene.playheadBeat,
              scene.visibleBeatWindow,
            )
            const [worldX, worldY, worldZ] = this.notePos(
              scene,
              target?.stringIndex ?? entry.note.stringIndex,
              targetFret,
              Math.max(-0.03, targetT),
              n,
              maxFret,
            )
            const projectedTarget = this.project(worldX, worldY, worldZ)
            if (projectedTarget.w > NEAR) {
              tx = projectedTarget.x
              ty = projectedTarget.y
            }
            if (
              slideOutFret !== undefined &&
              technique.kind === 'slide' &&
              scene.presentation === 'string-highway'
            ) {
              const pitchDirection =
                technique.slideType === 'out-up' ||
                technique.slideType === 'pick-slide-up'
                  ? 1
                  : -1
              const handedDirection = scene.display.leftHanded ? -1 : 1
              tx = head.x + pitchDirection * handedDirection * 22
              ty = head.y - 12
            }
          }
          ctx.beginPath()
          if (slideInFret !== undefined && technique.kind === 'slide') {
            ctx.moveTo(tx, ty)
            ctx.lineTo(head.x, head.y - 6)
          } else {
            ctx.moveTo(head.x, head.y - 6)
          }
          if (technique.kind === 'slide' && slideInFret === undefined) {
            ctx.lineTo(tx, ty)
          } else if (technique.kind !== 'slide') {
            ctx.quadraticCurveTo(
              (head.x + tx) / 2,
              Math.min(head.y, ty) - 12,
              tx,
              ty,
            )
          }
          ctx.strokeStyle = line
          ctx.stroke()
          ctx.fillStyle = ink
          const markLabel =
            technique.kind === 'slide'
              ? slideMarkLabel(technique.slideType)
              : technique.kind === 'hammer-on'
                ? 'H'
                : 'P'
          ctx.fillText(markLabel, (head.x + tx) / 2, Math.min(head.y, ty) - 7)
          continue
        }

        if (technique.kind === 'bend') {
          const topY = head.y - 25
          const bottomX = head.x + 4
          const bottomY = head.y - 5
          const topX = head.x + 10
          const motion = bendVisualMotion(technique.bendType)
          ctx.beginPath()
          if (motion === 'down') {
            ctx.moveTo(topX, topY)
            ctx.quadraticCurveTo(head.x + 17, head.y - 18, bottomX, bottomY)
            ctx.lineTo(bottomX + 1, bottomY - 5)
            ctx.moveTo(bottomX, bottomY)
            ctx.lineTo(bottomX + 5, bottomY - 2)
          } else if (motion === 'up-down') {
            ctx.moveTo(bottomX, bottomY)
            ctx.quadraticCurveTo(head.x + 17, head.y - 18, topX, topY)
            ctx.quadraticCurveTo(head.x + 21, head.y - 15, bottomX + 9, bottomY)
            ctx.lineTo(bottomX + 10, bottomY - 5)
            ctx.moveTo(bottomX + 9, bottomY)
            ctx.lineTo(bottomX + 14, bottomY - 2)
          } else if (motion === 'hold') {
            ctx.moveTo(bottomX, head.y - 16)
            ctx.lineTo(head.x + 22, head.y - 16)
            ctx.moveTo(bottomX, head.y - 20)
            ctx.lineTo(bottomX, head.y - 12)
            ctx.moveTo(head.x + 22, head.y - 20)
            ctx.lineTo(head.x + 22, head.y - 12)
          } else {
            ctx.moveTo(bottomX, bottomY)
            ctx.quadraticCurveTo(head.x + 17, head.y - 18, topX, topY)
            ctx.lineTo(head.x + 7, topY + 4)
            ctx.moveTo(topX, topY)
            ctx.lineTo(head.x + 13, topY + 4)
          }
          ctx.strokeStyle = line
          ctx.stroke()
          ctx.fillStyle = ink
          ctx.textAlign = 'left'
          const prefix = technique.bendType.startsWith('prebend')
            ? 'pre '
            : motion === 'down'
              ? 'rel '
              : motion === 'hold'
                ? 'hold '
                : ''
          ctx.fillText(
            `${prefix}${bendAmountLabel(technique.semitones)}`,
            head.x + 15,
            topY + 1,
          )
          ctx.textAlign = 'center'
          continue
        }

        if (technique.kind === 'vibrato') {
          const y = head.y - 14
          ctx.beginPath()
          ctx.moveTo(head.x - 13, y)
          const width = technique.width === 'wide' ? 5 : 3
          for (let step = 1; step <= 6; step += 1) {
            ctx.lineTo(
              head.x - 13 + step * 4.4,
              y + (step % 2 === 0 ? -width : width),
            )
          }
          ctx.strokeStyle = line
          ctx.stroke()
          continue
        }

        const label = technique.kind === 'palm-mute' ? 'PM' : 'LR'
        ctx.fillStyle = ink
        ctx.fillText(label, head.x, head.y + 16 + textRow * 10)
        textRow += 1
      }
    }
    ctx.restore()
  }

  /** Let targets breathe while guaranteeing dense 8-string chords never touch. */
  private stringHighwayTargetWidth(
    laneSpacing: number,
    near: number,
    isNext: boolean,
  ): number {
    const overlapSafeMaximum = Math.max(7, laneSpacing * 0.78)
    const desired = laneSpacing * 0.58 * (1 + near * 0.08) * (isNext ? 1.08 : 1)
    const nextTargetFloor = isNext
      ? Math.min(42, Math.max(34, this.cssWidth * 0.065))
      : 7
    return Math.min(
      overlapSafeMaximum,
      isNext ? 56 : 44,
      Math.max(nextTargetFloor, desired),
    )
  }

  // Scored-hit feedback: an expanding ring + core on the cell, coloured by
  // accuracy, fading over HIT_FLASH_MS. Input scoring (mic/MIDI).
  private drawHits(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
  ): void {
    if (scene.hits.length === 0) return
    const now = Date.now()
    ctx.save()
    if (!this.reducedEffects(scene)) ctx.globalCompositeOperation = 'lighter'
    for (const h of scene.hits) {
      const age = now - h.at
      if (age < 0 || age > HIT_FLASH_MS) continue
      const k = 1 - age / HIT_FLASH_MS
      const [x, y, z] = this.notePos(
        scene,
        h.stringIndex,
        h.fret,
        0,
        n,
        maxFret,
      )
      const p = this.project(x, y, z)
      if (p.w <= NEAR) continue
      const color =
        h.timing === 'perfect'
          ? '#22c55e'
          : h.timing === 'great'
            ? '#4ade80'
            : '#eab308'
      const uncappedRadius = Math.max(
        7,
        this.targetSpanPx(scene, h.stringIndex, h.fret, 0, n, maxFret) * 0.5,
      )
      const baseR =
        scene.presentation === 'string-highway'
          ? Math.min(36, uncappedRadius)
          : uncappedRadius
      ctx.beginPath()
      ctx.arc(p.x, p.y, baseR * (1 + (1 - k) * 1.6), 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha(color, 0.85 * k)
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(p.x, p.y, baseR * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(color, 0.5 * k)
      ctx.fill()
      // Accuracy is also encoded by one, two, or three crown ticks so the
      // result never depends on the green/amber palette alone.
      const tickCount =
        h.timing === 'perfect' ? 3 : h.timing === 'great' ? 2 : 1
      ctx.strokeStyle = withAlpha('#ffffff', 0.82 * k)
      ctx.lineWidth = 2
      for (let tick = 0; tick < tickCount; tick += 1) {
        const angle =
          -Math.PI / 2 + (tick - (tickCount - 1) / 2) * (Math.PI / 8)
        ctx.beginPath()
        ctx.moveTo(
          p.x + Math.cos(angle) * baseR * 0.78,
          p.y + Math.sin(angle) * baseR * 0.78,
        )
        ctx.lineTo(
          p.x + Math.cos(angle) * baseR * 1.18,
          p.y + Math.sin(angle) * baseR * 1.18,
        )
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // The player's detected input note, marked on its neck cell (green when it
  // matches the current target, else neutral); pulses, alpha by confidence.
  private drawDetected(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
  ): void {
    const d = scene.detected
    if (d === null) return
    const inferredPosition =
      scene.presentation === 'string-highway' && !d.matchesTarget
        ? ([0, LANE_HEIGHT, 0] as const)
        : this.notePos(scene, d.stringIndex, d.fret, 0, n, maxFret)
    const p = this.project(
      inferredPosition[0],
      inferredPosition[1],
      inferredPosition[2],
    )
    if (p.w <= NEAR) return
    const uncappedRadius = Math.max(
      8,
      this.targetSpanPx(scene, d.stringIndex, d.fret, 0, n, maxFret) * 0.55,
    )
    const r =
      scene.presentation === 'string-highway'
        ? Math.min(36, uncappedRadius)
        : uncappedRadius
    const pulse = this.reducedMotion(scene)
      ? 0.82
      : 0.6 + 0.4 * Math.sin(performance.now() / 180)
    const color = d.matchesTarget ? '#22c55e' : '#e8ecf5'
    const alpha = Math.min(1, 0.4 + d.clarity * 0.6) * pulse
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(color, alpha)
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, Math.min(1, 0.6 + d.clarity * 0.4))
    ctx.fill()
  }

  dispose(): void {
    this.canvas = null
    this.ctx = null
  }
}

/** Halo colour: the opposite of the readable ink, for a thin outline. */
function luminanceInkInverse(bg: string): string {
  return labelInk(bg) === '#ffffff' ? '#000000' : '#ffffff'
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
