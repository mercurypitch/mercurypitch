// Runner settings — existing mix, camera and setup controls within the shared game dialog.
import { createEffect, createMemo, createSignal, For, Show, untrack, } from 'solid-js'
import { SHATTER_PLAYBACK_SPEED } from '../core/shatter-presentation'
import type { GlassMicrophoneInput } from '../host'
import { runnerMidiName } from '../runner/notation'
import type { RunnerAudioPreferences, RunnerBackingAvailability, RunnerReferencePlayback, } from '../runner/session-contracts'
import type { DevelopmentRenderControls } from './DevelopmentRenderTuning'
import { GameAppearanceControls, GameIcon, GameMaterialControls, GameSettingsDialog, GameSurface, } from './GameUI'
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
  referencePlayback: RunnerReferencePlayback
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
  const hearingNote = createMemo(() => props.referencePlayback.phase !== 'idle')
  const referenceStatus = createMemo(() => {
    if (props.referencePlayback.error !== null)
      return props.referencePlayback.error
    if (props.referencePlayback.phase === 'preparing') return 'Preparing note'
    if (props.referencePlayback.phase === 'playing') return 'Playing note'
    return ''
  })

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
          aria-disabled={hearingNote()}
          aria-busy={hearingNote()}
          onClick={() => {
            if (!hearingNote()) props.onHearReference()
          }}
        >
          Hear note
        </button>
        <p class={setupStyles.referenceStatus} role="status" aria-live="polite">
          {referenceStatus()}
        </p>
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

export type RunnerCameraChoice =
  | 'responsive-close'
  | 'steering-close'
  | 'steering-angled'
export interface RunnerCameraControls {
  readonly disabled?: boolean
  readonly profile: RunnerCameraChoice
  readonly onChange: (profile: RunnerCameraChoice) => void
}

const CAMERA_VIEWS = [
  { profile: 'responsive-close', label: 'Standard' },
  { profile: 'steering-close', label: 'Closer' },
  { profile: 'steering-angled', label: 'Angled' },
] as const

interface RunnerSoundTuneProps {
  developmentControls?: DevelopmentRenderControls
  cameraControls?: RunnerCameraControls
  microphoneInput?: GlassMicrophoneInput
  microphoneIssue?: MicrophoneIssue
  open: boolean
  canChangeNote: boolean
  continuous: boolean
  exitLabel: string
  preferences: RunnerAudioPreferences
  backing: RunnerBackingAvailability | null
  comfortableMidi: number
  onPreferencesChange(patch: Partial<RunnerAudioPreferences>): void
  onOpen(): void
  onClose(): void
  onClosed(): void
  onExit(): void
  onSetup(): void
}

const percentage = (volume: number): number => Math.round(volume * 100)

export function RunnerSoundTune(props: RunnerSoundTuneProps) {
  const sound = () => (
    <div class={styles.section}>
      <p class={styles.description}>
        Music steps out while you sing. Note examples and the count-in have
        their own level.
      </p>
      <For
        each={
          [
            { key: 'musicVolume', label: 'Music', name: 'Music volume' },
            {
              key: 'guideVolume',
              label: 'Note examples',
              name: 'Note example volume',
            },
            {
              key: 'effectsVolume',
              label: 'Glass breaks',
              name: 'Glass break volume',
            },
          ] as const
        }
      >
        {(mix) => (
          <label class={styles.volume}>
            <span>
              {mix.label}
              <output>{percentage(props.preferences[mix.key])}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={percentage(props.preferences[mix.key])}
              aria-label={mix.name}
              aria-valuetext={`${percentage(props.preferences[mix.key])} percent${mix.key === 'musicVolume' && props.preferences.musicMuted ? ', muted' : ''}`}
              onInput={(event) =>
                props.onPreferencesChange({
                  [mix.key]: Number(event.currentTarget.value) / 100,
                })
              }
            />
          </label>
        )}
      </For>
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
          The backing music couldn't load. Note examples and the count-in still
          work.
        </p>
      </Show>
      <Show when={props.backing?.music === true && !props.backing.ambience}>
        <p class={styles.availability} role="status">
          Music is ready. The extra ambience couldn't load.
        </p>
      </Show>
      <Show when={props.microphoneIssue}>
        {(issue) => (
          <p class={styles.availability} role="status">
            {issue().message}
          </p>
        )}
      </Show>
      <MicrophoneInputRecovery
        microphoneInput={props.microphoneInput}
        issue={props.microphoneIssue}
      />
      <p class={styles.description}>Your mix is saved for the next run.</p>
    </div>
  )
  const play = () => (
    <div class={styles.section}>
      <Show when={props.cameraControls}>
        {(controls) => (
          <fieldset class={styles.choices}>
            <legend>Camera view</legend>
            <div>
              <For each={CAMERA_VIEWS}>
                {(view) => (
                  <button
                    type="button"
                    class={styles.action}
                    disabled={controls().disabled}
                    aria-pressed={controls().profile === view.profile}
                    onClick={() => controls().onChange(view.profile)}
                  >
                    {view.label}
                  </button>
                )}
              </For>
            </div>
          </fieldset>
        )}
      </Show>
      <div class={styles.tune}>
        <span>
          Comfortable note{' '}
          <strong>{runnerMidiName(props.comfortableMidi).text}</strong>
        </span>
        <Show when={props.canChangeNote}>
          <button type="button" class={styles.action} onClick={props.onSetup}>
            <GameIcon name="tuning" />
            Change note
          </button>
        </Show>
      </div>
      <details class={styles.help}>
        <summary>How to play</summary>
        <p>
          Match the note to begin. Sing through each glass wall, then steer and
          jump through the course.
        </p>
        <p>
          {props.continuous
            ? 'Hold left or right to steer. Use the arrow keys or A and D on a keyboard. Press Space to jump.'
            : 'Tap left or right to change lanes. Use the arrow keys or A and D on a keyboard. Press Space to jump.'}
        </p>
      </details>
    </div>
  )
  const display = () => (
    <div class={styles.section}>
      <GameAppearanceControls />
      <Show when={props.developmentControls}>
        {(controls) => (
          <fieldset class={styles.choices}>
            <legend>Graphics quality</legend>
            <p class={styles.description}>
              Current output: {controls().renderQualityProfile}
            </p>
            <div>
              <For
                each={
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'high', label: 'High' },
                    { id: 'balanced', label: 'Balanced' },
                  ] as const
                }
              >
                {(quality) => (
                  <button
                    type="button"
                    class={styles.action}
                    aria-pressed={
                      controls().renderQualityPreference === quality.id
                    }
                    onClick={() => controls().onRenderQualityChange(quality.id)}
                  >
                    {quality.label}
                  </button>
                )}
              </For>
            </div>
            <p class={styles.description}>
              Balanced reduces detail. High keeps it sharp. Auto chooses for
              this device. Texture detail updates the next time you open the
              game.
            </p>
          </fieldset>
        )}
      </Show>
    </div>
  )
  const advanced = () => (
    <Show when={props.developmentControls}>
      {(controls) => (
        <div class={styles.section}>
          <label class={styles.volume}>
            <span>
              Shatter speed{' '}
              <output>{controls().shatterPlaybackSpeed.toFixed(2)}×</output>
            </span>
            <input
              type="range"
              aria-label="Shatter speed"
              aria-valuetext={`${controls().shatterPlaybackSpeed.toFixed(2)} times normal speed`}
              min={SHATTER_PLAYBACK_SPEED.minimum}
              max={SHATTER_PLAYBACK_SPEED.maximum}
              step="0.05"
              value={controls().shatterPlaybackSpeed}
              onInput={(event) =>
                controls().onShatterPlaybackSpeedChange(
                  event.currentTarget.valueAsNumber,
                )
              }
            />
          </label>
          <p class={styles.description}>
            Lower is slower. Applies to the next break. Singing, movement and
            sound keep their timing.
          </p>
          <button
            type="button"
            class={styles.action}
            onClick={() => {
              controls().onRenderQualityChange('auto')
              controls().onShatterPlaybackSpeedChange(
                SHATTER_PLAYBACK_SPEED.default,
              )
            }}
          >
            Reset graphics and glass
          </button>
          <GameMaterialControls />
        </div>
      )}
    </Show>
  )
  return (
    <div class={styles.control}>
      <button
        type="button"
        class={styles.trigger}
        aria-label="Open settings"
        aria-haspopup="dialog"
        aria-expanded={props.open}
        title="Settings"
        onClick={() => props.onOpen()}
      >
        <GameSurface kind="tile" class={styles.triggerSurface}>
          <GameIcon name="settings" />
        </GameSurface>
      </button>
      <GameSettingsDialog
        open={props.open}
        onClose={props.onClose}
        onClosed={props.onClosed}
        onExit={props.onExit}
        exitLabel={props.exitLabel}
        sections={[
          { id: 'sound', label: 'Sound', content: sound },
          { id: 'play', label: 'Play', content: play },
          { id: 'display', label: 'Display', content: display },
          ...(props.developmentControls
            ? [{ id: 'advanced', label: 'Advanced', content: advanced }]
            : []),
        ]}
      />
    </div>
  )
}
