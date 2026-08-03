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
import { EVERYONE } from '@/lib/jam/jam-song-parts'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamAssignBrush, jamIsHost, jamPeerId, jamPeers, jamSong, setJamAssignBrush, toggleJamAssignBrush, } from '@/stores/jam-store'
import styles from './JamAssignBar.module.css'

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
                style={{
                  '--person-color': colors()[person.id] ?? '#58a6ff',
                }}
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
            style={{ '--person-color': 'rgba(255,255,255,0.5)' }}
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
          <span class={styles.hintArmed}>
            Now drag down the lines they sing.
          </span>
          <button
            type="button"
            class={styles.done}
            onClick={() => setJamAssignBrush(null)}
          >
            Done
          </button>
        </Show>
      </div>
    </Show>
  )
}
