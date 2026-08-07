// ============================================================
// useLrcMarkerInput — press-and-drag word marking
// ============================================================
//
// Marker input is the mapper's precise mode: press the highlighted word as
// its first sound begins, then drag through the text as it is sung. The
// pointer path becomes a curve of (time, progress) samples rather than a
// single onset.
//
// Extracted from StemMixerLyricsPanelBody so the full-screen mapper stage can
// use the same gesture without a second copy of it. It reaches into the DOM
// by `[data-marker-word]`, so any surface that renders the mapper rows with
// those attributes gets the behaviour for free.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 2).

import { createEffect, createSignal } from 'solid-js'
import { buildForwardMarkerPath } from '@/lib/marker-path'

/** Which word the pointer is over, and how far into it. */
export interface MarkerTarget {
  lineIdx: number
  wordIdx: number
  progress: number
}

export interface LrcMarkerInputDeps {
  elapsed: () => number
  playing: () => boolean
  handlePlay: () => void
  lrcGenInputMode: () => string
  lrcGenLineIdx: () => number
  lrcGenWordIdx: () => number
  handleMarkerSample: (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => void
}

export interface LrcMarkerInput {
  /** The word the gesture is currently on, for the live fill. */
  markerVisual: () => MarkerTarget | null
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
}

/** Vertical slack when snapping to the nearest word on the current line. */
const ROW_SLACK_PX = 24

export function useLrcMarkerInput(deps: LrcMarkerInputDeps): LrcMarkerInput {
  const [markerVisual, setMarkerVisual] = createSignal<MarkerTarget | null>(
    null,
  )
  let markerPointerId: number | null = null
  let latestMarkerTarget: MarkerTarget | null = null
  let latestMarkerElapsed: number | null = null
  let latestElapsed = 0

  // Pointer callbacks read a plain clock snapshot so reactive values never
  // escape the component's tracked root.
  createEffect(() => {
    latestElapsed = deps.elapsed()
  })

  const markerTargetAt = (
    clientX: number,
    clientY: number,
  ): MarkerTarget | null => {
    let wordEl = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-marker-word]')
    if (!wordEl) {
      // Off the text but still on the row: take the nearest word on the
      // current line, so a drag that runs slightly high or low keeps going.
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          '.sm-lyrics-gen-line-current [data-marker-word]',
        ),
      ]
      wordEl =
        candidates
          .filter((candidate) => {
            const rect = candidate.getBoundingClientRect()
            return (
              clientY >= rect.top - ROW_SLACK_PX &&
              clientY <= rect.bottom + ROW_SLACK_PX
            )
          })
          .sort((a, b) => {
            const distance = (candidate: HTMLElement) => {
              const rect = candidate.getBoundingClientRect()
              if (clientX < rect.left) return rect.left - clientX
              if (clientX > rect.right) return clientX - rect.right
              return 0
            }
            return distance(a) - distance(b)
          })[0] ?? undefined
    }
    if (wordEl === undefined) return null
    const lineIdx = Number(wordEl.dataset.markerLine)
    const wordIdx = Number(wordEl.dataset.markerWord)
    if (!Number.isInteger(lineIdx) || !Number.isInteger(wordIdx)) return null
    const rect =
      wordEl
        .querySelector<HTMLElement>('.sm-lyrics-gen-word-text')
        ?.getBoundingClientRect() ?? wordEl.getBoundingClientRect()
    const progress =
      rect.width > 0
        ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        : 0
    return { lineIdx, wordIdx, progress }
  }

  const updateMarkerVisual = (target: MarkerTarget | null) => {
    latestMarkerTarget = target
    setMarkerVisual(target)
  }

  const sendMarkerPath = (target: MarkerTarget, phase: 'move' | 'end') => {
    const previous = latestMarkerTarget
    // The gesture only ever moves forward through a line; a backwards jump is
    // the pointer wandering, not a correction.
    if (
      previous !== null &&
      previous.lineIdx === target.lineIdx &&
      target.wordIdx < previous.wordIdx
    ) {
      return
    }

    if (previous !== null && latestMarkerElapsed !== null) {
      const samples = buildForwardMarkerPath(
        previous,
        target,
        latestMarkerElapsed,
        latestElapsed,
      )
      for (const [index, sample] of samples.entries()) {
        deps.handleMarkerSample(
          sample.target.lineIdx,
          sample.target.wordIdx,
          sample.target.progress,
          sample.elapsed,
          index === samples.length - 1 ? phase : 'move',
        )
      }
      latestMarkerElapsed = samples.at(-1)?.elapsed ?? latestElapsed
    } else {
      deps.handleMarkerSample(
        target.lineIdx,
        target.wordIdx,
        target.progress,
        latestElapsed,
        phase,
      )
      latestMarkerElapsed = latestElapsed
    }

    updateMarkerVisual(target)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (deps.lrcGenInputMode() !== 'marker') return
    const target = markerTargetAt(e.clientX, e.clientY)
    if (!target || target.lineIdx !== deps.lrcGenLineIdx()) return
    if (target.wordIdx !== deps.lrcGenWordIdx()) return

    e.preventDefault()
    e.stopPropagation()
    markerPointerId = e.pointerId
    updateMarkerVisual(target)
    latestMarkerElapsed = latestElapsed
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (!deps.playing()) deps.handlePlay()
    deps.handleMarkerSample(
      target.lineIdx,
      target.wordIdx,
      target.progress,
      latestElapsed,
      'start',
    )
  }

  const onPointerMove = (e: PointerEvent) => {
    if (markerPointerId !== e.pointerId) return
    e.preventDefault()
    // Coalesced events are the fine-grained path between frames; the last one
    // is where the pointer actually is.
    const samples =
      typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
    const sample = samples.at(-1) ?? e
    const target = markerTargetAt(sample.clientX, sample.clientY)
    if (!target || target.lineIdx !== deps.lrcGenLineIdx()) return
    sendMarkerPath(target, 'move')
  }

  const onPointerUp = (e: PointerEvent) => {
    if (markerPointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    const target =
      markerTargetAt(e.clientX, e.clientY) ?? latestMarkerTarget ?? undefined
    if (target) {
      sendMarkerPath(target, 'move')
      sendMarkerPath(target, 'end')
    }
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    markerPointerId = null
    updateMarkerVisual(null)
    latestMarkerElapsed = null
  }

  return { markerVisual, onPointerDown, onPointerMove, onPointerUp }
}
