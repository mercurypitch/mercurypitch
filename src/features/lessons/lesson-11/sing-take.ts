// ============================================================
// Lesson 11 one slow siren — the microphone, the live chart and the take
// ============================================================
//
// Sing it's moving parts (WEB-SPEC, Toys 4, states 5 to 7), apart from the
// flow that decides what the card offers (kit/siren-flow.ts) and the card
// that shows it (sing.ts). The live chart is the range chart in live mode,
// over Lesson 7's windows, E2 to C5 for the lower voice and F3 to C6 for the
// higher, across fourteen seconds, a take's longest: Merc's slow siren in
// its one gear, thick for the lower voice and thin for the higher, with no
// seam, drawn as it sounds and kept faint behind a take for its shape; and
// the singer's violet line. Nothing is ever drawn on the singer's line or
// beside it: no seam, no label, no band and no mark, whatever the frames
// hold, since a jump can be a flip, a breath or the detector's error, and
// the page tells none of them apart (FACTS 27, 64). The window never moves,
// and a frame beyond it is drawn at its edge with a small arrow
// (kit/range-chart-draw.ts).
//
// A take opens 0.4 s after any sound has ended, with every sound held off
// (`Sound.hush`); waits up to 6 s for the voice; then runs until the voice
// has been quiet for a second after at least two seconds of it, or 14 s
// from its first voiced frame, whichever comes first (FACTS 63). Nothing
// extends it. The ring turns once every 8.5 s while it is open, whatever
// its length, and shows no seconds, so it never reads as a time to fill;
// under reduced motion it holds still with the word "Listening". Nothing
// reads the frames: they are drawn and dropped. The listener loads after
// Start (kit/listen.ts, through the kit's microphone holder,
// kit/mic-hold.ts), so the page's first paint does not carry it.

import { wait } from '@/features/lessons/kit/dom'
import type { Listener, PitchFrame } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { LinePoint, RangeChart, RangeLine, RangeWindow, } from '@/features/lessons/kit/range-chart'
import { mountRangeChart, RANGE_COLOR, } from '@/features/lessons/kit/range-chart'
import type { Ring } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { drawn, lineAt, singSirenLine, SIREN_UP } from './lines'

/** The page's consumer id with the app's microphone owner. */
export const CONSUMER = 'lesson-11'

/** The take's timing, seconds (FACTS 63). */
export const TAKE = {
  gap: 0.4,
  wait: 6,
  run: 14,
  quiet: 1,
  quietAfter: 2,
} as const

/** One turn of the ring while a take is open, seconds: Merc's siren's length. */
export const RING_TURN_SEC = 8.5
/** The ring's label through Sing it. */
export const RING_LABEL = 'One siren on “ng”'

/** Lesson 7's windows, which hold every preset of each voice group (FACTS 83). */
export const LIVE_WINDOWS: Readonly<Record<Voice, RangeWindow>> = {
  lower: { lo: 40, hi: 72 },
  higher: { lo: 53, hi: 84 },
}

/** The live chart's summary after a take with voice: no note, gear, flip or span (REQ-GVC-085). */
export const TAKE_SAID = 'Your siren, drawn as a line.'

/** A frame's note, MIDI, or null when it is not voice. */
export function frameMidi(f: PitchFrame): number | null {
  if (!(f.f0 > 0) || f.conf < 0.5) return null
  return 69 + 12 * Math.log2(f.f0 / 440)
}

export interface LiveChart {
  readonly chart: RangeChart
  setVoice(v: Voice): void
  /** Merc's siren drawn to `t` seconds, glowing while it sounds; faint behind a take. */
  merc(t: number, o: { glow: boolean; faint?: boolean }): void
  /** A new take: the singer's line goes; Merc's shape stays, faint. */
  beginTake(): void
  /** One frame of the singer's line, `t` seconds from the first voiced frame. */
  push(t: number, midi: number | null): void
  /** The take over: its head rests; with `keep` false the singer's line goes too. */
  endTake(keep: boolean): void
  /** The singer's line so far, as drawn: for a test that it carries nothing but its points. */
  readonly sung: readonly LinePoint[]
}

export function mountLiveChart(
  root: HTMLElement,
  voice: Voice,
  active: () => boolean,
): LiveChart {
  let v = voice
  const chart = mountRangeChart(root, {
    window: LIVE_WINDOWS[v],
    seconds: TAKE.run,
    active,
  })
  let mercLine: RangeLine | null = null
  let sung: LinePoint[] = []
  let head: { t: number; midi: number } | null = null

  const lines = (): void => {
    const out: RangeLine[] = []
    if (mercLine !== null) out.push(mercLine)
    if (sung.length > 0)
      out.push({
        points: sung,
        color: RANGE_COLOR.singer,
        head: head === null ? null : { ...head, glow: 1 },
      })
    chart.scene.lines = out
    chart.changed()
  }
  chart.changed()

  return {
    chart,
    get sung() {
      return sung
    },
    setVoice(next) {
      v = next
      chart.setWindow(LIVE_WINDOWS[v])
      mercLine = null
      lines()
    },
    merc(t, o) {
      const line = singSirenLine(v)
      const headT = reducedMotion() && o.glow ? SIREN_UP + 0.2 : t
      mercLine = {
        points: drawn(line, t),
        color: RANGE_COLOR.target,
        alpha: o.faint === true ? 0.3 : 1,
        head:
          o.faint === true || t <= 0
            ? null
            : {
                t: headT,
                midi: lineAt(line, headT).midi,
                glow: o.glow ? 1 : 0.45,
              },
      }
      lines()
    },
    beginTake() {
      sung = []
      head = null
      if (mercLine !== null) mercLine = { ...mercLine, alpha: 0.3, head: null }
      lines()
    },
    push(t, midi) {
      sung.push({ t, midi })
      head = midi === null ? head : { t, midi }
      lines()
    },
    endTake(keep) {
      head = null
      if (!keep) sung = []
      lines()
    },
  }
}

export interface TakeContext {
  readonly mod: ListenModule
  readonly listener: Listener
  readonly live: LiveChart
  readonly ring: Ring
  readonly which: Which
  readonly cancelled: () => boolean
}

/** What a take came to: whether it heard a voice, and whether it was abandoned. */
export interface TakeEnd {
  readonly voiced: boolean
  readonly abandoned: boolean
}

/** The ring through a take: a turn every 8.5 s, or still with "Listening". */
function turnRing(c: TakeContext, open: () => boolean): void {
  const words = { turn: () => 'Listening', done: 'Listening' }
  if (reducedMotion()) {
    void c.ring.run({
      which: c.which,
      label: RING_LABEL,
      listen: 0,
      turn: 0,
      words,
    })
    return
  }
  void c.ring
    .run({
      which: c.which,
      label: RING_LABEL,
      listen: 0,
      turn: RING_TURN_SEC,
      ripples: false,
      words,
    })
    .then(() => {
      if (open()) turnRing(c, open)
    })
}

/** One slow siren: whether a voice came, or how it was abandoned. */
export async function takeOne(c: TakeContext): Promise<TakeEnd> {
  c.live.beginTake()
  // the take opens once any sound and its release have died away
  await wait(TAKE.gap)
  if (c.cancelled()) return { voiced: false, abandoned: true }
  let open = true
  let voiced = false
  const seen = new Set<number>()
  Sound.hush(true)
  mercListen('blue', true)
  mercListen('orange', true)
  turnRing(c, () => open)
  try {
    const frames = await c.mod.takeFrames(c.listener, {
      wait: TAKE.wait,
      run: TAKE.run,
      quiet: TAKE.quiet,
      quietAfter: TAKE.quietAfter,
      cancelled: c.cancelled,
      onFrame(frame, voicedAt) {
        if (voicedAt === null || frame === null || seen.has(frame.t)) return
        seen.add(frame.t)
        voiced = true
        const t = frame.t - voicedAt
        if (t >= 0) c.live.push(t, frameMidi(frame))
      },
    })
    // a voice that came between the last two looks still counts
    const heard =
      voiced || (frames?.some((f) => frameMidi(f) !== null) ?? false)
    return { voiced: heard, abandoned: frames === null }
  } finally {
    open = false
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    // the take over, the ring rests: "Listening" would say the microphone is still on
    c.ring.stop('Rest')
  }
}
