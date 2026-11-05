// ============================================================
// Lesson 14 the take — Merc's phrase, the count-in, then the viewer's phrase
// ============================================================
//
// Sing it's moving parts after Start (WEB-SPEC, Toys 4, states 5 to 7),
// apart from the flow that decides what the card offers (phrase-flow.ts)
// and the card that shows it (sing.ts). Before take 1, Merc sings the
// phrase, take 2, the chart lighting each band as he sings it, the other
// Merc listening; then Lesson 4's count-in, do once and softly; take 2 and
// Again have the count-in alone. Then the take opens with every sound held
// off (`Sound.hush`) and the recorder running over the listener's own
// stream: it waits up to 6 s for the voice, then runs until 1.2 s of quiet
// or 8 s from its first voiced frame, so the 0.3 s breath the phrase asks
// for never ends it (`takeFrames`; FACTS 72).
//
// The guide is the chart itself: do's band glows until the voice starts,
// then a playhead runs along the phrase at 80 beats a minute from the first
// voiced frame and each band lights as it passes, without the playhead
// under reduced motion. The violet line draws live at the playhead, folded
// around the band under it (`foldCents`), with a small "octave lower" or
// "octave higher" tag while it sits within 50 cents of that band an octave
// away; where no voice is heard the line has a gap. It carries no light,
// and nothing measures how loud the singer was.
//
// The take is read by the range reader (`readRange`): a take with too
// little voice is discarded with its recording, and a take abandoned (the
// tab hidden, the section left, another sound) is discarded too. The line
// comes back in absolute cents, so the card can redraw it against the bands
// it was sung to after Move do. This module loads inside Start's tap, with
// the listener and the recorder (kit/listen.ts, kit/record.ts): the page's
// first paint carries none of them.

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import { octavesOf, octaveTag } from '@/features/lessons/kit/band-words'
import { wait } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import type { Listener, PitchFrame, RangeReading, } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COUNT_IN_SEC, countIn } from '@/features/lessons/kit/move-do'
import type { KeptTake } from '@/features/lessons/kit/record'
import { keepTake, recorderFor } from '@/features/lessons/kit/record'
import type { Run } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { singAlong, singNotes } from './plays'
import type { SongNote, TakeId } from './song'
import { laOf, lineNotes } from './song'
import type { Play, SongLine } from './song-line'
import { takePlay } from './song-line'

/** The take's timing, seconds (FACTS 72): the gap after Merc's phrase, the wait, the run and the quiet that ends it. */
export const TAKE = { gap: 0.4, wait: 6, run: 8, quiet: 1.2 } as const

/** What the viewer's take follows on the chart: the phrase at 80 beats a minute, take 2 with its breath after "star". */
export function guideOf(id: TakeId, doMidi: number): Play {
  if (id === 2) return takePlay(2, doMidi)
  return { notes: lineNotes(0, doMidi), name: 'take 1' }
}

/** How a take ended. */
export type TakeEnd =
  /** The sound turned off while Merc sang: no take is spent. */
  | { readonly kind: 'silenced' }
  /** Abandoned: the tab hidden, the section left or another sound; its recording discarded. */
  | { readonly kind: 'left' }
  | {
      readonly kind: 'read'
      readonly reading: RangeReading
      /** The take's line, seconds from its first voiced frame and absolute cents (MIDI × 100). */
      readonly trace: readonly TracePoint[]
      /** The recording, decoded and kept; null when nothing was recorded or kept. */
      readonly kept: KeptTake | null
    }

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  readonly context: AudioContext
  readonly line: SongLine
  readonly id: TakeId
  /** Merc sings the phrase first: take 1 alone. */
  readonly mercFirst: boolean
  /** The Merc who sings: blue for the lower voice, orange for the higher. */
  readonly which: Which
  /** The small tag beside the live line. */
  readonly tag: HTMLElement
  /** Abandoned: the tab hidden, the section left, another sound. */
  readonly cancelled: () => boolean
  /** Merc's phrase or the count-in starts: the page holds what stops it. */
  readonly onSound: (stop: (() => void) | null) => void
  /** The take is open and listens. */
  readonly onListen: () => void
}

/** Merc sings the phrase, take 2, on the chart; true when it was heard to its end. */
async function mercPhrase(c: TakeContext): Promise<boolean> {
  const p = takePlay(2, c.line.doMidi)
  const other: Which = c.which === 'blue' ? 'orange' : 'blue'
  const run: Run = singNotes(p.notes, true)
  c.onSound(() => run.stop())
  const drawing = c.line.play(p)
  const quiet = singAlong(p.notes, c.which, true)
  mercListen(other, true)
  const heard = await run.done
  c.onSound(null)
  quiet()
  mercListen(other, false)
  if (heard) drawing.end()
  else drawing.cancel()
  return heard
}

/** Do once, softly; true unless it was cut short. */
async function countInFirst(c: TakeContext): Promise<boolean> {
  const v = countIn(c.line.doMidi, true)
  let cut = false
  c.onSound(() => {
    cut = true
    v?.stop()
  })
  await wait(COUNT_IN_SEC)
  c.onSound(null)
  return !cut && Sound.state === 'on'
}

/** A frame's voice, as the live line draws it: the listener's smoothed frame, voiced. */
const voicedFrame = (f: PitchFrame): boolean => f.f0 > 0 && f.conf >= 0.5

/** The note under `t` seconds into the phrase: the one sounding then, or the last once it is over. */
export function noteAt(notes: readonly SongNote[], t: number): SongNote {
  return (
    notes.find((n) => t >= n.from && t < n.to) ??
    (t < 0 ? notes[0] : notes[notes.length - 1])
  )
}

/**
 * The guide and the live line, frame by frame: `draw(frame, voicedAt)` for
 * each of the listener's frames as the take runs; `trace()` the line so
 * far, in absolute cents.
 */
export function liveDrawer(
  c: Pick<TakeContext, 'mod' | 'line' | 'id' | 'tag'>,
): {
  draw: (frame: PitchFrame | null, voicedAt: number | null) => void
  trace: () => TracePoint[]
} {
  const doMidi = c.line.doMidi
  const guide = guideOf(c.id, doMidi)
  const scene = c.line.chart.scene
  const seen = new Set<number>()
  const line: TracePoint[] = []
  const absolute: TracePoint[] = []

  function push(frame: PitchFrame, t: number): void {
    if (!voicedFrame(frame)) {
      line.push({ t, c: null })
      absolute.push({ t, c: null })
      return
    }
    const n = noteAt(guide.notes, t)
    const raw = c.mod.hzToCents(frame.f0) - n.midi * 100
    const folded = c.mod.foldCents(raw)
    const cents = (n.midi - doMidi) * 100 + folded
    line.push({ t, c: cents })
    absolute.push({ t, c: n.midi * 100 + folded })
    scene.head = { t, c: cents }
    const tag = octaveTag(octavesOf(raw, folded), folded)
    c.tag.hidden = tag === null
    c.tag.textContent = tag ?? ''
  }

  return {
    draw(frame, voicedAt) {
      let t = 0
      if (voicedAt !== null && frame !== null) {
        t = frame.t - voicedAt
        if (!seen.has(frame.t) && t >= 0 && t <= c.line.chart.window) {
          seen.add(frame.t)
          push(frame, t)
        }
      }
      // before the voice, do's band glows; then each band as the playhead passes
      const reduced = reducedMotion()
      c.line.scrub(guide, Math.min(t, c.line.chart.window), reduced)
      if (reduced) scene.playhead = null
      scene.line = [...line]
      wake()
    },
    trace: () => [...absolute],
  }
}

/** One take: Merc's phrase (take 1), the count-in and the viewer's phrase, read and recorded; or how it ended. */
export async function takePhrase(c: TakeContext): Promise<TakeEnd> {
  if (c.mercFirst) {
    const heard = await mercPhrase(c)
    // the sound turned off while Merc sang: no take is spent on a phrase
    // the viewer could not hear
    if (!heard) return Sound.state === 'off' ? { kind: 'silenced' } : left(c)
    await wait(TAKE.gap)
    if (c.cancelled()) return left(c)
  }
  if (!(await countInFirst(c)))
    return Sound.state === 'off' ? { kind: 'silenced' } : left(c)
  if (c.cancelled()) return left(c)
  c.onListen()
  // nothing plays while the take is open, whatever happens to it
  Sound.hush(true)
  mercListen('blue', true)
  mercListen('orange', true)
  const recorder = recorderFor(c.listener.media)
  try {
    const live = liveDrawer(c)
    let voicedAt: number | null = null
    live.draw(null, null)
    recorder?.start()
    const frames = await c.mod.takeFrames(c.listener, {
      wait: TAKE.wait,
      run: TAKE.run,
      quiet: TAKE.quiet,
      cancelled: c.cancelled,
      onFrame(frame, at) {
        voicedAt = at
        live.draw(frame, at)
      },
    })
    if (frames === null) {
      recorder?.discard()
      return { kind: 'left' }
    }
    const doMidi = c.line.doMidi
    const reading = c.mod.readRange(frames, c.id, doMidi, laOf(doMidi))
    if (!reading.heard) {
      recorder?.discard()
      return { kind: 'read', reading, trace: live.trace(), kept: null }
    }
    const blob = recorder === null ? null : await recorder.stop()
    const kept = await keepTake(blob, c.context, voicedAt ?? 0)
    return { kind: 'read', reading, trace: live.trace(), kept }
  } finally {
    recorder?.dispose()
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    // the chart no longer listens: no head, no tag, no playhead
    c.tag.hidden = true
    c.line.chart.scene.head = null
    c.line.chart.scene.playhead = null
    c.line.chart.scene.line = []
    wake()
  }
}

/** A take abandoned before it listened. */
function left(c: TakeContext): TakeEnd {
  c.onSound(null)
  return { kind: 'left' }
}
