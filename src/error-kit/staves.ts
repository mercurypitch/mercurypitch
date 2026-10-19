// ============================================================
// Error staves — the picture each error state hangs over the sea
// ============================================================
//
// A stave of light drawn across the sky of the First Light plate, as an
// inline SVG string so a static page carries its picture with no request
// and no script. Each state changes the stave, never the layout: on the
// not-found page one note of the phrase has floated off its line, a ghost
// marks where it belongs, and a dotted glide runs between them.
//
// The drawing is decoration (aria-hidden); the page's words carry the
// meaning. Colours and motion are CSS (src/styles/error-scene.css), so
// another site can recolour the scene, and a visitor who asks for less
// motion gets a still one.

// Relative, not '@/': vite.config.ts loads this through
// tools/generate-error-pages.ts, before the alias exists.
import { G_CLEF_PATH } from '../features/lessons/kit/glyphs'
import type { ErrorState } from './error-states'

/** The viewBox every stave is drawn in: wide, as it spans the window. */
export const STAVE_VIEWBOX = { width: 1600, height: 300 } as const

const STAFF_SPACE = 22
/** The five lines, top to bottom. */
const LINES = [150, 172, 194, 216, 238] as const
/** The G line, where the clef's curl sits. */
const G_LINE = LINES[3]
/** The middle line: a note on it or above takes its stem down. */
const MIDDLE = LINES[2]

interface Note {
  x: number
  y: number
}

// The phrase climbs to D5 and back: F4 G4 A4 B4 C5 [D5] C5 B4 A4 B4 G4.
const PHRASE: readonly Note[] = [
  { x: 300, y: 227 },
  { x: 410, y: 216 },
  { x: 520, y: 205 },
  { x: 630, y: 194 },
  { x: 720, y: 183 },
  { x: 880, y: 183 },
  { x: 970, y: 194 },
  { x: 1080, y: 205 },
  { x: 1190, y: 194 },
  { x: 1300, y: 216 },
]
/** The D5 the phrase is missing. */
const GHOST: Note = { x: 800, y: LINES[1] }
/** Where the missing note went: up, which is sharp. */
const DRIFTED: Note = { x: 800, y: 92 }
/** The drifted note is the picture's subject, drawn larger than the rest. */
const DRIFTED_SCALE = 1.35

const HEAD_RX = 12
const HEAD_RY = 8.5
const STEM = 60

const head = ({ x, y }: Note): string =>
  `<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" transform="rotate(-22 ${x} ${y})" />`

/** A stem on the side engraving puts it: up on the right below the middle
 *  line, down on the left on it or above, unless the drawing asks. */
const stem = ({ x, y }: Note, up = y > MIDDLE): string =>
  up
    ? `<line x1="${x + HEAD_RX - 1}" y1="${y - 2}" x2="${x + HEAD_RX - 1}" y2="${y - STEM}" />`
    : `<line x1="${x - HEAD_RX + 1}" y1="${y + 2}" x2="${x - HEAD_RX + 1}" y2="${y + STEM}" />`

const barline = (x: number): string =>
  `<line x1="${x}" y1="${LINES[0]}" x2="${x}" y2="${LINES[4]}" />`

// The ids are prefixed: the in-app scene will put this SVG inside a page that
// has other SVGs, and an id is global to the document.
const DEFS = [
  '<defs>',
  '<linearGradient id="es-note-fill" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0" class="error-scene__stop-a" />',
  '<stop offset="1" class="error-scene__stop-b" />',
  '</linearGradient>',
  '<filter id="es-glow" x="-200%" y="-200%" width="500%" height="500%">',
  '<feGaussianBlur stdDeviation="10" />',
  '</filter>',
  '</defs>',
].join('')

function staff(): string {
  // Far past the viewBox both ways: the SVG is scaled to fit its height and
  // overflows its box, so on a wide window the lines still reach the edges,
  // where the CSS mask fades them out.
  const lines = LINES.map(
    (y) => `<line x1="-4000" y1="${y}" x2="5600" y2="${y}" />`,
  ).join('')
  const clefScale = (STAFF_SPACE / 244).toFixed(4)
  return [
    `<g class="error-scene__lines">${lines}</g>`,
    `<path class="error-scene__clef" d="${G_CLEF_PATH}" transform="translate(150 ${G_LINE}) scale(${clefScale})" />`,
    `<g class="error-scene__bars">${[575, 1025, 1390].map(barline).join('')}<line class="error-scene__final" x1="1397" y1="${LINES[0]}" x2="1397" y2="${LINES[4]}" /></g>`,
    `<g class="error-scene__phrase">${PHRASE.map((note) => head(note) + stem(note)).join('')}</g>`,
  ].join('')
}

function notFound(): string {
  // From the ghost up to the underside of the drifted head, bowing out to
  // the left so it never runs along the stem.
  const glide = `M${GHOST.x - 4} ${GHOST.y - 10} C ${GHOST.x - 46} ${GHOST.y - 34}, ${DRIFTED.x - 44} ${DRIFTED.y + 40}, ${DRIFTED.x - 8} ${DRIFTED.y + 14}`
  const { x, y } = DRIFTED
  // Its stem goes up, against engraving, so it reads as a note in flight and
  // not as a post standing on the stave.
  const note = `${head(DRIFTED)}${stem(DRIFTED, true)}`
  return [
    staff(),
    `<g class="error-scene__ghost">${head(GHOST)}</g>`,
    `<path class="error-scene__glide" d="${glide}" />`,
    '<g class="error-scene__drift">',
    `<g transform="translate(${x} ${y}) scale(${DRIFTED_SCALE}) translate(${-x} ${-y})">`,
    `<g class="error-scene__halo" filter="url(#es-glow)">${head(DRIFTED)}</g>`,
    `<g class="error-scene__note">${note}</g>`,
    '</g>',
    '</g>',
  ].join('')
}

const DRAWINGS: Record<ErrorState, () => string> = {
  'not-found': notFound,
}

/** The whole stave for a state, as one inline SVG element. */
export function staveSvg(state: ErrorState): string {
  const { width, height } = STAVE_VIEWBOX
  return `<svg class="error-scene__stave" data-state="${state}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${DEFS}${DRAWINGS[state]()}</svg>`
}
