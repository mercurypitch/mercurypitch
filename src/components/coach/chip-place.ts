// ============================================================
// chip-place — where the tour offer floats, so it covers nothing
// ============================================================
//
// The tour chip (TourChip.tsx) floats over its page instead of taking a row
// of it, so showing it and taking it down move nothing. This is the rule for
// where it stands, as a pure function of what is on screen (chip-room.ts
// reads that from the page): boxes in window coordinates, the chip's three
// forms' sizes, and where it may go.
//
// What it may never stand on (`hard`): text, controls, canvases and stages.
// What it stands on only when nothing else is free (`art`): pictures,
// drawings and cards. In order, the chip takes:
//
// 1. The free room at the top of its column (the first BAND px of what is on
//    screen), whole, else in its short form (Merc and one short line). Most
//    tabs have their title on one side and nothing on the other, and the
//    chip takes the far side: the end of the first free row.
// 2. The nearest free spot further down the column, whole or short,
//    whichever is nearer the top.
// 3. Merc alone with his Not now at the top of the column, then the bar over
//    the column (a phone's top bar, between its title and its buttons): a
//    phone's Sing and Piano tabs are a stage from their top row of buttons
//    to their transport, with no room for a line anywhere.
// 4. The same over art: the top of the column, then the nearest spot.
// 5. Nowhere free at all: short, at the end of the column's top, said so
//    (`covers: 'something'`).
//
// The area each place gives is already clear of the window's foot stack
// (the tab bar, the cookie banner, the confirm-email bar and the toasts
// standing on them: lib/foot-space.ts), so no rule here has to know it.

/** A box in window coordinates. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export type ChipForm = 'full' | 'short' | 'mini'

export interface ChipSize {
  width: number
  height: number
}

/** A place the chip may stand in, and what is in it. */
export interface ChipRoom {
  /** Where the chip's box may go. */
  area: Box
  /** Never under the chip: text, controls, canvases, stages. */
  hard: readonly Box[]
  /** Under it only when no free spot is left: pictures, drawings, cards. */
  art: readonly Box[]
}

export interface ChipPlaceInput {
  /** The column the chip is offered in, as much of it as is on screen. */
  column: ChipRoom
  /** The bar over the column, if the page has one the chip may use. */
  bar?: ChipRoom | null
  sizes: Readonly<Record<ChipForm, ChipSize>>
}

export interface ChipPlacement {
  form: ChipForm
  /** Where the chip's box goes, in window coordinates. */
  left: number
  top: number
  where: 'column' | 'bar'
  /** What is under it: art only where nothing was free, more only where no art was. */
  covers: 'nothing' | 'art' | 'something'
}

/** The top of the column: the chip's top within this many px of the area's. */
export const BAND = 72
/** The room the chip keeps from anything near it. */
export const GAP = 4

interface Spot {
  left: number
  top: number
}

/** The x-spans `blocks` take in the row from `top`, `height` tall, with the gap. */
function takenSpans(
  blocks: readonly Box[],
  top: number,
  height: number,
): [number, number][] {
  return blocks
    .filter((b) => b.top - GAP < top + height && b.bottom + GAP > top)
    .map((b): [number, number] => [b.left - GAP, b.right + GAP])
    .sort((a, b) => a[0] - b[0])
}

/** The end-most free span of `area` at least `width` wide, given the spans taken. */
function endmostFree(
  area: Box,
  taken: readonly [number, number][],
  width: number,
): [number, number] | null {
  let found: [number, number] | null = null
  let from = area.left
  for (const [start, end] of taken) {
    if (start - from >= width) found = [from, start]
    from = Math.max(from, end)
  }
  if (area.right - from >= width) found = [from, area.right]
  return found
}

/**
 * The topmost spot in `area` where a box of `size` touches none of `blocks`,
 * at the end of its row; none whose top is lower than `lowest`.
 */
export function freeSpot(
  area: Box,
  blocks: readonly Box[],
  size: ChipSize,
  lowest = Number.POSITIVE_INFINITY,
): Spot | null {
  // A row can only open at the area's top or just under a block.
  const rows = [area.top, ...blocks.map((b) => b.bottom + GAP)]
    .filter((top) => top >= area.top && top <= lowest)
    .filter((top) => top + size.height <= area.bottom)
    .sort((a, b) => a - b)
  for (const top of rows) {
    const span = endmostFree(
      area,
      takenSpans(blocks, top, size.height),
      size.width,
    )
    if (span !== null) return { left: span[1] - size.width, top }
  }
  return null
}

type Try = () => ChipPlacement | null

interface Ask {
  room: ChipRoom | null | undefined
  where: ChipPlacement['where']
  /** Over art too, or clear of it. */
  overArt: boolean
  form: ChipForm
  lowest?: number
}

function inRoom(
  ask: Ask,
  sizes: ChipPlaceInput['sizes'],
): ChipPlacement | null {
  const room = ask.room
  if (room === null || room === undefined) return null
  const blocks = ask.overArt ? room.hard : [...room.hard, ...room.art]
  const spot = freeSpot(room.area, blocks, sizes[ask.form], ask.lowest)
  if (spot === null) return null
  const covers = ask.overArt ? 'art' : 'nothing'
  return { form: ask.form, ...spot, where: ask.where, covers }
}

/** Whole or short, whichever is nearer the top; whole when they tie. */
function nearer(
  a: ChipPlacement | null,
  b: ChipPlacement | null,
): ChipPlacement | null {
  if (a === null) return b
  if (b === null) return a
  return b.top < a.top ? b : a
}

/** Where the chip stands: the first of the rule's places that is free. */
export function placeChip(input: ChipPlaceInput): ChipPlacement {
  const { column, bar, sizes } = input
  const band = column.area.top + BAND
  const col = (form: ChipForm, overArt: boolean, lowest?: number) =>
    inRoom({ room: column, where: 'column', overArt, form, lowest }, sizes)
  const inBar = (form: ChipForm) =>
    inRoom({ room: bar, where: 'bar', overArt: false, form }, sizes)
  // Whole at the top first; then whole or short, nearest the top, which
  // takes the short form by the title where the whole does not fit there.
  const tries: Try[] = [
    () => col('full', false, band),
    () => nearer(col('full', false), col('short', false)),
    () => col('mini', false, band),
    () => inBar('short'),
    () => inBar('mini'),
    () => col('full', true, band),
    () => nearer(col('full', true), col('short', true)),
  ]
  for (const attempt of tries) {
    const placed = attempt()
    if (placed !== null) return placed
  }
  return {
    form: 'short',
    left: Math.max(column.area.left, column.area.right - sizes.short.width),
    top: column.area.top,
    where: 'column',
    covers: 'something',
  }
}

/**
 * True while the chip's box `at` still covers no more than it did when it
 * was placed: nothing hard, and no art if it was placed clear of art. With
 * half the gap, so a spot rounded to whole pixels still holds.
 */
export function stillClear(
  room: ChipRoom,
  at: Box,
  covers: ChipPlacement['covers'],
): boolean {
  if (covers === 'something') return false
  const blocks = covers === 'art' ? room.hard : [...room.hard, ...room.art]
  const near = GAP / 2
  return !blocks.some(
    (b) =>
      b.left < at.right + near &&
      b.right + near > at.left &&
      b.top < at.bottom + near &&
      b.bottom + near > at.top,
  )
}
