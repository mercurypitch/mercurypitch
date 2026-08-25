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
  disabled?: boolean
  blockedReason?: string
  /** Render one position the way this room's timeline reads. */
  format(position: number): string
  onMarkStart(): void
  onMarkEnd(): void
  onClear(): void
}

export function GuitarNightLoopControls(props: GuitarNightLoopControlsProps) {
  return (
    <div class={styles.loopControls} role="group" aria-label="Section loop">
      {/* A and B set the two ends of one span, so they read as one segmented
          control rather than two loose boxes with a decorative icon between
          them. Both rooms already title this section and say what A and B do,
          which is why the idle caption here is silence. */}
      <span class={styles.loopMarks}>
        <button
          type="button"
          classList={{ [styles.loopMarkSet]: props.hasStart }}
          aria-pressed={props.hasStart}
          aria-label="A — start the loop at the playhead"
          disabled={props.disabled}
          title={
            props.disabled === true
              ? (props.blockedReason ?? 'Loop changes are unavailable')
              : 'Start the loop where the playhead is'
          }
          onClick={() => props.onMarkStart()}
        >
          A
        </button>
        <button
          type="button"
          classList={{ [styles.loopMarkSet]: props.hasEnd }}
          aria-pressed={props.hasEnd}
          aria-label="B — end the loop at the playhead"
          disabled={props.disabled}
          title={
            props.disabled === true
              ? (props.blockedReason ?? 'Loop changes are unavailable')
              : 'End the loop where the playhead is'
          }
          onClick={() => props.onMarkEnd()}
        >
          B
        </button>
      </span>
      <output aria-live="polite">
        <Show
          when={props.span}
          fallback={props.pending ? 'Mark the other end' : null}
        >
          {(span) => (
            <>
              <span class={styles.loopSpanIcon} aria-hidden="true">
                <Repeat />
              </span>
              {props.format(span().start)} – {props.format(span().end)}
            </>
          )}
        </Show>
      </output>
      <Show when={props.hasStart || props.hasEnd}>
        <button
          type="button"
          class={styles.loopClear}
          disabled={props.disabled}
          title="Clear the loop"
          onClick={() => props.onClear()}
        >
          Clear
        </button>
      </Show>
    </div>
  )
}
