// ============================================================
// chip-room — what is on screen where the tour chip may float
// ============================================================
//
// Reads a place for the tour chip (TourChip.tsx) off the page, for the rule
// in chip-place.ts: the part of it on screen, less the window's foot stack,
// and the boxes in it the chip must not cover.
//
// - Hard: every line of text (its own line boxes, so a title's empty end is
//   free room), every control as far as it takes a press, and canvases,
//   video and stages.
// - Art: pictures and drawings (img, svg), and cards: a box that shows a
//   background, a border or a shadow, inside the page's edges. A band from
//   edge to edge of it (a toolbar's ground, a panel's) is the page itself.
// - Clipped content is read as far as it shows, and a layer over the page
//   that the walk cannot see (a pill or a drawer from elsewhere in the
//   document) is found by hit-testing where the chip would go.
// - The foot stack (lib/foot-space.ts): the tab bar, the cookie banner and
//   the confirm-email bar publish their room on <html>, and on a phone the
//   toasts stand on them (Notifications.module.css), one toast's height.
//   On a wide screen the toasts stand in the window's top corner, over the
//   header and not the column.

import type { Box, ChipRoom } from './chip-place'

/** What the chip must never cover. */
const HARD = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  'canvas',
  'video',
  'iframe',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[contenteditable="true"]',
  '[data-stage-canvas]',
  '#canvas-container',
].join(', ')

const ART = 'img, svg, picture'

/** The room a page's own edges keep around the chip. */
export interface Inset {
  top: number
  side: number
  bottom: number
}

const NARROW = '(max-width: 768px)'
/** One toast on a phone: its 0.6rem lift and its 2.4rem (Notifications.module.css). */
const TOAST_REM = 3

const meet = (a: Box, b: Box): Box => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
})

const isEmpty = (b: Box): boolean => b.right <= b.left || b.bottom <= b.top

const touches = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const boxOf = (r: DOMRect | Box): Box => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
})

function cssPx(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

/** How far up from the window's foot the foot stack, and a phone's toasts, reach. */
export function footRoom(): number {
  const root = document.documentElement
  const style = window.getComputedStyle(root)
  const stack = Math.max(
    cssPx(style, '--tabbar-space'),
    cssPx(style, '--consent-banner-space'),
    cssPx(style, '--verify-banner-space'),
  )
  if (!window.matchMedia(NARROW).matches) return stack
  const rem = Number.parseFloat(style.fontSize) || 16
  return stack + TOAST_REM * rem
}

/** The part of `el` on screen, inside its scrollbar, less `inset` and the foot stack. */
export function areaOf(el: Element, inset: Inset): Box {
  const r = el.getBoundingClientRect()
  const left = r.left + el.clientLeft
  const top = r.top + el.clientTop
  const width = el.clientWidth > 0 ? el.clientWidth : r.width
  const height = el.clientHeight > 0 ? el.clientHeight : r.height
  return {
    left: left + inset.side,
    top: Math.max(top, 0) + inset.top,
    right: left + width - inset.side,
    bottom:
      Math.min(top + height, window.innerHeight - footRoom()) - inset.bottom,
  }
}

function alphaOf(color: string): number {
  if (color === 'transparent' || color === '') return 0
  const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color)
  if (slash) return Number(slash[1]) / (slash[2] === '%' ? 100 : 1)
  const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)
  return rgba ? Number(rgba[1]) : 1
}

const isSet = (value: string): boolean => value !== '' && value !== 'none'

/** A box anyone would see: a background, a border or a shadow. */
function showsBox(style: CSSStyleDeclaration): boolean {
  if (isSet(style.backgroundImage)) return true
  if (alphaOf(style.backgroundColor) > 0.05) return true
  if (isSet(style.boxShadow)) return true
  return (
    Number.parseFloat(style.borderTopWidth) > 0 &&
    alphaOf(style.borderTopColor) > 0.05
  )
}

const clipsOverflow = (style: CSSStyleDeclaration): boolean =>
  style.overflowX !== 'visible' || style.overflowY !== 'visible'

const union = (a: Box, b: Box): Box => ({
  left: Math.min(a.left, b.left),
  top: Math.min(a.top, b.top),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom),
})

/** The parts a control can take a press in beyond its own box. */
const PRESS_PARTS = ['::before', '::after'] as const

/** How far a transform moves a box, when all it does is move it. */
function moveOf(transform: string): { x: number; y: number } | null {
  if (transform === '' || transform === 'none') return { x: 0, y: 0 }
  const matrix = /^matrix\(([^)]+)\)$/.exec(transform)
  if (matrix === null) return null
  const [a, b, c, d, x, y] = matrix[1].split(',').map(Number)
  return a === 1 && b === 0 && c === 0 && d === 1 ? { x, y } : null
}

/**
 * The window box `part` (a ::before or ::after of `el`, drawn at `at`) takes
 * a press in: none where it draws nothing or takes no press, and none where
 * it is not stood in `el`'s own padding box or is turned or scaled.
 */
function partPress(
  el: Element,
  at: DOMRect,
  part: CSSStyleDeclaration,
): Box | null {
  const value = (name: string): string => part.getPropertyValue(name)
  if (['', 'none', 'normal'].includes(value('content'))) return null
  if (value('display') === 'none' || value('visibility') === 'hidden') {
    return null
  }
  if (value('pointer-events') === 'none') return null
  if (value('position') !== 'absolute') return null
  const move = moveOf(value('transform'))
  const [left, top, width, height] = ['left', 'top', 'width', 'height'].map(
    (name) => Number.parseFloat(value(name)),
  )
  if (move === null || ![left, top, width, height].every(Number.isFinite)) {
    return null
  }
  const x = at.left + el.clientLeft + left + cssPx(part, 'margin-left')
  const y = at.top + el.clientTop + top + cssPx(part, 'margin-top')
  return {
    left: x + move.x,
    top: y + move.y,
    right: x + move.x + width,
    bottom: y + move.y + height,
  }
}

/**
 * Where control `el` takes a press: its own box, and the invisible one a
 * small control is given so a finger can hit it, a ::before or ::after
 * stood in its padding box (AppHeader.css; the docked voice mic's reaches
 * 6.6 px past its left). A press the chip stood on would go to the chip.
 */
function pressOf(el: Element, style: CSSStyleDeclaration, at: DOMRect): Box {
  let press = boxOf(at)
  // Only a control that positions its children stands a part in its box.
  if (style.position === '' || style.position === 'static') return press
  for (const name of PRESS_PARTS) {
    const part = partPress(el, at, window.getComputedStyle(el, name))
    if (part !== null) press = union(press, part)
  }
  return press
}

interface Walk {
  area: Box
  /** The page's own box: a band from edge to edge of it is the page. */
  edge: Box
  skip: Element | null
  hard: Box[]
  art: Box[]
}

function readText(node: Node, clip: Box, walk: Walk): void {
  if ((node.textContent ?? '').trim() === '') return
  const range = document.createRange()
  range.selectNodeContents(node)
  for (const line of range.getClientRects()) {
    const seen = meet(boxOf(line), clip)
    if (!isEmpty(seen) && touches(seen, walk.area)) walk.hard.push(seen)
  }
}

/**
 * A card, not the page: not a band from edge to edge of the page (a
 * toolbar, a section's ground). A card can be as tall as the window on a
 * phone (Challenges' first), so its size says nothing.
 */
const isCard = (b: Box, edge: Box): boolean =>
  b.left > edge.left + 2 || b.right < edge.right - 2

/** What `el` is to the chip, by itself: hard, art, or nothing (look inside). */
function kindOf(
  el: Element,
  style: CSSStyleDeclaration,
  seen: Box,
  edge: Box,
): 'hard' | 'art' | null {
  if (el.matches(HARD)) return 'hard'
  if (el.matches(ART)) return 'art'
  return showsBox(style) && isCard(seen, edge) ? 'art' : null
}

function readElement(el: Element, clip: Box, walk: Walk): void {
  if (el === walk.skip) return
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return
  const at = el.getBoundingClientRect()
  const seen = meet(boxOf(at), clip)
  const shows = style.display !== 'contents' && !isEmpty(seen)
  const kind = shows ? kindOf(el, style, seen, walk.edge) : null
  // A control counts as far as it takes a press, and that as far as it shows.
  const taken = kind === 'hard' ? meet(pressOf(el, style, at), clip) : seen
  if (kind !== null && touches(taken, walk.area)) walk[kind].push(taken)
  // A control holds its own words, and a picture has none.
  if (kind === 'hard' || el.matches('img, picture')) return
  if (el.tagName.toLowerCase() === 'svg') {
    readDrawing(el, seen, walk)
    return
  }
  const inner = clipsOverflow(style) ? seen : clip
  if (isEmpty(inner)) return
  readChildren(el, inner, walk)
}

/** A drawing's own words, without reading every shape it is drawn with. */
function readDrawing(svg: Element, clip: Box, walk: Walk): void {
  for (const words of svg.querySelectorAll('text')) readText(words, clip, walk)
  for (const html of svg.querySelectorAll('foreignObject')) {
    readChildren(html, clip, walk)
  }
}

function readChildren(el: Element, clip: Box, walk: Walk): void {
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) readText(child, clip, walk)
    else if (child.nodeType === Node.ELEMENT_NODE) {
      readElement(child as Element, clip, walk)
    }
  }
}

/**
 * What is in `area` of `container`, leaving out `skip` (the chip's own
 * anchor). `container` itself is the page the chip floats over, not a card.
 */
export function readRoom(
  container: Element,
  area: Box,
  skip: Element | null,
): ChipRoom {
  const edge = boxOf(container.getBoundingClientRect())
  const walk: Walk = { area, edge, skip, hard: [], art: [] }
  readChildren(container, edge, walk)
  return { area, hard: walk.hard, art: walk.art }
}

/** Hit-test points across `box`, every `step` px or so, edges included. */
function pointsIn(box: Box, step: number): [number, number][] {
  const points: [number, number][] = []
  const across = Math.max(1, Math.ceil((box.right - box.left) / step))
  const down = Math.max(1, Math.ceil((box.bottom - box.top) / step))
  for (let i = 0; i <= across; i++) {
    for (let j = 0; j <= down; j++) {
      points.push([
        box.left + 1 + ((box.right - box.left - 2) * i) / across,
        box.top + 1 + ((box.bottom - box.top - 2) * j) / down,
      ])
    }
  }
  return points
}

/**
 * The layers over `box` from outside `rooms` (a floating pill, a drawer):
 * what a hit-test finds there that is not the chip, not inside one of the
 * rooms the walk read, and not one of the rooms or what holds them.
 */
export function layersOver(
  box: Box,
  rooms: readonly Element[],
  chip: Element,
): Box[] {
  const found = new Set<Element>()
  for (const [x, y] of pointsIn(box, 16)) {
    for (const hit of document.elementsFromPoint(x, y)) {
      if (chip.contains(hit)) continue
      if (rooms.some((room) => hit.contains(room) || room.contains(hit))) {
        continue
      }
      found.add(hit)
    }
  }
  // Any box a layer shows counts, a band across the window too.
  const edge = {
    left: -Infinity,
    top: -Infinity,
    right: Infinity,
    bottom: Infinity,
  }
  const over: Box[] = []
  for (const el of found) {
    const style = window.getComputedStyle(el)
    const at = el.getBoundingClientRect()
    const seen = boxOf(at)
    const kind = kindOf(el, style, seen, edge)
    if (kind !== null)
      over.push(kind === 'hard' ? pressOf(el, style, at) : seen)
  }
  return over
}
