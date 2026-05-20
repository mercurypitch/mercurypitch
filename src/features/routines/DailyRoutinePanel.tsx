import type { Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { createSignal, For, Show } from 'solid-js'
import { useDailyRoutine } from './use-daily-routine'
import type { SegmentKind } from './types'
import { startExercise } from '@/stores/ui-store'
import type { ExerciseType } from '@/features/exercises/types'
import { IconFire, IconTarget, IconTrophy, IconWater, IconCheck, } from '@/components/exercise-icons'

const segmentLabels: Record<SegmentKind, string> = {
  warmup: 'Warmup',
  exercise: 'Exercise',
  'challenge-prep': 'Challenge Prep',
  cooldown: 'Cool-down',
}

const segmentIcons: Record<SegmentKind, () => JSX.Element> = {
  warmup: () => <IconFire size={14} />,
  exercise: () => <IconTarget size={14} />,
  'challenge-prep': () => <IconTrophy size={14} />,
  cooldown: () => <IconWater size={14} />,
}

const segmentExercise: Record<SegmentKind, ExerciseType> = {
  warmup: 'long-note',
  exercise: 'vibrato',
  'challenge-prep': 'pitch-pursuit',
  cooldown: 'slide',
}

export const DailyRoutinePanel: Component = () => {
  const routine = useDailyRoutine()
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class="daily-routine-panel">
      <div
        class="daily-routine-header"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded((ex) => !ex)
        }}
      >
        <span class="daily-routine-title">Daily Practice</span>
        <Show when={routine.template() && !routine.isComplete()}>
          <span class="daily-routine-badge">
            {routine.completedSegments().length}/
            {routine.template()!.segments.length}
          </span>
        </Show>
        <Show when={routine.isComplete()}>
          <span class="daily-routine-badge complete">Done</span>
        </Show>
        <svg
          class={`daily-routine-chevron${expanded() ? ' open' : ''}`}
          viewBox="0 0 24 24"
          width="14"
          height="14"
        >
          <path
            fill="currentColor"
            d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
          />
        </svg>
      </div>

      <Show when={expanded()}>
        <div class="daily-routine-body">
          <Show
            when={routine.template()}
            fallback={
              <div class="daily-routine-empty">
                <p>No routine for today yet.</p>
                <button
                  class="daily-routine-btn"
                  onClick={() => routine.generate()}
                >
                  Generate Today's Routine
                </button>
              </div>
            }
          >
            <div class="daily-routine-meta">
              <span class="daily-routine-name">{routine.template()!.name}</span>
              <span class="daily-routine-time">
                ~{Math.round(routine.totalDurationSec() / 60)} min
              </span>
            </div>

            <div class="daily-routine-progress-bar">
              <div
                class="daily-routine-progress-fill"
                style={{ width: `${routine.progress()}%` }}
              />
            </div>

            <div class="daily-routine-segments">
              <For each={routine.template()!.segments}>
                {(seg, i) => {
                  const done = routine.completedSegments().includes(i())
                  const current = i() === routine.currentSegmentIndex()
                  return (
                    <div
                      class={`daily-routine-segment${done ? ' done' : ''}${current ? ' current' : ''}`}
                    >
                      <span class="daily-routine-segment-icon">
                        {done ? (
                          <IconCheck size={13} />
                        ) : (
                          segmentIcons[seg.type]()
                        )}
                      </span>
                      <span class="daily-routine-segment-type">
                        {segmentLabels[seg.type]}
                      </span>
                      <span class="daily-routine-segment-dur">
                        {Math.round(seg.durationSec / 60)}m
                      </span>
                      <Show when={current && !done}>
                        <button
                          class="daily-routine-segment-start-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            startExercise(segmentExercise[seg.type])
                          }}
                          title="Start exercise"
                        >
                          ▶
                        </button>
                        <button
                          class="daily-routine-segment-done-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            routine.completeSegment()
                          }}
                          title="Mark complete"
                        >
                          <IconCheck size={10} />
                        </button>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>

            <Show when={routine.isComplete()}>
              <div class="daily-routine-complete-msg">
                Routine complete! Great work today.
              </div>
            </Show>

            <div class="daily-routine-actions">
              <button
                class="daily-routine-btn secondary"
                onClick={() => routine.reset()}
              >
                New Routine
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
