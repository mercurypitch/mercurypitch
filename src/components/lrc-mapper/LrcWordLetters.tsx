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
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 4).

import type { Accessor, Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { splitGraphemes } from '@/lib/word-letters'

export interface LrcWordLettersProps {
  word: string
  /** Boundary index -> absolute song time. Sparse by design. */
  splits: Accessor<Record<number, number>>
  formatTimeMs: (t: number) => string
  /** Stamp the playhead at this boundary. */
  onSet: (letterIdx: number) => void
  /** Drop this boundary's time. Ignored on the word's own edges. */
  onClear: (letterIdx: number) => void
}

export const LrcWordLetters: Component<LrcWordLettersProps> = (props) => {
  const graphemes = () => splitGraphemes(props.word)
  /** n graphemes have n+1 joins, counting the word's own two edges. */
  const boundaries = () =>
    Array.from({ length: graphemes().length + 1 }, (_v, i) => i)

  const isEdge = (i: number) => i === 0 || i === graphemes().length

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
          return (
            <>
              <button
                type="button"
                class="sm-lyrics-letter-boundary"
                classList={{
                  'sm-lyrics-letter-boundary--set': isSet(),
                  'sm-lyrics-letter-boundary--edge': isEdge(i),
                }}
                aria-label={label(i)}
                title={
                  isEdge(i)
                    ? label(i)
                    : `${label(i)} — shift-click to clear it again`
                }
                onClick={(e) => {
                  e.stopPropagation()
                  if (e.shiftKey && !isEdge(i)) props.onClear(i)
                  else props.onSet(i)
                }}
              >
                <Show when={isSet()}>
                  <span class="sm-lyrics-letter-time">
                    {props.formatTimeMs(time() ?? 0)}
                  </span>
                </Show>
              </button>
              <Show when={i < graphemes().length}>
                <span class="sm-lyrics-letter-glyph">{graphemes()[i]}</span>
              </Show>
            </>
          )
        }}
      </For>
    </span>
  )
}
