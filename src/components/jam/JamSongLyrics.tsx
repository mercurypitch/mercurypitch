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
import type { JamLineScore } from '@/lib/jam/jam-line-scoring'
import { canAttachLyrics } from '@/lib/jam/jam-lyrics-attach'
import { lineIndexAt, restAt, restsBetween } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'
import { jamSong } from '@/stores/jam-store'
import { JamLyricsFinder } from './JamLyricsFinder'
import styles from './JamSongLyrics.module.css'

interface JamSongLyricsProps {
  lines: LyricsLineTiming[]
  positionSec: () => number
  /** Shows the note name under each line when the room wants pitch help. */
  showNotes: boolean
  /** Your score per line, filled in as the playhead leaves each one. */
  scores?: () => Record<number, JamLineScore>
}

/**
 * Where a line's score sits on the good/close/missed scale.
 *
 * Three bands rather than a number's worth of precision: mid-song, a
 * singer reads a colour, not a figure. The exact number is still there for
 * anyone who wants it, and for the screen reader.
 */
function scoreBand(score: number): 'good' | 'close' | 'missed' {
  if (score >= 80) return 'good'
  if (score >= 50) return 'close'
  return 'missed'
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
          // The finder shows itself only when the song is one it can fix
          // (a session of yours, with no words yet). Everything else --
          // an instrumental, the demo -- falls through to the plain note.
          <>
            <JamLyricsFinder />
            <Show when={!canAttachLyrics(jamSong())}>
              <p class={styles.empty}>
                No lyrics for this song — sing along by ear.
              </p>
            </Show>
          </>
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
                {/* Only on lines already sung: a score appearing beside the
                    line you are singing would be judging a phrase that is
                    not finished. */}
                <Show when={props.scores?.()[i()]}>
                  {(s) => (
                    <span
                      class={styles.lineScore}
                      classList={{
                        [styles[`lineScore_${scoreBand(s().score)}`] ?? '']:
                          true,
                      }}
                      aria-label={`${s().score} out of 100`}
                    >
                      {s().score}
                    </span>
                  )}
                </Show>
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
