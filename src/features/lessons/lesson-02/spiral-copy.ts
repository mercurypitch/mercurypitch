// ============================================================
// Lesson 2 spiral copy — the kit's spiral with the Climb and Look down
// ============================================================
//
// Every spiral on the page is its own copy of the kit's (kit/spiral.ts),
// with its own lit beads (DECISIONS 81): the five dim "?" beads on each turn
// light once heard on that copy, so the hero's climb leaves step 1's dim.
//   - Climb plays the thirteen notes from A3 to A4 at the film's timing
//     (FACTS 43), lights each bead as it sounds, draws a trail up the turn,
//     counts the steps from 0 on A3 to 12 on A4 (steps, not notes: FACTS 16)
//     and shows each note's frequency in whole hertz (the kit's readout),
//     with a gold "· Hz × 2" (the hertz doubled) at the end.
//   - Look down moves the camera onto the spiral's axis: one turn becomes the
//     ring of twelve, its wedges lit in gold; pressed again it returns.
// Under reduced motion the trail and the camera land at once.

import { clamp, q, TAU } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { Spiral, SpiralFrame, SpiralOptions, } from '@/features/lessons/kit/spiral'
import { mountSpiral } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import type { NoteEvent } from './examples'
import { CLIMB, schedule } from './examples'

/** A3 as semitones from A2, where the climb and the ring of twelve begin. */
const A3_S = 12

/** The trail up the turn: from A3 to the note the climb has reached. */
interface Trail {
  start(now: number): void
  reach(k: number, now: number): void
  end(now: number): void
  draw(f: SpiralFrame): void
}

function beadAt(beads: readonly BeadHit[], s: number): BeadHit | undefined {
  return beads.find((b) => b.s === s)
}

function createTrail(): Trail {
  let from: number | null = null
  let reached = 0
  let reachedAt = 0
  let endedAt: number | null = null

  function alphaAt(now: number): number {
    if (endedAt === null) return 1
    if (reducedMotion()) return now - endedAt < 4000 ? 1 : 0
    return 1 - clamp((now - endedAt - 3000) / 1000, 0, 1)
  }

  return {
    start(now) {
      from = now
      reached = 0
      reachedAt = now
      endedAt = null
    },
    reach(k, now) {
      reached = k
      reachedAt = now
    },
    end(now) {
      endedAt = now
    },
    draw(f) {
      if (from === null || f.u > 0.05) return
      const alpha = alphaAt(f.now)
      if (alpha <= 0) {
        from = null
        return
      }
      // the newest stretch draws over 0.3 s; under reduced motion it is there at once
      const grow = reducedMotion() ? 1 : clamp((f.now - reachedAt) / 300, 0, 1)
      const pts: { x: number; y: number }[] = []
      for (let k = 0; k <= reached; k++) {
        const b = beadAt(f.beads, A3_S + k)
        if (b !== undefined) pts.push(b)
      }
      if (pts.length < 2) return
      const last = pts[pts.length - 1]
      const prev = pts[pts.length - 2]
      pts[pts.length - 1] = {
        x: prev.x + (last.x - prev.x) * grow,
        y: prev.y + (last.y - prev.y) * grow,
      }
      const { ctx } = f
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const [w, a] of [
        [9, 0.12],
        [2.4, 0.85],
      ] as const) {
        ctx.strokeStyle = rgba(COLOR.chrome, a * alpha)
        ctx.lineWidth = w
        ctx.beginPath()
        pts.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        )
        ctx.stroke()
      }
      ctx.restore()
    },
  }
}

/** Looking down the axis: the ring of twelve's wedges, lit in gold as the camera arrives. */
function drawWedges(f: SpiralFrame, top: number): void {
  if (top < 0.02 || f.u > 0.05) return
  const ring: BeadHit[] = []
  for (let k = 0; k < 12; k++) {
    const b = beadAt(f.beads, A3_S + k)
    if (b === undefined) return
    ring.push(b)
  }
  const cx = ring.reduce((n, b) => n + b.x, 0) / 12
  const cy = ring.reduce((n, b) => n + b.y, 0) / 12
  const R = ring.reduce((n, b) => n + Math.hypot(b.x - cx, b.y - cy), 0) / 12
  const angles = ring.map((b) => Math.atan2(b.y - cy, b.x - cx))
  const { ctx } = f
  ctx.save()
  ctx.lineWidth = 1.2
  for (let k = 0; k < 12; k++) {
    const a0 = angles[k]
    // the short way round to the next bead, whichever way the ring runs on screen
    let d = angles[(k + 1) % 12] - a0
    if (d > Math.PI) d -= TAU
    if (d <= -Math.PI) d += TAU
    const back = d < 0
    const gap = 0.035 * Math.sign(d)
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.78, a0 + gap, a0 + d - gap, back)
    ctx.arc(cx, cy, R * 0.22, a0 + d - gap, a0 + gap, !back)
    ctx.closePath()
    ctx.fillStyle = rgba(COLOR.gold, 0.16 * top)
    ctx.strokeStyle = rgba(COLOR.gold, 0.6 * top)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

export interface Climb {
  readonly busy: boolean
  /** Plays the climb on this copy (silently when `audible` is false); resolves after A4. */
  run(audible: boolean): Promise<void>
}

export interface SpiralCopy {
  readonly spiral: Spiral
  readonly climb: Climb
  /** Looks down the axis, or back from the side. */
  setLookDown(on: boolean): void
  readonly lookingDown: boolean
}

export interface CopyOptions extends Omit<
  SpiralOptions,
  'overlay' | 'lightOnPlay'
> {
  /** Hears each note of the climb as it starts (the hero's Mercs sing A3 and A4). */
  readonly onClimbNote?: (e: NoteEvent, k: number) => void
}

/** The parts of the climb's readout a copy has: the steps line, its count, the gold "· Hz × 2" and the spoken line. */
interface ClimbParts {
  readonly row: HTMLElement | null
  readonly steps: HTMLElement | null
  readonly x2: HTMLElement | null
  readonly said: HTMLElement | null
}

function climbParts(root: HTMLElement): ClimbParts {
  return {
    row: root.querySelector<HTMLElement>('[data-climb-ro]'),
    steps: root.querySelector<HTMLElement>('[data-climb-steps]'),
    x2: root.querySelector<HTMLElement>('[data-climb-x2]'),
    said: root.querySelector<HTMLElement>('[data-climb-said]'),
  }
}

/**
 * Mounts a spiral copy on `root`, with a Climb (`[data-climb]`) and a Look
 * down (`[data-look-down]`) button if the root holds them.
 */
export function mountSpiralCopy(
  root: HTMLElement,
  opts: CopyOptions = {},
): SpiralCopy {
  const trail = createTrail()
  let looking = false
  const spiral: Spiral = mountSpiral(root, {
    ...opts,
    lightOnPlay: true,
    overlay: (f) => {
      trail.draw(f)
      drawWedges(f, spiral.top)
    },
  })
  const parts = climbParts(root)
  let busy = false

  async function run(audible: boolean): Promise<void> {
    if (busy) return
    busy = true
    if (parts.row !== null) parts.row.hidden = false
    root.classList.add('has-climb')
    if (parts.x2 !== null) parts.x2.hidden = true
    if (parts.said !== null) parts.said.textContent = ''
    spiral.setTurning(false)
    trail.start(performance.now())
    await schedule(CLIMB, (e, k) => {
      void spiral.play(e.midi, { audible, dur: e.dur })
      if (parts.steps !== null) parts.steps.textContent = String(k)
      trail.reach(k, performance.now())
      opts.onClimbNote?.(e, k)
    })
    if (parts.x2 !== null) parts.x2.hidden = false
    if (parts.said !== null)
      parts.said.textContent =
        'Twelve steps from A3 to A4: 220 hertz doubled to 440.'
    trail.end(performance.now())
    spiral.setTurning(!looking)
    busy = false
  }

  const lookBtn = root.querySelector<HTMLButtonElement>('[data-look-down]')

  function setLookDown(on: boolean): void {
    looking = on
    spiral.setView(on ? 'top' : 'side')
    spiral.setTurning(!on)
    if (lookBtn === null) return
    lookBtn.setAttribute('aria-pressed', String(on))
    q('span', lookBtn).textContent = on ? 'Look from the side' : 'Look down'
  }
  lookBtn?.addEventListener('click', () => setLookDown(!looking))

  const climbBtn = root.querySelector<HTMLButtonElement>('[data-climb]')
  climbBtn?.addEventListener('click', () => {
    if (busy) return
    climbBtn.classList.add('is-on')
    void run(Sound.canPlay()).then(() => climbBtn.classList.remove('is-on'))
  })

  return {
    spiral,
    climb: {
      get busy() {
        return busy
      },
      run,
    },
    setLookDown,
    get lookingDown() {
      return looking
    },
  }
}
