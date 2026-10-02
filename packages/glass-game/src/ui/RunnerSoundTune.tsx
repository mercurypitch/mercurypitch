// Runner sound and tune panel — saved backing/example levels with native modal focus and access to existing note setup.
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack, } from 'solid-js'
import type { GlassMicrophoneInput } from '../host'
import { runnerMidiName } from '../runner/notation'
import type { RunnerAudioPreferences, RunnerBackingAvailability, } from '../runner/session-contracts'
import { trapDialogKeys } from './dialog-focus'
import type { MicrophoneIssue } from './mic-error'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'
import styles from './RunnerSoundTune.module.css'
import setupStyles from './SongRunnerView.module.css'

interface RunnerSetupProps {
  microphoneInput?: GlassMicrophoneInput
  microphoneIssue?: MicrophoneIssue
  comfortableMidi: number
  minimumMidi: number
  maximumMidi: number
  onComfortableMidiChange(midi: number): void
  onHearReference(): void
}

/** Existing closed-capture setup keeps its note commit and microphone behavior. */
export function RunnerSetup(props: RunnerSetupProps) {
  const [draftMidi, setDraftMidi] = createSignal(
    untrack(() => props.comfortableMidi),
  )
  createEffect(() => setDraftMidi(props.comfortableMidi))
  const label = createMemo(() => runnerMidiName(draftMidi()).text)

  return (
    <div class={setupStyles.setup}>
      <div class={setupStyles.noteChoice}>
        <div class={setupStyles.setupLabel}>
          <span>Comfortable note</span>
          <strong>{label()}</strong>
        </div>
        <input
          class={setupStyles.noteRange}
          type="range"
          min={props.minimumMidi}
          max={props.maximumMidi}
          step="1"
          value={draftMidi()}
          aria-label="Comfortable note"
          aria-valuetext={label()}
          onInput={(event) => setDraftMidi(Number(event.currentTarget.value))}
          onChange={(event) => {
            const midi = Number(event.currentTarget.value)
            setDraftMidi(midi)
            props.onComfortableMidiChange(midi)
          }}
        />
        <div class={setupStyles.rangeLabels} aria-hidden="true">
          <span>{runnerMidiName(props.minimumMidi).text}</span>
          <span>{runnerMidiName(props.maximumMidi).text}</span>
        </div>
        <button
          type="button"
          class={setupStyles.secondaryButton}
          onClick={() => props.onHearReference()}
        >
          Hear note
        </button>
      </div>
      <Show when={props.microphoneInput !== undefined}>
        <MicrophoneInputRecovery
          microphoneInput={props.microphoneInput}
          issue={props.microphoneIssue}
        />
      </Show>
    </div>
  )
}

interface RunnerSoundTuneProps {
  openRequest: number
  canChangeNote: boolean
  restoreFocus(): boolean
  preferences: RunnerAudioPreferences
  backing: RunnerBackingAvailability | null
  comfortableMidi: number
  onPreferencesChange(patch: Partial<RunnerAudioPreferences>): void
  onOpen(): void
  onSetup(): void
}

const percentage = (volume: number): number => Math.round(volume * 100)

export function RunnerSoundTune(props: RunnerSoundTuneProps) {
  const [open, setOpen] = createSignal(false)
  let dialog!: HTMLDialogElement
  let trigger!: HTMLButtonElement
  let setupAfterClose = false
  let lastRequest = 0

  createEffect(() => {
    const request = props.openRequest
    if (request > lastRequest) {
      lastRequest = request
      setOpen(true)
    }
  })

  createEffect(() => {
    if (open() && !dialog.open) dialog.showModal()
    else if (!open() && dialog.open) dialog.close()
  })
  onCleanup(() => {
    if (dialog.open) dialog.close()
  })

  function closed(): void {
    if (dialog.open || !trigger.isConnected) return
    setOpen(false)
    if (setupAfterClose) {
      setupAfterClose = false
      props.onSetup()
    } else if (!props.restoreFocus()) trigger.focus({ preventScroll: true })
  }

  return (
    <div class={styles.control}>
      <button
        ref={trigger}
        type="button"
        class={styles.trigger}
        classList={{ [styles.muted]: props.preferences.musicMuted }}
        aria-label="Sound / tune"
        aria-haspopup="dialog"
        aria-expanded={open()}
        title="Sound / tune"
        onClick={() => {
          props.onOpen()
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M10 14v6" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        class={styles.panel}
        aria-labelledby="runner-sound-title"
        aria-describedby="runner-sound-description"
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClose={closed}
        onKeyDown={(event) => {
          event.stopPropagation()
          trapDialogKeys(event)
        }}
      >
        <div class={styles.titlebar}>
          <h2 id="runner-sound-title">Sound / tune</h2>
          <button
            type="button"
            class={styles.close}
            aria-label="Close sound settings"
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p id="runner-sound-description" class={styles.description}>
          Music steps out while you sing. Note examples and the count-in have
          their own level.
        </p>
        <label class={styles.volume}>
          <span>
            Music <output>{percentage(props.preferences.musicVolume)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentage(props.preferences.musicVolume)}
            aria-label="Music volume"
            aria-valuetext={`${percentage(props.preferences.musicVolume)} percent${props.preferences.musicMuted ? ', muted' : ''}`}
            onInput={(event) =>
              props.onPreferencesChange({
                musicVolume: Number(event.currentTarget.value) / 100,
              })
            }
          />
        </label>
        <label class={styles.volume}>
          <span>
            Note examples{' '}
            <output>{percentage(props.preferences.guideVolume)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentage(props.preferences.guideVolume)}
            aria-label="Note example volume"
            aria-valuetext={`${percentage(props.preferences.guideVolume)} percent`}
            onInput={(event) =>
              props.onPreferencesChange({
                guideVolume: Number(event.currentTarget.value) / 100,
              })
            }
          />
        </label>
        <button
          type="button"
          class={styles.action}
          aria-pressed={props.preferences.musicMuted}
          onClick={() =>
            props.onPreferencesChange({
              musicMuted: !props.preferences.musicMuted,
            })
          }
        >
          {props.preferences.musicMuted ? 'Turn music on' : 'Mute music'}
        </button>
        <Show when={props.backing !== null && !props.backing.music}>
          <p class={styles.availability} role="status">
            The backing music couldn't load. Note examples and the count-in
            still work.
          </p>
        </Show>
        <Show when={props.backing?.music === true && !props.backing.ambience}>
          <p class={styles.availability} role="status">
            Music is ready. The extra ambience couldn't load.
          </p>
        </Show>
        <div class={styles.tune}>
          <span>
            Comfortable note{' '}
            <strong>{runnerMidiName(props.comfortableMidi).text}</strong>
          </span>
          <Show when={props.canChangeNote}>
            <button
              type="button"
              class={styles.action}
              onClick={() => {
                setupAfterClose = true
                setOpen(false)
              }}
            >
              Change note
            </button>
          </Show>
        </div>
        <p class={styles.description}>Your mix is saved for the next run.</p>
      </dialog>
    </div>
  )
}
