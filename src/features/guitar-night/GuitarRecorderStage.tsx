// The player's tape machine and take label live over the stage, outside the transport layout.
import { Show } from 'solid-js'
import { Eye, EyeOff, Headphones } from '@/components/icons'
import { OverflowMenu } from '@/components/OverflowMenu'
import { GuitarRecorderArtwork } from './GuitarRecorderArtwork'
import styles from './GuitarRecorderStage.module.css'
import { recordingTime } from './GuitarRecordingControls'
import { recordingToneDescription } from './GuitarRecordingPlaybackControls'
import playbackStyles from './GuitarRecordingPlaybackControls.module.css'
import type { GuitarRecordingController } from './useGuitarRecordingController'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export function GuitarRecorderStage(props: {
  recorder: GuitarRecordingController
  playback: GuitarRecordingPlayback
  liveNotes: boolean
  onLiveNotes(enabled: boolean): void
  onAttachTab?(): void
  disabled: boolean
  allowRecordDuringPlayback?: boolean
  liveMode?: boolean
  onHistory?(): void
}) {
  const replaying = () => props.playback.playing() || props.playback.pending()
  const label = () =>
    props.recorder.state() === 'recording'
      ? 'Recording your idea'
      : props.recorder.state() === 'preparing'
        ? 'Opening your input…'
        : props.recorder.state() === 'stopping'
          ? 'Saving your melody…'
          : (props.recorder.draft()?.recording.title ?? 'Your next idea')
  return (
    <div
      class={styles.recorder}
      data-recording={props.recorder.busy()}
      data-testid="guitar-recorder-stage"
    >
      <button
        type="button"
        class={styles.machine}
        aria-label={
          props.recorder.busy()
            ? 'Stop using tape deck'
            : 'Record using tape deck'
        }
        title={
          replaying() && props.allowRecordDuringPlayback !== true
            ? 'Stop playback before recording'
            : props.recorder.busy()
              ? 'Stop recording'
              : 'Tap to record a melody'
        }
        disabled={
          props.disabled ||
          (replaying() && props.allowRecordDuringPlayback !== true) ||
          props.recorder.state() === 'stopping'
        }
        onClick={() =>
          props.recorder.busy()
            ? void props.recorder.stop()
            : void props.recorder.start()
        }
      >
        <GuitarRecorderArtwork
          recording={props.recorder.state() === 'recording'}
        />
      </button>
      <div class={styles.label}>
        <span class={styles.status}>
          <i aria-hidden="true" />
          {props.recorder.state() === 'preparing'
            ? 'Preparing'
            : props.recorder.state() === 'stopping'
              ? 'Saving'
              : props.recorder.busy()
                ? 'Recording'
                : props.playback.pending()
                  ? 'Opening playback'
                  : props.playback.playing()
                    ? 'Playing'
                    : props.liveMode === true
                      ? 'Live · not recording'
                      : 'Your melody'}
        </span>
        <strong title={label()}>{label()}</strong>
        <div class={styles.metadata}>
          <output aria-label="Recording duration">
            {recordingTime(
              props.recorder.busy()
                ? props.recorder.duration()
                : props.playback.duration(),
            )}
          </output>
          <span>
            {props.recorder.busy()
              ? 'Dry input'
              : props.recorder.draft() === null
                ? 'Tap the tape deck to begin'
                : props.playback.source() === 'recording'
                  ? 'Original audio'
                  : 'Transcribed notes'}
          </span>
        </div>
        <Show when={props.recorder.draft() !== null && !props.recorder.busy()}>
          <button
            type="button"
            class={styles.review}
            aria-label="Review take"
            disabled={props.disabled}
            onClick={() => props.recorder.setReviewOpen(true)}
          >
            <Headphones />
            Review take
          </button>
        </Show>
        <Show when={props.playback.error()}>
          {(message) => (
            <span role="alert" class={styles.error}>
              {message()}
            </span>
          )}
        </Show>
      </div>
      <OverflowMenu
        label="Recorder options"
        triggerClass={styles.options}
        panelClass={playbackStyles.menu}
        items={[
          {
            key: 'live-notes',
            label: 'Live notes',
            checked: props.liveNotes,
            checkType: 'checkbox',
            note: props.liveNotes
              ? 'On · show recognized notes as you play'
              : props.recorder.busy()
                ? 'Off · audio is still recorded'
                : 'Off · the input remains available',
            icon: () => (props.liveNotes ? <Eye /> : <EyeOff />),
            onSelect: () => props.onLiveNotes(!props.liveNotes),
          },
          ...(props.onHistory === undefined
            ? []
            : [
                {
                  key: 'history',
                  label: 'Show recorded history',
                  note: 'Pause replay and see the notes you recorded',
                  disabled:
                    props.disabled ||
                    props.recorder.busy() ||
                    props.recorder.draft() === null,
                  onSelect: () => props.onHistory?.(),
                },
              ]),
          {
            key: 'review',
            label: 'Review take',
            note: 'Keep, correct, practice or export your melody',
            icon: () => <Headphones />,
            disabled:
              props.disabled ||
              props.recorder.busy() ||
              props.recorder.draft() === null,
            onSelect: () => props.recorder.setReviewOpen(true),
          },
          {
            key: 'tone-info',
            label: recordingToneDescription(props.playback),
            note: 'Change the playback sound with the amp in the rail',
            disabled: true,
            onSelect: () => undefined,
          },
          ...(props.onAttachTab === undefined
            ? []
            : [
                {
                  key: 'attach-tab',
                  label: 'Attach a tab',
                  note: 'Open a score in tab rehearsal',
                  disabled: props.disabled || props.recorder.busy(),
                  onSelect: () => props.onAttachTab?.(),
                },
              ]),
        ]}
      />
    </div>
  )
}
