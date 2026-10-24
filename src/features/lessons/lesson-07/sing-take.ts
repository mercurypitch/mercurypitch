// ============================================================
// Lesson 7 one siren — the microphone, the live chart and the take
// ============================================================
//
// Sing it's moving parts (WEB-SPEC, Toys 4, states 5 to 7), apart from the
// flow that decides what the card offers (siren-flow.ts) and the card that
// shows it (sing.ts). The live chart is the range chart over ten seconds, a
// take's longest: the voice's column, Merc's amber siren drawn as it sounds
// and kept faint behind a take for its shape, the singer's violet line, and
// after a reading the lit band, which moves from the column's middle half
// to the middle half of the singer's siren with the rest of the window
// dimmed. The window never moves, and a frame or a band beyond it is drawn
// at its edge with a small arrow (kit/range-chart-draw.ts).
//
// A take opens 0.4 s after any sound has ended, with every sound held off
// (`Sound.hush`); waits up to 6 s for the voice; then runs until the voice
// has been quiet for a second after at least two seconds of it, or ten
// seconds from its first voiced frame, whichever comes first (FACTS 58).
// Nothing extends it. The ring turns once every 6 s while it is open,
// whatever its length, and shows no seconds, so it never reads as a time to
// fill; under reduced motion it holds still with the word "Listening". The
// listener and the siren reader load after Start (kit/listen.ts, through the
// kit's microphone holder, kit/mic-hold.ts), so the page's first paint
// carries neither.

import { wait } from '@/features/lessons/kit/dom'
import type { Listener, PitchFrame, SirenReading, } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { LinePoint, RangeChart, RangeLine, } from '@/features/lessons/kit/range-chart'
import { mountRangeChart, RANGE_COLOR, } from '@/features/lessons/kit/range-chart'
import type { Ring } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import type { ChartVoice } from './range-data'
import { columnOf, SIREN_UP, sirenAt, sirenLine, spoken, WINDOWS, } from './range-data'

/** The page's consumer id with the app's microphone owner. */
export const CONSUMER = 'lesson-07'

/** The take's timing, seconds (FACTS 58). */
export const TAKE = {
  gap: 0.4,
  wait: 6,
  run: 10,
  quiet: 1,
  quietAfter: 2,
} as const

/** One turn of the ring while a take is open, seconds. */
export const RING_TURN_SEC = 6
/** The ring's label through Sing it. */
export const RING_LABEL = 'One siren on “ng”'

/** A frame's note, MIDI, or null when it is not voice. */
export function frameMidi(f: PitchFrame): number | null {
  if (!(f.f0 > 0) || f.conf < 0.5) return null
  return 69 + 12 * Math.log2(f.f0 / 440)
}

/** The live chart's words after a take, spoken names only: "Your siren, drawn as a line; the middle half of it lit, about G 3 to C 4". */
export function takeSaid(voice: ChartVoice, r: SirenReading): string {
  if (r.band === null)
    return r.heard
      ? 'Your siren, drawn as a line'
      : "Merc's siren on the column"
  const w = WINDOWS[voice]
  const where =
    r.band.low > w.hi
      ? ', above the chart'
      : r.band.high < w.lo
        ? ', below the chart'
        : ''
  const notes =
    r.band.low === r.band.high
      ? `the middle of it lit, about ${spoken(r.band.low)}`
      : `the middle half of it lit, about ${spoken(r.band.low)} to ${spoken(r.band.high)}`
  return `Your siren, drawn as a line; ${notes}${where}`
}

export interface LiveChart {
  readonly chart: RangeChart
  setVoice(v: ChartVoice): void
  /** Merc's siren drawn to `t` seconds, glowing while it sounds; faint behind a take. */
  merc(t: number, o: { glow: boolean; faint?: boolean }): void
  /** A new take: the singer's line and the band go; Merc's shape stays, faint. */
  beginTake(): void
  /** One frame of the singer's line, `t` seconds from the first voiced frame. */
  push(t: number, midi: number | null): void
  /** The reading's band lit, or nothing; with `keepLine` false the singer's line goes too. */
  band(r: SirenReading | null, keepLine: boolean): void
}

export function mountLiveChart(
  root: HTMLElement,
  voice: ChartVoice,
  active: () => boolean,
): LiveChart {
  let v = voice
  const chart = mountRangeChart(root, {
    window: WINDOWS[v],
    seconds: TAKE.run,
    active,
  })
  let mercLine: RangeLine | null = null
  let sung: LinePoint[] = []
  let head: { t: number; midi: number } | null = null

  const column = (lit: boolean): void => {
    const c = columnOf(v)
    chart.scene.column = { lo: c.lo, hi: c.hi, lit: lit ? c.lit : null }
  }
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
  column(true)
  chart.changed()

  return {
    chart,
    setVoice(next) {
      v = next
      chart.setWindow(WINDOWS[v])
      column(chart.scene.wash === null)
      mercLine = null
      lines()
    },
    merc(t, o) {
      const headT = reducedMotion() && o.glow ? SIREN_UP + 0.2 : t
      mercLine = {
        points: sirenLine(v, t),
        color: RANGE_COLOR.target,
        alpha: o.faint === true ? 0.3 : 1,
        head:
          o.faint === true || t <= 0
            ? null
            : { t: headT, midi: sirenAt(v, headT), glow: o.glow ? 1 : 0.45 },
      }
      lines()
    },
    beginTake() {
      sung = []
      head = null
      chart.scene.wash = null
      column(true)
      if (mercLine !== null) mercLine = { ...mercLine, alpha: 0.3, head: null }
      lines()
    },
    push(t, midi) {
      sung.push({ t, midi })
      head = midi === null ? head : { t, midi }
      lines()
    },
    band(r, keepLine) {
      head = null
      if (!keepLine) sung = []
      const b = r?.band ?? null
      chart.scene.wash =
        b === null
          ? null
          : {
              lo: b.low,
              hi: b.high,
              label:
                b.low === b.high
                  ? 'middle of your siren'
                  : 'middle half of your siren',
            }
      column(b === null)
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

/** What a take came to: its reading, or abandoned, with whether a voice was heard first. */
export type TakeEnd =
  | { readonly reading: SirenReading }
  | { readonly reading: null; readonly voiced: boolean }

/** The ring through a take: a turn every 6 s, or still with "Listening". */
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

/** One siren: the reading, or how it was abandoned. */
export async function takeOne(c: TakeContext): Promise<TakeEnd> {
  c.live.beginTake()
  // the take opens once any sound and its release have died away
  await wait(TAKE.gap)
  if (c.cancelled()) return { reading: null, voiced: false }
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
    if (frames === null) return { reading: null, voiced }
    return { reading: c.mod.readSiren(frames) }
  } finally {
    open = false
    Sound.hush(false)
    mercListen('blue', false)
    mercListen('orange', false)
    // the take over, the ring rests: "Listening" would say the microphone is still on
    c.ring.stop('Rest')
  }
}
