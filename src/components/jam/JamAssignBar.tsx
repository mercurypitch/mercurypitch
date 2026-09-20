// ── JamAssignBar ──────────────────────────────────────────────────────
// Pick a person, then sweep their lines.
//
// The order matters. Line-first meant one decision per line -- tap a line,
// pick a name, repeat -- when the actual thought is "Ada takes the
// chorus": one decision and then a sweep. So the singer is chosen once and
// stays armed, and the lyric column paints while it is.
//
// Host-only. The allocation is authored, and two people editing it from
// opposite ends of a mesh is a room nobody can sing in.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { colorTokenVars } from '@/lib/css-color-token'
import { jamPhoneLayout } from '@/lib/jam/jam-phone-layout'
import { EVERYONE } from '@/lib/jam/jam-song-parts'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamAssignBrush, jamIsHost, jamPeerId, jamPeers, jamSong, setJamAssignBrush, toggleJamAssignBrush, } from '@/stores/jam-store'
import styles from './JamAssignBar.module.css'
import { JamLyricVersionPicker } from './JamLyricVersionPicker'

export const JamAssignBar: Component = () => {
  const roster = createMemo(() => {
    const mine = jamPeerId()
    const others = jamPeers().map((p) => ({ id: p.id, name: p.displayName }))
    return mine === null || mine === ''
      ? others
      : [{ id: mine, name: 'You' }, ...others]
  })

  const colors = createMemo(() => buildPeerColorMap(roster().map((p) => p.id)))

  const armed = () => jamAssignBrush()

  return (
    <Show when={jamIsHost() && (jamSong()?.lines.length ?? 0) > 0}>
      <div class={styles.bar}>
        <span class={styles.label}>Parts</span>
        <div class={styles.people}>
          <For each={roster()}>
            {(person) => (
              <button
                type="button"
                class={styles.person}
                classList={{ [styles.personArmed]: armed() === person.id }}
                style={colorTokenVars(
                  '--person-color',
                  colors()[person.id] ?? '#58a6ff',
                )}
                onClick={() => toggleJamAssignBrush(person.id)}
              >
                <span class={styles.dot} />
                {person.name}
              </button>
            )}
          </For>
          {/* Handing lines back is the same gesture as giving them out. */}
          <button
            type="button"
            class={styles.person}
            classList={{ [styles.personArmed]: armed() === EVERYONE }}
            style={colorTokenVars('--person-color', 'rgba(255,255,255,0.5)')}
            onClick={() => toggleJamAssignBrush(EVERYONE)}
          >
            <span class={styles.dotHollow} />
            Everyone
          </button>
        </div>

        <Show
          when={armed() !== null}
          fallback={
            <span class={styles.hint}>
              Pick someone, then drag down the words.
            </span>
          }
        >
          {/* Under a finger an armed sheet paints and does not scroll; a
              mouse still has its wheel, so only a touch screen is told how
              to get the scroll back. Said INSTEAD of the mouse's sentence,
              not after it: two sentences pushed Done onto a third row of a
              tablet's lyric column, and a row is 32px of words. */}
          <span class={`${styles.hintArmed} ${styles.mouseOnly}`}>
            Now drag down the lines they sing.
          </span>
          <span class={`${styles.hintArmed} ${styles.touchOnly}`}>
            Drag down their lines. Done to scroll again.
          </span>
          <button
            type="button"
            class={styles.done}
            onClick={() => setJamAssignBrush(null)}
          >
            Done
          </button>
        </Show>

        {/* Which words are on the sheet. It was in the song's own bar,
            which is on the playback row now and has to be short to fit
            there; and it is the same kind of thing as the rest of this
            bar -- the host's edit to the words under it. A phone keeps it
            on the timeline (JamSongTimeline), where it costs no height. */}
        <Show when={!jamPhoneLayout()}>
          <div class={styles.words}>
            <JamLyricVersionPicker />
          </div>
        </Show>
      </div>
    </Show>
  )
}
