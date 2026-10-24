// ============================================================
// Lesson 3 one take — Merc's note, the gap, the viewer's three seconds
// ============================================================
//
// Merc sings the note for 2.0 s (the singing Merc in `sing`, the other
// listening), then the page waits 0.4 s, until his "ooh" and its 0.34 s
// release have died away, so his note never enters the take: analysis
// capture runs with echo cancellation off. The take then waits up to 6 s
// for the first voiced frame and runs 3 s from it (WEB-SPEC, Toys 7). While
// it is open the page plays nothing (`Sound.hush`), Merc and Tavi both listen,
// the ring counts the three seconds, and the violet line draws live on the band
// chart, folded into Merc's octave, with a small "octave lower" tag while it
// sits within 50 cents of his note and the gap readout following it.

import { BAND_WORDS, gapWords, octavesOf, octaveTag, signedCents, } from '@/features/lessons/kit/band-words'
import { wait } from '@/features/lessons/kit/dom'
import type * as ListenKit from '@/features/lessons/kit/listen'
import type { Listener, PitchFrame, TakeReading, } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen, mercSing } from '@/features/lessons/kit/merc-duo'
import { hz, sharpOf, wordName } from '@/features/lessons/kit/notes'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import type { SingView } from './sing-view'

/** The listener chunk, loaded when Start is pressed. */
export type ListenModule = typeof ListenKit

/** Seconds of Merc's note, of the gap after it, of the wait for a voice and of the take. */
export const MERC_SEC = 2
export const GAP_SEC = 0.4
export const WAIT_SEC = 6
export const RUN_SEC = 3

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  readonly view: SingView
  readonly which: Which
  readonly midi: number
  /** The ring's label: "A3 · 220 Hz". */
  readonly label: string
  readonly cancelled: () => boolean
  /** Merc has sung: the viewer's turn. */
  readonly onTurn: () => void
}

/** The live gap: signed cents within the chart, the distance in semitones beyond it. */
export function liveGap(folded: number, mod: ListenModule): string {
  if (Math.abs(folded) <= 150) return `${signedCents(folded)} cents`
  return mod.semitonesAway(folded)
}

/** Draws one frame of the live line. */
function drawFrame(
  c: TakeContext,
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
  const raw = c.mod.hzToCents(frame.f0) - c.midi * 100
  const folded = c.mod.foldCents(raw)
  s.line.push({ t, c: folded })
  s.head = { t, c: folded }
  s.lit = Math.abs(folded) <= 35
  c.view.gap(liveGap(folded, c.mod))
  c.view.octaveTag(octaveTag(octavesOf(raw, folded), folded))
}

/** Merc's note, then the take; the reading, or null if the take was cancelled. */
export async function singOne(c: TakeContext): Promise<TakeReading | null> {
  const other: Which = c.which === 'blue' ? 'orange' : 'blue'
  const { chart, ring } = c.view
  chart.setTarget(c.midi)
  c.view.gap('–')
  c.view.octaveTag(null)
  const audible = Sound.canPlay()
  mercSing(c.which, c.midi, true)
  mercListen(other, true)
  chart.scene.glow = 1
  void ring.run({
    which: c.which,
    label: c.label,
    listen: MERC_SEC + GAP_SEC,
    turn: 0,
  })
  await playTone(hz(c.midi), MERC_SEC, { kind: 'merc', audible })
  chart.scene.glow = 0
  mercSing(c.which, c.midi, false)
  mercListen(other, false)
  await wait(GAP_SEC)
  if (c.cancelled()) return null

  c.onTurn()
  c.view.ringState('Your turn')
  const seen = new Set<number>()
  let turning = false
  // nothing plays while the take is open, whatever happens to it
  Sound.hush(true)
  mercListen('blue', true)
  mercListen('orange', true)
  try {
    const frames = await c.mod.takeFrames(c.listener, {
      wait: WAIT_SEC,
      run: RUN_SEC,
      cancelled: c.cancelled,
      onFrame(frame, voicedAt) {
        if (voicedAt === null) return
        if (!turning) {
          turning = true
          void ring.run({
            which: c.which,
            label: c.label,
            listen: 0,
            turn: RUN_SEC,
            ripples: false,
          })
        }
        drawFrame(c, frame, voicedAt, seen)
      },
    })
    return frames === null ? null : c.mod.readTake(frames, c.midi)
  } finally {
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    chart.scene.head = null
  }
}

/** The chart's text summary after a take: "Merc's note A3; your note 20 cents above it, in the band". */
export function chartSummary(midi: number, r: TakeReading): string {
  const note = `Merc's note ${wordName(sharpOf(midi))}`
  if (r.d === null || r.band === null) return `${note}; no steady note heard`
  const tag = r.octaveLine === null ? null : octaveTag(r.octaves, r.d)
  const octave =
    tag === null ? '' : `, ${tag.startsWith('octave') ? 'an ' : ''}${tag}`
  return `${note}; your note ${gapWords(r.d, 'it')}, ${BAND_WORDS[r.band]}${octave}`
}
