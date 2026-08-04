// ============================================================
// Voice Atlas Inspector — shared content for desktop rail and mobile sheet
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { X } from '@/components/icons'
import type { VoiceReflectionKind } from './voice-reflections'
import { MAX_VOICE_REFLECTION_NOTE_LENGTH, voiceReflectionLabel, } from './voice-reflections'
import styles from './VoiceAtlasPanel.module.css'

interface SelectedReflectionSummary {
  kind: VoiceReflectionKind
  note: string
  seconds: number
}

interface VoiceAtlasInspectorProps {
  mode: 'reflection' | 'room'
  selectedTakeLabel: string | null
  selectedSeconds: number
  note: string
  noteInputId: string
  selectedReflection: SelectedReflectionSummary | null
  roomPanel: JSX.Element
  onClose: () => void
  onNote: (note: string) => void
  onAddReflection: (kind: VoiceReflectionKind) => void
  onRemoveSelectedReflection: () => void
}

function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (safeSeconds > 0 && safeSeconds < 10) return `${safeSeconds.toFixed(1)}s`
  const rounded = Math.round(safeSeconds)
  const minutes = Math.floor(rounded / 60)
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`
}

export function VoiceAtlasInspector(
  props: VoiceAtlasInspectorProps,
): JSX.Element {
  return (
    <>
      <div class={styles.inspectorHeading}>
        <div>
          <span>
            {props.mode === 'reflection'
              ? 'Reflection beacons'
              : 'Listening room'}
          </span>
          <strong>
            {props.mode === 'reflection'
              ? 'Mark this exact moment.'
              : 'Place every replay in the same space.'}
          </strong>
        </div>
        <button
          type="button"
          aria-label="Close listening tools"
          onClick={() => props.onClose()}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <Show when={props.mode === 'reflection'}>
        <div class={styles.reflections}>
          <div class={styles.reflectionIntro}>
            <Show
              when={props.selectedTakeLabel}
              keyed
              fallback={<p>Select a take before placing a beacon.</p>}
            >
              {(takeLabel) => (
                <div
                  class={styles.reflectionTarget}
                  data-testid="reflection-target"
                  aria-live="polite"
                >
                  <span>Saving to</span>
                  <strong>{takeLabel}</strong>
                  <time>{formatClock(props.selectedSeconds)}</time>
                  <p>
                    Move the playhead to place this at another exact moment.
                  </p>
                </div>
              )}
            </Show>
          </div>

          <div class={styles.reflectionComposer}>
            <label for={props.noteInputId}>Optional note</label>
            <div class={styles.noteField}>
              <input
                id={props.noteInputId}
                value={props.note}
                maxlength={MAX_VOICE_REFLECTION_NOTE_LENGTH}
                placeholder="What did you hear here?"
                disabled={props.selectedTakeLabel === null}
                onInput={(event) => props.onNote(event.currentTarget.value)}
              />
              <span class={styles.noteCount} aria-hidden="true">
                {props.note.length} / {MAX_VOICE_REFLECTION_NOTE_LENGTH}
              </span>
            </div>
            <div
              class={styles.beaconActions}
              role="group"
              aria-label="Add reflection"
            >
              <For
                each={
                  [
                    'keep',
                    'curious',
                    'try-next',
                  ] as const satisfies readonly VoiceReflectionKind[]
                }
              >
                {(kind) => (
                  <button
                    type="button"
                    class={styles.beaconAction}
                    classList={{
                      [styles.keepAction]: kind === 'keep',
                      [styles.curiousAction]: kind === 'curious',
                      [styles.tryAction]: kind === 'try-next',
                    }}
                    data-testid={`reflection-beacon-${kind}`}
                    disabled={props.selectedTakeLabel === null}
                    onClick={() => props.onAddReflection(kind)}
                  >
                    <i aria-hidden="true" />
                    {voiceReflectionLabel(kind)}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show when={props.selectedReflection} keyed>
            {(reflection) => (
              <div class={styles.selectedReflection} aria-live="polite">
                <div>
                  <span>{voiceReflectionLabel(reflection.kind)}</span>
                  <strong>{formatClock(reflection.seconds)}</strong>
                  <p>
                    {reflection.note === ''
                      ? 'No note attached to this reflection.'
                      : reflection.note}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="reflection-beacon-remove"
                  onClick={() => props.onRemoveSelectedReflection()}
                >
                  Remove beacon
                </button>
              </div>
            )}
          </Show>
        </div>
      </Show>

      <Show when={props.mode === 'room'}>
        <div class={styles.roomSlot}>{props.roomPanel}</div>
      </Show>
    </>
  )
}
