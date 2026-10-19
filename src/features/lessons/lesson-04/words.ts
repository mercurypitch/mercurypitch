// ============================================================
// Lesson 4 four words — scale, tonic, scale degree and solfège, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button, with four
// new figures (FACTS 61): a three-stair staircase for scale, which climbs as
// C4 up to C5 plays; one stair with the house glyph for tonic, lit while C4
// sounds for a second; three numbered stairs for scale degree, lit in turn
// with C4, D4 and E4; and three syllable chips for solfège, lit in turn as
// Merc sings do, re, mi. Pitch is height in every figure.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { NoteEvent } from './examples'
import { FIRST_THREE, playNotes, scaleUp, TONIC_NOTE } from './examples'

/** One part of a figure that lights while its note sounds. */
interface Lamp {
  on(): void
  off(): void
}

const STAIR_FILL = rgba(COLOR.chrome, 0.12)
const STAIR_LIT = rgba(COLOR.chrome, 0.42)

/** A stair block in a stub, its tread a bright line, lit by its lamp. */
function stair(
  host: SVGSVGElement,
  x: number,
  top: number,
  w: number,
  label?: string,
): Lamp {
  const g = svg('g', {}, host)
  const body = svg(
    'rect',
    {
      x,
      y: top,
      width: w,
      height: 104 - top,
      fill: STAIR_FILL,
      stroke: rgba(COLOR.chrome, 0.28),
    },
    g,
  )
  const tread = svg(
    'rect',
    { x, y: top, width: w, height: 3, fill: rgba(COLOR.chrome, 0.85) },
    g,
  )
  if (label !== undefined)
    svg(
      'text',
      {
        x: x + w / 2,
        y: top - 6,
        'text-anchor': 'middle',
        fill: COLOR.ink,
        'font-family': 'Outfit, sans-serif',
        'font-weight': 600,
        'font-size': 13,
        text: label,
      },
      g,
    )
  return {
    on() {
      body.setAttribute('fill', STAIR_LIT)
      tread.setAttribute('fill', '#ffffff')
    },
    off() {
      body.setAttribute('fill', STAIR_FILL)
      tread.setAttribute('fill', rgba(COLOR.chrome, 0.85))
    },
  }
}

/** The house glyph from the page's sprite, centred on (cx, cy). */
function home(host: SVGSVGElement, cx: number, cy: number, size: number): void {
  svg(
    'use',
    {
      href: '#i-home',
      x: cx - size / 2,
      y: cy - size / 2,
      width: size,
      height: size,
      fill: 'none',
      stroke: COLOR.ink,
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    host,
  )
}

/** A syllable chip, lit as Merc sings it. */
function chip(host: SVGSVGElement, y: number, text: string): Lamp {
  const g = svg('g', {}, host)
  const pill = svg(
    'rect',
    {
      x: 6,
      y,
      width: 52,
      height: 24,
      rx: 12,
      fill: 'none',
      stroke: rgba(COLOR.chrome, 0.45),
    },
    g,
  )
  const label = svg(
    'text',
    {
      x: 32,
      y: y + 16.5,
      'text-anchor': 'middle',
      fill: COLOR.ink2,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 13,
      text,
    },
    g,
  )
  return {
    on() {
      pill.setAttribute('fill', rgba(COLOR.blue, 0.22))
      pill.setAttribute('stroke', COLOR.blue)
      label.setAttribute('fill', COLOR.ink)
    },
    off() {
      pill.setAttribute('fill', 'none')
      pill.setAttribute('stroke', rgba(COLOR.chrome, 0.45))
      label.setAttribute('fill', COLOR.ink2)
    },
  }
}

/** What a word plays, and which lamp each of its notes lights. */
interface WordPlay {
  readonly events: readonly NoteEvent[]
  readonly lamps: readonly Lamp[]
  readonly lampFor: (i: number) => number
  readonly kind?: 'merc'
}

const stub = (word: string): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

function scaleWord(): WordPlay {
  // three stairs climbing; the scale's eight notes climb them in thirds
  const host = stub('scale')
  const lamps = [0, 1, 2].map((k) => stair(host, 4 + k * 19, 76 - k * 22, 17))
  return {
    events: scaleUp(60),
    lamps,
    lampFor: (i) => Math.min(2, Math.floor((i * 3) / 8)),
  }
}

function tonicWord(): WordPlay {
  const host = stub('tonic')
  const lamp = stair(host, 10, 58, 44)
  home(host, 32, 81, 22)
  return { events: TONIC_NOTE, lamps: [lamp], lampFor: () => 0 }
}

function degreeWord(): WordPlay {
  const host = stub('degree')
  // C, D, E: two semitones a step, so the stairs climb evenly
  const lamps = ['1', '2', '3'].map((n, k) =>
    stair(host, 4 + k * 19, 80 - k * 22, 17, n),
  )
  return { events: FIRST_THREE, lamps, lampFor: (i) => i }
}

function solfegeWord(): WordPlay {
  const host = stub('solfege')
  const lamps = ['mi', 're', 'do'].map((s, k) => chip(host, 18 + k * 32, s))
  // do is lowest: it sits at the foot, mi at the top
  return {
    events: FIRST_THREE,
    lamps,
    lampFor: (i) => 2 - i,
    kind: 'merc',
  }
}

export function initWords(): void {
  const plays: Record<string, WordPlay> = {
    scale: scaleWord(),
    tonic: tonicWord(),
    degree: degreeWord(),
    solfege: solfegeWord(),
  }
  const busy = new Set<string>()
  qa<HTMLButtonElement>('[data-word-play]').forEach((b) =>
    b.addEventListener('click', () => {
      const word = b.dataset.wordPlay ?? ''
      const play = plays[word]
      if (play === undefined || busy.has(word)) return
      busy.add(word)
      b.classList.add('is-on')
      void playNotes(play.events, {
        audible: Sound.canPlay(),
        kind: play.kind,
        onNote: (e, i) => {
          const lamp = play.lamps[play.lampFor(i)]
          play.lamps.forEach((l) => l.off())
          lamp.on()
          window.setTimeout(() => {
            if (i === play.events.length - 1) lamp.off()
          }, e.dur * 1000)
        },
      }).then(() => {
        busy.delete(word)
        b.classList.remove('is-on')
        play.lamps.forEach((l) => l.off())
      })
    }),
  )
}
