// ============================================================
// Lesson 2 four words — semitone, tone, sharp and flat, cent, each heard
// ============================================================
//
// Each ticket's stub is a small drawing of its word, and its button plays
// it at the film's pitches: a semitone is two tiles that touch (A3 to A♯3,
// the film's first step, FACTS 42); a tone is two tiles with one between
// (A3 to B3); sharp and flat are two arrows onto one dark tile (C4 to C♯4);
// a cent is a hundredth of a ruler one semitone tall (the 100-cent glide,
// FACTS 25). A tile lights while its note sounds; the cent's bead climbs
// with the glide, or under reduced motion stays put while its count runs.
// The dark tiles' names follow the page's spelling.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { Names, namesFor } from '@/features/lessons/kit/names'
import { COLOR, isBlack, nameOf, rgba, signName, } from '@/features/lessons/kit/notes'
import { playContour, Sound } from '@/features/lessons/kit/sound'
import { KEY_LOOK } from '@/features/lessons/kit/spiral-keys'
import type { NoteEvent } from './examples'
import { A_TO_B, C_TO_C_SHARP, CENTS_GLIDE, FIRST_STEP, glideCents, playNotes, } from './examples'

/** A tile in a stub: its note and the rectangle it fills. */
interface StubTile {
  readonly midi: number
  readonly rect: SVGRectElement
  readonly label: SVGTextElement | null
}

const FACE = { white: KEY_LOOK.whiteTop, dark: KEY_LOOK.black }
const LIT = { white: '#ffffff', dark: COLOR.chrome }

/** Writes a dark tile's names in the page's spelling, stacked sharp above flat in Both. */
function writeDark(label: SVGTextElement, midi: number): void {
  label.textContent = ''
  const names = namesFor(midi, Names.mode)
  const x = label.getAttribute('x')
  names.forEach((n, i) =>
    svg(
      'tspan',
      {
        x,
        dy: i === 0 ? -(names.length - 1) * 14 : 14,
        text: signName(n, { octave: false }),
      },
      label,
    ),
  )
}

/** One tile, its name inside it at the foot (a dark tile's follows the spelling). */
function tile(
  host: SVGSVGElement,
  midi: number,
  x: number,
  w: number,
  named: boolean,
): StubTile {
  const black = isBlack(midi)
  const rect = svg(
    'rect',
    {
      x,
      y: 28,
      width: w,
      height: 56,
      rx: 3,
      fill: black ? FACE.dark : FACE.white,
      stroke: black ? KEY_LOOK.blackEdge : 'none',
    },
    host,
  )
  const label = named
    ? svg(
        'text',
        {
          x: x + w / 2,
          y: 77,
          'text-anchor': 'middle',
          fill: black ? COLOR.chrome : KEY_LOOK.whiteInk,
          'font-family': 'Outfit, sans-serif',
          'font-weight': 600,
          'font-size': 12,
          text: black ? null : (nameOf(midi) ?? '').replace(/\d/, ''),
        },
        host,
      )
    : null
  if (label !== null && black) writeDark(label, midi)
  return { midi, rect, label }
}

/** A step bar under the tiles, from one centre to another, a notch per semitone, and its count. */
function bar(host: SVGSVGElement, xs: readonly number[], label: string): void {
  const stroke = rgba(COLOR.chrome, 0.85)
  svg(
    'line',
    {
      x1: xs[0],
      x2: xs[xs.length - 1],
      y1: 98,
      y2: 98,
      stroke,
      'stroke-width': 2,
    },
    host,
  )
  for (const x of xs)
    svg(
      'line',
      { x1: x, x2: x, y1: 93, y2: 103, stroke, 'stroke-width': 1.5 },
      host,
    )
  svg(
    'text',
    {
      x: (xs[0] + xs[xs.length - 1]) / 2,
      y: 118,
      'text-anchor': 'middle',
      fill: COLOR.ink,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 14,
      text: label,
    },
    host,
  )
}

/** An arrow bowing from (x0, y0) to (x1, y1), its sign at the bow's peak. */
function arrow(
  host: SVGSVGElement,
  from: readonly [number, number],
  to: readonly [number, number],
  bow: number,
  sign: string,
): SVGGElement {
  const g = svg(
    'g',
    { stroke: COLOR.ink, fill: 'none', 'stroke-width': 1.6, opacity: 0.55 },
    host,
  )
  const mx = (from[0] + to[0]) / 2
  const my = (from[1] + to[1]) / 2 + bow
  svg(
    'path',
    {
      d: `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`,
      'stroke-linecap': 'round',
    },
    g,
  )
  const ang = Math.atan2(to[1] - my, to[0] - mx)
  const head = (da: number): string =>
    `${(to[0] - 6 * Math.cos(ang + da)).toFixed(1)} ${(to[1] - 6 * Math.sin(ang + da)).toFixed(1)}`
  svg(
    'path',
    {
      d: `M${head(-0.5)} L${to[0]} ${to[1]} L${head(0.5)}`,
      'stroke-linejoin': 'round',
    },
    g,
  )
  svg(
    'text',
    {
      x: mx,
      y: my + (bow < 0 ? -2 : 12),
      'text-anchor': 'middle',
      fill: COLOR.ink,
      stroke: 'none',
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 14,
      text: sign,
    },
    g,
  )
  return g
}

/** Lights a tile while its note sounds. */
function flash(t: StubTile, dur: number): void {
  const black = isBlack(t.midi)
  t.rect.setAttribute('fill', black ? LIT.dark : LIT.white)
  if (t.label !== null && black) t.label.setAttribute('fill', COLOR.bg)
  window.setTimeout(() => {
    t.rect.setAttribute('fill', black ? FACE.dark : FACE.white)
    if (t.label !== null && black) t.label.setAttribute('fill', COLOR.chrome)
  }, dur * 1000)
}

/** A word's play: what it sounds, and what lights as it does. */
interface WordPlay {
  run(audible: boolean): Promise<void>
}

/** Two or three tiles, one example lighting them note by note. */
function tilesWord(
  host: SVGSVGElement,
  notes: readonly number[],
  events: readonly NoteEvent[],
  o: {
    named: (midi: number) => boolean
    bar?: string
    extra?: (tiles: readonly StubTile[]) => void
  },
): { play: WordPlay; tiles: readonly StubTile[] } {
  const gap = 2
  const w = (60 - gap * (notes.length - 1)) / notes.length
  const tiles = notes.map((m, i) =>
    tile(host, m, 2 + i * (w + gap), w, o.named(m)),
  )
  const centre = (t: StubTile): number =>
    Number(t.rect.getAttribute('x')) + w / 2
  if (o.bar !== undefined) {
    const first = tiles[0]
    const last = tiles[tiles.length - 1]
    const xs = tiles
      .filter((t) => t === first || t === last || o.bar === '2')
      .map(centre)
    bar(host, xs, o.bar)
  }
  o.extra?.(tiles)
  return {
    tiles,
    play: {
      run: (audible) =>
        playNotes(events, audible, (e) => {
          const t = tiles.find((x) => x.midi === e.midi)
          if (t !== undefined) flash(t, e.dur)
        }),
    },
  }
}

/** The cent: a ruler one semitone tall, its bead climbing 100 cents with the glide. */
function centWord(host: SVGSVGElement): WordPlay {
  const x = 22
  const top = 22
  const bottom = 102
  svg(
    'line',
    { x1: x, x2: x, y1: top, y2: bottom, stroke: rgba(COLOR.chrome, 0.35) },
    host,
  )
  for (let c = 0; c <= 100; c += 10) {
    const y = bottom - (c / 100) * (bottom - top)
    const len = c % 50 === 0 ? 7 : 3.5
    svg(
      'line',
      {
        x1: x - len,
        x2: x + len,
        y1: y,
        y2: y,
        stroke: rgba(COLOR.chrome, c % 50 === 0 ? 0.6 : 0.35),
      },
      host,
    )
  }
  const count = svg(
    'text',
    {
      x: 44,
      y: 66,
      'text-anchor': 'middle',
      fill: COLOR.ink,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 18,
      text: '0',
    },
    host,
  )
  svg(
    'text',
    {
      x: 44,
      y: 84,
      'text-anchor': 'middle',
      class: 'svg-mono',
      fill: COLOR.ink3,
      text: '¢',
    },
    host,
  )
  const bead = svg(
    'circle',
    {
      cx: x,
      cy: bottom,
      r: 5.5,
      fill: COLOR.chrome,
      style: 'filter: drop-shadow(0 0 6px rgba(195,204,214,.8))',
    },
    host,
  )
  return {
    async run(audible) {
      const t0 = performance.now()
      let live = true
      const frame = (now: number): void => {
        const c = glideCents((now - t0) / 1000)
        count.textContent = String(Math.round(c))
        if (!reducedMotion())
          bead.setAttribute(
            'cy',
            (bottom - (c / 100) * (bottom - top)).toFixed(1),
          )
        if (live) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      await playContour(CENTS_GLIDE, { audible })
      live = false
      count.textContent = '100'
      window.setTimeout(() => {
        count.textContent = '0'
        bead.setAttribute('cy', String(bottom))
      }, 900)
    },
  }
}

export function initWords(): void {
  const stub = (word: string): SVGSVGElement =>
    q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)
  const named: StubTile[] = []

  const semitone = tilesWord(stub('semitone'), [57, 58], FIRST_STEP, {
    named: () => true,
    bar: '1',
  })
  const tone = tilesWord(stub('tone'), [57, 58, 59], A_TO_B, {
    named: (m) => !isBlack(m),
    bar: '2',
  })
  const signs = tilesWord(stub('signs'), [60, 61, 62], C_TO_C_SHARP, {
    named: (m) => !isBlack(m),
    extra: (tiles) => {
      const [c, , d] = tiles
      const cx = (t: StubTile): number =>
        Number(t.rect.getAttribute('x')) +
        Number(t.rect.getAttribute('width')) / 2
      arrow(stub('signs'), [cx(c), 26], [31, 26], -16, '♯')
      arrow(stub('signs'), [cx(d), 86], [33, 86], 16, '♭')
    },
  })
  named.push(
    ...semitone.tiles.filter((t) => isBlack(t.midi) && t.label !== null),
  )

  const plays: Record<string, WordPlay> = {
    semitone: semitone.play,
    tone: tone.play,
    signs: signs.play,
    cent: centWord(stub('cent')),
  }

  Names.subscribe(() => {
    for (const t of named) if (t.label !== null) writeDark(t.label, t.midi)
  })

  const busy = new Set<string>()
  qa<HTMLButtonElement>('[data-word-play]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = b.dataset.wordPlay ?? ''
      const play = plays[w]
      if (play === undefined || busy.has(w)) return
      busy.add(w)
      b.classList.add('is-on')
      void play.run(Sound.canPlay()).then(() => {
        busy.delete(w)
        b.classList.remove('is-on')
      })
    }),
  )
}
