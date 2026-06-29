// ============================================================
// SingingStatusChip — top-left glass overview of the practice
// context: current scale + melody name, tempo, and bar.beat
// position. Mirrors the Guitar 3D HUD status chip.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from './SingingStatusChip.module.css'

interface SingingStatusChipProps {
  keyName: () => string
  scaleType: () => string
  melodyName: () => string | null
  bpm: () => number
  currentBeat: () => number
  /** Live singing-playback signal (the controller's, not the dead store one). */
  isPlaying: () => boolean
}

const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// 0-based float beat → 1-based "bar.beat" (4/4), like Guitar 3D's Tab3DHud.
const barBeat = (b: number): string => {
  const beat = Math.max(0, b)
  return `${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`
}

export const SingingStatusChip: Component<SingingStatusChipProps> = (props) => {
  const scaleLabel = () => `${props.keyName()} ${titleCase(props.scaleType())}`
  return (
    <div
      class={styles.chip}
      classList={{ [styles.dimmed]: props.isPlaying() }}
      data-testid="singing-status-chip"
    >
      <div class={styles.primary} title={scaleLabel()}>
        <span class={styles.scale}>{scaleLabel()}</span>
        <Show when={props.melodyName()}>
          {(name) => (
            <>
              <span class={styles.dot}>·</span>
              <span class={styles.melody} title={name()}>
                {name()}
              </span>
            </>
          )}
        </Show>
      </div>
      <div class={styles.meta}>
        <span class={styles.bpm}>{props.bpm()} BPM</span>
        <span class={styles.dot}>·</span>
        <span class={styles.pos}>{barBeat(props.currentBeat())}</span>
      </div>
    </div>
  )
}
