// ============================================================
// Lesson 21 four words — key, key signature, circle of fifths, equal temperament
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure lit as its sound plays (WEB-SPEC,
// Toys 6; FACTS 62). Key plays G major from G3 on a small ring of twelve,
// the hero's ring by semitones: each bead lights as its note sounds,
// threaded to the one before, F sharp's black-key bead large; at rest G
// major's seven beads are lit, with no thread. Key signature plays G major
// in the learner's clef, G2 to G3 on the bass staff or G4 to G5 on the
// treble, on a small staff that carries G major's one sharp: each note is
// written as it sounds, over the one before, since a figure 88 px wide
// holds one, and F sharp is written with no sign of its own while the
// signature's sharp lights with it (staff-draw.ts `keyLit`). Circle of
// fifths plays C3, G3, D4 and A4, each a fifth above the last, as the house
// steps round a small circle of four named beads, C at the top as on the
// steps' circle, each bead lit while its note sounds; it names no sharp
// (FACTS 1a). Equal temperament plays C4 up to C5 in semitones on a row of
// thirteen equal tiles, each lit as it sounds. A note on the staff lights in
// its singer's colour, blue on the bass staff and orange on the treble, as
// on the stage, and the staff follows Sing it's voice choice at once. Each
// figure rests as its play left it. The four plays are the page's one
// sound (kit/now-playing.ts), in the soft tone: a press stops the sound
// before it, anywhere on the page, and a newer one stops them.

import type { BeadView, CircleScene } from '@/features/lessons/kit/circle-draw'
import { circleSize, drawCircle } from '@/features/lessons/kit/circle-draw'
import { angleOf } from '@/features/lessons/kit/circle-geometry'
import { q, qa, svg } from '@/features/lessons/kit/dom'
import type { Spelled } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene, figureSize, } from '@/features/lessons/kit/staff-draw'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import { covered, keyLetters } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { Pace } from './sounds'
import { note, PACE, scaleOf, STEP1_DO } from './sounds'
import { learnerClef } from './steps'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'key' | 'signature' | 'circle' | 'equal'
export const WORD_IDS: readonly WordId[] = [
  'key',
  'signature',
  'circle',
  'equal',
]

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** Key's scale, G major from G3 (FACTS 62). */
export const KEY_SCALE: readonly Spelled[] = scaleOf(note('G3'))

/** Key signature's scale in each clef, G2 to G3 or G4 to G5, Step 1's (FACTS 62, 63). */
export const signatureScale = (clef: Clef): Spelled[] => scaleOf(STEP1_DO[clef])

/** G major's key signature: one sharp, F sharp. */
export const G_MAJOR: KeySig = { sign: 'sharp', count: 1 }

/** Circle of fifths' four keys, each a fifth above the last (FACTS 62). */
export const CIRCLE_NOTES: readonly Spelled[] = ['C3', 'G3', 'D4', 'A4'].map(
  note,
)

/** Circle of fifths' pace: each note 0.5 s, their onsets 0.6 s apart (FACTS 62). */
export const CIRCLE_PACE: Pace = { every: 0.6, dur: 0.5 }

/** Equal temperament's pace: a semitone every 0.3 s, each 0.25 s long (FACTS 62). */
export const EQUAL_PACE: Pace = { every: 0.3, dur: 0.25 }

/** C4 to C5, a semitone a tile. */
export const TILES = 13

/** `midis` in turn at `pace`. */
const paced = (midis: readonly number[], pace: Pace): RunNote[] =>
  midis.map((midi, i) => ({
    t: Math.round(i * pace.every * 1000) / 1000,
    midi,
    dur: pace.dur,
  }))

/** What a word plays, Key signature in the learner's clef (FACTS 62). */
export function wordNotes(w: WordId, clef: Clef): RunNote[] {
  switch (w) {
    case 'key':
      return paced(KEY_SCALE.map(midiOf), PACE.step)
    case 'signature':
      return paced(signatureScale(clef).map(midiOf), PACE.step)
    case 'circle':
      return paced(CIRCLE_NOTES.map(midiOf), CIRCLE_PACE)
    case 'equal':
      return paced(
        Array.from({ length: TILES }, (_, i) => 60 + i),
        EQUAL_PACE,
      )
  }
}

// ---------------------------------------------------------------- the pictures

const BLACK = [1, 3, 6, 8, 10]

/**
 * Key's ring once `sounded` notes of its play have sounded, threaded in
 * that order; at rest (`null`) G major's seven beads lit, with no thread.
 * A black key's bead is large once lit, as on the hero's ring.
 */
export function keyScene(sounded: number | null): CircleScene {
  const lit = KEY_SCALE.slice(0, sounded ?? KEY_SCALE.length).map(
    (n) => midiOf(n) % 12,
  )
  const on = new Set(lit)
  const beads: BeadView[] = Array.from({ length: 12 }, (_, pc) => {
    const black = BLACK.includes(pc)
    return {
      pc,
      angle: angleOf(pc),
      look: !on.has(pc) ? 'rest' : black ? 'key' : 'lit',
      names: [],
      big: !black || on.has(pc),
    }
  })
  return {
    beads,
    fifths: false,
    house: null,
    thread: sounded === null ? [] : lit,
    gap: null,
    small: true,
  }
}

/** The places Key signature's staff keeps room for: G2 to G3 on the bass staff, G4 to G5 on the treble. */
const ROOM: readonly [number, number] = [0, 9]

/**
 * Key signature's staff: G major's signature, the note written last, lit
 * in its singer's colour while it sounds, and the signature's sharp lit
 * with a note it covers.
 */
export function signatureScene(
  clef: Clef,
  shown: Spelled | null,
  sounding: boolean,
): Scene {
  const tone = clef === 'bass' ? 'blue' : 'orange'
  return {
    ...emptyScene(clef, ROOM),
    cols: 1,
    small: true,
    key: G_MAJOR,
    marks:
      shown === null ? [] : [{ note: shown, tone: sounding ? tone : 'rest' }],
    keyLit:
      shown !== null && sounding && covered(shown, G_MAJOR)
        ? { sign: keyLetters(G_MAJOR).indexOf(shown.letter), tone }
        : null,
  }
}

/**
 * Circle of fifths' four beads at their seats, C at the top, each named
 * with its letter alone; the house at key `at`, its bead lit while its
 * note sounds.
 */
export function circleScene(at: number, sounding: boolean): CircleScene {
  const beads: BeadView[] = CIRCLE_NOTES.map((n, seat) => ({
    pc: midiOf(n) % 12,
    angle: angleOf(seat),
    look: sounding && seat === at ? 'lit' : 'rest',
    names: [n.letter],
    big: true,
  }))
  return {
    beads,
    fifths: true,
    house: angleOf(at),
    thread: [],
    gap: null,
    small: true,
  }
}

/** Draws Equal temperament's thirteen tiles into `el`, all one width, tile `lit` lit. */
export function drawTiles(
  el: SVGSVGElement,
  lit: number | null,
  size: { w: number; h: number },
): void {
  const { w, h } = size
  const gap = 1.5
  const tile = (w - 4 - (TILES - 1) * gap) / TILES
  const tall = Math.min(44, h * 0.4)
  const top = (h - tall) / 2
  el.setAttribute('viewBox', `0 0 ${w} ${h}`)
  el.replaceChildren()
  for (let i = 0; i < TILES; i++)
    svg(
      'rect',
      {
        x: (2 + i * (tile + gap)).toFixed(2),
        y: top.toFixed(2),
        width: tile.toFixed(2),
        height: tall.toFixed(2),
        rx: 1,
        class: i === lit ? 'et-tile is-lit' : 'et-tile',
      },
      el,
    )
}

// ---------------------------------------------------------------- the strip

/** A word's figure: drawn at rest, lit note by note as its play sounds. */
interface Figure {
  /** Draws the figure as it stands, at its laid-out size. */
  draw(): void
  /** A play starts afresh. */
  start(): void
  /** Its play's note `i` starts sounding. */
  on(i: number): void
  /** Note `i`'s sound ends. */
  off(i: number): void
  /** Its play ends, heard or cut short: whatever still sounds goes dark, the rest stays as the play left it. */
  rest(): void
}

const fig = (word: WordId): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word-fig="${word}"]`)

function keyFigure(): Figure {
  const el = fig('key')
  let sounded: number | null = null
  const draw = (): void => {
    drawCircle(el, keyScene(sounded), circleSize(el))
  }
  return {
    draw,
    start() {
      sounded = 0
      draw()
    },
    on(i) {
      sounded = i + 1
      draw()
    },
    off: () => undefined,
    rest: draw,
  }
}

function signatureFigure(): Figure & {
  readonly clef: Clef
  setClef(c: Clef): void
} {
  const el = fig('signature')
  let clef: Clef = learnerClef()
  let shown: number | null = null
  let sounding = false
  const draw = (): void => {
    const n = shown === null ? null : signatureScale(clef)[shown]
    drawScene(el, signatureScene(clef, n, sounding), figureSize(el))
  }
  return {
    get clef() {
      return clef
    },
    setClef(c) {
      clef = c
      shown = null
      sounding = false
      draw()
    },
    draw,
    start() {
      shown = null
      sounding = false
      draw()
    },
    on(i) {
      shown = i
      sounding = true
      draw()
    },
    off(i) {
      if (shown !== i) return
      sounding = false
      draw()
    },
    rest() {
      sounding = false
      draw()
    },
  }
}

function circleFigure(): Figure {
  const el = fig('circle')
  let at = 0
  let sounding = false
  const draw = (): void => {
    drawCircle(el, circleScene(at, sounding), circleSize(el))
  }
  return {
    draw,
    start() {
      at = 0
      sounding = false
      draw()
    },
    on(i) {
      at = i
      sounding = true
      draw()
    },
    off(i) {
      if (at !== i) return
      sounding = false
      draw()
    },
    rest() {
      sounding = false
      draw()
    },
  }
}

function equalFigure(): Figure {
  const el = fig('equal')
  let lit: number | null = null
  const draw = (): void => {
    drawTiles(el, lit, figureSize(el))
  }
  return {
    draw,
    start() {
      lit = null
      draw()
    },
    on(i) {
      lit = i
      draw()
    },
    off(i) {
      if (lit !== i) return
      lit = null
      draw()
    },
    rest() {
      lit = null
      draw()
    },
  }
}

/** Mounts the four words' figures and plays. */
export function initWords(): void {
  const signature = signatureFigure()
  const figures: Record<WordId, Figure> = {
    key: keyFigure(),
    signature,
    circle: circleFigure(),
    equal: equalFigure(),
  }
  const runs: Partial<Record<WordId, Run>> = {}
  const timers: Record<WordId, number[]> = {
    key: [],
    signature: [],
    circle: [],
    equal: [],
  }
  for (const w of WORD_IDS) figures[w].draw()

  /** A word's figure rests as its play left it, its notes' timers cleared. */
  function rest(w: WordId): void {
    timers[w].forEach((id) => window.clearTimeout(id))
    timers[w] = []
    figures[w].rest()
  }

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isWord(w)) return
    const f = figures[w]
    timers[w].forEach((id) => window.clearTimeout(id))
    timers[w] = []
    f.start()
    const notes = wordNotes(w, signature.clef)
    const r = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (n, i) => {
        f.on(i)
        timers[w].push(window.setTimeout(() => f.off(i), n.dur * 1000))
      },
    })
    runs[w] = r
    // heard to its end, or ended by the Sound switch or a hidden page:
    // either way the figure rests as the play left it
    await r.done
    if (runs[w] !== r) return
    delete runs[w]
    rest(w)
  }

  bindWordPlays(q('#words'), play, {
    owner: NowPlaying,
    stop: (w) => {
      if (!isWord(w)) return
      runs[w]?.stop()
      delete runs[w]
      rest(w)
    },
  })
  // the staff follows Sing it's voice choice at once, written afresh
  VoiceChoice.subscribe(() => {
    if (signature.clef === learnerClef()) return
    runs.signature?.stop()
    delete runs.signature
    rest('signature')
    signature.setClef(learnerClef())
  })
  // the figures redraw at their own size once laid out
  if (typeof ResizeObserver === 'function')
    for (const el of qa('[data-word-fig]'))
      new ResizeObserver(() => {
        const w = el.getAttribute('data-word-fig') ?? ''
        if (isWord(w)) figures[w].draw()
      }).observe(el)
}
