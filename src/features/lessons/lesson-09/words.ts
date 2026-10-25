// ============================================================
// Lesson 9 four words — leap, third, arpeggio, landing zone
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button
// (kit/words-strip.ts), each figure in the ladder chart's colours: Merc's
// bands and arcs amber, a lit edge mint (WEB-SPEC, Toys 3). Leap plays do up
// to so, its arc drawing as so starts; Third plays do up to mi, then mi up
// to so; Arpeggio plays do, mi, so and the top do (FACTS 91); in each figure
// a band lights while its note sounds. The three plays are the page's one
// sound (kit/now-playing.ts): a press stops the sound before it, anywhere on
// the page, and a newer one stops them. Landing zone lights so's band and
// plays nothing, so it takes no sound, stops none and never warns that
// sound is off; a second press waits for the first. No fact times the show,
// so it lights for 1.0 s, a note of Merc's leap. Under reduced motion an arc
// is drawn whole at once. The Merc of the stored voice sings each note.

import { q, qa } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { doOf } from './ladder-data'
import type { SoundNote, WordId } from './sounds'
import { NOTE_SEC, wordNotes } from './sounds'

/** A band at rest, and lit while its note sounds or the zone shows. */
const BAND_REST = '.14'
const ZONE_REST = '.16'
const LIT = '.5'
/** Sets a band's fill to one of the three above. */
const light = (band: SVGRectElement | undefined, opacity: string): void =>
  band?.setAttribute('fill-opacity', opacity)

/** An arc draws over this long as its note starts. */
const ARC_MS = 300

/** The words that play. */
type Played = Exclude<WordId, 'zone'>
const PLAYED: readonly Played[] = ['leap', 'third', 'arpeggio']
const isPlayed = (w: string): w is Played =>
  (PLAYED as readonly string[]).includes(w)

const stub = (word: WordId): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

/**
 * A word's figure: its bands low to high, each lit while its note sounds,
 * and, for Leap, the arc that draws as so starts.
 */
function figureOf(word: Played) {
  const bands = qa<SVGRectElement>('rect', stub(word))
  const arc =
    word === 'leap' ? q<SVGPathElement>('path[fill="none"]', stub(word)) : null
  arc?.setAttribute('pathLength', '1')
  let timers: number[] = []

  /** The arc whole, as the figure rests; or hidden until its note. */
  const showArc = (shown: boolean): void => {
    arc?.setAttribute('opacity', shown ? '1' : '0')
  }

  /** At rest: every band unlit, the arc whole. */
  function rest(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    bands.forEach((b) => light(b, BAND_REST))
    showArc(true)
  }

  /** Note `n` starts: its band lights for its length, and the arc draws as Leap's second note starts. */
  function note(n: SoundNote, i: number, notes: readonly SoundNote[]): void {
    const pitches = [...new Set(notes.map((x) => x.midi))].sort((x, y) => x - y)
    const band = bands[pitches.indexOf(n.midi)]
    light(band, LIT)
    timers.push(window.setTimeout(() => light(band, BAND_REST), n.dur * 1000))
    if (arc === null || i !== 1) return
    showArc(true)
    // drawn from do's end, in its own length of 1 (`pathLength`)
    if (!reducedMotion())
      arc.animate?.(
        [
          { strokeDasharray: '1', strokeDashoffset: '1' },
          { strokeDasharray: '1', strokeDashoffset: '0' },
        ],
        { duration: ARC_MS },
      )
  }

  return {
    /** Before the first note: no band lit, Leap's arc waiting for so. */
    start(): void {
      rest()
      showArc(false)
    },
    note,
    rest,
  }
}

export function initWords(): void {
  const figures = {
    leap: figureOf('leap'),
    third: figureOf('third'),
    arpeggio: figureOf('arpeggio'),
  }
  const runs: Partial<Record<Played, Run>> = {}
  let sung: { readonly which: Which; readonly midi: number } | null = null
  const quiet = (): void => {
    if (sung !== null) mercSing(sung.which, sung.midi, false)
    sung = null
  }

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isPlayed(w)) return
    const voice = VoiceChoice.voice ?? 'lower'
    const which = mercOf(voice)
    const notes = wordNotes(doOf(voice))[w]
    const fig = figures[w]
    fig.start()
    const r = playNotes(notes, {
      audible,
      onNote: (n, i) => {
        fig.note(n, i, notes)
        sung = { which, midi: n.midi }
        mercSing(which, n.midi, true)
      },
    })
    runs[w] = r
    // heard to its end, or ended by the Sound switch: either way the figure
    // rests; a run the owner stopped has already let go
    await r.done
    if (runs[w] !== r) return
    delete runs[w]
    fig.rest()
    quiet()
  }

  for (const w of PLAYED)
    bindWordPlays(q(`[data-word="${w}"]`), play, {
      owner: NowPlaying,
      stop: (word) => {
        if (!isPlayed(word)) return
        runs[word]?.stop()
        delete runs[word]
        figures[word].rest()
        quiet()
      },
    })

  // the zone shows: nothing sounds, so it claims no sound and a second press waits
  const zone = q<HTMLButtonElement>('[data-word="zone"] [data-word-play]')
  const band = q<SVGRectElement>('rect', stub('zone'))
  let showing = false
  zone.addEventListener('click', () => {
    if (showing) return
    showing = true
    zone.classList.add('is-on')
    light(band, LIT)
    window.setTimeout(() => {
      light(band, ZONE_REST)
      zone.classList.remove('is-on')
      showing = false
    }, NOTE_SEC * 1000)
  })
}
