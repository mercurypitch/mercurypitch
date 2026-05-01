// ============================================================
// VocalChallenges — Practice challenges & achievements
// ============================================================

import type { Component } from 'solid-js'
import { For, createSignal, createMemo, Show } from 'solid-js'

// ============================================================
// SVG Icons
// ============================================================

const IconMicChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="23"/><line x1="8" x2="16" y1="23" y2="23"/></svg>
)

const IconGuitarChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
)

const IconBoltChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
)

const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
)

const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
)

const IconKeyboardChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>
)

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
)

const IconLeaf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
)

const IconFireChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.4.5.7 1.3 1 2.3z"/></svg>
)

const IconRocket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
)

const IconVolume = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
)

const IconMusic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
)

const IconStopwatch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
)

const IconEagle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z"/></svg>
)

const IconDiamond = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="m15 14 3-3"/></svg>
)

const IconStarChallenge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
)

const IconBadge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5.25-3.75 5.25 3.75L14.79 13.9"/></svg>
)

const IconCrown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="m4 7 4-4 4 4"/><path d="m16 7 4-4 4 4"/><path d="M2 19h20"/><path d="M5 15l7 7 7-7"/><path d="M2 13h20"/></svg>
)

const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
)

const IconPaper = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
)

const IconCheck2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
)

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
)

const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
)

const IconWarning = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
)

const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
)

const IconList = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
)

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
          <h2><IconTarget /> Vocal Challenges</h2>
          <p class="challenges-subtitle">
            Complete challenges to earn badges and level up your skills
          </p>
        </div>
        <div class="streak-card">
          <div class="streak-icon"><IconFireChallenge /></div>
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
                  {challenge.status === 'completed' && '<IconCheck2 />'}
                  {challenge.status === 'in-progress' && '<IconRefresh />'}
                  {challenge.status === 'locked' && '<IconLock />'}
                </div>
              </div>

              <div class="challenge-body">
                <h3 class="challenge-title">{challenge.name}</h3>
                <p class="challenge-desc">{challenge.description}</p>

                <div class="challenge-stats">
                  <div class="stat-item">
                    <span class="stat-icon"><IconTarget /></span>
                    <span class="stat-value">{challenge.targetScore}%</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-icon"><IconChart /></span>
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
        <h3 class="section-title"><IconBadge /> Badges Earned</h3>
        <div class="badges-grid">
          <For each={badges()}>
            {(badge) => (
              <div class={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                <div class="badge-icon">{badge.icon}</div>
                <div class="badge-info">
                  <span class="badge-name">{badge.name}</span>
                  <span class="badge-tier">{badge.tier}</span>
                </div>
                {badge.earned && <span class="badge-check"><IconCheck2 /></span>}
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Achievements Section */}
      <div class="achievements-section">
        <h3 class="section-title"><IconStarChallenge /> Achievements</h3>
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
                {ach.unlocked && <span class="achievement-locked"><IconCheck2 /></span>}
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
            alert('<IconSparkle /> Challenge completed! Keep it up!')
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
        <button class="modal-close" onClick={props.onClose}><IconClose /></button>

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
          <h3><IconPaper /> How to Complete</h3>
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
  { id: 'high-notes' as const, name: 'High Notes', icon: IconMicChallenge, count: 3 },
  { id: 'low-notes' as const, name: 'Low Notes', icon: IconGuitarChallenge, count: 2 },
  { id: 'speed' as const, name: 'Speed', icon: IconBoltChallenge, count: 3 },
  { id: 'perfect' as const, name: 'Perfect Pitch', icon: IconTarget, count: 2 },
  { id: 'scales' as const, name: 'Scales', icon: IconMusic, count: 2 },
]

const mockChallenges: ChallengeProgress[] = [
  {
    id: 'c1',
    type: 'high-notes',
    name: 'High Note Hero',
    description: 'Achieve 90%+ accuracy on C5 and higher notes',
    icon: IconMicChallenge,
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
    icon: IconFireChallenge,
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
    icon: IconRocket,
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
    icon: IconGuitarChallenge,
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
    icon: IconVolume,
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
    icon: IconBoltChallenge,
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
    icon: IconStopwatch,
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
    icon: IconEagle,
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
    icon: '<IconTarget />',
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
    icon: IconDiamond,
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
    icon: IconKeyboardChallenge,
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
    icon: IconMoon,
    targetScore: 8,
    currentScore: 3,
    progress: 38,
    status: 'in-progress',
    unlockedDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
]

const mockBadges: UserBadge[] = [
  { id: 'b1', name: 'First Steps', description: 'Complete your first challenge', icon: IconLeaf, tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 10, earned: true },
  { id: 'b2', name: 'On Fire', description: 'Maintain a 7-day practice streak', icon: IconFireChallenge, tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 7, earned: true },
  { id: 'b3', name: 'High & Mighty', description: 'Complete a high note challenge', icon: IconMicChallenge, tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 5, earned: true },
  { id: 'b4', name: 'Speed Demon', description: 'Complete a speed challenge', icon: IconBoltChallenge, tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 3, earned: true },
  { id: 'b5', name: 'Perfect Start', description: 'Complete a perfect pitch challenge', icon: '<IconTarget />', tier: 'silver', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 2, earned: true },
  { id: 'b6', name: 'Scale Scholar', description: 'Complete a scale challenge', icon: IconMusic, tier: 'bronze', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 15, earned: true },
  { id: 'b7', name: 'Streak Master', description: 'Reach a 14-day practice streak', icon: IconCrown, tier: 'gold', earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 14, earned: false },
  { id: 'b8', name: 'All Star', description: 'Complete all bronze badges', icon: IconSparkle, tier: 'gold', earnedDate: 0, earned: false },
]

const mockAchievements: UserAchievement[] = [
  { id: 'a1', name: '10 Notes', description: 'Complete 10 practice sessions', icon: '<IconPaper />', points: 10, unlocked: true, progress: 45, required: 50 },
  { id: 'a2', name: '50 Sessions', description: 'Complete 50 practice sessions', icon: '<IconChart />', points: 25, unlocked: true, progress: 45, required: 50 },
  { id: 'a3', name: '3 Octaves', description: 'Cover 3 octaves in one run', icon: IconKeyboardChallenge, points: 15, unlocked: false, progress: 1, required: 3 },
  { id: 'a4', name: 'High Note Master', description: 'Hit C5 or higher 100 times', icon: IconMicChallenge, points: 30, unlocked: false, progress: 15, required: 100 },
  { id: 'a5', name: 'Perfect Run', description: 'Get 100% accuracy on a run', icon: '<IconTarget />', points: 50, unlocked: false, progress: 0, required: 1 },
  { id: 'a6', name: 'Speed Demon', description: 'Hit 10 notes in 3 seconds', icon: IconBoltChallenge, points: 20, unlocked: false, progress: 2, required: 10 },
  { id: 'a7', name: 'Scale Explorer', description: 'Practice 20 different scales', icon: IconMusic, points: 25, unlocked: false, progress: 8, required: 20 },
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

  alert(`Starting "${challenge.name}"! Good luck! <IconTarget />`)
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================
