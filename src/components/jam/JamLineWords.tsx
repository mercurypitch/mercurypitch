// ── JamLineWords ──────────────────────────────────────────────────────
// The line being sung, as words that light up one by one.
//
// Only ever the CURRENT line: every other row of the sheet stays one text
// node (see JamSongLyrics), so a sixty-line song is sixty text nodes and one
// line of spans, not five hundred spans repainted at the song's frame rate.
//
// The look is Karaoke Night's -- a word that has been sung is lit, the one
// being sung fills from the left, the rest wait -- and so is the arithmetic
// (lib/jam/jam-line-words asks the same function).

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { JamWordProgress } from '@/lib/jam/jam-line-words'
import styles from './JamLineWords.module.css'

interface JamLineWordsProps {
  words: readonly string[]
  progress: () => JamWordProgress
}

export const JamLineWords: Component<JamLineWordsProps> = (props) => (
  <For each={props.words}>
    {(word, i) => {
      const sung = () => i() <= props.progress().sungUpTo
      const active = () =>
        i() === props.progress().sungUpTo + 1 && props.progress().fraction > 0
      return (
        <span
          class={styles.word}
          classList={{
            [styles.wordSung]: sung(),
            [styles.wordActive]: active(),
          }}
          data-word={sung() ? 'sung' : active() ? 'active' : 'ahead'}
          style={
            active()
              ? {
                  '--word-sweep': `${(props.progress().fraction * 100).toFixed(1)}%`,
                }
              : undefined
          }
        >
          {word}
          {i() < props.words.length - 1 ? ' ' : ''}
        </span>
      )
    }}
  </For>
)
