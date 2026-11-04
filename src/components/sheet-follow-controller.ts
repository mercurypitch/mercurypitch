// ============================================================
// createSheetFollow — the staff keeps the playback cursor in sight
// ============================================================
//
// While the song plays, the cursor's system is kept in view (the rules are
// in lib/sheet-follow.ts). When the staff opens, when the song starts, and
// after every seek, playing or not, the cursor's system is brought into
// view at once.
//
// A hand on the staff wins. A wheel, a drag or a press on a scrollbar lets
// the follow go until 3.5 s after the last of them, or until the next seek
// or press of play, as the lyrics do (useLyricsScrollController).
//
// Each scroller is moved with one scroll call and then left alone while it
// glides. Chromium stops a glide on any scroll of the same element, even to
// where it already stands, and the follow used to write the staff's
// scrollLeft on most frames: a system change started a glide and the next
// frame stopped it, so the staff stayed put (measured 4 Nov 2026 on the
// MIDI Melody panel's Notes view).

import type { Accessor } from 'solid-js'
import { createEffect, on, onCleanup, untrack } from 'solid-js'
import type { Span } from '@/lib/sheet-follow'
import { cursorFollowLeft, revealShift, SHEET_FOLLOW_RESUME_MS, SHEET_GLIDE_CAP_MS, systemFollowOffset, } from '@/lib/sheet-follow'
import type { CursorPos } from '@/lib/sheet-music-renderer'

/** Room kept above and below a stave shown by an outer scroller. */
const STAVE_MARGIN_PX = 12

export interface SheetFollowOptions {
  /** The staff's own scroller. */
  scroller: () => HTMLElement | undefined
  /** The engraved staff inside it; the cursor is placed in its coordinates. */
  content: () => HTMLElement | undefined
  /**
   * A scrolling ancestor of the staff that the follow may also move, just
   * far enough to show the stave. Nothing outside it is scrolled.
   */
  outer?: () => HTMLElement | undefined
  /** Where the cursor is, in the content's coordinates; null without one. */
  cursor: Accessor<CursorPos | null>
  playing: Accessor<boolean>
  /** Goes up by one with each jump of the transport: a seek, a loop, a stop. */
  jumps?: Accessor<number>
  now?: () => number
  reducedMotion?: () => boolean
}

export interface SheetFollow {
  /** A place on the staff was asked for, a note clicked: show it, follow again. */
  seeked: () => void
}

/** `open` places without a glide; `reveal` ignores a hand; `track` does not. */
type FollowMode = 'open' | 'reveal' | 'track'

interface Glide {
  top: number
  until: number
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function createSheetFollow(options: SheetFollowOptions): SheetFollow {
  const now = options.now ?? (() => performance.now())
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion
  const glides = new Map<HTMLElement, Glide>()
  let handUntil = 0
  let opened = false
  let revealPending = false
  let wasPlaying = false

  /** The glide in flight on `el`, until it lands or runs past its cap. */
  const glideOf = (el: HTMLElement): Glide | undefined => {
    const glide = glides.get(el)
    if (glide !== undefined && now() >= glide.until) {
      glides.delete(el)
      return undefined
    }
    return glide
  }

  const scrollToTop = (
    el: HTMLElement,
    top: number,
    mode: FollowMode,
    left?: number,
  ): void => {
    const behavior: ScrollBehavior =
      mode === 'open' || reducedMotion() ? 'instant' : 'smooth'
    el.scrollTo(
      left === undefined ? { top, behavior } : { top, left, behavior },
    )
    if (behavior === 'smooth') {
      glides.set(el, { top, until: now() + SHEET_GLIDE_CAP_MS })
    } else {
      glides.delete(el)
    }
  }

  /** Moves the outer scroller just far enough to show the stave. */
  const revealIn = (
    outer: HTMLElement,
    staff: HTMLElement,
    stave: Span,
    staffTop: number,
    mode: FollowMode,
  ): void => {
    const goal = glideOf(outer)?.top ?? outer.scrollTop
    // Where the stave will be once both scrollers are where they are going.
    const at =
      staff.getBoundingClientRect().top +
      staff.clientTop +
      stave.start -
      staffTop +
      (outer.scrollTop - goal)
    const viewTop = outer.getBoundingClientRect().top + outer.clientTop
    const shift = revealShift(
      { start: viewTop, end: viewTop + outer.clientHeight },
      { start: at, end: at + stave.end - stave.start },
      STAVE_MARGIN_PX,
    )
    const target = Math.round(
      Math.min(
        Math.max(0, outer.scrollHeight - outer.clientHeight),
        Math.max(0, goal + shift),
      ),
    )
    if (Math.abs(target - goal) >= 1) scrollToTop(outer, target, mode)
  }

  const follow = (pos: CursorPos, mode: FollowMode): void => {
    const staff = options.scroller()
    const content = options.content()
    if (staff === undefined || content === undefined) return
    const stave: Span = {
      start: content.offsetTop + pos.top,
      end: content.offsetTop + pos.bottom,
    }
    const glide = glideOf(staff)
    const goal = glide?.top ?? staff.scrollTop
    const top = systemFollowOffset(
      { offset: goal, size: staff.clientHeight, extent: staff.scrollHeight },
      stave,
    )
    const left = cursorFollowLeft(
      {
        offset: staff.scrollLeft,
        size: staff.clientWidth,
        extent: staff.scrollWidth,
      },
      content.offsetLeft + pos.x,
    )
    if (top !== null) {
      scrollToTop(staff, top, mode, left ?? staff.scrollLeft)
    } else if (left !== null && glide === undefined) {
      // Sideways only, and with no glide on the staff to stop.
      staff.scrollTo({ left, behavior: 'instant' })
    }
    const outer = options.outer?.()
    if (outer !== undefined) revealIn(outer, staff, stave, top ?? goal, mode)
  }

  const handOn = (): void => {
    handUntil = now() + SHEET_FOLLOW_RESUME_MS
    glides.clear()
  }
  /** A press on a scroller itself rather than on the staff: its scrollbar. */
  const pressOn = (event: Event): void => {
    if (event.target === event.currentTarget) handOn()
  }
  const landed = (event: Event): void => {
    const el = event.currentTarget as HTMLElement
    const glide = glides.get(el)
    if (glide !== undefined && Math.abs(el.scrollTop - glide.top) < 1) {
      glides.delete(el)
    }
  }

  createEffect(() => {
    const staff = options.scroller()
    const outer = options.outer?.()
    if (staff === undefined) return
    const scrollers = outer === undefined ? [staff] : [staff, outer]
    // Wheels and drags over the staff reach the outer scroller too.
    const hand = outer ?? staff
    hand.addEventListener('wheel', handOn, { passive: true })
    hand.addEventListener('touchmove', handOn, { passive: true })
    for (const el of scrollers) {
      el.addEventListener('pointerdown', pressOn)
      el.addEventListener('scrollend', landed)
    }
    onCleanup(() => {
      hand.removeEventListener('wheel', handOn)
      hand.removeEventListener('touchmove', handOn)
      for (const el of scrollers) {
        el.removeEventListener('pointerdown', pressOn)
        el.removeEventListener('scrollend', landed)
      }
    })
  })

  createEffect(() => {
    const pos = options.cursor()
    const isPlaying = options.playing()
    const started = isPlaying && !wasPlaying
    wasPlaying = isPlaying
    if (pos === null) return
    untrack(() => {
      if (!opened) {
        opened = true
        follow(pos, 'open')
      } else if (started || revealPending) {
        revealPending = false
        handUntil = 0
        follow(pos, 'reveal')
      } else if (isPlaying && now() >= handUntil) {
        follow(pos, 'track')
      }
    })
  })

  // A jump can land before or after the cursor moves: show the cursor now,
  // and again when it next moves.
  createEffect(
    on(
      () => options.jumps?.() ?? 0,
      () => {
        handUntil = 0
        revealPending = true
        const pos = untrack(options.cursor)
        if (opened && pos !== null) follow(pos, 'reveal')
      },
      { defer: true },
    ),
  )

  return {
    seeked: () => {
      handUntil = 0
      revealPending = true
    },
  }
}
