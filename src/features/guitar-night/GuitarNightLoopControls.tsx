// The A/B loop control, identical in both rooms because the loop is.
// ============================================================

import { Show } from 'solid-js'
import { Repeat } from '@/components/icons'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import styles from './GuitarNightApp.module.css'

interface GuitarNightLoopControlsProps {
  span: LoopSpan | null
  /** A mark exists but the pair is not loopable yet. */
  pending: boolean
  hasStart: boolean
  hasEnd: boolean
  /** Render one position the way this room's timeline reads. */
  format(position: number): string
  onMarkStart(): void
  onMarkEnd(): void
  onClear(): void
}

export function GuitarNightLoopControls(props: GuitarNightLoopControlsProps) {
  return (
    <div class={styles.loopControls} role="group" aria-label="Section loop">
      <span class={styles.loopIcon} aria-hidden="true">
        <Repeat />
      </span>
      <button
        type="button"
        classList={{ [styles.loopMarkSet]: props.hasStart }}
        aria-pressed={props.hasStart}
        title="Start the loop where the playhead is"
        onClick={() => props.onMarkStart()}
      >
        A
      </button>
      <button
        type="button"
        classList={{ [styles.loopMarkSet]: props.hasEnd }}
        aria-pressed={props.hasEnd}
        title="End the loop where the playhead is"
        onClick={() => props.onMarkEnd()}
      >
        B
      </button>
      <output aria-live="polite">
        <Show
          when={props.span}
          fallback={
            props.pending ? 'Mark the other end' : 'Loop a section: A then B'
          }
        >
          {(span) => (
            <>
              {props.format(span().start)} – {props.format(span().end)}
            </>
          )}
        </Show>
      </output>
      <Show when={props.hasStart || props.hasEnd}>
        <button
          type="button"
          class={styles.loopClear}
          title="Clear the loop"
          onClick={() => props.onClear()}
        >
          Clear
        </button>
      </Show>
    </div>
  )
}
