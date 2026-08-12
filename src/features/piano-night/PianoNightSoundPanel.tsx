// ============================================================
// Piano Night Sound panel — expressive instrument choice and preparation state
// ============================================================
//
// The room shell owns navigation; this panel owns the sampled-piano product
// truth so loading, fallback, controls, and attribution stay one reusable unit.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './PianoNightApp.module.css'
import type { PianoNightController } from './usePianoNightController'

const SOUND_CHARACTERS = [
  { id: 'soft', label: 'Soft', detail: 'Rounder attack' },
  { id: 'balanced', label: 'Balanced', detail: 'Natural response' },
  { id: 'bright', label: 'Bright', detail: 'Clearer presence' },
] as const

const SOUND_AMBIENCES = [
  { id: 'close', label: 'Close', detail: 'Dry and immediate' },
  { id: 'studio', label: 'Studio', detail: 'Focused room' },
  { id: 'hall', label: 'Hall', detail: 'Longer bloom' },
] as const

interface PianoNightSoundPanelProps {
  controller: PianoNightController
}

export function PianoNightSoundPanel(
  props: PianoNightSoundPanelProps,
): JSX.Element {
  const concertGrandSelected = (): boolean =>
    props.controller.instrumentPreference() !== 'fallback'

  const soundStatusLabel = (): string => {
    if (props.controller.soundLoadStatus() === 'loading') {
      const prepared = props.controller.soundLoadedSamples()
      const planned = props.controller.soundTotalSamples()
      return planned > 0
        ? `Loading concert grand · ${prepared} of ${planned}`
        : 'Loading concert grand'
    }
    if (props.controller.soundLoadStatus() === 'error') {
      return 'Fallback active · concert grand unavailable'
    }
    if (props.controller.soundLoadStatus() === 'ready') {
      return concertGrandSelected()
        ? 'Concert grand ready'
        : 'Concert grand ready · fallback selected'
    }
    return props.controller.audioActive()
      ? 'Fallback active · concert grand not loaded'
      : 'Silent until gesture'
  }

  const soundErrorMessage = (message: string): string =>
    /\bfallback\b/i.test(message)
      ? message
      : `${message} The fallback remains available.`

  return (
    <section
      id="piano-night-panel-sound"
      class={styles.drawerPanel}
      role="tabpanel"
      aria-labelledby="piano-night-tab-sound"
    >
      <span class={styles.drawerKicker}>Expressive piano</span>
      <h2>Mercury Concert Grand</h2>
      <p>
        A four-layer sampled grand loads only when you ask for it. Until its
        current zones are ready, every note remains playable through the
        lightweight Mercury Felt Synth.
      </p>
      <div class={styles.soundStatus} data-testid="piano-night-sound-status">
        <span>Current output</span>
        <strong>{soundStatusLabel()}</strong>
      </div>

      <div class={styles.soundChoiceList} aria-label="Piano instrument">
        <button
          class={styles.soundChoice}
          classList={{
            [styles.soundChoiceActive]: concertGrandSelected(),
          }}
          type="button"
          aria-pressed={concertGrandSelected()}
          onClick={() => props.controller.setInstrumentPreference('auto')}
        >
          <span>
            <strong>Mercury Concert Grand</strong>
            <small>Salamander Grand Piano · four velocity layers</small>
          </span>
          <i>
            {props.controller.soundLoadStatus() === 'ready'
              ? 'Window ready'
              : 'Loads by phrase'}
          </i>
        </button>
        <button
          class={styles.soundChoice}
          classList={{
            [styles.soundChoiceActive]: !concertGrandSelected(),
          }}
          type="button"
          aria-pressed={!concertGrandSelected()}
          onClick={() => props.controller.setInstrumentPreference('fallback')}
        >
          <span>
            <strong>Mercury Felt Synth</strong>
            <small>Instant, offline-safe 32-voice fallback</small>
          </span>
          <i>Built in</i>
        </button>
      </div>

      <Show
        when={props.controller.soundLoadStatus() !== 'ready'}
        fallback={
          <p class={styles.soundReadyNote}>
            The current performance window is ready. Later zones prepare as the
            playhead advances.
          </p>
        }
      >
        <button
          class={`${styles.actionButton} ${styles.soundLoadButton}`}
          type="button"
          onClick={() => void props.controller.loadSampledInstrument()}
          disabled={props.controller.soundLoadStatus() === 'loading'}
          data-testid="piano-night-load-sampled"
        >
          {props.controller.soundLoadStatus() === 'loading'
            ? 'Loading concert grand…'
            : props.controller.soundLoadStatus() === 'error'
              ? 'Retry concert grand'
              : 'Load concert grand'}
        </button>
      </Show>

      <Show when={props.controller.soundLoadError()}>
        {(message) => (
          <p class={styles.runtimeError} role="alert">
            {soundErrorMessage(message())}
          </p>
        )}
      </Show>

      <fieldset class={styles.soundControlGroup}>
        <legend>Character</legend>
        <div>
          <For each={SOUND_CHARACTERS}>
            {(option) => (
              <button
                type="button"
                aria-pressed={props.controller.soundCharacter() === option.id}
                classList={{
                  [styles.soundControlActive]:
                    props.controller.soundCharacter() === option.id,
                }}
                onClick={() => props.controller.setSoundCharacter(option.id)}
                title={option.detail}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </fieldset>

      <fieldset class={styles.soundControlGroup}>
        <legend>Space</legend>
        <div>
          <For each={SOUND_AMBIENCES}>
            {(option) => (
              <button
                type="button"
                aria-pressed={props.controller.soundAmbience() === option.id}
                classList={{
                  [styles.soundControlActive]:
                    props.controller.soundAmbience() === option.id,
                }}
                onClick={() => props.controller.setSoundAmbience(option.id)}
                title={option.detail}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </fieldset>

      <p class={styles.soundAttribution}>
        Samples from{' '}
        <a
          href="https://github.com/sfzinstruments/SalamanderGrandPiano"
          target="_blank"
          rel="noreferrer"
        >
          Salamander Grand Piano V3 by Alexander Holm
        </a>
        , using the{' '}
        <a
          href="https://github.com/darosh/samples-piano-mp3"
          target="_blank"
          rel="noreferrer"
        >
          MP3 adaptation distributed by Jan Forst
        </a>
        . MercuryPitch selects and maps a compact layer set under{' '}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 3.0
        </a>
        .
      </p>

      <div class={styles.futureSoundbank}>
        <span>
          <strong>Load your soundbank</strong>
          <small>
            Local Mercury Bank import is planned for a later sound update.
          </small>
        </span>
        <i>Planned</i>
      </div>
    </section>
  )
}
