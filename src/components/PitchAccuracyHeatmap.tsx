// ============================================================
// PitchAccuracyHeatmap — Color-coded piano keys with accuracy
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { getNoteAccuracyMap } from '@/stores/practice-session-store'
import type { ScaleDegree } from '@/types'
import styles from './PitchAccuracyHeatmap.module.css'

interface Props {
  scale: () => ScaleDegree[]
  onSeekNote?: (midi: number, noteName: string) => void
}

function accuracyColor(acc: number): string {
  if (acc >= 90) return 'var(--green, #3fb950)'
  if (acc >= 75) return 'var(--chart-lime, #8dcb41)'
  if (acc >= 60) return 'var(--yellow, #d29922)'
  if (acc >= 40) return 'var(--orange, #db7d00)'
  return 'var(--red, #db3232)'
}

function accuracyLabel(acc: number): string {
  if (acc >= 90) return 'Excellent'
  if (acc >= 75) return 'Good'
  if (acc >= 60) return 'Okay'
  if (acc >= 40) return 'Weak'
  return 'Needs Work'
}

const PitchAccuracyHeatmap: Component<Props> = (props) => {
  const accuracyMap = createMemo(() => getNoteAccuracyMap())

  const hasData = createMemo(() => accuracyMap().size > 0)

  return (
    <Show when={hasData()}>
      <div class={styles.heatmap}>
        <h4 class={styles.title}>Note Accuracy</h4>
        <div class={styles.keys}>
          <For each={props.scale()}>
            {(note) => {
              const acc = createMemo(() => accuracyMap().get(note.midi))
              const color = createMemo(() =>
                acc() != null ? accuracyColor(acc()!) : undefined,
              )
              return (
                <button
                  class={styles.key}
                  classList={{ [styles.hasData]: acc() != null }}
                  style={color() != null ? { '--key-color': color() } : {}}
                  onClick={() =>
                    acc() != null &&
                    props.onSeekNote?.(note.midi, note.name + note.octave)
                  }
                  title={
                    acc() != null
                      ? `${note.name}${note.octave}: ${acc()}% — ${accuracyLabel(acc()!)}`
                      : `${note.name}${note.octave}: no data`
                  }
                  type="button"
                  aria-label={
                    acc() != null
                      ? `${note.name}${note.octave} accuracy ${acc()}%`
                      : `${note.name}${note.octave} no practice data`
                  }
                >
                  <span class={styles.noteName}>
                    {note.name}
                    <span class={styles.octave}>{note.octave}</span>
                  </span>
                  <Show when={acc() != null}>
                    <span class={styles.accuracy}>{acc()}%</span>
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
      </div>
    </Show>
  )
}

export default PitchAccuracyHeatmap
