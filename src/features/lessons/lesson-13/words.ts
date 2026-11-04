// ============================================================
// Lesson 13 four words — harmonic, spectrum, resonance, formant
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button
// (kit/words-strip.ts), each figure a small copy of the vowel strip with no
// band chart (WEB-SPEC, Toys 3). Harmonic plays the 1st harmonic of A3,
// then the 2nd, 220 and 440 Hz, pure tones, 1.0 s each with 0.3 s between
// (FACTS 66): one line in the soft tone made pure (vowel-voice.ts `PURE`),
// at the soft tone's gain, silent between its two tones, each column lit
// while its tone sounds. It is the page's one sound (kit/now-playing.ts): a
// press stops the sound before it, anywhere on the page, and a newer one
// stops it. The three Shows are silent, so they claim no sound, stop none,
// and never warn that sound is off or turn it on: Spectrum lights ‘ee’'s strip from the
// foot, Resonance draws its curve over the dim strip, Formant caps ‘ee’'s
// two peaks, the 1st bar and then the 10th. No fact times a Show, so each
// takes SHOW_SEC; a Show replays its drawing at every press, and under
// reduced motion lands on its end at once. A press of a word still running
// is ignored, as the kit has it.

import { q, qa } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { animate, bindWordPlays } from '@/features/lessons/kit/words-strip'
import { PURE } from './vowel-voice'

/** Each tone's length, and the silence between them (FACTS 66). */
export const TONE_SEC = 1
export const GAP_SEC = 0.3
/** The fade at each edge of the silence, inside it, so neither tone clicks. */
const EDGE_SEC = 0.03

/** Harmonic's line: 220 Hz, silence, 440 Hz. The pitch moves while the line is silent. */
export const HARMONIC_LINE: readonly ContourPoint[] = [
  { t: 0, hz: 220 },
  { t: TONE_SEC, hz: 220 },
  { t: TONE_SEC + EDGE_SEC, hz: 220, level: 0 },
  { t: TONE_SEC + GAP_SEC - EDGE_SEC, hz: 440, level: 0 },
  { t: TONE_SEC + GAP_SEC, hz: 440 },
  { t: 2 * TONE_SEC + GAP_SEC, hz: 440 },
]

/** A Show's drawing, seconds. */
export const SHOW_SEC = 1

/** A column of Harmonic's figure while the other one sounds. */
const DIM = '.2'

const stub = (word: string): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

/** Sets an attribute on each of `els` to the value `f` gives it. */
function each<T extends Element>(
  els: readonly T[],
  name: string,
  f: (el: T, i: number) => string,
): void {
  els.forEach((el, i) => el.setAttribute(name, f(el, i)))
}

/** Harmonic's two columns: at rest both lit, as drawn; while it plays, each lit only while its tone sounds. */
function harmonicFigure() {
  const cols = qa<SVGRectElement>('.lit', stub('harmonic'))
  let timers: number[] = []
  const light = (lit: number | null): void =>
    each(cols, 'fill-opacity', (_, i) =>
      lit === null || i === lit ? '1' : DIM,
    )
  return {
    start(): void {
      light(0)
      timers = [
        window.setTimeout(() => light(-1), TONE_SEC * 1000),
        window.setTimeout(() => light(1), (TONE_SEC + GAP_SEC) * 1000),
      ]
    },
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      light(null)
    },
  }
}

/** A Show's drawing at `u`, 0 to 1, from nothing to the figure as drawn. */
type Drawing = (u: number) => void

/** Spectrum: each column's lit share grows from the foot. */
function spectrumDrawing(): Drawing {
  const lits = qa<SVGRectElement>('.lit', stub('spectrum'))
  const drawn = lits.map((r) => ({
    y: r.getAttribute('y') ?? '',
    height: r.getAttribute('height') ?? '',
  }))
  const full = drawn.map((d) => ({
    foot: Number(d.y) + Number(d.height),
    height: Number(d.height),
  }))
  return (u) => {
    lits.forEach((r, i) => {
      if (u >= 1) {
        r.setAttribute('y', drawn[i].y)
        r.setAttribute('height', drawn[i].height)
        return
      }
      const h = full[i].height * u
      r.setAttribute('y', String(+(full[i].foot - h).toFixed(2)))
      r.setAttribute('height', String(+h.toFixed(2)))
    })
  }
}

/** Resonance: its curve draws from the strip's low end, in its own length of 1. */
function resonanceDrawing(): Drawing {
  const curve = q<SVGPathElement>('.curve', stub('resonance'))
  curve.setAttribute('pathLength', '1')
  return (u) => {
    if (u >= 1) {
      curve.removeAttribute('stroke-dasharray')
      curve.removeAttribute('stroke-dashoffset')
      return
    }
    curve.setAttribute('stroke-dasharray', '1')
    curve.setAttribute('stroke-dashoffset', String(+(1 - u).toFixed(3)))
  }
}

/** Formant: the 1st bar's cap, then the 10th's, each from its half of the Show. */
function formantDrawing(): Drawing {
  const caps = qa<SVGGElement>('.peak', stub('formant'))
  return (u) =>
    each(caps, 'opacity', (_, i) => (u >= i / caps.length ? '1' : '0'))
}

/** Plays a Show: the drawing from its start, or straight to its end under reduced motion. */
async function show(draw: Drawing): Promise<void> {
  if (reducedMotion()) {
    draw(1)
    return
  }
  draw(0)
  await animate(SHOW_SEC, (u) => draw(u))
  draw(1)
}

export function initWords(): void {
  const harmonic = harmonicFigure()
  let run: Run | null = null

  bindWordPlays(
    q('[data-word="harmonic"]'),
    async (_, audible) => {
      harmonic.start()
      const r = playLine(HARMONIC_LINE, { audible, kind: 'soft', timbre: PURE })
      run = r
      // heard to its end, or ended by the Sound switch: either way the
      // columns rest; a run the owner stopped has already let go
      await r.done
      if (run !== r) return
      run = null
      harmonic.rest()
    },
    {
      owner: NowPlaying,
      stop: () => {
        run?.stop()
        run = null
        harmonic.rest()
      },
    },
  )

  const drawings: Record<string, Drawing> = {
    spectrum: spectrumDrawing(),
    resonance: resonanceDrawing(),
    formant: formantDrawing(),
  }
  // a Show sounds nothing, so it asks nothing of the sound switch: the kit's
  // binding would warn that sound is off, or turn it on from unset
  for (const [word, draw] of Object.entries(drawings)) {
    const btn = q<HTMLButtonElement>(`[data-word="${word}"] [data-word-play]`)
    let showing = false
    btn.addEventListener('click', () => {
      if (showing) return
      showing = true
      btn.classList.add('is-on')
      void show(draw).then(() => {
        btn.classList.remove('is-on')
        showing = false
      })
    })
  }
}
