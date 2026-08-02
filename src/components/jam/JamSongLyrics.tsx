// ── JamSongLyrics ─────────────────────────────────────────────────────
// The left half of a song room: the words, scrolling with the music.
//
// Deliberately not the stem-mixer's lyrics panel. That one is an editor --
// it owns block marking, LRC generation, tap-to-time and an edit mode,
// none of which belong in a room where someone else is driving playback.
// This is the read-only half of the same idea, and it stays small enough
// that the singer's eye can find the current line without hunting.

import type { Component } from 'solid-js'
import { createEffect, createMemo, For, Show } from 'solid-js'
import { formatClock } from '@/lib/format-time'
import { lineIndexAt, restAt, restsBetween } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'
import styles from './JamSongLyrics.module.css'

interface JamSongLyricsProps {
  lines: LyricsLineTiming[]
  positionSec: () => number
  /** Shows the note name under each line when the room wants pitch help. */
  showNotes: boolean
}

/** Dots that empty as the rest runs out -- the karaoke count-in idea. */
const RestDots: Component<{ total: number; left: number }> = (props) => (
  <div class={styles.rest} aria-label={`${Math.ceil(props.left)} seconds`}>
    <For each={Array.from({ length: props.total })}>
      {(_dot, i) => (
        <span
          class={styles.restDot}
          classList={{
            // Dots go out from the left as time passes, so the number
            // still lit IS the seconds remaining.
            [styles.restDotSpent]: i() < props.total - Math.ceil(props.left),
          }}
        />
      )}
    </For>
  </div>
)

export const JamSongLyrics: Component<JamSongLyricsProps> = (props) => {
  let scrollRef: HTMLDivElement | undefined

  const currentIndex = () => lineIndexAt(props.lines, props.positionSec())
  const rests = createMemo(() => restsBetween(props.lines))
  const activeRest = () => restAt(rests(), props.positionSec())

  /**
   * Keep the sung line centred in THIS panel.
   *
   * Not scrollIntoView: it scrolls every scrollable ancestor, so following
   * the song dragged the whole page down and the header, the picker and
   * the transport all scrolled out of reach. Setting scrollTop moves only
   * this element.
   *
   * Centring rather than pinning to the top because a singer needs the
   * NEXT line as much as the current one. The clamp is what makes the
   * first and last lines behave -- they simply stop at the ends instead of
   * needing half a panel of padding to centre into.
   */
  createEffect(() => {
    const i = currentIndex()
    const box = scrollRef
    if (i < 0 || box === undefined) return
    const el = box.querySelector<HTMLElement>(`[data-line="${i}"]`)
    if (el === null) return
    const target = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2
    box.scrollTo({
      top: Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight)),
      behavior: 'smooth',
    })
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
                {/* The count-in sits above the line it leads into, which
                    is where the singer's eye already is. */}
                <Show
                  when={
                    activeRest()?.rest.beforeLine === i()
                      ? activeRest()
                      : undefined
                  }
                >
                  {(r) => (
                    <RestDots
                      total={r().rest.dotCount}
                      left={r().secondsLeft}
                    />
                  )}
                </Show>
                <span class={styles.lineText}>{line.text}</span>
                <Show when={props.showNotes}>
                  <span class={styles.lineTime}>
                    {formatClock(line.startSec)}
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
