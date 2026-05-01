// ============================================================
// VocalChallenges — Practice challenges & achievements
// ============================================================

import type { Component } from 'solid-js'
import { For, createSignal, createMemo, Show } from 'solid-js'

// ============================================================
// Types
// ============================================================

export type ChallengeType = 'high-notes' | 'low-notes' | 'speed' | 'perfect' | 'scales'

export interface ChallengeProgress {
  /** Challenge ID */
  id: string
  /** Challenge type */
  type: ChallengeType
  /** Challenge name */
  name: string
  /** Challenge description */
  description: string
  /** Icon */
  icon: string
  /** Target percentage */
  targetScore: number
  /** Current score */
  currentScore: number
  /** Progress percentage */
  progress: number
  /** Status */
  status: 'not-started' | 'in-progress' | 'completed' | 'locked'
  /** Unlocked date */
  unlockedDate?: number
  /** Completion date */
  completedDate?: number
}

export interface UserBadge {
  /** Badge ID */
  id: string
  /** Badge name */
  name: string
  /** Badge description */
  description: string
  /** Icon */
  icon: string
  /** Tier */
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  /** Earned date */
  earnedDate: number
  /** Is earned */
  earned: boolean
}

export interface UserAchievement {
  /** Achievement ID */
  id: string
  /** Achievement name */
  name: string
  /** Achievement description */
  description: string
  /** Icon */
  icon: string
  /** Points */
  points: number
  /** Is unlocked */
  unlocked: boolean
  /** Unlocked date */
  unlockedDate?: number
  /** Progress */
  progress: number
  /** Total required */
  required: number
}

// ============================================================
// Component
// ============================================================

export const VocalChallenges: Component = () => {
  const [activeCategory, setActiveCategory] = createSignal<ChallengeType>('high-notes')
  const [showChallengeModal, setShowChallengeModal] = createSignal(false)
  const [selectedChallenge, setSelectedChallenge] = createSignal<ChallengeProgress | null>(null)

  // Challenges data (in-memory for demo)
  const challenges = createMemo(() => generateMockChallenges())
  const badges = createMemo(() => generateMockBadges())
  const achievements = createMemo(() => generateMockAchievements())
  const progress = createMemo(() => generateMockProgress())

  // Streak display
  const currentStreak = createMemo(() => {
    return 7
  })

  return (
    <div class="vocal-challenges">
      {/* Header */}
      <div class="challenges-header">
        <div class="challenges-header-content">
          <h2>🎯 Vocal Challenges</h2>
          <p class="challenges-subtitle">
            Complete challenges to earn badges and level up your skills
          </p>
        </div>
        <div class="streak-card">
          <div class="streak-icon">🔥</div>
          <div class="streak-info">
            <span class="streak-label">Current Streak</span>
            <span class="streak-value">{currentStreak()} days</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div class="category-tabs">
        <For each={challengeCategories()}>
          {(cat) => (
            <button
              class={`category-tab ${activeCategory() === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id as ChallengeType)}
              disabled={cat.id === 'scales' && progress()?.find(c => c.id === 'scales')?.status === 'locked'}
            >
              <span class="cat-icon">{cat.icon}</span>
              <span class="cat-name">{cat.name}</span>
              <span class="cat-count">{cat.count}</span>
            </button>
          )}
        </For>
      </div>

      {/* Challenges Grid */}
      <div class="challenges-grid">
        <For each={challenges().filter(c => c.type === activeCategory())}>
          {(challenge) => (
            <div
              class={`challenge-card ${challenge.status}`}
              data-challenge-id={challenge.id}
              data-challenge-type={challenge.type}
            >
              <div class="challenge-header">
                <div class="challenge-icon-large">{challenge.icon}</div>
                <div class="challenge-status">
                  {challenge.status === 'completed' && '✓'}
                  {challenge.status === 'in-progress' && '🔄'}
                  {challenge.status === 'locked' && '🔒'}
                </div>
              </div>

              <div class="challenge-body">
                <h3 class="challenge-title">{challenge.name}</h3>
                <p class="challenge-desc">{challenge.description}</p>

                <div class="challenge-stats">
                  <div class="stat-item">
                    <span class="stat-icon">🎯</span>
                    <span class="stat-value">{challenge.targetScore}%</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-icon">📊</span>
                    <span class="stat-value">{challenge.progress}%</span>
                  </div>
                </div>
              </div>

              <div class="challenge-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style={{
                      width: `${challenge.progress}%`,
                      '--progress-color': getChallengeProgressColor(challenge.progress),
                    }}
                  />
                </div>
                <span class="progress-label">
                  {challenge.progress}% to {challenge.targetScore}%
                </span>
              </div>

              <button
                class={`challenge-action-btn ${challenge.status}`}
                onClick={() => startChallenge(challenge)}
              >
                {challenge.status === 'completed' && 'View Complete'}
                {challenge.status === 'in-progress' && 'Continue'}
                {challenge.status === 'not-started' && 'Start Challenge'}
                {challenge.status === 'locked' && 'Locked'}
              </button>
            </div>
          )}
        </For>
      </div>

      {/* Badges Section */}
      <div class="badges-section">
        <h3 class="section-title">🏅 Badges Earned</h3>
        <div class="badges-grid">
          <For each={badges()}>
            {(badge) => (
              <div class={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                <div class="badge-icon">{badge.icon}</div>
                <div class="badge-info">
                  <span class="badge-name">{badge.name}</span>
                  <span class="badge-tier">{badge.tier}</span>
                </div>
                {badge.earned && <span class="badge-check">✓</span>}
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Achievements Section */}
      <div class="achievements-section">
        <h3 class="section-title">⭐ Achievements</h3>
        <div class="achievements-list">
          <For each={achievements()}>
            {(ach) => (
              <div class={`achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                <div class="achievement-icon">{ach.icon}</div>
                <div class="achievement-content">
                  <div class="achievement-header">
                    <span class="achievement-name">{ach.name}</span>
                    {ach.unlocked && (
                      <span class="achievement-points">+{ach.points} pts</span>
                    )}
                  </div>
                  <p class="achievement-desc">{ach.description}</p>
                  <div class="achievement-progress">
                    <div class="progress-label">
                      <span class="current">{ach.progress}</span>
                      <span class="separator">/</span>
                      <span class="total">{ach.required}</span>
                    </div>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        style={{
                          width: `${(ach.progress / ach.required) * 100}%`,
                          background: getAchievementColor(ach.progress),
                        }}
                      />
                    </div>
                  </div>
                </div>
                {ach.unlocked && <span class="achievement-locked">✓</span>}
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Challenge Modal */}
      <Show when={showChallengeModal() && selectedChallenge()}>
        <ChallengeModal
          challenge={selectedChallenge()!}
          onClose={() => {
            setShowChallengeModal(false)
            setSelectedChallenge(null)
          }}
          onComplete={() => {
            setShowChallengeModal(false)
            setSelectedChallenge(null)
            alert('🎉 Challenge completed! Keep it up!')
          }}
        />
      </Show>
    </div>
  )
}

// ============================================================
// Challenge Modal Component
// ============================================================

interface ChallengeModalProps {
  challenge: ChallengeProgress
  onClose: () => void
  onComplete: () => void
}

const ChallengeModal: Component<ChallengeModalProps> = (props) => {
  return (
    <div class="challenge-modal">
      <div class="modal-backdrop" onClick={props.onClose} />
      <div class="modal-content">
        <button class="modal-close" onClick={props.onClose}>✕</button>

        <div class="modal-header">
          <span class="modal-icon">{props.challenge.icon}</span>
          <div>
            <h2 class="modal-title">{props.challenge.name}</h2>
            <p class="modal-desc">{props.challenge.description}</p>
          </div>
        </div>

        <div class="modal-stats">
          <div class="stat-card">
            <span class="stat-label">Target Score</span>
            <span class="stat-value">{props.challenge.targetScore}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Your Progress</span>
            <span class="stat-value">{props.challenge.progress}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Days Left</span>
            <span class="stat-value">{7 - Math.floor(props.challenge.progress / 15)} days</span>
          </div>
        </div>

        <div class="modal-instructions">
          <h3>📝 How to Complete</h3>
          <ul class="instructions-list">
            <li>Practice the target notes for at least 5 minutes</li>
            <li>Try to achieve {props.challenge.targetScore}% or higher accuracy</li>
            <li>Practice at least 3 sessions this week</li>
            <li>Track your progress in the Analysis tab</li>
          </ul>
        </div>

        <div class="modal-progress-large">
          <div class="progress-bar-large">
            <div
              class="progress-fill-large"
              style={{
                width: `${props.challenge.progress}%`,
                background: getChallengeProgressColor(props.challenge.progress),
              }}
            />
          </div>
          <span class="progress-text-large">{props.challenge.progress}% to {props.challenge.targetScore}%</span>
        </div>

        <div class="modal-actions">
          <button class="modal-btn secondary" onClick={props.onClose}>Cancel</button>
          <button
            class="modal-btn primary"
            disabled={props.challenge.progress >= props.challenge.targetScore}
            onClick={props.onComplete}
          >
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Mock Data
// ============================================================

const challengeCategories = () => [
  { id: 'high-notes' as const, name: 'High Notes', icon: '🎤', count: 3 },
  { id: 'low-notes' as const, name: 'Low Notes', icon: '🎸', count: 2 },
  { id: 'speed' as const, name: 'Speed', icon: '⚡', count: 3 },
  { id: 'perfect' as const, name: 'Perfect Pitch', icon: '🎯', count: 2 },
  { id: 'scales' as const, name: 'Scales', icon: '🎼', count: 2 },
]

const mockChallenges: ChallengeProgress[] = [
  {
    id: 'c1',
    type: 'high-notes',
    name: 'High Note Hero',
    description: 'Achieve 90%+ accuracy on C5 and higher notes',
    icon: '🎤',
    targetScore: 90,
    currentScore: 75,
    progress: 75,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: 'c2',
    type: 'high-notes',
    name: 'Belting Master',
    description: 'Maintain belting range (D4-C5) for 3 consecutive songs',
    icon: '🔥',
    targetScore: 100,
    currentScore: 65,
    progress: 65,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'c3',
    type: 'high-notes',
    name: 'Above It All',
    description: 'Reach F5 at least 5 times in practice sessions',
    icon: '🚀',
    targetScore: 50,
    currentScore: 10,
    progress: 10,
    status: 'not-started',
    unlockedDate: undefined,
  },
  {
    id: 'c4',
    type: 'low-notes',
    name: 'Deep Note King',
    description: 'Achieve 90%+ accuracy on E3 and lower notes',
    icon: '🎸',
    targetScore: 90,
    currentScore: 88,
    progress: 88,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: 'c5',
    type: 'low-notes',
    name: 'Subwoofer Sound',
    description: 'Maintain low register (E2-D4) consistently',
    icon: '🔊',
    targetScore: 100,
    currentScore: 20,
    progress: 20,
    status: 'not-started',
    unlockedDate: undefined,
  },
  {
    id: 'c6',
    type: 'speed',
    name: 'Scale Speedster',
    description: 'Complete a 3-octave scale in under 20 seconds',
    icon: '⚡',
    targetScore: 60,
    currentScore: 30,
    progress: 30,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
  {
    id: 'c7',
    type: 'speed',
    name: 'Rapid Fire',
    description: 'Hit 10 notes in under 3 seconds',
    icon: '⏱️',
    targetScore: 80,
    currentScore: 45,
    progress: 45,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 4,
  },
  {
    id: 'c8',
    type: 'speed',
    name: 'Climbing Eagle',
    description: 'Ascend 2 octaves in under 5 seconds',
    icon: '🦅',
    targetScore: 50,
    currentScore: 5,
    progress: 5,
    status: 'not-started',
    unlockedDate: undefined,
  },
  {
    id: 'c9',
    type: 'perfect',
    name: 'Perfect Pitch Pilot',
    description: 'Hit 100% accuracy in a 10-note sequence',
    icon: '🎯',
    targetScore: 100,
    currentScore: 85,
    progress: 85,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    id: 'c10',
    type: 'perfect',
    name: 'Crystal Clear',
    description: 'Maintain 95%+ clarity across 3 sessions',
    icon: '💎',
    targetScore: 95,
    currentScore: 60,
    progress: 60,
    status: 'not-started',
    unlockedDate: undefined,
  },
  {
    id: 'c11',
    type: 'scales',
    name: 'Major Scale Master',
    description: 'Practice all 12 major scales this month',
    icon: '🎹',
    targetScore: 12,
    currentScore: 5,
    progress: 42,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 8,
  },
  {
    id: 'c12',
    type: 'scales',
    name: 'Minor Scale Sage',
    description: 'Complete 8 minor scale practice sessions',
    icon: '🌙',
    targetScore: 8,
    currentScore: 3,
    progress: 38,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
]

const mockBadges: UserBadge[] = [
  { id: 'b1', name: 'First Steps', description: 'Complete your first challenge', icon: '🌱', tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 10, earned: true },
  { id: 'b2', name: 'On Fire', description: 'Maintain a 7-day practice streak', icon: '🔥', tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 7, earned: true },
  { id: 'b3', name: 'High & Mighty', description: 'Complete a high note challenge', icon: '🎤', tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 5, earned: true },
  { id: 'b4', name: 'Speed Demon', description: 'Complete a speed challenge', icon: '⚡', tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 3, earned: true },
  { id: 'b5', name: 'Perfect Start', description: 'Complete a perfect pitch challenge', icon: '🎯', tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 2, earned: true },
  { id: 'b6', name: 'Scale Scholar', description: 'Complete a scale challenge', icon: '🎼', tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 15, earned: true },
  { id: 'b7', name: 'Streak Master', description: 'Reach a 14-day practice streak', icon: '👑', tier: 'gold', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 14, earned: false },
  { id: 'b8', name: 'All Star', description: 'Complete all bronze badges', icon: '🌟', tier: 'gold', earnedDate: 0, earned: false },
]

const mockAchievements: UserAchievement[] = [
  { id: 'a1', name: '10 Notes', description: 'Complete 10 practice sessions', icon: '📝', points: 10, unlocked: true, progress: 45, required: 50 },
  { id: 'a2', name: '50 Sessions', description: 'Complete 50 practice sessions', icon: '📊', points: 25, unlocked: true, progress: 45, required: 50 },
  { id: 'a3', name: '3 Octaves', description: 'Cover 3 octaves in one run', icon: '🎹', points: 15, unlocked: false, progress: 1, required: 3 },
  { id: 'a4', name: 'High Note Master', description: 'Hit C5 or higher 100 times', icon: '🎤', points: 30, unlocked: false, progress: 15, required: 100 },
  { id: 'a5', name: 'Perfect Run', description: 'Get 100% accuracy on a run', icon: '🎯', points: 50, unlocked: false, progress: 0, required: 1 },
  { id: 'a6', name: 'Speed Demon', description: 'Hit 10 notes in 3 seconds', icon: '⚡', points: 20, unlocked: false, progress: 2, required: 10 },
  { id: 'a7', name: 'Scale Explorer', description: 'Practice 20 different scales', icon: '🎼', points: 25, unlocked: false, progress: 8, required: 20 },
]

function generateMockChallenges(): ChallengeProgress[] {
  return mockChallenges
}

function generateMockBadges(): UserBadge[] {
  return mockBadges
}

function generateMockAchievements(): UserAchievement[] {
  return mockAchievements
}

function generateMockProgress(): ChallengeProgress[] {
  return mockChallenges
}

function getChallengeProgressColor(progress: number): string {
  if (progress >= 100) return 'var(--green)'
  if (progress >= 75) return 'var(--accent)'
  if (progress >= 50) return 'var(--teal)'
  if (progress >= 25) return 'var(--yellow)'
  return 'var(--red)'
}

function getAchievementColor(progress: number): string {
  if (progress >= 100) return 'var(--green)'
  if (progress >= 75) return 'var(--accent)'
  return 'var(--teal)'
}

function startChallenge(challenge: ChallengeProgress) {
  if (challenge.status === 'completed') {
    alert('Challenge already completed! View your progress.')
    return
  }

  if (challenge.status === 'in-progress') {
    alert('Continue practicing to increase your progress!')
    return
  }

  alert(`Starting "${challenge.name}"! Good luck! 🎯`)
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================
