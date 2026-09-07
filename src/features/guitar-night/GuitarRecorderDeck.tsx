// Two rows keep the take timeline above a centered Play, Stop and Record transport.
import { Show } from 'solid-js'
import { Pause, Play, Square } from '@/components/icons'
import styles from './GuitarRecorderDeck.module.css'
import { GuitarRecordButton } from './GuitarRecordingControls'
import { GuitarRecordingSourceMenu, GuitarRecordingToneMenu, } from './GuitarRecordingPlaybackControls'
import { GuitarRecordingTimeline } from './GuitarRecordingTimeline'
import type { GuitarRecordingController } from './useGuitarRecordingController'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export function GuitarRecorderDeck(props: {
  recorder: GuitarRecordingController
  playback: GuitarRecordingPlayback
  disabled: boolean
}) {
  const busy = () => props.recorder.busy() || props.disabled
  const running = () => props.playback.playing() || props.playback.pending()
  return (
    <div
      class={styles.deck}
      data-recording={props.recorder.busy()}
      data-testid="guitar-recorder-deck"
    >
      <div class={styles.timeline}>
        <Show when={props.recorder.draft() !== null && !props.recorder.busy()}>
          <GuitarRecordingTimeline
            playback={props.playback}
            disabled={props.disabled}
          />
        </Show>
      </div>
      <div class={styles.controls}>
        <div class={styles.source}>
          <GuitarRecordingSourceMenu
            playback={props.playback}
            disabled={busy() || props.recorder.draft() === null}
          />
        </div>
        <div class={styles.keys} data-testid="guitar-recorder-actions">
          <button
            type="button"
            class={styles.play}
            aria-label={
              running()
                ? props.playback.source() === 'recording'
                  ? 'Pause recording replay'
                  : 'Pause note playback'
                : props.playback.source() === 'recording'
                  ? 'Play recording'
                  : 'Play recorded notes'
            }
            disabled={!props.playback.available() || busy()}
            aria-busy={props.playback.pending()}
            title={running() ? 'Pause playback' : 'Play the take'}
            onClick={() => void props.playback.toggle()}
          >
            <Show when={running()} fallback={<Play />}>
              <Pause />
            </Show>
          </button>
          <button
            type="button"
            aria-label="Stop take playback"
            title="Stop and return to the beginning"
            disabled={busy() || !props.playback.engaged()}
            onClick={() => props.playback.stop()}
          >
            <Square />
          </button>
          <GuitarRecordButton
            controller={props.recorder}
            iconOnly
            disabled={props.disabled || running()}
            showDuration={false}
            disabledReason={
              running()
                ? 'Stop playback before recording'
                : 'Finish setup before recording'
            }
          />
        </div>
        <div class={styles.tone}>
          <GuitarRecordingToneMenu
            playback={props.playback}
            includeSource
            disabled={busy() || props.recorder.draft() === null}
          />
        </div>
      </div>
    </div>
  )
}
