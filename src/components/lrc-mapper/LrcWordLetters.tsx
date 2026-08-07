// ============================================================
// LrcWordLetters — timing the glyph boundaries inside one word
// ============================================================
//
// A held vowel is one timestamp and four seconds of sound, and no amount of
// word-level precision fixes that. This opens a single word into its letters
// so the joins between them can carry their own times.
//
// Every target is a *boundary*, not a glyph: the join before letter 3 is the
// start of that syllable and the end of the one before it, so one click sets
// both sides. The word's own two edges are boundaries too — index 0 is its
// onset, index n its end — which is why they are in the same row rather than
// edited somewhere else.
//
// Only the word the user opened renders like this. Expanding every word in a
// song would be ten thousand extra spans for a refinement that touches a
// handful of them.
//
// Three gestures, deliberately: tap a boundary to time it, alt-act on one to
// clear it, and close the row when done. The alt action is bound to
// shift-click, right-click AND long-press because this is used on a phone,
// and a clear that only exists as a modifier key is a clear that half the
// users cannot reach.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 4).

import type { Accessor, Component } from 'solid-js'
import { For, onCleanup, Show } from 'solid-js'
import { X } from '@/components/icons'
import { splitGraphemes } from '@/lib/word-letters'

/** How long a press has to hold before it counts as the alt action. */
const LONG_PRESS_MS = 450
/** A press that wanders further than this was a scroll, not a hold. */
const LONG_PRESS_SLOP_PX = 8

export interface LrcWordLettersProps {
  word: string
  /** Boundary index -> absolute song time. Sparse by design. */
  splits: Accessor<Record<number, number>>
  /** How far the highlighter has run through this word, 0 to 1. */
  progress: Accessor<number>
  formatTimeMs: (t: number) => string
  /** Stamp the playhead at this boundary. */
  onSet: (letterIdx: number) => void
  /** Drop this boundary's time. Ignored on the word's own edges. */
  onClear: (letterIdx: number) => void
  /** Collapse the row back to a plain word. */
  onClose: () => void
  /** Pre-fill the boundaries where the word's syllables begin. */
  onSuggestSyllables?: () => void
}

export const LrcWordLetters: Component<LrcWordLettersProps> = (props) => {
  const graphemes = () => splitGraphemes(props.word)
  /** n graphemes have n+1 joins, counting the word's own two edges. */
  const boundaries = () =>
    Array.from({ length: graphemes().length + 1 }, (_v, i) => i)

  const isEdge = (i: number) => i === 0 || i === graphemes().length

  /**
   * How much of glyph i the highlighter has covered, 0 to 1.
   *
   * Computed per glyph rather than as one gradient across the row because
   * progress is measured in grapheme space, not pixels — a single sweep
   * would drift from the letter it claims to be on, which is the whole thing
   * this editor exists to make visible.
   */
  const glyphFill = (i: number) => {
    const count = graphemes().length
    if (count === 0) return 0
    return Math.max(0, Math.min(1, props.progress() * count - i))
  }

  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let holdFrom: { x: number; y: number } | null = null
  let holdFired = false

  const cancelHold = () => {
    if (holdTimer !== undefined) clearTimeout(holdTimer)
    holdTimer = undefined
    holdFrom = null
  }
  onCleanup(cancelHold)

  const startHold = (e: PointerEvent, i: number) => {
    if (isEdge(i)) return
    holdFired = false
    holdFrom = { x: e.clientX, y: e.clientY }
    holdTimer = setTimeout(() => {
      holdFired = true
      cancelHold()
      props.onClear(i)
    }, LONG_PRESS_MS)
  }

  const moveHold = (e: PointerEvent) => {
    if (holdFrom === null) return
    const dx = e.clientX - holdFrom.x
    const dy = e.clientY - holdFrom.y
    if (Math.hypot(dx, dy) > LONG_PRESS_SLOP_PX) cancelHold()
  }

  const label = (i: number) => {
    if (i === 0) return 'Time the start of the word'
    if (i === graphemes().length) return 'Time the end of the word'
    return `Time the start of "${graphemes().slice(i).join('')}"`
  }

  return (
    <span class="sm-lyrics-letters" data-letter-editor="true">
      <For each={boundaries()}>
        {(i) => {
          // A word can legitimately start at 0 s, so presence is the test —
          // a truthiness check would hide the first line of the song.
          const time = () => props.splits()[i]
          const isSet = () => time() !== undefined
          const canClear = () => isSet() && !isEdge(i)
          return (
            <>
              <button
                type="button"
                class="sm-lyrics-letter-boundary"
                classList={{
                  'sm-lyrics-letter-boundary--set': isSet(),
                  'sm-lyrics-letter-boundary--edge': isEdge(i),
                  'sm-lyrics-letter-boundary--clearable': canClear(),
                }}
                aria-label={label(i)}
                title={
                  canClear()
                    ? `${label(i)} — right-click or hold to clear it`
                    : label(i)
                }
                onClick={(e) => {
                  e.stopPropagation()
                  // A long press already did the work and released here; the
                  // browser still delivers the click, and acting on it would
                  // re-stamp the boundary the hold just cleared.
                  if (holdFired) {
                    holdFired = false
                    return
                  }
                  if (e.shiftKey && !isEdge(i)) props.onClear(i)
                  else props.onSet(i)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isEdge(i)) props.onClear(i)
                }}
                onPointerDown={(e) => startHold(e, i)}
                onPointerMove={moveHold}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
              >
                <Show when={isSet()}>
                  <span class="sm-lyrics-letter-time">
                    {props.formatTimeMs(time() ?? 0)}
                  </span>
                </Show>
              </button>
              <Show when={i < graphemes().length}>
                <span
                  class="sm-lyrics-letter-glyph"
                  style={{
                    '--glyph-fill': `${(glyphFill(i) * 100).toFixed(1)}%`,
                  }}
                >
                  {graphemes()[i]}
                </span>
              </Show>
            </>
          )
        }}
      </For>
      <span class="sm-lyrics-letter-actions">
        <Show when={props.onSuggestSyllables !== undefined}>
          <button
            type="button"
            class="sm-lyrics-letter-action"
            aria-label="Split this word at its syllables"
            title="Split at syllables — a starting guess you can then adjust"
            onClick={(e) => {
              e.stopPropagation()
              props.onSuggestSyllables?.()
            }}
          >
            <span class="sm-lyrics-letter-action-glyph" aria-hidden="true">
              a-b
            </span>
          </button>
        </Show>
        <button
          type="button"
          class="sm-lyrics-letter-action sm-lyrics-letter-action--close"
          aria-label="Close the letter editor"
          title="Close the letter editor (Esc)"
          onClick={(e) => {
            e.stopPropagation()
            props.onClose()
          }}
        >
          <X />
        </button>
      </span>
    </span>
  )
}
