// ============================================================
// useLyricsScrollController — follow the active lyric line
// ============================================================
//
// Keeps whichever list is on screen scrolled to the line being sung, and
// stops doing that the moment the user scrolls for themselves — then quietly
// resumes once they land back on the active line, or have left the words
// alone for a few seconds. It never stays off: a list left where a hand put
// it, with the song going on underneath, reads as broken.
//
// Split out of useStemMixerLyricsController (Phase 0 of
// docs/plans/lrc-mapper-studio-plan.md). The arithmetic moved further out
// again, into ./lyrics-scroll.ts, because it was duplicated between the
// playback list and the mapper list and testable in neither.

import type { Setter } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { findLyricsRow } from '@/lib/lyrics-row'
import { ANCHOR_RATIO, FOLLOW_RESUME_MS, isBackOnActiveLine, scrollTargetFor, } from './lyrics-scroll'
import type { LyricsSource } from './types'

/** Where the playback list lives. Excludes the mapper and editor lists. */
const LYRICS_CONTAINER_SELECTOR =
  '.sm-lyrics-lines:not(.sm-lyrics-gen-lines):not(.sm-lyrics-lines-edit)'
const GEN_CONTAINER_SELECTOR = '.sm-lyrics-gen-lines'

/** How long a user scroll suppresses following before we re-check. */
const SETTLE_MS = 800

/**
 * The longest one of our own glides is believed to be running. `scrollend`
 * ends it sooner where the browser has one; this is for the ones that do
 * not, and for a glide that never lands.
 */
const GLIDE_CAP_MS = 1000

/** The playback list tolerates less drift than the mapper's taller rows. */
const PLAYBACK_BOTTOM_RATIO = 0.57
const GEN_BOTTOM_RATIO = 0.6

export interface LyricsScrollDeps {
  playing: () => boolean
  currentLineIdx: () => number
  lyricsSource: () => LyricsSource
  editMode: () => boolean
  lrcGenMode: () => boolean
  lrcGenLineIdx: () => number
}

export interface LyricsScrollController {
  /** True while the user has scrolled away from the active line. */
  userScrolled: () => boolean
  setUserScrolled: Setter<boolean>
  /**
   * Bring `idx` to the anchor unconditionally — for a click, where the user
   * asked to go there and "it was already roughly visible" is not a reason to
   * leave it where it was.
   */
  scrollToLine: (idx: number) => void
}

export function useLyricsScrollController(
  deps: LyricsScrollDeps,
): LyricsScrollController {
  const [userScrolled, setUserScrolled] = createSignal(false)

  let container: HTMLElement | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let resumeTimer: ReturnType<typeof setTimeout> | null = null
  // Distinguishes our own smooth scroll from the user's, so following does
  // not mistake itself for someone taking over.
  let isAutoScrolling = false
  let glideTimer: ReturnType<typeof setTimeout> | null = null

  const query = (selector: string) =>
    document.querySelector(selector) as HTMLElement | null

  const clearSettle = () => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  const clearResume = () => {
    if (resumeTimer !== null) {
      clearTimeout(resumeTimer)
      resumeTimer = null
    }
  }

  const onLyricsScroll = () => {
    if (isAutoScrolling) return
    setUserScrolled(true)
    // Counted from the LAST scroll, so reading on keeps the words. When it
    // does fire, the follow effect below is watching `userScrolled` and
    // brings the sung line back if it has drifted out of the band.
    clearResume()
    resumeTimer = setTimeout(() => {
      resumeTimer = null
      setUserScrolled(false)
    }, FOLLOW_RESUME_MS)
    clearSettle()
    settleTimer = setTimeout(() => {
      settleTimer = null
      const el = query(LYRICS_CONTAINER_SELECTOR)
      if (el === null) return
      const idx = deps.currentLineIdx()
      if (idx < 0) return
      const activeLine = findLyricsRow(el, idx)
      if (activeLine === null) return
      if (
        isBackOnActiveLine(
          el.getBoundingClientRect(),
          activeLine.getBoundingClientRect(),
        )
      ) {
        setUserScrolled(false)
      }
    }, SETTLE_MS)
  }

  const attachScrollListener = () => {
    const next = query(LYRICS_CONTAINER_SELECTOR)
    if (next === container) return
    if (container !== null) {
      container.removeEventListener('scroll', onLyricsScroll)
    }
    container = next
    if (next !== null) {
      next.addEventListener('scroll', onLyricsScroll, { passive: true })
    }
  }

  // The list is remounted when the source, the editor or the mapper toggles,
  // so the listener has to be re-attached to whatever element replaced it.
  createEffect(() => {
    void deps.lyricsSource()
    void deps.editMode()
    void deps.lrcGenMode()
    setTimeout(() => attachScrollListener(), 0)
  })

  /** Smooth-scroll `el` to `target`, flagging it as ours while it runs. */
  const scrollTo = (el: HTMLElement, target: number, markAuto: boolean) => {
    if (markAuto) {
      isAutoScrolling = true
      // ONE release at a time. The timer used to be fire-and-forget, so the
      // timer of one glide went off in the middle of the next and unmarked
      // it -- and the rest of that glide was taken for the reader scrolling,
      // which turned following off.
      if (glideTimer !== null) clearTimeout(glideTimer)
      const release = () => {
        el.removeEventListener('scrollend', release)
        if (glideTimer !== null) clearTimeout(glideTimer)
        glideTimer = null
        isAutoScrolling = false
      }
      el.addEventListener('scrollend', release, { once: true })
      // scrollend is not universal, and a smooth scroll that never lands
      // would otherwise leave following disabled for the rest of the session.
      glideTimer = setTimeout(release, GLIDE_CAP_MS)
    }
    el.scrollTo({ top: target, behavior: 'smooth' })
  }

  /** Resolve a line's element and container in one go, or null. */
  const locate = (selector: string, idx: number) => {
    const el = query(selector)
    if (el === null) return null
    const line = findLyricsRow(el, idx)
    return line === null ? null : { el, line }
  }

  /** Scroll `idx` back to the anchor, but only if it drifted out of band. */
  const follow = (
    selector: string,
    idx: number,
    bottomRatio: number,
    markAuto: boolean,
  ) => {
    const found = locate(selector, idx)
    if (found === null) return
    const target = scrollTargetFor(
      found.el.getBoundingClientRect(),
      found.line.getBoundingClientRect(),
      found.el.scrollTop,
      bottomRatio,
    )
    if (target === null) return
    scrollTo(found.el, target, markAuto)
  }

  const scrollToLine = (idx: number) => {
    const found = locate(LYRICS_CONTAINER_SELECTOR, idx)
    if (found === null) return
    const containerRect = found.el.getBoundingClientRect()
    const lineRect = found.line.getBoundingClientRect()
    scrollTo(
      found.el,
      found.el.scrollTop +
        (lineRect.top - containerRect.top) -
        containerRect.height * ANCHOR_RATIO,
      true,
    )
  }

  createEffect(() => {
    const idx = deps.currentLineIdx()
    if (!deps.playing() || idx < 0) return
    if (userScrolled()) return
    follow(LYRICS_CONTAINER_SELECTOR, idx, PLAYBACK_BOTTOM_RATIO, true)
  })

  // The mapper follows the cursor rather than the playhead, and never marks
  // the scroll as ours: it has no user-scroll suppression to protect.
  createEffect(() => {
    const idx = deps.lrcGenLineIdx()
    if (!deps.lrcGenMode()) return
    follow(GEN_CONTAINER_SELECTOR, idx, GEN_BOTTOM_RATIO, false)
  })

  onCleanup(() => {
    if (container !== null) {
      container.removeEventListener('scroll', onLyricsScroll)
      container = null
    }
    clearSettle()
    clearResume()
    if (glideTimer !== null) clearTimeout(glideTimer)
    isAutoScrolling = false
  })

  return { userScrolled, setUserScrolled, scrollToLine }
}
