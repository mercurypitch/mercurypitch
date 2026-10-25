// ============================================================
// Field above keyboard — keeps a focused field in a scroll region clear of the keyboard
// ============================================================
//
// A phone's keyboard shrinks the visual viewport and nothing else: the layout
// viewport, a `position: fixed; inset: 0` box and the scroll regions inside
// it keep their full height. A region whose content fits has no scroll room,
// so a field near its foot stays under the keyboard and neither the browser
// nor a script can scroll it out. Measured on the onboarding plan at 390x844
// with a 336 px keyboard: Q3's typed line was 264 px under it and Q4's 189,
// in a region that could scroll 26 px and 0.
//
// While a text field inside the region has focus, this follows
// `window.visualViewport` (its resize and scroll). It gives the region room
// at its foot for the part of the region the keyboard covers, plus a margin,
// and scrolls the field into what is left, with the margin above and below
// it. The region must keep its height as that room grows (a definite height,
// as a region that fills its box has): one sized by its content would grow
// under the keyboard instead.
//
// The region's side of it, its stylesheet's: while `data-keyboard-room` is
// set on the region, the region shows a spacer as its last box,
// `--keyboard-room` tall (a `::after` with `flex: none`, and a width, as
// `align-self: stretch` gives it: WebKit leaves an empty box with no width
// out of the scroll range). A box, not padding: Safari 26 leaves a flex
// column's block-axis padding out of its scroll range (WebKit bug 316902,
// "flex column padding excluded from scrollHeight", fixed in trunk with no
// release named), so on an iPhone running it padding would add no room.
// The region's own padding is never touched.
//
// When the field loses focus or leaves the page, the scrolling stops at
// once, but the room stays until the keyboard has gone. Taken away with the
// focus, it moved the content under a finger in the middle of a tap:
// Chromium focuses a tapped button on touch-down, before its click, so the
// region's scroll was cut short, the button jumped away, and the click
// missed it (Next on Q3 in the repro; Android Chrome does the same). On
// dispose everything goes at once. Where there is no visualViewport it does
// nothing. Under reduced motion the scroll jumps instead of gliding.

/** The room kept between the field and the keyboard: a counter under the field fits in it. */
export const FIELD_MARGIN_PX = 24

/** Set on the region while it keeps room: its stylesheet shows the spacer. */
export const ROOM_ATTRIBUTE = 'data-keyboard-room'

/** The spacer's height, set on the region while it keeps room. */
export const ROOM_PROPERTY = '--keyboard-room'

const TEXT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
])

/** A field that brings up the keyboard. */
function isTextField(el: EventTarget | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Keeps whichever text field inside `region` has focus above the keyboard.
 * Returns the function that stops it.
 */
export function keepFieldAboveKeyboard(region: HTMLElement): () => void {
  /** The field being kept in view, null once it has lost focus. */
  let field: HTMLElement | null = null
  /** The visual viewport being followed: while a field is, or room is kept. */
  let viewport: VisualViewport | null = null
  /** The px of room at the region's foot, 0 while none is kept. */
  let room = 0

  /** The spacer's height, through the attribute and property the region's stylesheet reads. */
  function setRoom(px: number): void {
    if (px === room) return
    room = px
    if (px === 0) {
      region.removeAttribute(ROOM_ATTRIBUTE)
      region.style.removeProperty(ROOM_PROPERTY)
    } else {
      region.setAttribute(ROOM_ATTRIBUTE, '')
      region.style.setProperty(ROOM_PROPERTY, `${px}px`)
    }
  }

  function stop(): void {
    field = null
    if (viewport !== null) {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      viewport = null
    }
    setRoom(0)
  }

  /** The field is no longer kept in view; any room stays until the keyboard goes. */
  function unfollow(): void {
    field = null
    if (room === 0) stop()
  }

  function update(): void {
    if (viewport === null) return
    if (
      field !== null &&
      (!field.isConnected || document.activeElement !== field)
    ) {
      field = null
    }
    // Boxes are read against the layout viewport; the visual one says which
    // part of it is still seen.
    const seenTop = viewport.offsetTop
    const seenBottom = seenTop + viewport.height
    const box = region.getBoundingClientRect()
    const covered = Math.ceil(box.bottom - seenBottom)
    if (field === null && covered <= 0) {
      stop()
      return
    }
    setRoom(covered > 0 ? covered + FIELD_MARGIN_PX : 0)
    if (field === null) return

    const top = Math.max(seenTop, box.top) + FIELD_MARGIN_PX
    const bottom = Math.min(seenBottom, box.bottom) - FIELD_MARGIN_PX
    const at = field.getBoundingClientRect()
    let lift = 0
    if (at.bottom > bottom) lift = at.bottom - bottom
    // A field taller than what is seen keeps its top in view.
    if (at.top - lift < top) lift = at.top - top
    if (lift !== 0) {
      region.scrollBy({
        top: lift,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
    }
  }

  function follow(next: HTMLElement): void {
    const seen = window.visualViewport
    if (seen === null || seen === undefined) return
    if (viewport === null) {
      viewport = seen
      seen.addEventListener('resize', update)
      seen.addEventListener('scroll', update)
    }
    field = next
    update()
  }

  const onFocusIn = (e: FocusEvent): void => {
    if (isTextField(e.target)) follow(e.target)
    else unfollow()
  }

  const onFocusOut = (e: FocusEvent): void => {
    // Focus going on to another field here keeps following: focusin moves it.
    const next = e.relatedTarget
    if (isTextField(next) && region.contains(next)) return
    unfollow()
  }

  region.addEventListener('focusin', onFocusIn)
  region.addEventListener('focusout', onFocusOut)
  return () => {
    region.removeEventListener('focusin', onFocusIn)
    region.removeEventListener('focusout', onFocusOut)
    stop()
  }
}
