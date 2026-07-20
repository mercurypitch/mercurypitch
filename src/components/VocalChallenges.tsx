// ============================================================
// VocalChallenges — Practice challenges & achievements
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { IconArrowUpDown, IconExpand, IconLayers, IconReply, IconSiren, IconZap, } from '@/components/exercise-icons'
import modalStyles from '@/components/Modal.module.css'
import type { Achievement as DBAchievement, BadgeDefinition as DBBadgeDefinition, ChallengeCategory, ChallengeDefinition as DBChallengeDefinition, ChallengeProgress as DBChallengeProgress, UserAchievement as DBUserAchievement, UserBadge as DBUserBadge, } from '@/db/entities'
import { loadAchievementDefinitions, loadBadgeDefinitions, loadChallengeDefinitions, loadChallengeProgress, loadUserAchievements, loadUserBadges, } from '@/db/services/challenges-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { authVersion } from '@/db/services/user-service'
import { beginChallengeAttempt, challengeAttemptVersion, } from '@/features/challenges/challenge-attempt'
import { generateChallengeDrill } from '@/features/challenges/challenge-drill-generator'
import { WeeklyLegendHero } from '@/features/challenges/WeeklyLegendHero'
import { launchDrill } from '@/stores/ui-store'
import { IconBadge, IconBoltChallenge, iconByName, IconChart, IconCheckSolid, IconCloseSimple, IconFireChallenge, IconGuitarChallenge, IconLeaf, IconMicChallenge, IconMusicChallenge, IconPaper, IconRefreshSimple, IconStarChallenge, IconTarget, renderIcon, } from './hidden-features-icons'

// (SVG icons imported from ./hidden-features-icons)

// ============================================================
// Types
// ============================================================

// One shared category vocabulary: the UI tabs use the DB's challenge
// categories directly, so a new category is a seed-data + constants change,
// never a type drift (6 UI-only tabs used to render permanently empty).
export type ChallengeType = ChallengeCategory

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
  icon: Component | string
  /** Target percentage */
  targetScore: number
  /** Score of the latest attempt */
  currentScore: number
  /** Best score across attempts */
  bestScore: number
  /** Attempts recorded so far */
  attempts: number
  /** Progress percentage (best score, 0-100) */
  progress: number
  /** Status */
  status: 'not-started' | 'in-progress' | 'completed'
  /** Completion date */
  completedDate?: number
  /** Badge (id or name) granted on completion */
  rewardBadgeId?: string
  /** Difficulty — beginner challenges get a gentler drill note set */
  difficulty: string
}

export interface UserBadge {
  /** Badge ID */
  id: string
  /** Badge name */
  name: string
  /** Badge description */
  description: string
  /** Icon */
  icon: Component | string
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
  icon: Component | string
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

const [showChallengeModal, setShowChallengeModal] = createSignal(false)
const [selectedChallenge, setSelectedChallenge] =
  createSignal<ChallengeProgress | null>(null)

/**
 * Arm the challenge attempt context and launch its drill. The drill's score
 * comes back through the exercise-history store → challenge-attempt return
 * path, which records the attempt and completes the challenge when the
 * target is met — there is no manual "update progress" step.
 */
function startChallengeDrill(challenge: ChallengeProgress): void {
  const drill = generateChallengeDrill(
    challenge.type,
    challenge.name,
    challenge.difficulty,
  )
  beginChallengeAttempt({
    challengeId: challenge.id,
    title: challenge.name,
    category: challenge.type,
    exercise: drill.exercise,
    targetScore: challenge.targetScore,
    rewardBadgeId: challenge.rewardBadgeId,
  })
  launchDrill({
    exercise: drill.exercise,
    notes: drill.notes,
    challengeName: drill.challengeName,
  })
}

export const VocalChallenges: Component = () => {
  const [activeCategory, setActiveCategory] =
    createSignal<ChallengeType>('basics')

  // Open the challenge detail modal (stats + drill launch).
  function handleStartChallenge(challenge: ChallengeProgress) {
    setSelectedChallenge(challenge)
    setShowChallengeModal(true)
  }

  // DB-backed data signals
  const [dbChallengeDefs, setDbChallengeDefs] = createSignal<
    DBChallengeDefinition[]
  >([])
  const [dbChallengeProg, setDbChallengeProg] = createSignal<
    DBChallengeProgress[]
  >([])
  const [dbBadgeDefs, setDbBadgeDefs] = createSignal<DBBadgeDefinition[]>([])
  const [dbUserBadges, setDbUserBadges] = createSignal<DBUserBadge[]>([])
  const [dbAchievementDefs, setDbAchievementDefs] = createSignal<
    DBAchievement[]
  >([])
  const [dbUserAchievements, setDbUserAchievements] = createSignal<
    DBUserAchievement[]
  >([])

  // Streak display — same source as the badge engine and leaderboard
  // (streak-service), not a local reimplementation.
  const [currentStreak, setCurrentStreak] = createSignal(0)

  // Load data from DB; reloads when the signed-in identity changes and
  // after every recorded challenge attempt (drill scores land while the
  // user is on the Exercises tab).
  createEffect(() => {
    authVersion()
    challengeAttemptVersion()
    void (async () => {
      const [defs, prog, badgeDefs, userBadges, achDefs, userAchs, streak] =
        await Promise.all([
          loadChallengeDefinitions(),
          loadChallengeProgress(),
          loadBadgeDefinitions(),
          loadUserBadges(),
          loadAchievementDefinitions(),
          loadUserAchievements(),
          getCurrentStreak(),
        ])
      setDbChallengeDefs(defs)
      setDbChallengeProg(prog)
      setDbBadgeDefs(badgeDefs)
      setDbUserBadges(userBadges)
      setDbAchievementDefs(achDefs)
      setDbUserAchievements(userAchs)
      setCurrentStreak(streak)
    })()
  })

  // Map icon name strings (from DB) to SVG components
  function iconForName(name: string): Component | string {
    return iconByName(name)
  }

  function mapDbStatus(status: string): ChallengeProgress['status'] {
    if (status === 'completed') return 'completed'
    if (status === 'active') return 'in-progress'
    return 'not-started'
  }

  // Challenges data (definitions merged with the user's real progress)
  function getChallengesForCategory(
    category: ChallengeType,
  ): ChallengeProgress[] {
    return dbChallengeDefs()
      .filter((d) => d.category === category)
      .map((d) => {
        const dbProg = dbChallengeProg().find((p) => p.challengeId === d.id)
        return {
          id: d.id,
          type: d.category,
          name: d.title,
          description: d.description,
          icon: iconForName(d.icon),
          targetScore: d.targetScore,
          currentScore: dbProg?.currentScore ?? 0,
          bestScore: dbProg?.bestScore ?? 0,
          attempts: dbProg?.attempts ?? 0,
          progress: dbProg?.progress ?? 0,
          status: dbProg ? mapDbStatus(dbProg.status) : 'not-started',
          completedDate:
            dbProg?.completedAt !== undefined
              ? new Date(dbProg.completedAt).getTime()
              : undefined,
          rewardBadgeId: d.rewardBadgeId,
          difficulty: d.difficulty,
        }
      })
  }

  // Get filtered challenges with real progress
  const challenges = createMemo(() =>
    getChallengesForCategory(activeCategory()),
  )

  // User badges — earned state comes from the grant engine's records only.
  function getBadges(): UserBadge[] {
    return dbBadgeDefs().map((def) => {
      const userBadge = dbUserBadges().find((ub) => ub.badgeId === def.id)
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: iconForName(def.icon),
        tier: def.tier,
        earned: !!userBadge,
        earnedDate: userBadge ? new Date(userBadge.earnedAt).getTime() : 0,
      }
    })
  }

  // User achievements — progress/unlocked come from the grant engine only.
  function getAchievements(): UserAchievement[] {
    return dbAchievementDefs().map((def) => {
      const userAch = dbUserAchievements().find(
        (ua) => ua.achievementId === def.id,
      )
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: iconForName(def.icon),
        points: def.points,
        unlocked: userAch?.unlocked ?? false,
        unlockedDate:
          userAch?.unlockedAt !== undefined
            ? new Date(userAch.unlockedAt).getTime()
            : undefined,
        progress: userAch?.progress ?? 0,
        required: def.required,
      }
    })
  }

  const badges = createMemo(() => getBadges())
  const achievements = createMemo(() => getAchievements())

  // Category tabs with real definition counts (no hardcoded numbers, no
  // fake locks — every category has seeded, drill-backed content).
  const categories = createMemo(() =>
    CHALLENGE_CATEGORIES.map((cat) => ({
      ...cat,
      count: dbChallengeDefs().filter((d) => d.category === cat.id).length,
    })),
  )

  return (
    <div class="vocal-challenges">
      {/* Header */}
      <div class="challenges-header">
        <div class="challenges-header-content">
          <h2>
            <IconTarget /> Vocal Challenges
          </h2>
          <p class="challenges-subtitle">
            Complete challenges to earn badges and level up your skills
          </p>
        </div>
        <div class="streak-card">
          <div class="streak-icon">
            <IconFireChallenge />
          </div>
          <div class="streak-info">
            <span class="streak-label">Current Streak</span>
            <span class="streak-value">{currentStreak()} days</span>
          </div>
        </div>
      </div>

      {/* Featured: the community weekly challenge — same card as Home, so it's
          discoverable here in the challenges hub too. Renders its own
          "coming soon" state when there is no active Legend. */}
      <div class="challenges-weekly">
        <WeeklyLegendHero />
      </div>

      {/* Category Tabs */}
      <div class="category-tabs">
        <For each={categories()}>
          {(cat) => (
            <button
              class={`category-tab ${activeCategory() === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span class="cat-icon">{renderIcon(cat.icon)}</span>
              <span class="cat-name">{cat.name}</span>
              <span class="cat-count">{cat.count}</span>
            </button>
          )}
        </For>
      </div>

      {/* Challenges Grid */}
      <div class="challenges-grid">
        <For each={challenges()}>
          {(challenge) => (
            <div
              class={`challenge-card ${challenge.status}`}
              data-challenge-id={challenge.id}
              data-challenge-type={challenge.type}
            >
              <div class="challenge-header">
                <div class="challenge-icon-large">
                  {renderIcon(challenge.icon)}
                </div>
                <div class="challenge-status">
                  {challenge.status === 'completed' && <IconCheckSolid />}
                  {challenge.status === 'in-progress' && <IconRefreshSimple />}
                </div>
              </div>

              <div class="challenge-body">
                <h3 class="challenge-title">{challenge.name}</h3>
                <p class="challenge-desc">{challenge.description}</p>

                <div class="challenge-stats">
                  <div class="stat-item" title="Target score">
                    <span class="stat-icon">
                      <IconTarget />
                    </span>
                    <span class="stat-value">{challenge.targetScore}%</span>
                  </div>
                  <div class="stat-item" title="Best score">
                    <span class="stat-icon">
                      <IconChart />
                    </span>
                    <span class="stat-value">{challenge.bestScore}%</span>
                  </div>
                </div>
              </div>

              <div class="challenge-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style={{
                      width: `${challenge.progress}%`,
                      '--progress-color': getChallengeProgressColor(
                        challenge.progress,
                      ),
                    }}
                  />
                </div>
                <span class="progress-label">
                  {challenge.status === 'completed'
                    ? `Completed — best ${challenge.bestScore}%`
                    : `Best ${challenge.bestScore}% of ${challenge.targetScore}% target`}
                </span>
              </div>

              <button
                class={`challenge-action-btn ${challenge.status}`}
                onClick={() => handleStartChallenge(challenge)}
              >
                {challenge.status === 'completed' && 'View Details'}
                {challenge.status === 'in-progress' && 'Continue'}
                {challenge.status === 'not-started' && 'Start Challenge'}
              </button>

              <button
                class="challenge-practice-btn"
                onClick={() => startChallengeDrill(challenge)}
                title={
                  generateChallengeDrill(
                    challenge.type,
                    challenge.name,
                    challenge.difficulty,
                  ).tip
                }
              >
                Practice
              </button>
            </div>
          )}
        </For>
      </div>

      {/* Badges Section */}
      <div class="badges-section">
        <h3 class="section-title">
          <IconBadge /> Badges Earned
        </h3>
        <div class="badges-grid">
          <For each={badges()}>
            {(badge) => (
              <div class={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                <div class="badge-icon">{renderIcon(badge.icon)}</div>
                <div class="badge-info">
                  <span class="badge-name">{badge.name}</span>
                  <span class="badge-tier">{badge.tier}</span>
                </div>
                {badge.earned && (
                  <span class="badge-check">
                    <IconCheckSolid />
                  </span>
                )}
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Achievements Section */}
      <div class="achievements-section">
        <h3 class="section-title">
          <IconStarChallenge /> Achievements
        </h3>
        <div class="achievements-list">
          <For each={achievements()}>
            {(ach) => (
              <div
                class={`achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`}
              >
                <div class="achievement-icon">{renderIcon(ach.icon)}</div>
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
                {ach.unlocked && (
                  <span class="achievement-locked">
                    <IconCheckSolid />
                  </span>
                )}
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
}

const ChallengeModal: Component<ChallengeModalProps> = (props) => {
  const drillTip = () =>
    generateChallengeDrill(
      props.challenge.type,
      props.challenge.name,
      props.challenge.difficulty,
    ).tip

  return (
    <div class="challenge-modal">
      <div class="modal-backdrop" onClick={() => props.onClose?.()} />
      <div class={modalStyles.modalContent}>
        <button
          class={modalStyles.modalClose}
          onClick={() => props.onClose?.()}
        >
          <IconCloseSimple />
        </button>

        <div class={modalStyles.modalHeader}>
          <span class="modal-icon">{renderIcon(props.challenge.icon)}</span>
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
            <span class="stat-label">Best Score</span>
            <span class="stat-value">{props.challenge.bestScore}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Attempts</span>
            <span class="stat-value">{props.challenge.attempts}</span>
          </div>
        </div>

        <div class="modal-instructions">
          <h3>
            <IconPaper /> How to Complete
          </h3>
          <Show
            when={props.challenge.status !== 'completed'}
            fallback={
              <ul class="instructions-list">
                <li>
                  Completed
                  {props.challenge.completedDate !== undefined
                    ? ` on ${new Date(props.challenge.completedDate).toLocaleDateString()}`
                    : ''}{' '}
                  with a best score of {props.challenge.bestScore}%
                </li>
                <li>Run the drill again any time to beat your best</li>
              </ul>
            }
          >
            <ul class="instructions-list">
              <li>
                Press <strong>Practice Drill</strong> to launch the matching
                exercise — its score is recorded as an attempt automatically
              </li>
              <li>
                Score {props.challenge.targetScore}% or higher on a single run
                to complete the challenge
              </li>
              <li>Retry as often as you like — your best score is kept</li>
              <li>{drillTip()}</li>
            </ul>
          </Show>
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
          <span class="progress-text-large">
            {props.challenge.status === 'completed'
              ? `Completed — best ${props.challenge.bestScore}%`
              : `Best ${props.challenge.bestScore}% of ${props.challenge.targetScore}% target`}
          </span>
        </div>

        <div class="modal-actions">
          <button class="modal-btn secondary" onClick={() => props.onClose()}>
            Close
          </button>
          <button
            class="modal-btn primary"
            onClick={() => {
              startChallengeDrill(props.challenge)
              props.onClose()
            }}
          >
            Practice Drill
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Category catalog (counts come from the seeded definitions)
// ============================================================

const CHALLENGE_CATEGORIES: ReadonlyArray<{
  id: ChallengeType
  name: string
  icon: Component
}> = [
  { id: 'basics', name: 'Basics', icon: IconLeaf },
  { id: 'high-notes', name: 'High Notes', icon: IconMicChallenge },
  { id: 'low-notes', name: 'Low Notes', icon: IconGuitarChallenge },
  { id: 'speed', name: 'Speed', icon: IconBoltChallenge },
  { id: 'perfect', name: 'Perfect Pitch', icon: IconTarget },
  { id: 'scales', name: 'Scales', icon: IconMusicChallenge },
  { id: 'intervals', name: 'Intervals', icon: IconArrowUpDown },
  { id: 'harmony', name: 'Harmony', icon: IconLayers },
  { id: 'agility', name: 'Agility', icon: IconZap },
  { id: 'range', name: 'Range', icon: IconSiren },
  { id: 'dynamic', name: 'Dynamics', icon: IconExpand },
  { id: 'call-response', name: 'Call & Response', icon: IconReply },
]

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

// ============================================================
// CSS Styles (inline for this component)
// ============================================================
