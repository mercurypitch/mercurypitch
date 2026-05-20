import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { ExerciseType } from './types'
import { EXERCISE_LONG_NOTE, EXERCISE_SLIDE, EXERCISE_VIBRATO, EXERCISE_PITCH_PURSUIT, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, } from './types'
import { getExerciseStats, exerciseHistory, } from '@/stores/exercise-history-store'
import { IconTarget, IconWave, IconSlide, IconGame, IconMirror, IconLock, IconStar, IconDiamond, IconCircleFill, IconCircleEmpty, } from '@/components/exercise-icons'

interface ExerciseMenuProps {
  onSelect: (type: ExerciseType) => void
  onQuickStart?: (type: ExerciseType) => void
}

interface ExerciseCardDef {
  type: ExerciseType
  title: string
  description: string
  icon: () => JSX.Element
  tags: string[]
  available: boolean
}

const CARDS: ExerciseCardDef[] = [
  {
    type: EXERCISE_LONG_NOTE,
    title: 'Long Note',
    description:
      'Hold a steady pitch as long as you can. Builds breath support and pitch stability.',
    icon: () => <IconTarget size={28} />,
    tags: ['Stability', 'Breath Control'],
    available: true,
  },
  {
    type: EXERCISE_VIBRATO,
    title: 'Vibrato',
    description:
      'Develop controlled, even vibrato. Live feedback on rate and depth.',
    icon: () => <IconWave size={28} />,
    tags: ['Vibrato', 'Control'],
    available: true,
  },
  {
    type: EXERCISE_SLIDE,
    title: 'Slide In/Out',
    description:
      'Practice clean transitions between notes. No scooping, no overshoot.',
    icon: () => <IconSlide size={28} />,
    tags: ['Transitions', 'Precision'],
    available: true,
  },
  {
    type: EXERCISE_PITCH_PURSUIT,
    title: 'Pitch Pursuit',
    description:
      'Match falling notes before they reach the bottom. Game-like pitch training.',
    icon: () => <IconGame size={28} />,
    tags: ['Game', 'Speed'],
    available: true,
  },
  {
    type: EXERCISE_MIRROR_MELODY,
    title: 'Mirror the Melody',
    description:
      'Listen to a phrase and sing it back. Train your ear and voice together.',
    icon: () => <IconMirror size={28} />,
    tags: ['Ear Training'],
    available: true,
  },
  {
    type: EXERCISE_PITCH_HOLD,
    title: 'Pitch Hold',
    description:
      'Keep your pitch inside a shrinking target zone. How long can you stay locked in?',
    icon: () => <IconLock size={28} />,
    tags: ['Endurance'],
    available: true,
  },
]

function gradeLabel(score: number): JSX.Element {
  if (score >= 90)
    return (
      <>
        <IconStar size={12} /> Elite
      </>
    )
  if (score >= 80)
    return (
      <>
        <IconDiamond size={12} /> Great
      </>
    )
  if (score >= 65)
    return (
      <>
        <IconCircleFill size={12} /> Good
      </>
    )
  if (score >= 50)
    return (
      <>
        <IconCircleEmpty size={12} /> Novice
      </>
    )
  return <></>
}

function gradeClass(score: number): string {
  if (score >= 90) return 'exercise-grade-elite'
  if (score >= 80) return 'exercise-grade-great'
  if (score >= 65) return 'exercise-grade-good'
  return 'exercise-grade-novice'
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

const ExerciseMenu: Component<ExerciseMenuProps> = (props) => {
  const recentEntries = createMemo(() => exerciseHistory().slice(0, 5))

  return (
    <div class="exercises-panel">
      <div class="exercises-header">
        <h2>Singing Exercises</h2>
        <span style="font-size:0.8rem;color:var(--text-secondary)">
          Choose a drill to start practicing
        </span>
      </div>

      <div class="exercises-grid">
        {CARDS.map((card) => {
          const stats = createMemo(() => getExerciseStats(card.type))
          return (
            <div
              class="exercise-card"
              classList={{ 'exercise-card-disabled': !card.available }}
              onClick={() => card.available && props.onSelect(card.type)}
              style={
                card.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }
              }
            >
              <div class="exercise-card-icon">{card.icon()}</div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div class="exercise-card-tags">
                {card.tags.map((t) => (
                  <span>{t}</span>
                ))}
              </div>
              <Show when={stats().totalPlays > 0}>
                <div class="exercise-card-stats">
                  <span
                    class={`exercise-card-grade ${gradeClass(stats().bestScore)}`}
                  >
                    {gradeLabel(stats().bestScore)}
                  </span>
                  <span class="exercise-card-best">
                    Best: {stats().bestScore}%
                  </span>
                  <span class="exercise-card-plays">{stats().totalPlays}x</span>
                </div>
              </Show>
              <Show when={card.available}>
                <button
                  class="exercise-card-start-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onQuickStart?.(card.type)
                  }}
                >
                  Start
                </button>
              </Show>
            </div>
          )
        })}
      </div>

      <Show when={recentEntries().length > 0}>
        <div class="exercise-recent">
          <h4 class="exercise-recent-title">Recent Sessions</h4>
          <div class="exercise-recent-list">
            <For each={recentEntries()}>
              {(entry) => (
                <div class="exercise-recent-item">
                  <span class="exercise-recent-type">{entry.type}</span>
                  <span
                    class="exercise-recent-score"
                    style={`color:${entry.score >= 80 ? '#22c55e' : entry.score >= 50 ? '#eab308' : '#ef4444'}`}
                  >
                    {entry.score}%
                  </span>
                  <span class="exercise-recent-time">
                    {formatTime(entry.completedAt)}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default ExerciseMenu
