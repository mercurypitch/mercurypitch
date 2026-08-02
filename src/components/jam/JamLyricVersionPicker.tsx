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

import type { Component } from 'solid-js'
import { createResource, For, Show } from 'solid-js'
import { sessionIdOfSong } from '@/lib/jam/jam-lyrics-attach'
import type { JamLyricChoice } from '@/lib/jam/jam-session-songs'
import { sessionLyricChoices } from '@/lib/jam/jam-session-songs'
import { attachJamSongLyrics, jamIsHost, jamSong } from '@/stores/jam-store'
import styles from './JamLyricVersionPicker.module.css'

export const JamLyricVersionPicker: Component = () => {
  const sessionId = () => sessionIdOfSong(jamSong())

  const [choices] = createResource(sessionId, async (id) =>
    id === null ? [] : sessionLyricChoices(id),
  )

  /**
   * Which one is on screen right now.
   *
   * Matched on the lines themselves rather than remembered separately: the
   * room's words can also be replaced by the finder, and a picker showing
   * a selection the column is not actually using would be a lie.
   */
  const currentKind = () => {
    const lines = jamSong()?.lines ?? []
    if (lines.length === 0) return null
    return (
      (choices() ?? []).find(
        (c) =>
          c.lines.length === lines.length &&
          c.lines[0]?.startSec === lines[0]?.startSec &&
          c.lines[0]?.text === lines[0]?.text,
      )?.kind ?? null
    )
  }

  const choose = (choice: JamLyricChoice) => {
    attachJamSongLyrics(choice.lines)
  }

  return (
    <Show when={jamIsHost() && (choices() ?? []).length > 1}>
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
