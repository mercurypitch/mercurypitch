// ============================================================
// Drum Pattern Picker — start a groove from an idiom instead of a blank grid
// ============================================================
//
// The picker only names patterns and reports the choice. Loading one is a
// groove-editor command the host dispatches, so this component never touches
// the draft, the scheduler, or storage.

import { createMemo, createSignal, For, Show } from 'solid-js'
import type { DrumPattern, DrumPatternStyle } from './drum-pattern'
import { drumPatternDurationBeats } from './drum-pattern'
import { DRUM_PATTERN_STYLE_LABELS, DRUM_PATTERN_STYLE_ORDER, drumPatternsForStyle, } from './drum-pattern-library'
import styles from './DrumPatternPicker.module.css'

export interface DrumPatternPickerProps {
  readonly disabled?: boolean
  /** Last pattern this draft was started from, when the host tracks one. */
  readonly loadedPatternId?: string | null
  readonly onLoad: (pattern: DrumPattern) => void
}

function barsLabel(pattern: DrumPattern): string {
  const beats = drumPatternDurationBeats(pattern)
  return `${pattern.bars} bar${pattern.bars === 1 ? '' : 's'} · ${beats} beats`
}

export function DrumPatternPicker(props: DrumPatternPickerProps) {
  const [style, setStyle] = createSignal<DrumPatternStyle>('rock')
  const [confirmingId, setConfirmingId] = createSignal<string | null>(null)

  const patterns = createMemo(() => drumPatternsForStyle(style()))
  const confirming = createMemo(
    () => patterns().find((pattern) => pattern.id === confirmingId()) ?? null,
  )

  const selectStyle = (next: DrumPatternStyle): void => {
    setStyle(next)
    setConfirmingId(null)
  }

  const load = (pattern: DrumPattern): void => {
    setConfirmingId(null)
    props.onLoad(pattern)
  }

  return (
    <section
      class={styles.patterns}
      aria-label="Groove pattern library"
      data-testid="drum-pattern-picker"
    >
      <header>
        <h3>Start from a pattern</h3>
        <p>
          Replaces the hits in the open variation with an idiom groove. Your
          other variations, and the Feel settings, stay as they are.
        </p>
      </header>

      <div class={styles.styleRail} role="group" aria-label="Pattern style">
        <For each={DRUM_PATTERN_STYLE_ORDER}>
          {(candidate) => (
            <button
              type="button"
              aria-pressed={style() === candidate}
              disabled={props.disabled === true}
              onClick={() => selectStyle(candidate)}
            >
              {DRUM_PATTERN_STYLE_LABELS[candidate]}
            </button>
          )}
        </For>
      </div>

      <ul class={styles.patternList}>
        <For each={patterns()}>
          {(pattern) => (
            <li data-loaded={props.loadedPatternId === pattern.id}>
              <div class={styles.patternIdentity}>
                <strong>{pattern.name}</strong>
                <small>
                  {pattern.tempoBpm} BPM · {barsLabel(pattern)}
                </small>
                <p>{pattern.description}</p>
                <Show when={props.loadedPatternId === pattern.id}>
                  <span class={styles.loadedMark}>Loaded</span>
                </Show>
              </div>
              <Show
                when={confirmingId() === pattern.id}
                fallback={
                  <button
                    type="button"
                    class={styles.startAction}
                    disabled={props.disabled === true}
                    onClick={() => setConfirmingId(pattern.id)}
                  >
                    Start from this
                  </button>
                }
              >
                <div class={styles.confirmActions}>
                  <button
                    type="button"
                    class={styles.startAction}
                    disabled={props.disabled === true}
                    onClick={() => load(pattern)}
                  >
                    Replace hits
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)}>
                    Keep mine
                  </button>
                </div>
              </Show>
            </li>
          )}
        </For>
      </ul>

      <Show when={confirming()}>
        {(pattern) => (
          <p class={styles.confirmNote} role="status">
            {pattern().name} replaces every hit in the open variation. Undo
            brings your groove back in one step.
          </p>
        )}
      </Show>
    </section>
  )
}
