// ============================================================
// WeaknessPanel — Displays weakness analysis and micro-drills
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { IconArrowUpDown, IconLock, IconMusic, IconTarget, } from '@/components/exercise-icons'
import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import type { MicroDrill } from '../drill-generator'
import { generateDrills } from '../drill-generator'
import { generateWeaknessReport } from '../weakness-analyzer'

interface WeaknessPanelProps {
  onStartDrill?: (exerciseType: ExerciseType, config?: ExerciseConfig) => void
  /** Rendered when there are no weak spots to surface (keeps the area filled). */
  fallback?: JSX.Element
}

const drillIconCls = 'weakness-drill-icon-svg'

function drillIconSvg(icon: MicroDrill['icon']) {
  switch (icon) {
    case 'target':
      return <IconTarget size={18} class={drillIconCls} />
    case 'arrow':
      return <IconArrowUpDown size={18} class={drillIconCls} />
    case 'scale':
      return <IconMusic size={18} class={drillIconCls} />
    case 'lock':
      return <IconLock size={18} class={drillIconCls} />
  }
}

export const WeaknessPanel: Component<WeaknessPanelProps> = (props) => {
  const report = createMemo(() => generateWeaknessReport())
  const drills = createMemo(() =>
    generateDrills(
      report().weakExercises,
      report().weakPitches,
      report().weakIntervals,
    ),
  )

  const hasContent = createMemo(
    () =>
      drills().length > 0 ||
      report().weakPitches.length > 0 ||
      report().weakIntervals.length > 0,
  )

  return (
    <Show when={hasContent()} fallback={props.fallback}>
      <div class="weakness-panel">
        <div class="weakness-panel-title-row">
          <h3 class="weakness-panel-title">Practice Suggestions</h3>
          <span
            class="weakness-panel-help"
            title="Your exercise scores and pitch accuracy are analyzed to find weak areas and suggest focused practice drills. Exercise difficulty adjusts automatically based on your performance trends."
          >
            ?
          </span>
        </div>
        <p class="weakness-panel-subtitle">
          Based on your recent practice sessions
        </p>

        {/* Micro-drills */}
        <Show when={drills().length > 0}>
          <div class="weakness-drills">
            <For each={drills()}>
              {(drill) => (
                <div class="weakness-drill-card">
                  <div class="weakness-drill-header">
                    <span class="weakness-drill-icon">
                      {drillIconSvg(drill.icon)}
                    </span>
                    <div class="weakness-drill-info">
                      <strong>{drill.title}</strong>
                      <p class="weakness-drill-desc">{drill.description}</p>
                      <p class="weakness-drill-reason">{drill.reason}</p>
                    </div>
                  </div>
                  <button
                    class="weakness-drill-start"
                    onClick={() =>
                      props.onStartDrill?.(drill.exerciseType, drill.config)
                    }
                  >
                    Practice
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Weak pitches summary */}
        <Show when={report().weakPitches.length > 0}>
          <div class="weakness-pitch-summary">
            <h4>Weak Notes</h4>
            <div class="weakness-pitch-list">
              <For each={report().weakPitches.slice(0, 5)}>
                {(pitch) => (
                  <span
                    class="weakness-pitch-badge"
                    classList={{
                      'pitch-bad': pitch.avgDeviation >= 30,
                      'pitch-ok': pitch.avgDeviation < 30,
                    }}
                    title={`${pitch.avgDeviation}¢ avg deviation over ${pitch.occurrences} plays`}
                  >
                    {pitch.noteName} ({pitch.avgDeviation}¢)
                  </span>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}
