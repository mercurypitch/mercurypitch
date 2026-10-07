// Adventure settings adapter — shared chrome around existing gallery preferences and session actions.
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import type { GlassGameHost } from '../host'
import settingsStyles from './AdventureSettings.module.css'
import { hasDevelopmentTuning } from './development-tuning'
import { DevelopmentReferenceTuning } from './DevelopmentReferenceTuning'
import { DevelopmentRenderTuning } from './DevelopmentRenderTuning'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import { GameAppearanceControls, GameMaterialControls, GameSettingsDialog, GameSurface, } from './GameUI'
import styles from './GlassAdventure.module.css'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'
import type { useAdventure } from './useAdventure'

export function AdventureSettings(props: {
  host: GlassGameHost
  adventure: ReturnType<typeof useAdventure>
  onPreviewCamera(): void
  onClosed(): void
}) {
  const adventure = untrack(() => props.adventure)
  const [dismissedAfterInterruption, setDismissedAfterInterruption] =
    createSignal(false)
  let pauseDialog!: HTMLDialogElement
  const pausedSurface = () =>
    adventure.paused() &&
    !adventure.tutorial() &&
    adventure.inspection() === null
  createEffect(() => {
    if (!adventure.paused()) setDismissedAfterInterruption(false)
  })
  createEffect(() => {
    if (pausedSurface() && dismissedAfterInterruption()) {
      if (!pauseDialog.open) {
        pauseDialog.showModal()
        focusDialog(pauseDialog)
      }
    } else if (pauseDialog.open) pauseDialog.close()
  })
  onCleanup(() => {
    if (pauseDialog.open) pauseDialog.close()
  })
  const closeSettings = () => {
    if (adventure.pauseInterrupted()) setDismissedAfterInterruption(true)
    else adventure.resume()
  }
  const settingsClosed = () => {
    if (dismissedAfterInterruption()) focusDialog(pauseDialog)
    else props.onClosed()
  }
  const sound = () => (
    <>
      <p>The microphone is off.</p>{' '}
      <Show
        when={adventure.audioPreferences() || adventure.narrationPreferences()}
      >
        <fieldset class={styles.audioSettings}>
          <legend>Museum sound</legend>
          <Show when={adventure.audioPreferences()}>
            {(preferences) => (
              <>
                <label class={styles.audioMute}>
                  <input
                    type="checkbox"
                    checked={preferences().muted}
                    onChange={(event) =>
                      adventure.changeAudio({
                        muted: event.currentTarget.checked,
                      })
                    }
                  />
                  Mute music and ambience
                </label>
                <label class={styles.audioVolume} for="glass-music-volume">
                  <span>
                    Music{' '}
                    <output for="glass-music-volume">
                      {Math.round(preferences().musicVolume * 100)}%
                    </output>
                  </span>
                  <input
                    id="glass-music-volume"
                    aria-label="Music volume"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(preferences().musicVolume * 100)}
                    onInput={(event) =>
                      adventure.changeAudio({
                        musicVolume: event.currentTarget.valueAsNumber / 100,
                      })
                    }
                  />
                </label>
                <label class={styles.audioVolume} for="glass-ambience-volume">
                  <span>
                    Ambience{' '}
                    <output for="glass-ambience-volume">
                      {Math.round(preferences().ambienceVolume * 100)}%
                    </output>
                  </span>
                  <input
                    id="glass-ambience-volume"
                    aria-label="Ambience volume"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(preferences().ambienceVolume * 100)}
                    onInput={(event) =>
                      adventure.changeAudio({
                        ambienceVolume: event.currentTarget.valueAsNumber / 100,
                      })
                    }
                  />
                </label>
              </>
            )}
          </Show>
          <Show when={adventure.narrationPreferences()}>
            {(preferences) => (
              <label class={styles.audioMute}>
                <input
                  type="checkbox"
                  checked={preferences().enabled}
                  onChange={(event) =>
                    adventure.changeNarration(event.currentTarget.checked)
                  }
                />
                Merc voice
              </label>
            )}
          </Show>
          <Show when={adventure.audioPreferences()}>
            <small>Music and ambience fade out while you sing.</small>
          </Show>
        </fieldset>
      </Show>
    </>
  )
  const play = () => (
    <>
      {' '}
      <Show when={adventure.automaticSingingAvailable}>
        <fieldset class={styles.audioSettings}>
          <legend>Singing</legend>
          <label class={styles.audioMute}>
            <input
              type="checkbox"
              checked={adventure.automaticSingingEnabled()}
              onChange={(event) =>
                adventure.changeAutomaticSinging(event.currentTarget.checked)
              }
            />
            Automatic singing
          </label>
          <small>
            Start when Merc enters a glowing circle. Turn this off to choose
            Sing yourself.
          </small>
        </fieldset>
      </Show>
      <MicrophoneInputRecovery microphoneInput={props.host.microphoneInput} />
      <button
        class={styles.textButton}
        type="button"
        onClick={adventure.showTutorial}
      >
        How to play
      </button>
    </>
  )
  const display = () => (
    <>
      <GameAppearanceControls />{' '}
      <fieldset class={styles.cameraModeSettings}>
        <legend>Camera view</legend>
        <div class={styles.cameraModeOptions}>
          <label
            classList={{
              [styles.cameraModeSelected]:
                adventure.cameraMode() === 'third-person',
            }}
          >
            <input
              type="radio"
              name="glass-camera-mode"
              value="third-person"
              checked={adventure.cameraMode() === 'third-person'}
              onChange={() => adventure.changeCameraMode('third-person')}
            />
            <span>Third person</span>
          </label>
          <label
            classList={{
              [styles.cameraModeSelected]:
                adventure.cameraMode() === 'first-person',
            }}
          >
            <input
              type="radio"
              name="glass-camera-mode"
              value="first-person"
              checked={adventure.cameraMode() === 'first-person'}
              onChange={() => adventure.changeCameraMode('first-person')}
            />
            <span>First person</span>
          </label>
        </div>
        <small>Press V during play to switch views.</small>
      </fieldset>
    </>
  )
  const advanced = () => (
    <>
      <DevelopmentReferenceTuning
        referenceNoteHoldSeconds={adventure.referenceNoteHoldSeconds()}
        onReferenceNoteHoldChange={adventure.changeReferenceNoteHold}
      />
      <DevelopmentRenderTuning
        renderQualityPreference={adventure.renderQualityPreference()}
        renderQualityProfile={adventure.renderQualityProfile()}
        onRenderQualityChange={adventure.changeRenderQuality}
        shatterPlaybackSpeed={adventure.shatterPlaybackSpeed()}
        onShatterPlaybackSpeedChange={adventure.changeShatterPlaybackSpeed}
      />
      <button
        class={styles.textButton}
        type="button"
        onClick={() => {
          if (adventure.pauseInterrupted()) setDismissedAfterInterruption(true)
          else props.onPreviewCamera()
        }}
      >
        Preview camera
      </button>
      <GameMaterialControls />
    </>
  )
  return (
    <>
      <GameSettingsDialog
        open={pausedSurface() && !dismissedAfterInterruption()}
        onClose={closeSettings}
        onClosed={settingsClosed}
        onExit={() => props.host.onExit()}
        exitLabel="Museum"
        sections={[
          { id: 'sound', label: 'Sound', content: sound },
          { id: 'play', label: 'Play', content: play },
          { id: 'display', label: 'Display', content: display },
          ...(hasDevelopmentTuning(props.host)
            ? [{ id: 'advanced', label: 'Advanced', content: advanced }]
            : []),
        ]}
      />
      <dialog
        ref={pauseDialog}
        class={settingsStyles.pausedDialog}
        aria-labelledby="interrupted-museum-title"
        onCancel={(event) => {
          event.preventDefault()
          adventure.resume()
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          trapDialogKeys(event)
        }}
      >
        <GameSurface>
          <h2 id="interrupted-museum-title">Museum paused</h2>
          <p>The microphone is off. Resume when you’re ready.</p>
          <div class={settingsStyles.actions}>
            <button type="button" onClick={adventure.resume}>
              Resume
            </button>
            <button
              type="button"
              onClick={() => setDismissedAfterInterruption(false)}
            >
              Settings
            </button>
          </div>
        </GameSurface>
      </dialog>
    </>
  )
}
