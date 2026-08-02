// ── JamSongLyrics ─────────────────────────────────────────────────────
// The left half of a song room: the words, scrolling with the music.
//
// Deliberately not the stem-mixer's lyrics panel. That one is an editor --
// it owns block marking, LRC generation, tap-to-time and an edit mode,
// none of which belong in a room where someone else is driving playback.
// This is the read-only half of the same idea, and it stays small enough
// that the singer's eye can find the current line without hunting.

import type { Component } from 'solid-js'
import { createEffect, For, Show } from 'solid-js'
import { lineIndexAt } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'
import styles from './JamSongLyrics.module.css'

interface JamSongLyricsProps {
  lines: LyricsLineTiming[]
  positionSec: () => number
  /** Shows the note name under each line when the room wants pitch help. */
  showNotes: boolean
}

export const JamSongLyrics: Component<JamSongLyricsProps> = (props) => {
  let scrollRef: HTMLDivElement | undefined

  const currentIndex = () => lineIndexAt(props.lines, props.positionSec())

  // Keep the sung line in view. Centring rather than scrolling it to the
  // top: a singer needs the NEXT line as much as the current one, and a
  // line pinned to the top edge hides everything coming.
  createEffect(() => {
    const i = currentIndex()
    if (i < 0 || scrollRef === undefined) return
    const el = scrollRef.querySelector<HTMLElement>(`[data-line="${i}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })

  return (
    <div class={styles.panel}>
      <Show
        when={props.lines.length > 0}
        fallback={
          <p class={styles.empty}>
            No lyrics for this song — sing along by ear.
          </p>
        }
      >
        <div class={styles.scroll} ref={scrollRef}>
          <For each={props.lines}>
            {(line, i) => (
              <div
                data-line={i()}
                class={styles.line}
                classList={{
                  [styles.lineCurrent]: i() === currentIndex(),
                  // Everything already sung dims rather than disappearing,
                  // so the singer keeps a sense of where they are in the
                  // song rather than only where they are in the bar.
                  [styles.linePast]:
                    currentIndex() >= 0 && i() < currentIndex(),
                }}
              >
                <span class={styles.lineText}>{line.text}</span>
                <Show when={props.showNotes}>
                  <span class={styles.lineTime}>
                    {formatTime(line.startSec)}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
