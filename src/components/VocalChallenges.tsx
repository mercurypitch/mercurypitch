// ============================================================
// VocalChallenges — Practice challenges & achievements
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { Achievement as DBAchievement, BadgeDefinition as DBBadgeDefinition, ChallengeDefinition as DBChallengeDefinition, ChallengeProgress as DBChallengeProgress, UserAchievement as DBUserAchievement, UserBadge as DBUserBadge, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { loadAchievementDefinitions, loadBadgeDefinitions, loadChallengeDefinitions, loadChallengeProgress, loadUserAchievements, loadUserBadges, saveChallengeProgress, } from '@/db/services/challenges-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import { storageGet, storageRemove, storageSet } from '@/lib/storage'
import { getSessionHistory } from '@/stores'
import { setActiveTab } from '@/stores/ui-store'
import { IconBadge, IconBoltChallenge, iconByName, IconChart, IconCheckSolid, IconCloseSimple, IconCrown, IconDiamond, IconEagle, IconFireChallenge, IconGuitarChallenge, IconKeyboardChallenge, IconLeaf, IconLockSimple, IconMicChallenge, IconMoon, IconMusicChallenge, IconPaper, IconRefreshSimple, IconRocket, IconSparkle, IconStarChallenge, IconStopwatch, IconTarget, IconVolume, renderIcon, } from './hidden-features-icons'

// (SVG icons imported from ./hidden-features-icons)

// ============================================================
// Types
// ============================================================

export type ChallengeType =
  | 'high-notes'
  | 'low-notes'
  | 'speed'
  | 'perfect'
  | 'scales'

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
  /** Array of actual scores achieved */
  actualScores?: number[]
}

export interface UserChallengeProgress {
  [challengeId: string]: ChallengeProgress
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
// ============================================================
// Component
// ============================================================

// Export signals and functions for use in other components
export const [showChallengeModal, setShowChallengeModal] = createSignal(false)
export const [selectedChallenge, setSelectedChallenge] =
  createSignal<ChallengeProgress | null>(null)

interface ResultModalState {
  title: string
  message: string
  icon: () => JSX.Element
  actionLabel?: string
  onAction?: () => void
}

const [resultModal, setResultModal] = createSignal<ResultModalState | null>(
  null,
)

export const VocalChallenges: Component = () => {
  const [activeCategory, setActiveCategory] =
    createSignal<ChallengeType>('high-notes')

  // Update challenge progress (also saves to DB)
  function updateChallengeProgress(
    challengeId: string,
    score: number,
    completed: boolean,
  ) {
    const progress: UserChallengeProgress = userProgress() ?? {}
    const progressKey = `ch-${challengeId}`
    const saved = progress[progressKey] ?? {
      id: challengeId,
      type: challengeId.substring(0, challengeId.indexOf('-')) as ChallengeType,
      name: challengeId,
      description: `Challenge progress for ${challengeId}`,
      icon: IconMicChallenge,
      targetScore: 100,
      currentScore: 0,
      progress: 0,
      status: 'not-started' as const,
      unlockedDate: undefined,
      completedDate: undefined,
      actualScores: [],
    }

    saved.currentScore = score
    saved.progress = Math.min(100, score)
    ;(saved.actualScores || []).push(score)

    if (completed) {
      saved.status = 'completed'
      saved.completedDate = Date.now()
      if (saved.unlockedDate === undefined) {
        saved.unlockedDate = Date.now()
      }
    } else if (score >= 80) {
      saved.status = 'in-progress'
      if (saved.unlockedDate === undefined) {
        saved.unlockedDate = Date.now()
      }
    } else if (score >= 50) {
      saved.status = 'in-progress'
    }

    progress[progressKey] = saved
    saveProgress(progress)

    // Also save to DB
    const def = dbChallengeDefs().find((d) => d.id === challengeId)
    if (def) {
      saveChallengeProgress({
        userId: getUserId(),
        challengeId,
        progress: saved.progress,
        currentScore: saved.currentScore,
        bestScore: Math.max(...(saved.actualScores ?? [saved.currentScore])),
        status: saved.status === 'completed' ? 'completed' : 'active',
        completed: saved.status === 'completed',
        attempts: saved.actualScores?.length ?? 1,
      })
    }
  }

  // Start challenge handler
  function handleStartChallenge(challenge: ChallengeProgress) {
    const sessions = getSessionHistory()

    if (challenge.status === 'completed') {
      const completedScore = challenge.actualScores?.[0] ?? 0
      setResultModal({
        title: 'Challenge Completed!',
        message: `"${challenge.name}" was completed with a score of ${completedScore}%. ${challenge.actualScores?.length ?? 1} session(s) played.`,
        icon: () => <IconSparkle />,
        actionLabel: 'Close',
      })
      return
    }

    if (challenge.status === 'in-progress') {
      const scores = challenge.actualScores || []
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0
      setResultModal({
        title: 'Continue Challenge',
        message: `"${challenge.name}" is in progress. Current average: ${avgScore}% (${challenge.actualScores?.length ?? 0} session(s)).`,
        icon: () => <IconRefreshSimple />,
        actionLabel: 'Continue Practice',
        onAction: () => {
          setSelectedChallenge(challenge)
          setShowChallengeModal(true)
        },
      })
      return
    }

    // Get recent session scores to pre-fill progress
    const recentSessions = sessions.slice(-3)
    const sessionScores = recentSessions.map((s) => s.score || 0)
    const avgScore =
      sessionScores.length > 0
        ? Math.round(
            sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length,
          )
        : 0

    setResultModal({
      title: challenge.name,
      message: `Your recent average score: ${avgScore}%. Start this challenge?`,
      icon: () => renderIcon(challenge.icon),
      actionLabel: 'Start',
      onAction: () => {
        setSelectedChallenge(challenge)
        setShowChallengeModal(true)
      },
    })
  }

  // Load session history for real progress tracking
  const sessionHistory = createMemo(() => getSessionHistory())

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

  // Challenge progress stored in localStorage (legacy fallback)
  const [userProgress, setUserProgress] =
    createSignal<UserChallengeProgress | null>(null)

  // Streak display (derived from real session history)
  const currentStreak = createMemo(() => {
    const sessions = sessionHistory()
    const scores = sessions.filter((s) => s.score !== undefined && s.score > 70)
    if (scores.length === 0) return 0
    return calculateStreak(scores.map((s) => s.completedAt || 0))
  })

  // Load data from DB (with legacy localStorage fallback)
  onMount(() => {
    void (async () => {
      // Load challenge definitions & progress from DB
      const [defs, prog, badgeDefs, userBadges, achDefs, userAchs] =
        await Promise.all([
          loadChallengeDefinitions(),
          loadChallengeProgress(),
          loadBadgeDefinitions(),
          loadUserBadges(),
          loadAchievementDefinitions(),
          loadUserAchievements(),
        ])
      setDbChallengeDefs(defs)
      setDbChallengeProg(prog)
      setDbBadgeDefs(badgeDefs)
      setDbUserBadges(userBadges)
      setDbAchievementDefs(achDefs)
      setDbUserAchievements(userAchs)

      // Legacy localStorage fallback
      const stored = storageGet<UserChallengeProgress>('pp_challenge_progress')
      if (stored !== null) {
        setUserProgress(stored)
      }
    })()
  })

  // Save user progress to localStorage + DB
  const saveProgress = (progress: UserChallengeProgress | null) => {
    setUserProgress(progress)
    if (progress) {
      storageSet('pp_challenge_progress', progress)
    } else {
      storageRemove('pp_challenge_progress')
    }
  }

  // Calculate streak from array of timestamps
  function calculateStreak(dates: number[]): number {
    if (dates.length === 0) return 0

    const sorted = [...dates].sort((a, b) => b - a)
    const today = new Date().setHours(0, 0, 0, 0)
    const oneDay = 24 * 60 * 60 * 1000

    let streak = 0
    let currentDate = today

    for (const date of sorted) {
      if (date >= currentDate - oneDay) {
        streak++
        currentDate -= oneDay
      } else {
        break
      }
    }

    return streak
  }

  // Map icon name strings (from DB) to SVG components
  function iconForName(name: string): Component | string {
    return iconByName(name)
  }

  function mapDbStatus(status: string): ChallengeProgress['status'] {
    if (status === 'completed') return 'completed'
    if (status === 'active') return 'in-progress'
    return 'not-started'
  }

  // Challenges data (merged with real progress)
  function getChallengesForCategory(
    category: ChallengeType,
  ): ChallengeProgress[] {
    const defs = dbChallengeDefs()
    const progress = userProgress()

    if (defs.length > 0) {
      return defs
        .filter((d) => d.category === category)
        .map((d) => {
          const dbProg = dbChallengeProg().find((p) => p.challengeId === d.id)
          const localProg = progress?.[`ch-${d.id}`]
          return {
            id: d.id,
            type: d.category,
            name: d.title,
            description: d.description,
            icon: iconForName(d.icon),
            targetScore: d.targetScore,
            currentScore: dbProg?.currentScore ?? localProg?.currentScore ?? 0,
            progress: dbProg?.progress ?? localProg?.progress ?? 0,
            status: dbProg
              ? mapDbStatus(dbProg.status)
              : (localProg?.status ?? 'not-started'),
            unlockedDate: localProg?.unlockedDate,
            completedDate: localProg?.completedDate,
            actualScores: localProg?.actualScores ?? [],
          }
        })
    }

    // Fall back to mock data, merged with localStorage progress
    let challenges: ChallengeProgress[] = []
    switch (category) {
      case 'high-notes':
        challenges = mockChallenges.filter((c) => c.type === 'high-notes')
        break
      case 'low-notes':
        challenges = mockChallenges.filter((c) => c.type === 'low-notes')
        break
      case 'speed':
        challenges = mockChallenges.filter((c) => c.type === 'speed')
        break
      case 'perfect':
        challenges = mockChallenges.filter((c) => c.type === 'perfect')
        break
      case 'scales':
        challenges = mockChallenges.filter((c) => c.type === 'scales')
        break
    }

    return challenges.map((c) => {
      const storedProgress = (progress || {})[`ch-${c.id}`]
      if (storedProgress !== undefined) return storedProgress
      return c
    })
  }

  // Get filtered challenges with real progress
  const challenges = createMemo(() =>
    getChallengesForCategory(activeCategory()),
  )

  // Calculate user badges (DB-backed with mock fallback)
  function getBadges(): UserBadge[] {
    const badgeDefs = dbBadgeDefs()
    if (badgeDefs.length > 0) {
      return badgeDefs.map((def) => {
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

    // Fall back to mock data with session-based computation
    const sessions = sessionHistory()
    const totalSessions = sessions.length
    const bestScore =
      sessions.length > 0 ? Math.max(...sessions.map((s) => s.score || 0)) : 0
    const avgScore =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
        : 0
    const streak = calculateStreak(sessions.map((s) => s.completedAt || 0))

    return mockBadges.map((badge) => {
      let earned = false
      let earnedDate: number

      switch (badge.id) {
        case 'b1':
          earned = totalSessions > 0
          earnedDate =
            totalSessions > 0
              ? (sessions[0].completedAt ?? Date.now())
              : Date.now()
          break
        case 'b2':
          earned = streak >= 7
          earnedDate =
            streak >= 7 ? Date.now() - streak * 24 * 60 * 60 * 1000 : Date.now()
          break
        case 'b3':
          earned = bestScore >= 90
          earnedDate = bestScore >= 90 ? Date.now() : Date.now()
          break
        case 'b4':
          earned = bestScore >= 95
          earnedDate = bestScore >= 95 ? Date.now() : Date.now()
          break
        case 'b5':
          earned = avgScore >= 90
          earnedDate = avgScore >= 90 ? Date.now() : Date.now()
          break
        case 'b6':
          earned = totalSessions >= 10
          earnedDate =
            totalSessions >= 10
              ? (sessions[0].completedAt ?? Date.now())
              : Date.now()
          break
        case 'b7':
          earned = streak >= 14
          earnedDate =
            streak >= 14
              ? Date.now() - streak * 24 * 60 * 60 * 1000
              : Date.now()
          break
        default:
          earned = false
          earnedDate = Date.now()
      }

      return {
        ...badge,
        earned,
        earnedDate,
      }
    })
  }

  // Calculate user achievements (DB-backed with mock fallback)
  function getAchievements(): UserAchievement[] {
    const achDefs = dbAchievementDefs()
    if (achDefs.length > 0) {
      return achDefs.map((def) => {
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

    // Fall back to mock data with session-based computation
    const sessions = sessionHistory()
    const totalSessions = sessions.length
    const bestScore =
      sessions.length > 0 ? Math.max(...sessions.map((s) => s.score || 0)) : 0
    const avgScore =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
        : 0

    // Track high note completions
    let highNoteCount = 0
    sessions.forEach((session) => {
      if (session.practiceItemResult !== undefined) {
        session.practiceItemResult.forEach((item) => {
          if (item.noteResult !== undefined) {
            item.noteResult.forEach((note) => {
              if (note.pitchFreq > 880 && note.rating === 'perfect') {
                highNoteCount++
              }
            })
          }
        })
      }
    })

    return mockAchievements.map((ach) => {
      let unlocked = false
      let progress = 0

      switch (ach.id) {
        case 'a1':
          progress = totalSessions
          unlocked = totalSessions >= 10
          break
        case 'a2':
          progress = totalSessions
          unlocked = totalSessions >= 50
          break
        case 'a3':
          progress = Math.min(highNoteCount / 10, 3)
          unlocked = highNoteCount >= 30
          break
        case 'a4':
          progress = highNoteCount
          unlocked = highNoteCount >= 100
          break
        case 'a5':
          progress = bestScore
          unlocked = bestScore >= 100
          break
        case 'a6':
          progress = Math.min(avgScore, 10)
          unlocked = avgScore >= 95 && totalSessions >= 5
          break
        case 'a7':
          progress = Math.min(totalSessions / 2, 20)
          unlocked = totalSessions >= 40
          break
      }

      return {
        ...ach,
        unlocked,
        progress,
        required: ach.required,
      }
    })
  }

  const badges = createMemo(() => getBadges())
  const achievements = createMemo(() => getAchievements())

  // Check if category is locked based on actual progress
  const isCategoryLocked = (categoryId: string): boolean => {
    if (categoryId === 'scales') {
      return challenges().filter((c) => c.type === 'scales').length === 0
    }
    return false
  }

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

      {/* Category Tabs */}
      <div class="category-tabs">
        <For each={challengeCategories()}>
          {(cat) => {
            const locked = isCategoryLocked(cat.id)
            return (
              <button
                class={`category-tab ${activeCategory() === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id as ChallengeType)}
                disabled={locked}
              >
                <span class="cat-icon">{renderIcon(cat.icon)}</span>
                <span class="cat-name">{cat.name}</span>
                <span class="cat-count">{cat.count}</span>
                {locked && (
                  <span class="cat-locked">
                    <IconLockSimple />
                  </span>
                )}
              </button>
            )
          }}
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
                  {challenge.status === 'locked' && <IconLockSimple />}
                </div>
              </div>

              <div class="challenge-body">
                <h3 class="challenge-title">{challenge.name}</h3>
                <p class="challenge-desc">{challenge.description}</p>

                <div class="challenge-stats">
                  <div class="stat-item">
                    <span class="stat-icon">
                      <IconTarget />
                    </span>
                    <span class="stat-value">{challenge.targetScore}%</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-icon">
                      <IconChart />
                    </span>
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
                      '--progress-color': getChallengeProgressColor(
                        challenge.progress,
                      ),
                    }}
                  />
                </div>
                <span class="progress-label">
                  {challenge.progress}% to {challenge.targetScore}%
                </span>
              </div>

              <button
                class={`challenge-action-btn ${challenge.status}`}
                onClick={() => handleStartChallenge(challenge)}
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
          updateProgress={updateChallengeProgress}
          onClose={() => {
            setShowChallengeModal(false)
            setSelectedChallenge(null)
          }}
          onComplete={() => {
            setShowChallengeModal(false)
            setSelectedChallenge(null)
            setResultModal({
              title: 'Challenge Completed!',
              message: 'Great job! Keep it up!',
              icon: () => <IconSparkle />,
              actionLabel: 'Close',
            })
          }}
        />
      </Show>

      {/* Result Modal */}
      <Show when={resultModal()}>
        <div class="challenge-modal">
          <div class="modal-backdrop" onClick={() => setResultModal(null)} />
          <div class="modal-content">
            <button class="modal-close" onClick={() => setResultModal(null)}>
              <IconCloseSimple />
            </button>
            <div class="modal-header">
              <span class="modal-icon">{resultModal()!.icon()}</span>
              <h2 class="modal-title">{resultModal()!.title}</h2>
              <p class="modal-desc">{resultModal()!.message}</p>
            </div>
            <div class="modal-actions">
              {resultModal()!.onAction && (
                <button
                  class="modal-btn primary"
                  onClick={() => {
                    resultModal()!.onAction!()
                    setResultModal(null)
                  }}
                >
                  {resultModal()!.actionLabel ?? 'OK'}
                </button>
              )}
              <button
                class={`modal-btn ${resultModal()!.onAction ? 'secondary' : 'primary'}`}
                onClick={() => setResultModal(null)}
              >
                {resultModal()!.onAction ? 'Cancel' : 'Close'}
              </button>
            </div>
          </div>
        </div>
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
  updateProgress?: (
    challengeId: string,
    score: number,
    completed: boolean,
  ) => void
}

const ChallengeModal: Component<ChallengeModalProps> = (props) => {
  const [isPracticing, setIsPracticing] = createSignal(false)
  const [_sessionScore, _setSessionScore] = createSignal(0)

  const handleComplete = () => {
    const sessions = getSessionHistory()
    const recentSessions = sessions.slice(-5)
    const avgScore =
      recentSessions.length > 0
        ? recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
          recentSessions.length
        : 0

    const target = props.challenge.targetScore
    const completed = avgScore >= target

    props.updateProgress?.(props.challenge.id, avgScore, completed)

    setIsPracticing(false)
    props.onComplete()
  }

  return (
    <div class="challenge-modal">
      <div class="modal-backdrop" onClick={() => props.onClose?.()} />
      <div class="modal-content">
        <button class="modal-close" onClick={() => props.onClose?.()}>
          <IconCloseSimple />
        </button>

        <div class="modal-header">
          <span class="modal-icon">{renderIcon(props.challenge.icon)}</span>
          <div>
            <h2 class="modal-title">{props.challenge.name}</h2>
            <p class="modal-desc">{props.challenge.description}</p>
          </div>
        </div>

        {isPracticing() ? (
          <>
            <div class="modal-practice-status">
              <div class="practice-pulse">
                <IconMicChallenge />
              </div>
              <p class="practice-text">Practice session in progress...</p>
              <p class="practice-instruction">
                Complete a session to track your progress
              </p>
            </div>
            <div class="modal-actions">
              <button class="modal-btn primary" onClick={handleComplete}>
                Complete Session
              </button>
            </div>
          </>
        ) : (
          <>
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
                <span class="stat-label">Sessions</span>
                <span class="stat-value">
                  {props.challenge.actualScores?.length ?? 0}
                </span>
              </div>
            </div>

            <div class="modal-instructions">
              <h3>
                <IconPaper /> How to Complete
              </h3>
              <ul class="instructions-list">
                <li>Practice the target notes for at least 5 minutes</li>
                <li>
                  Try to achieve {props.challenge.targetScore}% or higher
                  accuracy
                </li>
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
                    background: getChallengeProgressColor(
                      props.challenge.progress,
                    ),
                  }}
                />
              </div>
              <span class="progress-text-large">
                {props.challenge.progress}% to {props.challenge.targetScore}%
              </span>
            </div>

            <div class="modal-actions">
              <button class="modal-btn secondary" onClick={props.onClose}>
                Cancel
              </button>
              <button
                class="modal-btn primary"
                onClick={() => {
                  setActiveTab(TAB_SINGING)
                  props.onClose()
                }}
              >
                Start Practice
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Mock Data
// ============================================================

const challengeCategories = () => [
  {
    id: 'high-notes' as const,
    name: 'High Notes',
    icon: IconMicChallenge,
    count: 3,
  },
  {
    id: 'low-notes' as const,
    name: 'Low Notes',
    icon: IconGuitarChallenge,
    count: 2,
  },
  { id: 'speed' as const, name: 'Speed', icon: IconBoltChallenge, count: 3 },
  { id: 'perfect' as const, name: 'Perfect Pitch', icon: IconTarget, count: 2 },
  { id: 'scales' as const, name: 'Scales', icon: IconMusicChallenge, count: 2 },
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
    icon: IconTarget,
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
  {
    id: 'b1',
    name: 'First Steps',
    description: 'Complete your first challenge',
    icon: IconLeaf,
    tier: 'bronze',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 10,
    earned: true,
  },
  {
    id: 'b2',
    name: 'On Fire',
    description: 'Maintain a 7-day practice streak',
    icon: IconFireChallenge,
    tier: 'bronze',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 7,
    earned: true,
  },
  {
    id: 'b3',
    name: 'High & Mighty',
    description: 'Complete a high note challenge',
    icon: IconMicChallenge,
    tier: 'silver',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 5,
    earned: true,
  },
  {
    id: 'b4',
    name: 'Speed Demon',
    description: 'Complete a speed challenge',
    icon: IconBoltChallenge,
    tier: 'silver',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 3,
    earned: true,
  },
  {
    id: 'b5',
    name: 'Perfect Start',
    description: 'Complete a perfect pitch challenge',
    icon: IconTarget,
    tier: 'silver',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
    earned: true,
  },
  {
    id: 'b6',
    name: 'Scale Scholar',
    description: 'Complete a scale challenge',
    icon: IconMusicChallenge,
    tier: 'bronze',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 15,
    earned: true,
  },
  {
    id: 'b7',
    name: 'Streak Master',
    description: 'Reach a 14-day practice streak',
    icon: IconCrown,
    tier: 'gold',
    earnedDate: Date.now() - 1000 * 60 * 60 * 24 * 14,
    earned: false,
  },
  {
    id: 'b8',
    name: 'All Star',
    description: 'Complete all bronze badges',
    icon: IconSparkle,
    tier: 'gold',
    earnedDate: 0,
    earned: false,
  },
]

const mockAchievements: UserAchievement[] = [
  {
    id: 'a1',
    name: '10 Notes',
    description: 'Complete 10 practice sessions',
    icon: IconPaper,
    points: 10,
    unlocked: true,
    progress: 45,
    required: 50,
  },
  {
    id: 'a2',
    name: '50 Sessions',
    description: 'Complete 50 practice sessions',
    icon: IconChart,
    points: 25,
    unlocked: true,
    progress: 45,
    required: 50,
  },
  {
    id: 'a3',
    name: '3 Octaves',
    description: 'Cover 3 octaves in one run',
    icon: IconKeyboardChallenge,
    points: 15,
    unlocked: false,
    progress: 1,
    required: 3,
  },
  {
    id: 'a4',
    name: 'High Note Master',
    description: 'Hit C5 or higher 100 times',
    icon: IconMicChallenge,
    points: 30,
    unlocked: false,
    progress: 15,
    required: 100,
  },
  {
    id: 'a5',
    name: 'Perfect Run',
    description: 'Get 100% accuracy on a run',
    icon: IconTarget,
    points: 50,
    unlocked: false,
    progress: 0,
    required: 1,
  },
  {
    id: 'a6',
    name: 'Speed Demon',
    description: 'Hit 10 notes in 3 seconds',
    icon: IconBoltChallenge,
    points: 20,
    unlocked: false,
    progress: 2,
    required: 10,
  },
  {
    id: 'a7',
    name: 'Scale Explorer',
    description: 'Practice 20 different scales',
    icon: IconMusicChallenge,
    points: 25,
    unlocked: false,
    progress: 8,
    required: 20,
  },
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
