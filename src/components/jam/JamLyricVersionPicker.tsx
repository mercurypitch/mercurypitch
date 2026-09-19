// ── JamLyricVersionPicker ─────────────────────────────────────────────
// Which set of words the room sings.
//
// A session accumulates versions: the imported LRC, the one corrected by
// hand, an auto-sync pass. They are not equally good -- LRCLib's line
// timings are routinely a second or two out, so the hand-corrected one is
// usually what you actually want to sing to. The mixer has had this
// switcher in its lyrics header all along; the room did not, and took
// whatever happened to be stored.
//
// Host-only, because it changes what everyone is reading. Hidden entirely
// when there is nothing to choose between, so the common case stays a
// transport bar and not a settings panel.
//
// Tests: src/tests/jam-lyric-version-picker.test.tsx

import type { Component } from 'solid-js'
import { createResource, createSignal, For, Show } from 'solid-js'
import type { JamLyricChoice } from '@/lib/jam/jam-session-songs'
import { sessionLyricChoices } from '@/lib/jam/jam-session-songs'
import { jamSongSessionId } from '@/lib/jam/jam-song-sources'
import type { LyricsLineTiming } from '@/lib/jam/types'
import type { LyricsVersionKind } from '@/lib/lyrics-versions'
import { attachJamSongLyrics, jamIsHost, jamSong } from '@/stores/jam-store'
import styles from './JamLyricVersionPicker.module.css'

/** A song's versions, with the song written on them. */
interface SongChoices {
  songId: string
  choices: JamLyricChoice[]
}

/** The same words at the same times, line for line. */
function sameLines(
  a: readonly LyricsLineTiming[],
  b: readonly LyricsLineTiming[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (line, i) => line.startSec === b[i]?.startSec && line.text === b[i]?.text,
    )
  )
}

export const JamLyricVersionPicker: Component = () => {
  const songId = () => jamSong()?.id ?? null

  // Keyed on the SONG, and the answer carries the song it was read for.
  // Keyed on the session id it kept the last song's list whenever the next
  // one had none -- a resource whose source goes null holds its value, and
  // every example song had a null source -- and for as long as any song's
  // own list took to read. Pressing a button then put the previous song's
  // words on the one that was loaded.
  const [read] = createResource(songId, async (id): Promise<SongChoices> => {
    const sessionId = jamSongSessionId(id)
    return {
      songId: id,
      choices: sessionId === null ? [] : await sessionLyricChoices(sessionId),
    }
  })

  /** The loaded song's own, or none -- never the last song's. */
  const choices = (): JamLyricChoice[] => {
    const held = read()
    return held !== undefined && held.songId === songId() ? held.choices : []
  }

  // Only to break a tie. Two versions can read the same line for line -- a
  // word-level correction moves no line -- and then the lines cannot say
  // which button was pressed.
  const [picked, setPicked] = createSignal<{
    songId: string
    kind: LyricsVersionKind
  } | null>(null)

  /**
   * Which one is on screen right now.
   *
   * Matched on the lines themselves rather than remembered separately: the
   * room's words can also be replaced by the finder, and a picker showing
   * a selection the column is not actually using would be a lie. Matched on
   * every line, too -- most corrections leave the first one alone, and
   * comparing only that lit Original whichever version was showing.
   */
  const currentKind = (): LyricsVersionKind | null => {
    const lines = jamSong()?.lines ?? []
    if (lines.length === 0) return null
    const showing = choices().filter((c) => sameLines(c.lines, lines))
    const last = picked()
    const remembered =
      last !== null && last.songId === songId()
        ? showing.find((c) => c.kind === last.kind)
        : undefined
    return (remembered ?? showing[0])?.kind ?? null
  }

  const choose = (choice: JamLyricChoice) => {
    const id = songId()
    if (id === null) return
    setPicked({ songId: id, kind: choice.kind })
    attachJamSongLyrics(id, choice.lines)
  }

  return (
    <Show when={jamIsHost() && choices().length > 1}>
      <div class={styles.picker}>
        <span class={styles.label}>Words</span>
        <div class={styles.options}>
          <For each={choices()}>
            {(choice) => (
              <button
                type="button"
                class={styles.option}
                classList={{
                  [styles.optionOn]: currentKind() === choice.kind,
                }}
                aria-pressed={currentKind() === choice.kind}
                title={`${choice.lines.length} lines`}
                onClick={() => choose(choice)}
              >
                {choice.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
