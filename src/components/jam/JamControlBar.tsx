// ── JamControlBar ─────────────────────────────────────────────────────
// The room's playback controls: one capsule for what is reached for all
// the time, and a More button for what is set once and left.
//
// In the capsule: the host's transport, and the live-pitch toggle. The
// toggle used to be a lone box between the transport and the room's mode,
// belonging to neither -- it is a thing everyone in the room has, host or
// guest, so it shares the transport's glass and a guest's capsule is that
// one button.
//
// Behind More: the tempo and the room's mode. Both reshape a DRILL -- the
// mode deals the shared melody out into parts, the tempo is how fast its
// beats run -- so on a song there is nothing behind the button and it is
// not drawn. A song's parts are dealt line by line in the bar above the
// words, and a mode picker beside them would be a second answer to the
// same question that changes nothing.
//
// Open or folded is remembered on the device (jam-view-prefs), the same
// deal the practice bars make: open it once and it stays open.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { JAM_MODES } from '@/lib/jam/jam-modes'
import { jamMoreControlsPinned, setJamMoreControlsPinned, } from '@/lib/jam/jam-view-prefs'
import { jamExerciseBpm, jamExerciseLoop, jamExerciseMelody, jamIsHost, jamIsSongRoom, jamRoomMode, jamShowPitch, selectJamRoomMode, setJamExerciseBpm, setJamExerciseLoop, setJamShowPitch, } from '@/stores/jam-store'
import styles from './JamControlBar.module.css'
import { JamTransport } from './JamTransport'

/** The id the More button points at, so a screen reader can follow it. */
const EXTRAS_ID = 'jam-more-controls'

interface JamControlBarProps {
  onSelectExercise: () => void
  /** Whether the picker the transport's first button opens is showing. */
  pickerOpen: boolean
}

export const JamControlBar: Component<JamControlBarProps> = (props) => {
  /** Is there anything behind More? Not for a guest, and not on a song. */
  const hasExtras = () => jamIsHost() && !jamIsSongRoom()
  const extrasOpen = () => hasExtras() && jamMoreControlsPinned()

  return (
    <>
      <div
        class={styles.capsule}
        classList={{ [styles.capsuleGuest]: !jamIsHost() }}
        data-testid="jam-controls"
      >
        <JamTransport
          bare
          onSelectExercise={() => props.onSelectExercise()}
          pickerOpen={props.pickerOpen}
          loopEnabled={jamExerciseLoop()}
          onToggleLoop={() => setJamExerciseLoop((v) => !v)}
        />

        <Show when={jamIsHost()}>
          <span class={`${styles.divider} ${styles.deskOnly}`} />
        </Show>

        {/* Hidden on a phone, where the same control lives in the room menu
            -- the bar scrolls sideways there and every button in it is one
            more thing to scroll past. */}
        <button
          type="button"
          class={`${styles.iconBtn} ${styles.deskOnly}`}
          classList={{ [styles.iconBtnOn]: jamShowPitch() }}
          data-testid="jam-pitch-toggle"
          onClick={() => setJamShowPitch((v) => !v)}
          aria-pressed={jamShowPitch()}
          title={jamShowPitch() ? 'Hide the live pitch' : 'Show the live pitch'}
          aria-label={
            jamShowPitch() ? 'Hide the live pitch' : 'Show the live pitch'
          }
        >
          <svg
            viewBox="0 0 16 16"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path
              d="M2 8h2l2-4 2 8 2-5 2 3h2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <Show when={hasExtras()}>
          <button
            type="button"
            class={styles.iconBtn}
            classList={{ [styles.iconBtnOn]: jamMoreControlsPinned() }}
            data-testid="jam-more-toggle"
            onClick={() => setJamMoreControlsPinned((v) => !v)}
            aria-expanded={jamMoreControlsPinned()}
            aria-controls={EXTRAS_ID}
            title={
              jamMoreControlsPinned() ? 'Hide extra controls' : 'More controls'
            }
            aria-label={
              jamMoreControlsPinned() ? 'Hide extra controls' : 'More controls'
            }
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <circle cx="5" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="19" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
        </Show>
      </div>

      {/* Taken out of the page when folded, not shrunk to nothing: a
          control squeezed to zero width can still take the keyboard's
          focus, and it still costs the row one of its gaps. */}
      <Show when={extrasOpen()}>
        <div class={styles.extras} id={EXTRAS_ID} data-testid={EXTRAS_ID}>
          {/* Tempo -- once there is a drill for it to be the tempo of. */}
          <Show when={jamExerciseMelody()}>
            <div class={styles.bpmControl}>
              <button
                type="button"
                class={styles.bpmStep}
                onClick={() => setJamExerciseBpm((v) => Math.max(40, v - 5))}
                title="Decrease BPM by 5"
                aria-label="Decrease BPM by 5"
              >
                <svg
                  viewBox="0 0 12 12"
                  width="10"
                  height="10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                </svg>
              </button>
              <input
                class={styles.bpmInput}
                type="number"
                min="20"
                max="300"
                value={jamExerciseBpm()}
                onInput={(e) => {
                  const v = parseInt(e.currentTarget.value, 10)
                  if (!isNaN(v) && v >= 20 && v <= 300) setJamExerciseBpm(v)
                }}
                title="Playback BPM"
                aria-label="Playback BPM"
              />
              <button
                type="button"
                class={styles.bpmStep}
                onClick={() => setJamExerciseBpm((v) => Math.min(300, v + 5))}
                title="Increase BPM by 5"
                aria-label="Increase BPM by 5"
              >
                <svg
                  viewBox="0 0 12 12"
                  width="10"
                  height="10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                  <rect x="5.25" y="2" width="1.5" height="8" rx="0.75" />
                </svg>
              </button>
              <span class={styles.bpmLabel}>bpm</span>
            </div>
          </Show>

          {/* Room mode -- host picks, everyone follows. Roles are derived
              from the sorted peer list, so nothing is sent but this. */}
          <div class={styles.modePicker} role="group" aria-label="Room mode">
            <For each={JAM_MODES}>
              {(m) => (
                <button
                  type="button"
                  class={styles.modeBtn}
                  classList={{
                    [styles.modeBtnActive]: jamRoomMode() === m.id,
                  }}
                  title={m.blurb}
                  aria-pressed={jamRoomMode() === m.id}
                  onClick={() => selectJamRoomMode(m.id)}
                >
                  {m.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  )
}
