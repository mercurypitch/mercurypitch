// ============================================================
// Lesson 13 figure — the band chart with the strip under it, still or playing
// ============================================================
//
// One component in every state of the page (WEB-SPEC, Toys 1): the kit's
// band chart, Merc's band 35 cents either side of his note on a ±100-cent
// axis with only the band's edges named, and the kit's spectrum strip under
// it (kit/spectrum-strip.ts). A still shows one vowel, or the source alone,
// on a voice's note. A play sings a line (plays.ts) and lights the strip as
// it sounds, frame by frame from the play's own schedule, never from the
// sound: Merc's line glows and a play head crosses the plot while it plays,
// and the columns follow each change of vowel. Under reduced motion a
// change lands on its end and no play head moves.
//
// One sound at a time: a play claims the page's owner (kit/now-playing.ts)
// with this figure's stop, so any other sound stops it, and its promise
// says whether it was heard to its end. A stop puts the strip back on the
// line's end state at once. The live state (`dark`) shows every segment
// unlit: while the viewer sings, nothing in the strip is the viewer's.

import type { BandChart, CentsTick } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { SpectrumScene } from '@/features/lessons/kit/spectrum-strip'
import { spectrumUnder } from '@/features/lessons/kit/spectrum-strip'
import type { Line, StripNow } from './plays'
import { curvesOf, sourceLine, stripAt } from './plays'
import { singLine } from './vowel-voice'
import type { VoiceName, Vowel } from './vowels'
import { harmonicCount, HOME } from './vowels'

/** The cents axis: ±100, with only the band's edges named (WEB-SPEC, Toys 1, Drawing). */
export const VOWEL_TICKS: readonly CentsTick[] = [
  { c: 100, label: '' },
  { c: 35, label: '35', place: 'below' },
  { c: -35, label: '35' },
  { c: -100, label: '' },
]

/** The strip's caption, and the curves' beside it (FACTS 44). */
export const CAPTION = "Merc's model"
export const CURVE_CAPTION = "Merc's model too"

/** What a still shows: one vowel, or the first `n` harmonics of the source, on a voice's note. */
export interface Still {
  readonly voice: VoiceName
  readonly midi?: number
  readonly vowel: Vowel | null
  /** The source's harmonics shown, for a still of the source (default all). */
  readonly n?: number
}

export interface FigureOptions {
  /** When the chart draws: a deck's `toyActive(n)`; default while on screen. */
  readonly active?: () => boolean
  /** The page's one sound. */
  readonly owner?: SoundOwner
  /** The compact figure: the labelled peaks' numbers alone. */
  readonly compact?: boolean
  /** A hold's frame, its seconds named under the plot (Sing it). */
  readonly ticks?: boolean
}

export interface PlayHooks {
  /** Decided once at the tap (kit/sound.ts, `ToneOptions.audible`). */
  readonly audible?: boolean
  /** The vowel whose cue has come, as each comes, and null when the play ends or stops. */
  readonly onVowel?: (v: Vowel | null) => void
}

export interface VowelFigure {
  readonly chart: BandChart
  /** The resonance curves over the strip (Step 2's Resonances, free play's). */
  curves: boolean
  /** Shows a still, stopping any play. */
  show(still: Still): void
  /** Sings `line` and lights the strip as it sounds: true if heard to its end. */
  play(line: Line, hooks?: PlayHooks): Promise<boolean>
  /** Stops a play where it stands; the strip lands on the play's end. */
  stop(): void
  /** Every segment unlit, Merc's band on `midi`: the live state while the viewer sings. */
  dark(midi: number): void
  readonly playing: boolean
}

/** The strip's scene for a moment of a line. */
function sceneOf(
  line: Line,
  now: StripNow,
  compact: boolean,
  curves: boolean,
): SpectrumScene {
  const peaks: readonly (number | null)[] = now.peaks ?? []
  return {
    f0: hz(line.midi),
    columns: now.columns,
    peaks: peaks.filter((p): p is number => p !== null),
    numbers: compact ? 'peaks' : 'all',
    curves: curves ? curvesOf(now.res) : [],
    caption: CAPTION,
    curveCaption: CURVE_CAPTION,
  }
}

/** A still as a line of no length: its end state is the still. */
const stillLine = (s: Still): Line => {
  const midi = s.midi ?? HOME[s.voice]
  if (s.vowel === null)
    return sourceLine(s.voice, midi, s.n ?? harmonicCount(hz(midi)), 0)
  return {
    kind: 'vowels',
    voice: s.voice,
    midi,
    stretches: [{ vowel: s.vowel, at: 0, glide: 0 }],
    end: 0,
  }
}

export function mountFigure(
  root: HTMLElement,
  opts: FigureOptions = {},
): VowelFigure {
  const compact = opts.compact === true
  // the figure's own drawer comes first, so a frame's scene is written before the chart paints it
  let playing: {
    readonly line: Line
    readonly run: Run
    readonly t0: number
    readonly onVowel?: (v: Vowel | null) => void
    vowel: Vowel | null
  } | null = null
  let shown: Line = stillLine({ voice: 'lower', vowel: 'ee' })
  let curves = false
  addDrawer({
    active: () => playing !== null,
    wants: () => playing !== null,
    draw(now) {
      const p = playing
      if (p === null) return
      const t = Math.min(p.line.end, (now - p.t0) / 1000)
      const strip = paint(p.line, t)
      if (!reducedMotion()) chart.scene.playhead = t
      if (strip.vowel !== p.vowel) {
        p.vowel = strip.vowel
        p.onVowel?.(strip.vowel)
      }
    },
  })
  const chart = mountBandChart(root, {
    target: HOME.lower,
    axis: { range: 100 },
    // the compact figure's band is too short for both edges' names, which
    // would overlap on a phone: there the band stands unnamed
    ticks: compact
      ? VOWEL_TICKS.map((t) => ({ ...t, label: '' }))
      : VOWEL_TICKS,
    window: 2,
    active: opts.active,
    timeTicks: opts.ticks,
    under: spectrumUnder({ ticks: opts.ticks }),
  })

  /** The strip at `t` seconds into `line`, into the chart's scene. */
  function paint(line: Line, t: number): StripNow {
    const strip = stripAt(line, t, reducedMotion())
    chart.scene.spectrum = sceneOf(line, strip, compact, curves)
    return strip
  }

  /** Merc's band on the line's note, the strip at its end. */
  function settle(line: Line): void {
    if (chart.target !== line.midi) chart.setTarget(line.midi)
    shown = line
    chart.scene.glow = 0
    chart.scene.playhead = null
    paint(line, line.end)
    wake()
  }

  function stop(): void {
    const p = playing
    if (p === null) return
    playing = null
    p.run.stop()
    opts.owner?.release(stop)
    p.onVowel?.(null)
    settle(p.line)
  }

  return {
    chart,
    get playing() {
      return playing !== null
    },
    get curves() {
      return curves
    },
    set curves(on: boolean) {
      curves = on
      if (playing === null) settle(shown)
    },
    show(still) {
      stop()
      settle(stillLine(still))
    },
    play(line, hooks = {}) {
      stop()
      opts.owner?.claim(stop)
      const audible = hooks.audible ?? Sound.canPlay()
      if (chart.target !== line.midi) chart.setTarget(line.midi)
      chart.setWindow(Math.max(line.end, 0.5))
      const run = singLine(line, audible)
      const mine = {
        line,
        run,
        t0: performance.now(),
        onVowel: hooks.onVowel,
        vowel: null,
      }
      playing = mine
      shown = line
      chart.scene.glow = 1
      paint(line, 0)
      wake()
      return run.done.then((heard) => {
        if (playing !== mine) return false
        playing = null
        opts.owner?.release(stop)
        mine.onVowel?.(null)
        settle(line)
        return heard
      })
    },
    stop,
    dark(midi) {
      stop()
      if (chart.target !== midi) chart.setTarget(midi)
      chart.scene.spectrum = {
        f0: hz(midi),
        columns: [],
        peaks: [],
        numbers: 'all',
        curves: [],
        caption: CAPTION,
      }
      wake()
    },
  }
}
