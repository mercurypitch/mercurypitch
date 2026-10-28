// ============================================================
// chip-float — keeps the tour chip where it covers nothing
// ============================================================
//
// The tour chip (TourChip.tsx) floats over its page from an anchor that
// takes no room: a zero-height box at the top of the page's column (a row of
// nothing in the app's main column, TourChipHost; nothing in Karaoke Night's
// grid, KaraokeTourChip). This places it by the rule (chip-place.ts) on what
// is on screen (chip-room.ts), and keeps it there:
//
// - In the column it stands from the anchor, so it scrolls with the page,
//   over the same free room. In the bar over the column (a phone's top bar)
//   it stands in the window, as the bar does.
// - It is placed again when the window or the column changes size, and
//   checked when the page under it changes (a list arriving, a card loading,
//   the fonts) or settles. In its first two seconds, as the page settles
//   (a list's skeleton giving way to the list), it takes the rule's best
//   spot each time; after that a spot that is still clear is kept, so the
//   chip does not chase a better one while it is read.
// - A scroll that takes it out of view before it has been seen, or while
//   the page settles in its first two seconds (Path glides to the singer's
//   week as it opens, past the chip), has it placed again where the page
//   comes to rest, so the offer is there to see. Once it has been seen and
//   the page has settled, it stays with the page.
// - Before it is placed it is not drawn, so it never shows where it covers
//   something first. Nothing here moves focus.

import type { Box, ChipForm, ChipPlacement, ChipSize } from './chip-place'
import { GAP, placeChip, stillClear } from './chip-place'
import type { Inset } from './chip-room'
import { areaOf, layersOver, readRoom } from './chip-room'

/** Where the chip floats: its page's column, and a bar over it it may use. */
export interface ChipRoomSource {
  column: () => Element | null
  bar?: () => Element | null
}

export interface FloatOptions {
  room: ChipRoomSource
  /** Called with the form the chip takes. */
  onForm: (form: ChipForm) => void
  /** Whether it has a short line to shrink to. */
  hasShort: boolean
  /** Whether it has been on screen yet. */
  seen: () => boolean
}

const FORMS: readonly ChipForm[] = ['full', 'short', 'mini']
/** Clear of the column's edges, as the row it replaces was. */
const COLUMN_INSET: Inset = { top: 8, side: 12, bottom: 8 }
/** Inside the bar: its height holds the chip with this to spare. */
const BAR_INSET: Inset = { top: 2, side: 8, bottom: 2 }
/** Its first seconds: content that eases in moves under it without a change to the page. */
const SETTLE_MS = [200, 500, 1000, 1800]
/** The page's changes, read together. */
const CHECK_MS = 150
/** A page settling as it opens: its scroll counts as its own this long. */
const PAGE_SETTLE_MS = 2000
/** A scroll has come to rest when it has not moved for this long. */
const SCROLL_REST_MS = 150

const boxOf = (r: DOMRect): Box => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
})

const grow = (b: Box, by: number): Box => ({
  left: b.left - by,
  top: b.top - by,
  right: b.right + by,
  bottom: b.bottom + by,
})

/**
 * Each form's size, drawn in turn at its anchor's corner, so where it stood
 * does not squeeze it; all before the next paint, so none of it shows. A
 * chip with no short line is its whole self where the rule says short.
 */
function measure(
  chip: HTMLElement,
  hasShort: boolean,
): Record<ChipForm, ChipSize> {
  const was = {
    form: chip.dataset.form,
    left: chip.style.left,
    top: chip.style.top,
  }
  chip.style.left = '0px'
  chip.style.top = '0px'
  const sizes = {} as Record<ChipForm, ChipSize>
  for (const form of FORMS) {
    chip.dataset.form = form === 'short' && !hasShort ? 'full' : form
    sizes[form] = { width: chip.offsetWidth, height: chip.offsetHeight }
  }
  if (was.form === undefined) delete chip.dataset.form
  else chip.dataset.form = was.form
  chip.style.left = was.left
  chip.style.top = was.top
  return sizes
}

/** The placement's box in the window. */
function boxAt(placed: ChipPlacement, size: ChipSize): Box {
  return {
    left: placed.left,
    top: placed.top,
    right: placed.left + size.width,
    bottom: placed.top + size.height,
  }
}

/** A document that lays out and hit-tests: not a test's, which does neither. */
const canFloat = (): boolean =>
  typeof window.matchMedia === 'function' &&
  typeof document.elementsFromPoint === 'function'

/** True when no part of `chip` is inside the part of `column` on screen. */
function scrolledAway(chip: Element, column: Element): boolean {
  const at = chip.getBoundingClientRect()
  const view = areaOf(column, { top: 0, side: 0, bottom: 0 })
  return (
    at.bottom <= view.top ||
    at.top >= view.bottom ||
    at.right <= view.left ||
    at.left >= view.right
  )
}

/**
 * Floats `chip` from its parent, the anchor. Returns the stop. Where nothing
 * is laid out it does nothing, and the chip keeps its whole line.
 */
export function floatChip(chip: HTMLElement, opts: FloatOptions): () => void {
  if (!canFloat()) return () => undefined
  const { room: source, onForm, hasShort } = opts
  const anchor = chip.parentElement
  let placed: ChipPlacement | null = null
  let pending: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  const born = Date.now()
  const settling = (): boolean => Date.now() - born < PAGE_SETTLE_MS

  const rooms = (): { column: Element | null; bar: Element | null } => ({
    column: source.column(),
    bar: source.bar?.() ?? null,
  })

  const apply = (next: ChipPlacement): void => {
    placed = next
    const form = next.form === 'short' && !hasShort ? 'full' : next.form
    chip.dataset.form = form
    chip.dataset.place = next.where
    chip.dataset.covers = next.covers
    onForm(form)
    const origin =
      next.where === 'bar' || anchor === null
        ? { left: 0, top: 0 }
        : anchor.getBoundingClientRect()
    chip.style.left = `${Math.round(next.left - origin.left)}px`
    chip.style.top = `${Math.round(next.top - origin.top)}px`
  }

  const place = (): void => {
    const { column, bar } = rooms()
    if (column === null) return
    // Measured where it stands, so its parent's width does not squeeze it.
    chip.dataset.place ??= 'column'
    const sizes = measure(chip, hasShort)
    const columnRoom = readRoom(column, areaOf(column, COLUMN_INSET), anchor)
    const barRoom =
      bar === null ? null : readRoom(bar, areaOf(bar, BAR_INSET), anchor)
    const held = [column, ...(bar === null ? [] : [bar])]
    let next = placeChip({ column: columnRoom, bar: barRoom, sizes })
    // A layer from elsewhere in the document over that spot: stand clear of
    // it too, and look again (a few times at most).
    for (let i = 0; i < 3 && next.covers !== 'something'; i++) {
      const over = layersOver(boxAt(next, sizes[next.form]), held, chip)
      if (over.length === 0) break
      const room = next.where === 'bar' ? barRoom : columnRoom
      ;(room?.hard as Box[] | undefined)?.push(...over)
      next = placeChip({ column: columnRoom, bar: barRoom, sizes })
    }
    apply(next)
  }

  const check = (): void => {
    pending = null
    if (stopped) return
    const { column, bar } = rooms()
    const now = placed
    const container = now?.where === 'bar' ? bar : column
    // While the page settles (skeletons giving way to what they stood for),
    // the rule's first choice may open up: look again from the top.
    if (now === null || container === null || settling()) {
      place()
      return
    }
    const box = boxOf(chip.getBoundingClientRect())
    const near = readRoom(container, grow(box, GAP * 2), anchor)
    if (!stillClear(near, box, now.covers)) place()
  }

  const soon = (): void => {
    if (!stopped) pending ??= setTimeout(check, CHECK_MS)
  }
  const again = (): void => {
    if (!stopped) place()
  }
  // Scrolled out of view before it was seen, or by the page settling (Path
  // glides to the singer's week as it opens, past the chip): placed again
  // where the page comes to rest.
  let rest: ReturnType<typeof setTimeout> | null = null
  const atRest = (): void => {
    rest = null
    const column = source.column()
    if (stopped || column === null || placed?.where !== 'column') return
    if (scrolledAway(chip, column)) place()
  }
  const scrolled = (): void => {
    if (stopped) return
    if (opts.seen() && !settling()) return
    if (rest !== null) clearTimeout(rest)
    rest = setTimeout(atRest, SCROLL_REST_MS)
  }

  place()
  const timers = SETTLE_MS.map((ms) => setTimeout(check, ms))
  const { column, bar } = rooms()
  const changed =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon)
  const resized =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(again)
  for (const el of [column, bar]) {
    if (el === null) continue
    changed?.observe(el, { childList: true, subtree: true })
    resized?.observe(el)
  }
  window.addEventListener('resize', again)
  // A page scrolls in its column or, as Karaoke Night does, in the window.
  column?.addEventListener('scroll', scrolled, { passive: true })
  window.addEventListener('scroll', scrolled, { passive: true })
  void document.fonts?.ready.then(soon)

  return () => {
    stopped = true
    for (const timer of timers) clearTimeout(timer)
    if (pending !== null) clearTimeout(pending)
    if (rest !== null) clearTimeout(rest)
    changed?.disconnect()
    resized?.disconnect()
    window.removeEventListener('resize', again)
    column?.removeEventListener('scroll', scrolled)
    window.removeEventListener('scroll', scrolled)
  }
}
