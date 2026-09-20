// ============================================================
// lyrics-hands-off — whose turn it is to scroll the words
// ============================================================
//
// A lyric sheet that follows the song has two hands on it: the song's and
// the reader's. This says when the reader's are, so the follower can keep
// its own off.
//
// It listens to INPUT (a wheel, a finger, a key, the scrollbar), not to
// `scroll`. A scroll event cannot say who scrolled, and every follower that
// tried to tell its own glide from the reader's by timing it has at some
// point mistaken one for the other -- and a follower that thinks the reader
// is scrolling stops following, which from the outside is a sheet stuck
// where somebody left it. Input has an author.
//
// `scroll` is still listened to, for one thing: momentum. A flick keeps the
// sheet moving for a second or two after the finger has gone, with no touch
// events at all. Those scrolls extend a hold that is already open and never
// open one, so the follower's own glide (which only starts once the hold
// has closed) cannot hold itself off.

import { createSignal, onCleanup } from 'solid-js'

/**
 * How long after the last scroll input the words are still the reader's.
 *
 * Long enough that a follow does not land between two turns of a wheel or
 * under a thumb that is about to come back down; short enough that the
 * song is picked up again within the line it was left on.
 */
export const LYRICS_HANDS_OFF_MS = 1200

/** Keys that scroll a box from the keyboard. Space is the transport's. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

export interface LyricsHandsOff {
  /** True while somebody is scrolling the words, or only just was. */
  held: () => boolean
  /** Listen on the box that scrolls. Call from its ref. */
  bind: (box: HTMLElement) => void
}

export function createLyricsHandsOff(): LyricsHandsOff {
  const [held, setHeld] = createSignal(false)
  /** One finger is down and has moved: a drag, which no timer ends. */
  let dragging = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const hold = (): void => {
    setHeld(true)
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      // A finger resting on the sheet is still reading it.
      if (!dragging) setHeld(false)
    }, LYRICS_HANDS_OFF_MS)
  }

  onCleanup(() => {
    if (timer !== undefined) clearTimeout(timer)
  })

  const bind = (box: HTMLElement): void => {
    // Ctrl+wheel sizes the words (JamSongLyrics); it does not scroll them.
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) hold()
    }
    // One finger scrolls. Two size the words, and a touch that never moves
    // is a tap on a line -- neither is a reason to stop following.
    const onTouchMove = (event: TouchEvent): void => {
      if (event.touches.length !== 1) return
      dragging = true
      hold()
    }
    const onTouchEnd = (event: TouchEvent): void => {
      if (event.touches.length > 0 || !dragging) return
      dragging = false
      // The flick carries on without the finger; the clock starts now.
      hold()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (SCROLL_KEYS.has(event.key)) hold()
    }
    // A press on the box ITSELF, not on a line in it, is the scrollbar.
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target === box && event.pointerType === 'mouse') hold()
    }
    const onScroll = (): void => {
      if (held()) hold()
    }

    const passive = { passive: true } as const
    box.addEventListener('wheel', onWheel, passive)
    box.addEventListener('touchmove', onTouchMove, passive)
    box.addEventListener('touchend', onTouchEnd, passive)
    box.addEventListener('touchcancel', onTouchEnd, passive)
    box.addEventListener('keydown', onKeyDown)
    box.addEventListener('pointerdown', onPointerDown, passive)
    box.addEventListener('scroll', onScroll, passive)
    onCleanup(() => {
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('touchmove', onTouchMove)
      box.removeEventListener('touchend', onTouchEnd)
      box.removeEventListener('touchcancel', onTouchEnd)
      box.removeEventListener('keydown', onKeyDown)
      box.removeEventListener('pointerdown', onPointerDown)
      box.removeEventListener('scroll', onScroll)
    })
  }

  return { held, bind }
}
