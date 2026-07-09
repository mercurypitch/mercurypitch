// ============================================================
// WeaknessPanel — Displays weakness analysis and micro-drills
// ============================================================

import type { Component, JSX } from 'solid-js'
import piStyles from '@/features/practice-intelligence/components/PracticeIntelligence.module.css'
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

const drillIconCls = piStyles.weaknessDrillIconSvg

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
      <div class={piStyles.weaknessPanel}>
        <div class={piStyles.weaknessPanelTitleRow}>
          <h3 class={piStyles.weaknessPanelTitle}>Practice Suggestions</h3>
          <span
            class={piStyles.weaknessPanelHelp}
            title="Your exercise scores and pitch accuracy are analyzed to find weak areas and suggest focused practice drills. Exercise difficulty adjusts automatically based on your performance trends."
          >
            ?
          </span>
        </div>
        <p class={piStyles.weaknessPanelSubtitle}>
          Based on your recent practice sessions
        </p>

        {/* Micro-drills */}
        <Show when={drills().length > 0}>
          <div class={piStyles.weaknessDrills}>
            <For each={drills()}>
              {(drill) => (
                <div class={piStyles.weaknessDrillCard}>
                  <div class={piStyles.weaknessDrillHeader}>
                    <span class={piStyles.weaknessDrillIcon}>
                      {drillIconSvg(drill.icon)}
                    </span>
                    <div class={piStyles.weaknessDrillInfo}>
                      <strong>{drill.title}</strong>
                      <p class={piStyles.weaknessDrillDesc}>
                        {drill.description}
                      </p>
                      <p class={piStyles.weaknessDrillReason}>{drill.reason}</p>
                    </div>
                  </div>
                  <button
                    class={piStyles.weaknessDrillStart}
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
          <div class={piStyles.weaknessPitchSummary}>
            <h4>Weak Notes</h4>
            <div class={piStyles.weaknessPitchList}>
              <For each={report().weakPitches.slice(0, 5)}>
                {(pitch) => (
                  <span
                    class={piStyles.weaknessPitchBadge}
                    classList={{
                      [piStyles.pitchBad]: pitch.avgDeviation >= 30,
                      [piStyles.pitchOk]: pitch.avgDeviation < 30,
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
