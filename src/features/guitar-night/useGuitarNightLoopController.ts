// One A/B loop, owned the same way in both Guitar Night rooms.
// ============================================================
//
// The rooms differ in what a wrap costs them — the play-along room seeks a real
// recording, the tab room folds a click that cannot be rewound — so the wrap
// itself is the host's job. Everything before it is not: which marks exist,
// which is A, whether the span is loopable, and whether the playhead has passed
// B are the same questions in both rooms, and they are answered here.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, shouldWrapToStart } from '@/lib/guitar/loop-span'

interface GuitarNightLoopControllerOptions {
  /** End of the timeline, in the host's own unit. */
  limit: Accessor<number>
  /**
   * Move the playhead back to A. The host owns what that costs. Omitted by a
   * host whose clock already folds itself — the tab room schedules the loop
   * into the click, so loop wrapping never asks this controller to seek.
   */
  onWrap?: (start: number) => void
}

export function useGuitarNightLoopController(
  options: GuitarNightLoopControllerOptions,
) {
  const [markA, setMarkA] = createSignal<number | null>(null)
  const [markB, setMarkB] = createSignal<number | null>(null)

  const span = createMemo<LoopSpan | null>(() =>
    normalizeLoopSpan(markA(), markB(), options.limit()),
  )
  const isLooping = createMemo(() => span() !== null)
  /** A mark is dropped but the loop is not runnable yet — the surface says so. */
  const isPending = createMemo(
    () => span() === null && (markA() !== null || markB() !== null),
  )

  const markStart = (position: number): void => {
    if (!Number.isFinite(position)) return
    setMarkA(Math.max(0, position))
    // A dropped after B is the player re-choosing the top of the loop, not the
    // bottom of a new one: keep B if it still sits after the new A.
    const end = markB()
    if (end !== null && end <= position) setMarkB(null)
  }

  const markEnd = (position: number): void => {
    if (!Number.isFinite(position)) return
    setMarkB(Math.max(0, position))
    const start = markA()
    if (start !== null && start >= position) setMarkA(null)
  }

  const clear = (): void => {
    setMarkA(null)
    setMarkB(null)
  }

  /**
   * Offer the current playhead to the loop. Returns true when the host was
   * asked to wrap, so a caller driving this from a frame loop can skip the rest
   * of its own update.
   */
  const follow = (position: number): boolean => {
    const current = span()
    const wrap = options.onWrap
    if (wrap === undefined) return false
    if (!shouldWrapToStart(position, current) || current === null) return false
    wrap(current.start)
    return true
  }

  return {
    markA,
    markB,
    span,
    isLooping,
    isPending,
    markStart,
    markEnd,
    clear,
    follow,
  }
}
