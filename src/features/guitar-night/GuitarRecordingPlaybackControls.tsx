// Recording and note auditions share tactile source/tone menus and one playback owner.
import { Show } from 'solid-js'
import { CheckSmall as Check, Headphones, MusicNote, Pause, Play, PowerSymbol as Power, Square, } from '@/components/icons'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { OverflowMenu } from '@/components/OverflowMenu'
import type { GuitarRecordingPlaybackTone } from '@/lib/guitar/recording-playback'
import styles from './GuitarRecordingPlaybackControls.module.css'
import { GuitarRecordingTimeline } from './GuitarRecordingTimeline'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export const RECORDING_AMP_ART = '/guitar-night/recorder-amp-cabinet-v1.webp'

export function recordingToneDescription(
  playback: GuitarRecordingPlayback,
): string {
  if (playback.parameters() === null)
    return 'No saved amp settings for this take.'
  if (playback.parameters()?.enabled !== true)
    return 'App amp bypassed · clean playback'
  if (playback.ampStatus() === 'loading')
    return 'Cabinet loading · Lite tone for now'
  if (playback.ampStatus() === 'fallback')
    return 'Cabinet unavailable · Lite fallback'
  const parameters = playback.parameters()!
  return parameters.engine === 'studio'
    ? `Studio ${parameters.head === 'lead' ? 'Lead' : parameters.head === 'heavy' ? 'Heavy' : 'Definition'} · amp + cabinet`
    : 'Lite amp · tone + cabinet'
}

function sourceItems(
  playback: GuitarRecordingPlayback,
  disabled: boolean,
): OverflowMenuItem[] {
  return [
    {
      key: 'recording-source',
      label: 'Recording',
      checked: playback.source() === 'recording',
      icon: () =>
        playback.source() === 'recording' ? <Check /> : <Headphones />,
      note: 'Your original input audio',
      disabled: disabled || !playback.sourceAvailable('recording'),
      onSelect: () => playback.setSource('recording'),
    },
    {
      key: 'notes-source',
      label: 'Notes',
      checked: playback.source() === 'notes',
      icon: () => (playback.source() === 'notes' ? <Check /> : <MusicNote />),
      note: 'Play your transcribed melody',
      disabled: disabled || !playback.sourceAvailable('notes'),
      onSelect: () => playback.setSource('notes'),
    },
  ]
}

export function GuitarRecordingSourceMenu(props: {
  playback: GuitarRecordingPlayback
  disabled?: boolean
}) {
  return (
    <OverflowMenu
      label="Playback source"
      triggerClass={styles.sourceTrigger}
      panelClass={styles.menu}
      disabled={props.disabled}
      items={sourceItems(props.playback, props.disabled === true)}
      triggerContent={
        <>
          <Show
            when={props.playback.source() === 'recording'}
            fallback={<MusicNote />}
          >
            <Headphones />
          </Show>
          <span>
            {props.playback.source() === 'recording' ? 'Recording' : 'Notes'}
          </span>
        </>
      }
    />
  )
}

export function GuitarRecordingToneMenu(props: {
  playback: GuitarRecordingPlayback
  disabled?: boolean
  includeSource?: boolean
}) {
  const tone = (
    value: GuitarRecordingPlaybackTone,
    label: string,
    note: string,
  ): OverflowMenuItem => ({
    key: value,
    label,
    checked: props.playback.tone() === value,
    separatorBefore: value === 'current-amp' && props.includeSource === true,
    note,
    icon: () => (
      <Show
        when={props.playback.tone() === value}
        fallback={
          value === 'clean' ? (
            <Power />
          ) : (
            <img src={RECORDING_AMP_ART} width="32" height="32" alt="" />
          )
        }
      >
        <Check />
      </Show>
    ),
    disabled:
      props.disabled === true ||
      (value === 'saved-amp' && !props.playback.savedAmpAvailable()),
    onSelect: () => props.playback.setTone(value),
  })
  return (
    <OverflowMenu
      label="Playback tone"
      triggerClass={styles.ampTrigger}
      panelClass={styles.menu}
      triggerTitle={recordingToneDescription(props.playback)}
      disabled={props.disabled}
      items={[
        ...(props.includeSource === true
          ? sourceItems(props.playback, props.disabled === true)
          : []),
        tone(
          'current-amp',
          'Current amp',
          'Follow Session’s amp on/off and tone controls',
        ),
        tone('clean', 'Clean', 'Bypass the app amp'),
        tone(
          'saved-amp',
          'Saved amp',
          props.playback.savedAmpAvailable()
            ? 'Settings saved when Record was pressed'
            : 'No amp settings were saved with this take',
        ),
      ]}
      triggerContent={
        <span
          class={styles.amp}
          data-bypassed={props.playback.parameters()?.enabled !== true}
        >
          <img src={RECORDING_AMP_ART} width="48" height="48" alt="" />
          <span>
            {props.playback.tone() === 'clean'
              ? 'Clean'
              : props.playback.tone() === 'saved-amp'
                ? 'Saved'
                : 'Current'}
          </span>
        </span>
      }
    />
  )
}

export function GuitarRecordingPlaybackControls(props: {
  playback: GuitarRecordingPlayback
  disabled?: boolean
  transport?: boolean
  details?: boolean
}) {
  return (
    <div
      class={styles.playback}
      data-testid="guitar-recording-playback-options"
    >
      <Show when={props.transport}>
        <GuitarRecordingTimeline
          playback={props.playback}
          disabled={props.disabled}
        />
      </Show>
      <div class={styles.choices}>
        <GuitarRecordingSourceMenu
          playback={props.playback}
          disabled={props.disabled}
        />
        <Show when={props.transport}>
          <div class={styles.transport}>
            <button
              type="button"
              aria-busy={props.playback.pending()}
              aria-label={
                props.playback.playing() || props.playback.pending()
                  ? 'Pause take playback'
                  : 'Play take playback'
              }
              disabled={props.disabled === true || !props.playback.available()}
              onClick={() => void props.playback.toggle()}
            >
              <Show
                when={props.playback.playing() || props.playback.pending()}
                fallback={<Play />}
              >
                <Pause />
              </Show>
            </button>
            <button
              type="button"
              aria-label="Stop take playback"
              title="Stop and return to the beginning"
              disabled={props.disabled === true || !props.playback.engaged()}
              onClick={() => props.playback.stop()}
            >
              <Square />
            </button>
          </div>
        </Show>
        <GuitarRecordingToneMenu
          playback={props.playback}
          disabled={props.disabled}
        />
      </div>
      <Show when={props.details}>
        <details class={styles.details}>
          <summary>{recordingToneDescription(props.playback)}</summary>
          <p>
            {props.playback.source() === 'notes'
              ? 'Synthesized from your current note corrections, in their own timing. This does not change or accept a practice score.'
              : 'Your original input audio is preserved. Amp playback processes it without changing the recording.'}{' '}
            {props.playback.tone() === 'saved-amp'
              ? 'Saved amp reapplies the settings from when Record was pressed; later knob changes and monitoring levels were not stored.'
              : props.playback.tone() === 'clean'
                ? 'Bypass removes the app’s processing, not any sound already recorded from external gear.'
                : 'Current amp follows Session’s Amp on/off, drive, tone and cabinet controls.'}
          </p>
        </details>
      </Show>
      <Show when={!props.playback.sourceAvailable('recording')}>
        <p class={styles.explanation}>
          Original audio is unavailable. Any retained notes can still be played.
        </p>
      </Show>
      <Show when={props.playback.error()}>
        {(message) => (
          <p role="alert" class={styles.explanation}>
            {message()}
          </p>
        )}
      </Show>
    </div>
  )
}
