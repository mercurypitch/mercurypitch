import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { IconArrowUpDown, IconCircleEmpty, IconCircleFill, IconDiamond, IconDrone, IconExpand, IconGame, IconLayers, IconList, IconLock, IconMirror, IconMusic, IconReply, IconSiren, IconSlide, IconStar, IconTarget, IconWave, IconZap, } from '@/components/exercise-icons'
import { exerciseHistory, getExerciseStats, } from '@/stores/exercise-history-store'
import type { ExerciseType } from './types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, EXERCISE_PITCH_PURSUIT, EXERCISE_ROUTINE_RUNNER, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, EXERCISE_VIBRATO, } from './types'

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
  {
    type: EXERCISE_INTERVAL_TRAINER,
    title: 'Interval Trainer',
    description:
      'Sing specific intervals above and below a reference note. Train your ear to internalize musical distances.',
    icon: () => <IconArrowUpDown size={28} />,
    tags: ['Intervals', 'Ear Training'],
    available: true,
  },
  {
    type: EXERCISE_SCALE_RUNNER,
    title: 'Scale Runner',
    description:
      'Move smoothly up and down scales. Practice major, minor, pentatonic, and chromatic patterns.',
    icon: () => <IconArrowUpDown size={28} />,
    tags: ['Scales', 'Agility'],
    available: true,
  },
  {
    type: EXERCISE_ARPEGGIO_JUMPER,
    title: 'Arpeggio Jumper',
    description:
      'Leap between chord tones with precision. Build confidence hitting notes across wide intervals.',
    icon: () => <IconLayers size={28} />,
    tags: ['Arpeggios', 'Precision'],
    available: true,
  },
  {
    type: EXERCISE_DRONE_INTONATION,
    title: 'Drone Intonation',
    description:
      'Sing intervals against a sustained drone. Fine-tune your sense of harmonic alignment.',
    icon: () => <IconDrone size={28} />,
    tags: ['Intonation', 'Harmony'],
    available: true,
  },
  {
    type: EXERCISE_SIREN,
    title: 'Siren / Range Explorer',
    description:
      'Glide smoothly across your range. Develop seamless register transitions and vocal flexibility.',
    icon: () => <IconSiren size={28} />,
    tags: ['Range', 'Flexibility'],
    available: true,
  },
  {
    type: EXERCISE_CALL_RESPONSE,
    title: 'Call & Response',
    description:
      'Hear a melodic phrase, then sing it back. Train pitch memory and rhythmic accuracy together.',
    icon: () => <IconReply size={28} />,
    tags: ['Memory', 'Phrasing'],
    available: true,
  },
  {
    type: EXERCISE_DYNAMIC_SWELL,
    title: 'Dynamic Swell',
    description:
      'Hold a note with controlled crescendo and decrescendo. Master breath support and dynamic control.',
    icon: () => <IconExpand size={28} />,
    tags: ['Dynamics', 'Breath Control'],
    available: true,
  },
  {
    type: EXERCISE_CHORD_STACKER,
    title: 'Chord Stacker',
    description:
      'Hear a chord played note by note, then sing each pitch back. Build harmonic awareness.',
    icon: () => <IconLayers size={28} />,
    tags: ['Chords', 'Harmony'],
    available: true,
  },
  {
    type: EXERCISE_STACCATO,
    title: 'Staccato Precision',
    description:
      'Hit short, crisp notes dead-on. Sharpen your attack accuracy and pitch precision.',
    icon: () => <IconZap size={28} />,
    tags: ['Attack', 'Precision'],
    available: true,
  },
  {
    type: EXERCISE_ROUTINE_RUNNER,
    title: 'Routine Runner',
    description:
      'Complete a full warm-up sequence: scales, arpeggios, and cool-down in one guided flow.',
    icon: () => <IconList size={28} />,
    tags: ['Warm-up', 'Endurance'],
    available: true,
  },
  {
    type: EXERCISE_SIGHT_SINGING,
    title: 'Sight-Singing',
    description:
      'Read notes from a musical staff and sing them — no audio preview. Train your sight-reading.',
    icon: () => <IconMusic size={28} />,
    tags: ['Reading', 'Accuracy'],
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
        <For each={CARDS}>
          {(card) => {
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
                  <For each={card.tags}>{(t) => <span>{t}</span>}</For>
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
                    <span class="exercise-card-plays">
                      {stats().totalPlays}x
                    </span>
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
          }}
        </For>
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
