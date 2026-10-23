// ============================================================
// Lesson 5 one hold — Listen · Breathe · Sing, then the reading
// ============================================================
//
// One take of a hold (WEB-SPEC, Toys 6, state 6). Listen: Merc sings the
// note for 2.0 s, the singing Merc in `sing`, the other listening. Breathe:
// the ring breathes once over 2 s from the end of his note, and nothing
// counts down. Sing: the ring turns and closes over the hold while the
// violet line draws on a fixed 10- or 15-second frame, folded into Merc's
// octave, and Merc and Tavi both listen.
//
// The take opens 0.4 s after Merc's note ends, once his "ooh" and its
// release have died away, during the Breathe ring, so a voice that starts
// as the breath turns is caught and nobody sits holding a breath for a cue
// (FACTS 56, 65). It waits up to 6 s from opening for the first voiced
// frame, then runs exactly the hold's length from it, timed on the frames'
// own clock; it ends sooner only if the voice stops for more than a second.
// Nothing on the page extends it, and nothing plays while it is open
// (`Sound.hush`). The reading comes from the kit's hold reader
// (kit/hold-take.ts), loaded with the listener after Start.

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { wait } from '@/features/lessons/kit/dom'
import type * as HoldKit from '@/features/lessons/kit/hold-take'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type * as ListenKit from '@/features/lessons/kit/listen'
import type { Listener, PitchFrame } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen, mercSing } from '@/features/lessons/kit/merc-duo'
import { hz, sharpOf, wordName } from '@/features/lessons/kit/notes'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import type { HoldPhase, SingView } from './sing-view'

/** The listener chunk and the hold reader, loaded when Start is pressed. */
export type ListenModule = typeof ListenKit
export type HoldModule = typeof HoldKit

/** Seconds of Merc's note, of the gap before the take opens, and of the in-breath. */
export const MERC_SEC = 2
export const GAP_SEC = 0.4
export const BREATHE_SEC = 2

export interface HoldContext {
  readonly mod: ListenModule
  readonly reader: HoldModule
  readonly listener: Listener
  readonly view: SingView
  readonly which: Which
  readonly midi: number
  /** The hold's length, seconds: 10 or 15. */
  readonly length: number
  /** The ring's label: "A3 · 220 Hz". */
  readonly label: string
  readonly cancelled: () => boolean
  /** Each phase as it begins. */
  readonly onPhase: (p: HoldPhase) => void
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
  s.lit = Math.abs(folded) <= HIT_TOLERANCE_CENTS
  c.view.now(bandWords(folded))
}

/** Merc's note and the in-breath, up to the take's opening: false if the viewer left meanwhile. */
async function lead(c: HoldContext, chart: BandChart): Promise<boolean> {
  const other: Which = c.which === 'blue' ? 'orange' : 'blue'
  const audible = Sound.canPlay()
  c.onPhase('listen')
  mercSing(c.which, c.midi, true)
  mercListen(other, true)
  chart.scene.glow = 1
  void c.view.ring.run({
    which: c.which,
    label: c.label,
    listen: MERC_SEC,
    breathe: BREATHE_SEC,
    turn: 0,
    // no voice yet when the in-breath ends: the ring waits on "Sing"
    words: { done: 'Sing' },
  })
  await playTone(hz(c.midi), MERC_SEC, { kind: 'merc', audible })
  chart.scene.glow = 0
  mercSing(c.which, c.midi, false)
  mercListen(other, false)
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
  if (!(await lead(c, chart))) return null
  const seen = new Set<number>()
  let singing = false
  let turning = false
  const sing = (): void => {
    if (singing) return
    singing = true
    c.onPhase('sing')
  }
  // the in-breath ends 2 s after Merc's note: the cue to sing, if the voice has not come already
  const cue = window.setTimeout(sing, (BREATHE_SEC - GAP_SEC) * 1000)
  Sound.hush(true)
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
        drawFrame(c, frame, voicedAt, seen)
      },
    })
    return frames === null ? null : c.reader.readHold(frames, c.midi, c.length)
  } finally {
    window.clearTimeout(cue)
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    chart.scene.head = null
    // the ring stops with the take: a hold stopped early leaves no count running
    void ring.run({ which: c.which, label: c.label, listen: 0, turn: 0 })
  }
}

/** The chart's words after a hold: "Merc's note A3; your line in the band for 8.4 of 10 seconds, ...". */
export function holdSummaryFor(
  reader: HoldModule,
  midi: number,
  r: HoldReading,
): string {
  return reader.holdChartWords(wordName(sharpOf(midi)), r)
}
