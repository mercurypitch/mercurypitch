import type { Component } from 'solid-js'
import type { ExerciseType } from './types'
import {
  EXERCISE_LONG_NOTE,
  EXERCISE_SLIDE,
  EXERCISE_VIBRATO,
  EXERCISE_PITCH_PURSUIT,
  EXERCISE_MIRROR_MELODY,
  EXERCISE_PITCH_HOLD,
} from './types'

interface ExerciseMenuProps {
  onSelect: (type: ExerciseType) => void
}

interface ExerciseCardDef {
  type: ExerciseType
  title: string
  description: string
  icon: string
  tags: string[]
  available: boolean
}

const CARDS: ExerciseCardDef[] = [
  {
    type: EXERCISE_LONG_NOTE,
    title: 'Long Note',
    description: 'Hold a steady pitch as long as you can. Builds breath support and pitch stability.',
    icon: '🎯',
    tags: ['Stability', 'Breath Control'],
    available: true,
  },
  {
    type: EXERCISE_VIBRATO,
    title: 'Vibrato',
    description: 'Develop controlled, even vibrato. Live feedback on rate and depth.',
    icon: '〰️',
    tags: ['Vibrato', 'Control'],
    available: true,
  },
  {
    type: EXERCISE_SLIDE,
    title: 'Slide In/Out',
    description: 'Practice clean transitions between notes. No scooping, no overshoot.',
    icon: '↗️',
    tags: ['Transitions', 'Precision'],
    available: true,
  },
  {
    type: EXERCISE_PITCH_PURSUIT,
    title: 'Pitch Pursuit',
    description: 'Match falling notes before they reach the bottom. Game-like pitch training.',
    icon: '🎮',
    tags: ['Game', 'Speed', 'Coming Soon'],
    available: false,
  },
  {
    type: EXERCISE_MIRROR_MELODY,
    title: 'Mirror the Melody',
    description: 'Listen to a phrase and sing it back. Train your ear and voice together.',
    icon: '🪞',
    tags: ['Ear Training', 'Coming Soon'],
    available: false,
  },
  {
    type: EXERCISE_PITCH_HOLD,
    title: 'Pitch Hold',
    description: 'Keep your pitch inside a drifting target zone. How long can you stay locked in?',
    icon: '🔒',
    tags: ['Endurance', 'Coming Soon'],
    available: false,
  },
]

const ExerciseMenu: Component<ExerciseMenuProps> = (props) => {
  return (
    <div class="exercises-panel">
      <div class="exercises-header">
        <h2>Singing Exercises</h2>
        <span style="font-size:0.8rem;color:var(--text-secondary)">
          Choose a drill to start practicing
        </span>
      </div>

      <div class="exercises-grid">
        {CARDS.map((card) => (
          <div
            class="exercise-card"
            classList={{ 'exercise-card-disabled': !card.available }}
            onClick={() => card.available && props.onSelect(card.type)}
            style={card.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }}
          >
            <div class="exercise-card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div class="exercise-card-tags">
              {card.tags.map((t) => (
                <span>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExerciseMenu
