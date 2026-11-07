// ============================================================
// Hold run — one take of a held note: Listen · Breathe · Sing, then the reading
// ============================================================
//
// One take of a hold, as Lessons 5 and 13 sing it. Listen: Merc's
// demonstration, which the page passes in (Lesson 5's note for 2.0 s,
// Lesson 13's five vowels for ten seconds), the singing Merc in `sing` and
// the other listening; a demonstration cut short, by another sound or by
// leaving, ends the take before it opens. Breathe: the ring breathes once
// over 2 s from the end of the demonstration, and nothing counts down.
// Sing: the ring turns and closes over the hold while the violet line draws
// on the hold's fixed frame, folded into Merc's octave, and Merc and Tavi
// both listen.
//
// The take opens 0.4 s after the demonstration ends, once Merc's "ooh" and
// its release have died away, during the Breathe ring, so a voice that
// starts as the breath turns is caught and nobody sits holding a breath for
// a cue (Lesson 5 FACTS 56, 65). It waits up to 6 s from opening for the
// first voiced frame, then runs exactly the hold's length from it, timed on
// the frames' own clock; it ends sooner only if the voice stops for more
// than a second. Nothing extends it, and nothing plays while it is open
// (`Sound.hush`). The reading comes from the kit's hold reader
// (hold-take.ts), loaded with the listener after Start; `onSung` hears the
// seconds since the first voiced frame on each frame, for a page that
// paces cues by them (Lesson 13's vowel names). A page may keep the band
// state to itself while the take runs (`live: false`, Lesson 22, whose
// vibrato would flip it on every swing): from the Listen phase to the
// take's end the band's edge does not light, it does not glow and nothing
// names where the voice is against it.
//
// A take may sound one thing: a drone the page starts in the Listen phase
// (Lesson 24's do, 2.0 s before the in-breath, both Mercs listening), kept
// through the take while every other sound is held off (`kept`,
// `Sound.hush`), and released over 0.3 s as the take ends.

import type { BandChart } from './band-chart'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { wait } from './dom'
import type * as HoldKit from './hold-take'
import type { HoldReading } from './hold-take'
import type * as ListenKit from './listen'
import type { Listener, PitchFrame } from './listen'
import type { Which } from './merc-duo'
import { mercListen, mercSing } from './merc-duo'
import type { Ring } from './sing'
import type { Voice } from './sound'
import { Sound } from './sound'

/** The listener chunk and the hold reader, loaded when Start is pressed. */
export type ListenModule = typeof ListenKit
export type HoldModule = typeof HoldKit

/** Seconds of the gap before the take opens, and of the in-breath. */
export const GAP_SEC = 0.4
export const BREATHE_SEC = 2
/** Seconds a kept drone releases over as the take ends. */
export const DRONE_RELEASE_SEC = 0.3

/** A hold's three phases, as the ring and the line above it name them. */
export type HoldPhase = 'listen' | 'breathe' | 'sing'

/** What a take draws on: the hold's chart, its ring, and the band state in words. */
export interface HoldView {
  readonly chart: BandChart
  readonly ring: Ring
  /** The band state in words, beside the chart's mint edge: "in the band". */
  now(text: string): void
}

/** Merc's Listen phase: its seconds on the ring, and the demonstration itself, false if it was cut short. */
export interface HoldListen {
  readonly sec: number
  play(audible: boolean): Promise<boolean>
  /** Whether the singing Merc sings in it: false, and both listen (Lesson 24's drone). */
  readonly mercSings?: boolean
}

export interface HoldContext {
  readonly mod: ListenModule
  readonly reader: HoldModule
  readonly listener: Listener
  readonly view: HoldView
  readonly which: Which
  readonly midi: number
  /** The hold's length, seconds: 10 or 15. */
  readonly length: number
  /** The ring's label: "A3 · 220 Hz". */
  readonly label: string
  /** Whether the band lights, glows and is named as the take runs: on unless false. */
  readonly live?: boolean
  readonly listen: HoldListen
  readonly cancelled: () => boolean
  /** Each phase as it begins. */
  readonly onPhase: (p: HoldPhase) => void
  /** Each frame once the voice has come: the seconds since its first voiced frame. */
  readonly onSung?: (t: number) => void
  /** The drone the Listen phase started, kept sounding through the take and released as it ends (Lesson 24). */
  readonly kept?: () => Voice | null
}

/** The band state in words, for the line beside the chart: never colour alone (REQ-GVC-082). */
export function bandWords(folded: number): string {
  if (Math.abs(folded) <= HIT_TOLERANCE_CENTS) return 'in the band'
  return folded < 0 ? 'below the band' : 'above the band'
}

/** Draws one frame of the live line, from the voice's first frame on. */
function drawFrame(
  c: HoldContext,
  frame: PitchFrame | null,
  voicedAt: number,
  seen: Set<number>,
): void {
  if (frame === null || seen.has(frame.t)) return
  seen.add(frame.t)
  const s = c.view.chart.scene
  const t = frame.t - voicedAt
  const voiced = frame.f0 > 0 && frame.conf >= 0.5
  if (!voiced || t < 0) {
    s.line.push({ t: Math.max(0, t), c: null })
    return
  }
  const folded = c.mod.foldCents(c.mod.hzToCents(frame.f0) - c.midi * 100)
  s.line.push({ t, c: folded })
  s.head = { t, c: folded }
  if (c.live === false) return
  s.lit = Math.abs(folded) <= HIT_TOLERANCE_CENTS
  c.view.now(bandWords(folded))
}

/** Merc's demonstration and the in-breath, up to the take's opening: false if it was cut short or the viewer left meanwhile. */
async function lead(c: HoldContext, chart: BandChart): Promise<boolean> {
  const other: Which = c.which === 'blue' ? 'orange' : 'blue'
  const sings = c.listen.mercSings !== false
  const audible = Sound.canPlay()
  c.onPhase('listen')
  if (sings) mercSing(c.which, c.midi, true)
  else mercListen(c.which, true)
  mercListen(other, true)
  if (c.live !== false) chart.scene.glow = 1
  void c.view.ring.run({
    which: c.which,
    label: c.label,
    listen: c.listen.sec,
    breathe: BREATHE_SEC,
    turn: 0,
    // no voice yet when the in-breath ends: the ring waits on "Sing"
    words: { done: 'Sing' },
  })
  const heard = await c.listen.play(audible)
  chart.scene.glow = 0
  if (sings) mercSing(c.which, c.midi, false)
  else mercListen(c.which, false)
  mercListen(other, false)
  if (!heard) {
    c.view.ring.stop()
    return false
  }
  c.onPhase('breathe')
  await wait(GAP_SEC)
  return !c.cancelled()
}

/** One take of a hold: the reading, or null if the take was cancelled. */
export async function holdOne(c: HoldContext): Promise<HoldReading | null> {
  const { chart, ring } = c.view
  chart.setTarget(c.midi)
  chart.setWindow(c.length)
  c.view.now('–')
  if (!(await lead(c, chart))) {
    c.kept?.()?.stop()
    return null
  }
  const seen = new Set<number>()
  let singing = false
  let turning = false
  const sing = (): void => {
    if (singing) return
    singing = true
    c.onPhase('sing')
  }
  // the in-breath ends 2 s after Merc's demonstration: the cue to sing, if the voice has not come already
  const cue = window.setTimeout(sing, (BREATHE_SEC - GAP_SEC) * 1000)
  Sound.hush(true, c.kept?.() ?? null)
  mercListen('blue', true)
  mercListen('orange', true)
  try {
    const frames = await c.mod.takeFrames(c.listener, {
      wait: c.reader.HOLD_WAIT_SEC,
      run: c.length,
      quiet: c.reader.HOLD_QUIET_SEC,
      cancelled: c.cancelled,
      onFrame(frame, voicedAt) {
        if (voicedAt === null) return
        if (!turning) {
          // the voice has come: the ring turns from here, over the hold
          turning = true
          sing()
          void ring.run({
            which: c.which,
            label: c.label,
            listen: 0,
            turn: c.length,
            ripples: false,
            exhale: true,
          })
        }
        if (frame !== null) c.onSung?.(Math.max(0, frame.t - voicedAt))
        drawFrame(c, frame, voicedAt, seen)
      },
    })
    return frames === null ? null : c.reader.readHold(frames, c.midi, c.length)
  } finally {
    window.clearTimeout(cue)
    c.kept?.()?.stop(DRONE_RELEASE_SEC)
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    chart.scene.head = null
    // the ring stops with the take: a hold stopped early leaves no count running
    void ring.run({ which: c.which, label: c.label, listen: 0, turn: 0 })
  }
}
