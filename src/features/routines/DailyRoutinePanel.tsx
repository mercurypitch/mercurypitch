import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { IconCheck, IconFire, IconTarget, IconTrophy, IconWater, } from '@/components/exercise-icons'
import { dailyRoutines } from '@/data/routine-templates'
import { EXERCISE_WARMUP } from '@/features/exercises/types'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { copyShareUrl, encodeRoutineForShare } from '@/lib/share-codec'
import { showNotification } from '@/stores/notifications-store'
import { setActiveTab, startExercise } from '@/stores/ui-store'
import type { SegmentKind } from './types'
import type { RoutineLength } from './use-daily-routine'
import { routinePrefs, setRoutinePrefs, useDailyRoutine, } from './use-daily-routine'

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

export const DailyRoutinePanel: Component = () => {
  const routine = useDailyRoutine()
  const [expanded, setExpanded] = createSignal(false)
  const [isSharing, setIsSharing] = createSignal(false)
  const [shareProgress, setShareProgress] = createSignal(0)

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
                <div class="daily-routine-prefs">
                  <label class="daily-routine-pref">
                    <span>Focus</span>
                    <select
                      value={routinePrefs().focus}
                      onChange={(e) =>
                        setRoutinePrefs((p) => ({
                          ...p,
                          focus: e.currentTarget.value,
                        }))
                      }
                    >
                      <option value="auto">Auto — target my weak spots</option>
                      <option value="surprise">Surprise me</option>
                      <For each={dailyRoutines}>
                        {(t) => <option value={t.id}>{t.name}</option>}
                      </For>
                    </select>
                  </label>
                  <label class="daily-routine-pref">
                    <span>Length</span>
                    <select
                      value={routinePrefs().length}
                      onChange={(e) =>
                        setRoutinePrefs((p) => ({
                          ...p,
                          length: e.currentTarget.value as RoutineLength,
                        }))
                      }
                    >
                      <option value="short">Short (~5 min)</option>
                      <option value="standard">Standard (~8 min)</option>
                      <option value="long">Long (~12 min)</option>
                    </select>
                  </label>
                </div>
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
              <For each={routine.segmentStatuses()}>
                {(item) => {
                  const seg = item.seg
                  const done = item.done
                  const current = item.current
                  const segExercise = seg.config.exercise
                  const segNotes = seg.config.notes ?? []
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
                        {segExercise ? `: ${segExercise}` : ''}
                      </span>
                      <span class="daily-routine-segment-dur">
                        {Math.round(seg.durationSec / 60)}m
                      </span>
                      <Show when={current && !done}>
                        <Show
                          when={segExercise}
                          fallback={
                            <>
                              {seg.type === 'challenge-prep' && (
                                <button
                                  class="daily-routine-segment-start-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveTab(TAB_CHALLENGES)
                                  }}
                                  title="Go to Challenges"
                                >
                                  ▶
                                </button>
                              )}
                              {(seg.type === 'warmup' ||
                                seg.type === 'cooldown') && (
                                <button
                                  class="daily-routine-segment-start-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // The guided warmup runs this segment's
                                    // pattern (cool-downs map via `mode`).
                                    startExercise(EXERCISE_WARMUP, {
                                      pattern:
                                        seg.config.pattern ?? seg.config.mode,
                                    })
                                  }}
                                  title={
                                    seg.type === 'warmup'
                                      ? 'Start guided warmup'
                                      : 'Start guided cool-down'
                                  }
                                >
                                  ▶
                                </button>
                              )}
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
                            </>
                          }
                        >
                          <button
                            class="daily-routine-segment-start-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              startExercise(segExercise!, { notes: segNotes })
                            }}
                            title={`Start ${segExercise}`}
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
              <button
                class="daily-routine-btn secondary"
                disabled={isSharing()}
                onClick={() => {
                  if (isSharing()) return
                  const t = routine.template()
                  if (!t) return
                  setIsSharing(true)
                  setShareProgress(10)

                  const interval = setInterval(() => {
                    setShareProgress((p) => Math.min(p + 15, 90))
                  }, 150)

                  const encoded = encodeRoutineForShare({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    segments: t.segments.map((s) => ({
                      type: s.type,
                      durationSec: s.durationSec,
                      config: s.config as Record<string, unknown>,
                    })),
                  })
                  void copyShareUrl(encoded).then((ok) => {
                    clearInterval(interval)
                    setShareProgress(100)
                    setTimeout(() => {
                      setIsSharing(false)
                      setShareProgress(0)
                      if (!ok) showNotification('Failed to copy link', 'error')
                    }, 1000)
                  })
                }}
                title="Copy shareable routine link"
              >
                Share
              </button>
            </div>

            <Show when={isSharing()}>
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  gap: '8px',
                  'margin-top': '12px',
                  'margin-bottom': '4px',
                  'font-size': '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  style={{ transform: 'rotate(-90deg)' }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="var(--border)"
                    stroke-width="3"
                    fill="none"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="var(--green)"
                    stroke-width="3"
                    fill="none"
                    stroke-dasharray="62.83"
                    stroke-dashoffset={
                      2 * Math.PI * 10 * (1 - shareProgress() / 100)
                    }
                    style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                  />
                </svg>
                <span>
                  {shareProgress() === 100
                    ? 'Copied to clipboard!'
                    : 'Generating Link...'}
                </span>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  )
}
