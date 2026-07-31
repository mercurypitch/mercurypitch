// ============================================================
// Take trace — what the voice actually did, over the take
//
// One SVG that adapts to whatever the take can support:
//   audio/notes  detected note timeline (real start/end seconds)
//   live         the pitch contour captured so far
//   summary      per-note sequence, widths from recorded time-per-note
//
// Geometry lives in trace-model.ts; this is the rendering only.
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { LivePitchSample } from '@/lib/live-pitch-analysis'
import type { MergedNote } from '@/lib/midi-generator'
import type { NoteResult } from '@/types'
import styles from './AnalysisDashboard.module.css'
import { buildTraceModel } from './trace-model'

function formatSpan(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

export interface TakeTraceProps {
  /** Detected notes, for song takes that have been through a pitch pass. */
  notes?: MergedNote[]
  /** Live capture buffer. */
  samples?: LivePitchSample[]
  /** Practice note results. */
  results?: NoteResult[]
}

export const TakeTrace: Component<TakeTraceProps> = (props) => {
  const model = createMemo(() =>
    buildTraceModel({
      notes: props.notes,
      results: props.results,
      samples: props.samples,
    }),
  )

  /** Axis labels: the extremes of the padded pitch band, as note names. */
  const axis = createMemo(() => {
    const m = model()
    if (m === null) return null
    return {
      high: midiToNoteName(Math.round(m.high)),
      low: midiToNoteName(Math.round(m.low)),
    }
  })

  // Practice takes have no clock, so the footer must not imply one.
  const isSequence = () =>
    props.results !== undefined &&
    props.results.length > 0 &&
    (props.notes === undefined || props.notes.length === 0)

  return (
    <Show
      when={model()}
      fallback={
        <p class={styles.unavailable}>
          Nothing to plot yet — sing, or pick a take that's been analysed.
        </p>
      }
    >
      {(m) => (
        <div>
          <div class={styles.traceWrap}>
            <div class={styles.traceAxis}>
              <span>{axis()?.high}</span>
              <span>{axis()?.low}</span>
            </div>
            <svg
              class={styles.traceChart}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Pitch over the take"
            >
              <Show when={m().kind === 'bars'}>
                <For each={m().bars}>
                  {(bar) => (
                    <rect
                      x={bar.x}
                      y={Math.max(0, Math.min(100 - bar.height, bar.y))}
                      width={bar.width}
                      height={bar.height}
                      rx="1"
                      fill={bar.color}
                    />
                  )}
                </For>
              </Show>
              <Show when={m().kind === 'path'}>
                <path class={styles.traceLine} d={m().path} />
              </Show>
            </svg>
          </div>
          <div class={styles.trendFoot}>
            <span>{isSequence() ? 'start' : '0s'}</span>
            <span>
              {isSequence()
                ? 'Note sequence · width = time on the note'
                : 'Pitch over time'}
            </span>
            <span>{formatSpan(m().span)}</span>
          </div>
        </div>
      )}
    </Show>
  )
}
