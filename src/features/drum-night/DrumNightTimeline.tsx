// Drum Night timeline presents one elapsed-time seek axis and authored A/B marks.
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import styles from './DrumNightTimeline.module.css'

interface DrumNightTimelineProps {
  readonly sourceLabel: Accessor<string>
  readonly positionSeconds: Accessor<number>
  readonly durationSeconds: Accessor<number>
  readonly playheadBeat: Accessor<number>
  readonly durationBeats: Accessor<number>
  readonly markA: Accessor<number | null>
  readonly markB: Accessor<number | null>
  readonly active: Accessor<boolean>
  readonly disabled?: Accessor<boolean>
  readonly secondsForBeat: (beat: number) => number
  readonly beatForSeconds: (seconds: number) => number
  readonly onSeek: (seconds: number) => void
  readonly onScrubStart: () => void
  readonly onScrubEnd: () => void
  readonly onMoveMark: (mark: 'A' | 'B', beat: number) => void
  readonly onCommitMark: (mark: 'A' | 'B') => void
  readonly onMarkAtPlayhead: (mark: 'A' | 'B') => void
  readonly onClear: () => void
}

function formatClock(seconds: number): string {
  const bounded = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(bounded / 60)
  const remainder = Math.floor(bounded % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function formatBeat(beat: number): string {
  const bounded = Math.max(0, Number.isFinite(beat) ? beat : 0)
  const rounded = Math.round((bounded + 1) * 100) / 100
  return `Beat ${rounded}`
}

export const DrumNightTimeline: Component<DrumNightTimelineProps> = (props) => {
  const hasA = createMemo(() => props.markA() !== null)
  const hasB = createMemo(() => props.markB() !== null)
  const hasAnyMark = createMemo(() => hasA() || hasB())
  const loopCopy = createMemo(() => {
    const a = props.markA()
    const b = props.markB()
    if (a === null && b === null) return 'Full song'
    if (a === null) return 'Set A to finish the loop'
    if (b === null) return 'Set B to finish the loop'
    return `${formatBeat(Math.min(a, b))} – ${formatBeat(Math.max(a, b))}`
  })

  return (
    <section
      class={styles.timelineDock}
      aria-label="Song timeline and A B practice loop"
      inert={props.disabled?.() ?? false}
      data-loop-state={
        props.active() ? 'active' : hasAnyMark() ? 'waiting' : 'full'
      }
      data-testid="drum-night-timeline"
    >
      <div class={styles.timelineIdentity}>
        <span>{props.sourceLabel()}</span>
        <strong>
          {formatClock(props.positionSeconds())}
          <small> / {formatClock(props.durationSeconds())}</small>
        </strong>
      </div>

      <div class={styles.timelineRail}>
        <LoopRangeRail
          axisDomain={() => ({
            start: 0,
            end: props.durationSeconds() > 0 ? props.durationSeconds() : 1,
          })}
          axisValue={props.positionSeconds}
          markDomain={() => ({
            start: 0,
            end: props.durationBeats() > 0 ? props.durationBeats() : 0.25,
          })}
          markA={props.markA}
          markB={props.markB}
          toAxis={props.secondsForBeat}
          fromAxis={props.beatForSeconds}
          active={props.active}
          disabled={props.disabled}
          axisStep={() => 0.05}
          markStep={() => 0.25}
          minimumMarkGap={() => 0.25}
          formatAxisValue={(seconds) =>
            `${formatClock(seconds)} of ${formatClock(props.durationSeconds())} · ${formatBeat(props.beatForSeconds(seconds))}`
          }
          formatMarkValue={formatBeat}
          seekLabel="Drum part position"
          onSeek={props.onSeek}
          onScrubStart={props.onScrubStart}
          onScrubEnd={props.onScrubEnd}
          snapMarkValue={(beat) => Math.round(beat * 4) / 4}
          onMoveMarkA={(beat) => props.onMoveMark('A', beat)}
          onMoveMarkB={(beat) => props.onMoveMark('B', beat)}
          onCommitMark={props.onCommitMark}
          testIdPrefix="drum-night"
        />
        <span class={styles.timelinePosition} aria-hidden="true">
          {formatBeat(props.playheadBeat())}
        </span>
      </div>

      <div
        class={styles.loopControls}
        role="group"
        aria-label="A B practice loop"
      >
        <span class={styles.loopMarks}>
          <button
            type="button"
            classList={{ [styles.isSet]: hasA() }}
            aria-pressed={hasA()}
            disabled={props.disabled?.() ?? false}
            aria-label="Set loop start A at the playhead"
            onClick={() => props.onMarkAtPlayhead('A')}
          >
            A
          </button>
          <button
            type="button"
            classList={{ [styles.isSet]: hasB() }}
            aria-pressed={hasB()}
            disabled={props.disabled?.() ?? false}
            aria-label="Set loop end B at the playhead"
            onClick={() => props.onMarkAtPlayhead('B')}
          >
            B
          </button>
        </span>
        <output aria-live="polite">{loopCopy()}</output>
        <Show when={hasAnyMark()}>
          <button
            class={styles.clearLoop}
            type="button"
            disabled={props.disabled?.() ?? false}
            aria-label="Clear A B practice loop"
            onClick={() => props.onClear()}
          >
            Clear
          </button>
        </Show>
      </div>
    </section>
  )
}
