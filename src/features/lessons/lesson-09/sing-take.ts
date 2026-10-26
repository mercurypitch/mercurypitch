// ============================================================
// Lesson 9 the take — Merc's ladder, then the viewer's, read a rung at a time
// ============================================================
//
// Sing it's moving parts after Start (WEB-SPEC, Toys 4, states 5 to 7),
// apart from the flow that decides what the card offers (ladder-flow.ts)
// and the card that shows it (sing.ts). Merc sings the chosen ladder, a
// note every 1.5 s, each slot's band lighting as he sings it, the other
// Merc listening. At least 0.4 s after his last note ends, once his "ooh"
// and its release have died away, the take opens with every sound held off
// (`Sound.hush`): it waits up to 6 s for the voice, then runs one 1.5 s slot
// a rung from its first voiced frame, 6.0 s for the full ladder and 7.5 s
// for the smaller (`takeFrames`; FACTS 76). The guide is the chart itself:
// do's band glows until the voice starts, then each slot's in turn, a swell
// as it lights, at once under reduced motion. The violet line draws live
// on the chart's fixed frame, folded around the glowing rung's note
// (`foldCents`), with a small "octave lower" or "octave higher" tag while it
// sits within 50 cents of that rung an octave away; a frame beyond the
// window pins to its edge (the band chart's arrow). Merc and Tavi both
// listen. However the take ends, the guide goes out with it, so a chart
// that heard no voice no longer looks as if it listens.
//
// The ladder reader (`readLadder`) reads the take's raw frames against the
// rungs in sung order, its slots timed from the take's own first voiced
// frame (`voicedAt`), so each slot is the stretch its band glowed, and 1.5 s
// long (`LADDER_NOTE_SEC`, the kit's `LADDER_SLOT_SEC`). Each rung's line is
// `rungLine`, never the reading's own line, which carries advice to try
// again (FACTS 79); the count is `countLine`, or `NONE_HEARD_LINE` when no
// note was steady. A take whose listener heard a voiced frame, though the
// reader kept none, sang a ladder: it is 'unsteady', never 'none'.
//
// This module loads inside Start's tap (sing.ts), beside the listener, the
// pitch stream and the readers (kit/listen.ts, through kit/mic-hold.ts),
// and imports only their types, calling them through the loaded module: the
// page's first paint carries none of them. Nothing from a take is stored.

import type { BandScene, TracePoint } from '@/features/lessons/kit/band-chart'
import { BAND_WORDS, inBand, octavesOf, octaveTag, } from '@/features/lessons/kit/band-words'
import { wait } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import type { LadderReading, Listener, PitchFrame, } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen, mercSing } from '@/features/lessons/kit/merc-duo'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { LadderChart } from './ladder-chart'
import type { LadderId } from './ladder-data'
import { ladderNotes, LADDERS } from './ladder-data'
import type { TakeKind } from './ladder-flow'
import { kindOf } from './ladder-flow'
import { LADDER_NOTE_SEC, mercLadderNotes } from './sounds'

/** The take's timing, seconds: the gap after Merc's last note, and the wait for the voice (FACTS 76). */
export const TAKE = { gap: 0.4, wait: 6 } as const

/** A guide's band swells in over this long as it lights. */
const SWELL_MS = 150

/** A take's seconds once the voice has started: a slot a rung. */
export const runSec = (ladder: LadderId): number =>
  LADDERS[ladder].length * LADDER_NOTE_SEC

/** What a take came to. */
export type TakeEnd =
  /** The sound went off while Merc sang, before the take listened. */
  | { readonly kind: 'silenced' }
  /** Abandoned: the tab hidden, the section left, another sound claimed. */
  | { readonly kind: 'left'; readonly voiced: boolean }
  | {
      readonly kind: 'read'
      readonly reading: LadderReading
      readonly voiced: boolean
    }

/** A take's kind for the flow: the reader's, but a voice heard with no note kept is 'unsteady'. */
export const takeKind = (r: LadderReading, voiced: boolean): TakeKind =>
  !r.heard && voiced ? 'unsteady' : kindOf(r)

/** A rung's reading as its line and the chart read it. */
interface Slot {
  readonly d: number | null
  readonly octaveLine: string | null
  readonly band: keyof typeof BAND_WORDS | null
  readonly landed: boolean
}

const NO_STEADY: Slot = { d: null, octaveLine: null, band: null, landed: false }

/** A take read out: a line a rung, the count's line, the lit edges and the chart's words. */
export interface ReadOut {
  readonly lines: readonly string[]
  readonly count: string
  /** "If that felt tricky, good: that's learning." follows the count. */
  readonly tricky: boolean
  readonly landed: readonly boolean[]
  readonly said: string
}

/**
 * The chart's words after a take, in the ladder's order (WEB-SPEC, Toys 4,
 * "Accessibility and motion"): "Your ladder, drawn as a line: do in the
 * band, mi close, so in the band, top do with no steady note".
 */
export function ladderSaid(
  ladder: LadderId,
  slots: readonly Pick<Slot, 'band'>[],
): string {
  const parts = LADDERS[ladder].map((n, k) => {
    const band = slots[k]?.band ?? null
    const name = n.label.toLowerCase()
    return band === null
      ? `${name} with no steady note`
      : `${name} ${BAND_WORDS[band]}`
  })
  return `Your ladder, drawn as a line: ${parts.join(', ')}`
}

/** A take that heard a voice, read out through the loaded reader's own lines. */
export function readOut(
  mod: ListenModule,
  ladder: LadderId,
  r: LadderReading,
): ReadOut {
  const slots: readonly Slot[] = r.heard
    ? r.slots
    : LADDERS[ladder].map(() => NO_STEADY)
  const count = r.heard ? r.count : null
  return {
    lines: LADDERS[ladder].map((n, k) => mod.rungLine(n.label, slots[k])),
    count:
      (count === null ? null : mod.countLine(count)) ?? mod.NONE_HEARD_LINE,
    tricky: count !== null && mod.trickyAfter(count),
    landed: slots.map((s) => s.landed),
    said: ladderSaid(ladder, slots),
  }
}

/** The rungs of the chart's live frame, rung `glowing` lit by `glow` and those of `lit` with their edges. */
function setRungs(
  s: BandScene,
  glowing: number | null,
  glow: number,
  lit: (k: number) => boolean,
): void {
  s.rungs = (s.rungs ?? []).map((r, k) => ({
    ...r,
    glow: k === glowing ? glow : 0,
    lit: lit(k),
  }))
}

/** The chart after a take: the line kept, the head gone, each landed rung's edge lit. */
export function showReading(chart: LadderChart, out: ReadOut): void {
  const s = chart.chart.scene
  s.head = null
  setRungs(s, null, 0, (k) => out.landed[k] === true)
  chart.chart.describe(out.said)
  wake()
}

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  readonly chart: LadderChart
  readonly ladder: LadderId
  /** The Merc who sings: blue for the lower voice, orange for the higher. */
  readonly which: Which
  /** The small tag beside the live line. */
  readonly tag: HTMLElement
  /** Abandoned: the tab hidden, the section left. */
  readonly cancelled: () => boolean
  /** Merc's ladder starts: the page holds its run, to stop it. */
  readonly onMerc: (r: Run | null) => void
  /** Merc's ladder is over and the take listens. */
  readonly onListen: () => void
}

/** Merc sings the ladder, each slot lighting; true when it was heard to its end. */
async function mercFirst(c: TakeContext): Promise<boolean> {
  const notes = mercLadderNotes(c.ladder, c.chart.doMidi)
  const other: Which = c.which === 'blue' ? 'orange' : 'blue'
  const drawing = c.chart.play({ notes })
  let midi: number | null = null
  mercListen(other, true)
  const run = playNotes(notes, {
    audible: Sound.canPlay(),
    onNote: (n, i) => {
      drawing.note(i)
      midi = n.midi
      mercSing(c.which, n.midi, true)
    },
  })
  c.onMerc(run)
  const heard = await run.done
  c.onMerc(null)
  if (heard) drawing.end()
  else drawing.cancel()
  if (midi !== null) mercSing(c.which, midi, false)
  mercListen(other, false)
  return heard
}

/** A frame's voice, as the live line draws it: the listener's smoothed frame, voiced. */
const voicedFrame = (f: PitchFrame): boolean => f.f0 > 0 && f.conf >= 0.5

/**
 * The live line, the guide and the octave tag, frame by frame: `draw(frame,
 * voicedAt)` for each of the listener's frames as the take runs.
 */
function liveDrawer(
  c: TakeContext,
  rungs: readonly number[],
): (frame: PitchFrame | null, voicedAt: number | null) => void {
  const doMidi = c.chart.doMidi
  const seen = new Set<number>()
  const line: TracePoint[] = []
  let glowing = -1
  let since = 0
  let lit = false

  /** Rung `k` glows, swelling in as it lights, at once under reduced motion. */
  function guide(k: number): void {
    if (k !== glowing) {
      glowing = k
      since = performance.now()
    }
    const glow = reducedMotion()
      ? 1
      : Math.min(1, 0.35 + (0.65 * (performance.now() - since)) / SWELL_MS)
    setRungs(c.chart.chart.scene, k, glow, (j) => j === k && lit)
  }

  /** One new frame of the line, `t` seconds from the voice's start, folded around rung `k`. */
  function push(frame: PitchFrame, t: number, k: number): void {
    const s = c.chart.chart.scene
    if (!voicedFrame(frame)) {
      line.push({ t, c: null })
      lit = false
      return
    }
    const raw = c.mod.hzToCents(frame.f0) - rungs[k] * 100
    const folded = c.mod.foldCents(raw)
    const cents = (rungs[k] - doMidi) * 100 + folded
    line.push({ t, c: cents })
    s.head = { t, c: cents }
    lit = inBand(folded)
    const tag = octaveTag(octavesOf(raw, folded), folded)
    c.tag.hidden = tag === null
    c.tag.textContent = tag ?? ''
  }

  return (frame, voicedAt) => {
    // before the voice, do's band glows: the guide's first rung
    let k = Math.max(glowing, 0)
    if (voicedAt !== null && frame !== null && !seen.has(frame.t)) {
      seen.add(frame.t)
      const t = frame.t - voicedAt
      k = Math.min(
        rungs.length - 1,
        Math.max(0, Math.floor(t / LADDER_NOTE_SEC)),
      )
      if (t >= 0) push(frame, t, k)
      c.chart.chart.scene.line = [...line]
    }
    guide(k)
    wake()
  }
}

/** Listens for the ladder: the raw frames, or null if the take was abandoned, and whether a voice was heard. */
async function listenFor(
  c: TakeContext,
): Promise<{ frames: PitchFrame[] | null; voicedAt: number | null }> {
  const rungs = ladderNotes(c.ladder, c.chart.doMidi)
  const draw = liveDrawer(c, rungs)
  let voicedAt: number | null = null
  draw(null, null)
  const frames = await c.mod.takeFrames(c.listener, {
    wait: TAKE.wait,
    run: runSec(c.ladder),
    cancelled: c.cancelled,
    onFrame(frame, at) {
      voicedAt = at
      draw(frame, at)
    },
  })
  return { frames, voicedAt }
}

/** One take: Merc's ladder, then the viewer's, read; or how it ended without a reading. */
export async function takeLadder(c: TakeContext): Promise<TakeEnd> {
  const heard = await mercFirst(c)
  // the sound turned off while Merc sang: no take is spent on a ladder
  // the viewer could not hear
  if (!heard)
    return Sound.state === 'off'
      ? { kind: 'silenced' }
      : { kind: 'left', voiced: false }
  // the take opens once his note and its release have died away
  await wait(TAKE.gap)
  if (c.cancelled()) return { kind: 'left', voiced: false }
  c.onListen()
  // nothing plays while the take is open, whatever happens to it
  Sound.hush(true)
  mercListen('blue', true)
  mercListen('orange', true)
  try {
    const { frames, voicedAt } = await listenFor(c)
    const voiced = voicedAt !== null
    if (frames === null) return { kind: 'left', voiced }
    const reading = c.mod.readLadder(
      frames,
      ladderNotes(c.ladder, c.chart.doMidi),
      { slotSec: LADDER_NOTE_SEC, start: voicedAt },
    )
    return { kind: 'read', reading, voiced }
  } finally {
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    // the chart no longer listens: no head, no tag and no rung glowing,
    // whatever the take heard (a reading lights its landed rungs after)
    c.tag.hidden = true
    c.chart.chart.scene.head = null
    setRungs(c.chart.chart.scene, null, 0, () => false)
    wake()
  }
}
