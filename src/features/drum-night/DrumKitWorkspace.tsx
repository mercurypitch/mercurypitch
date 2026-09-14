// Drum kit workspace — intent-loaded sound selection, licensing and MIDI learn controls.

import type { Accessor } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { DrumKitId, DrumKitManifest } from './audio/drum-kit-manifest'
import { DRUM_KIT_CATALOG } from './audio/drum-kit-manifest'
import type { DrumKitPlayerSnapshot } from './audio/drum-kit-player'
import { nextRovingIndex } from './drum-night-roving-index'
import styles from './DrumNightApp.module.css'
import type { DrumMidiRawNoteEvent } from './runtime/drum-input'
import { ESSENTIAL_DRUM_PADS } from './runtime/drum-pad-layout'
import type { DrumNightRuntimeController } from './runtime/useDrumNightRuntime'

interface DrumKitWorkspaceProps {
  readonly snapshot: Accessor<DrumKitPlayerSnapshot>
  readonly selectedKit: Accessor<DrumKitManifest>
  readonly midi: Pick<
    DrumNightRuntimeController,
    | 'midiState'
    | 'midiMapping'
    | 'clearMidiMapping'
    | 'beginMidiLearnForPad'
    | 'cancelMidiLearn'
  >
  readonly unmappedNote: Accessor<DrumMidiRawNoteEvent | null>
  readonly onSelect: (kitId: DrumKitId) => void
  readonly onRetry: () => void
}

function formatMegabytes(bytes: number): string {
  if (bytes === 0) return 'No download'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB encoded`
}

export function DrumKitWorkspace(props: DrumKitWorkspaceProps) {
  const kitStatusCopy = createMemo(() => {
    const snapshot = props.snapshot()
    const manifest = props.selectedKit()
    if (snapshot.status === 'error') {
      if (!snapshot.fallbackReady) {
        return 'Audio start failed · retry from this control'
      }
      const progress =
        snapshot.plannedSamples > 0
          ? `${snapshot.preparedSamples} of ${snapshot.plannedSamples} core samples ready · `
          : ''
      return `${progress}sample warm-up stopped · synth fallback active`
    }
    if (manifest.engine === 'synth') {
      return snapshot.fallbackReady
        ? 'Ready · synthesized locally'
        : 'Selected · activates on your first action'
    }
    if (snapshot.status === 'loading') {
      return `Loading ${snapshot.preparedSamples} of ${snapshot.plannedSamples} core samples · synth fallback active`
    }
    if (snapshot.sampledReady || snapshot.status === 'ready') {
      const coreCopy =
        snapshot.loadedSamples > 0
          ? `${snapshot.loadedSamples} samples ready`
          : 'Sample preparation complete'
      if (snapshot.sampleStatus === 'fallback') {
        return `${coreCopy} · some kit articulations use Mercury Synth because their samples did not pass quality calibration`
      }
      if (snapshot.sampleStatus === 'reduced') {
        return `${coreCopy} · some kit articulations have reduced sample coverage; Mercury Synth covers unavailable sounds`
      }
      return `${coreCopy} · per-hit synth fallback remains available`
    }
    return 'Selected · samples warm after your first audio action'
  })

  const mappedSourcesFor = (gmKey: number): readonly number[] =>
    [...props.midi.midiMapping().entries()]
      .filter((entry) => entry[1] === gmKey)
      .map((entry) => entry[0])
      .sort((left, right) => left - right)

  return (
    <div
      class={`${styles.workspaceView} ${styles.kitWorkspace}`}
      id="drum-workbench-panel-kit"
      role="tabpanel"
      aria-labelledby="drum-workbench-tab-kit"
    >
      <div class={styles.workspaceCopy}>
        <span>Sound and mapping</span>
        <h3>{props.selectedKit().name}</h3>
        <p>
          {props.selectedKit().character}. Each sampled flavor loads only after
          an audio action and falls back per strike.
        </p>
        <div
          class={styles.kitLoadStatus}
          data-status={props.snapshot().status}
          role="status"
        >
          <strong>{kitStatusCopy()}</strong>
          <small>
            {formatMegabytes(props.selectedKit().publishedEncodedBytes)}
          </small>
          <Show when={props.snapshot().error !== null}>
            <button type="button" onClick={() => props.onRetry()}>
              Retry {props.selectedKit().name}
            </button>
          </Show>
        </div>
      </div>
      <div class={styles.kitCatalog} role="radiogroup" aria-label="Drum sound">
        <For each={DRUM_KIT_CATALOG}>
          {(kit, index) => (
            <button
              class={
                props.snapshot().selectedKitId === kit.id
                  ? styles.isSelected
                  : undefined
              }
              type="button"
              role="radio"
              aria-checked={props.snapshot().selectedKitId === kit.id}
              tabindex={props.snapshot().selectedKitId === kit.id ? 0 : -1}
              onClick={() => props.onSelect(kit.id)}
              onKeyDown={(event) => {
                const nextIndex = nextRovingIndex(
                  event.key,
                  index(),
                  DRUM_KIT_CATALOG.length,
                )
                if (nextIndex === null) return
                event.preventDefault()
                const nextKit = DRUM_KIT_CATALOG[nextIndex]
                props.onSelect(nextKit.id)
                const radios =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="radio"]',
                  )
                radios?.[nextIndex]?.focus()
              }}
            >
              <span>
                <strong>{kit.name}</strong>
                <small>{kit.character}</small>
                <Show when={props.snapshot().selectedKitId === kit.id}>
                  <em class={styles.selectionMark} aria-hidden="true">
                    Selected
                  </em>
                </Show>
              </span>
              <b>
                {kit.engine === 'synth'
                  ? 'Instant'
                  : formatMegabytes(kit.publishedEncodedBytes)}
              </b>
            </button>
          )}
        </For>
        <Show when={props.selectedKit().license.noticePath !== null}>
          <p class={styles.kitAttribution}>
            {props.selectedKit().license.attribution}{' '}
            <a
              href={props.selectedKit().license.url}
              target="_blank"
              rel="noreferrer"
            >
              {props.selectedKit().license.spdx}
            </a>
            {' · '}
            <a
              href={`/drum-night/kits/${props.selectedKit().license.noticePath}`}
              target="_blank"
              rel="noreferrer"
            >
              Credits and sample licence
            </a>
          </p>
        </Show>
      </div>
      <div class={styles.mappingPanel}>
        <div class={styles.mappingHeading}>
          <span>
            <strong>E-kit learn map</strong>
            <small>
              {props.midi.midiState().status === 'connected'
                ? props.midi.midiState().selectedInputName
                : 'Connect MIDI to learn by strike'}
            </small>
          </span>
          <button
            type="button"
            disabled={props.midi.midiMapping().size === 0}
            onClick={() => props.midi.clearMidiMapping()}
          >
            Clear learned
          </button>
        </div>
        <div class={styles.mappingList}>
          <For each={ESSENTIAL_DRUM_PADS}>
            {(pad) => {
              const sources = () => mappedSourcesFor(pad.gmKey)
              const learning = () =>
                props.midi.midiState().learningTargetGmKey === pad.gmKey
              return (
                <div>
                  <span>{pad.gmKey}</span>
                  <strong>{pad.label}</strong>
                  <small>
                    {sources().length === 0
                      ? 'GM default'
                      : `Raw ${sources().join(', ')}`}
                  </small>
                  <button
                    type="button"
                    class={learning() ? styles.isLearning : undefined}
                    disabled={props.midi.midiState().status !== 'connected'}
                    onClick={() => {
                      if (learning()) props.midi.cancelMidiLearn()
                      else props.midi.beginMidiLearnForPad(pad.id)
                    }}
                  >
                    {learning() ? 'Strike now · cancel' : 'Learn'}
                  </button>
                  <Show when={sources().length > 0}>
                    <button
                      type="button"
                      aria-label={`Reset learned sources for ${pad.label}`}
                      disabled={props.midi.midiState().status !== 'connected'}
                      onClick={() => {
                        for (const sourceKey of sources()) {
                          props.midi.clearMidiMapping(sourceKey)
                        }
                      }}
                    >
                      Reset
                    </button>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
        <Show when={props.unmappedNote()}>
          {(unmapped) => (
            <p class={styles.rawMidiNotice}>
              Raw note {unmapped().rawMidiKey} on channel{' '}
              {unmapped().midiChannel + 1} is not mapped yet. Choose Learn
              beside its intended drum, then strike it again.
            </p>
          )}
        </Show>
      </div>
    </div>
  )
}
