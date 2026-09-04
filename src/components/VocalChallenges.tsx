// ============================================================
// VocalChallenges — the practice challenge catalogue
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { IconArrowUpDown, IconExpand, IconLayers, IconReply, IconSiren, IconZap, } from '@/components/exercise-icons'
import modalStyles from '@/components/Modal.module.css'
import type { ChallengeCategory, ChallengeDefinition as DBChallengeDefinition, ChallengeProgress as DBChallengeProgress, } from '@/db/entities'
import { loadChallengeDefinitions, loadChallengeProgress, } from '@/db/services/challenges-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { authVersion } from '@/db/services/user-service'
import { beginChallengeAttempt, challengeAttemptVersion, } from '@/features/challenges/challenge-attempt'
import { generateChallengeDrill } from '@/features/challenges/challenge-drill-generator'
import { getDifficulty } from '@/features/practice-intelligence/difficulty-store'
import { TAB_PROGRESS } from '@/features/tabs/constants'
import { launchDrill, setActiveTab } from '@/stores/ui-store'
import { IconBoltChallenge, iconByName, IconChart, IconCheckSolid, IconCloseSimple, IconFireChallenge, IconGuitarChallenge, IconLeaf, IconMicChallenge, IconMusicChallenge, IconPaper, IconRefreshSimple, IconTarget, renderIcon, } from './hidden-features-icons'

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
  const scoringDifficulty = getDifficulty(drill.exercise)
  beginChallengeAttempt({
    challengeId: challenge.id,
    title: challenge.name,
    category: challenge.type,
    exercise: drill.exercise,
    targetNotes: drill.notes,
    difficulty: scoringDifficulty,
    targetScore: challenge.targetScore,
    rewardBadgeId: challenge.rewardBadgeId,
  })
  launchDrill({
    exercise: drill.exercise,
    notes: drill.notes,
    challengeName: drill.challengeName,
    difficulty: scoringDifficulty,
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
      const [defs, prog, streak] = await Promise.all([
        loadChallengeDefinitions(),
        loadChallengeProgress(),
        getCurrentStreak(),
      ])
      setDbChallengeDefs(defs)
      setDbChallengeProg(prog)
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
          completedDate: earnedTimestamp(dbProg?.completedAt),
          rewardBadgeId: d.rewardBadgeId ?? undefined,
          difficulty: d.difficulty,
        }
      })
  }

  // Get filtered challenges with real progress
  const challenges = createMemo(() =>
    getChallengesForCategory(activeCategory()),
  )

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

      {/* The Legend and its archive used to sit in a rail here. They are
          competition, and they live on the Leaderboard's Legends view now —
          this page is the personal practice catalogue. Home keeps the live
          card as the daily hook. */}
      <div class="challenges-main">
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
                    {challenge.status === 'in-progress' && (
                      <IconRefreshSimple />
                    )}
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
      </div>

      {/* The badge and achievement grids sat here until the relayout moved
          them to Progress. A badge is a record of what practice earned, and
          Progress is the record — so that is where the cabinet is. One line
          where the grids used to be keeps the old path from ending in
          nothing. */}
      <p class="challenges-cabinet-pointer">
        <span>
          Every badge and achievement you earn here is kept on your Progress
          page.
        </span>
        <button type="button" onClick={() => setActiveTab(TAB_PROGRESS)}>
          Open Progress
        </button>
      </p>

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
    // The shared overlay, like every other modal in the app. This used to
    // hand-roll `.challenge-modal` + an absolutely positioned
    // `.modal-backdrop` SIBLING of the content — and the module's
    // .modalContent carries no `position`, so it stayed in flow while the
    // backdrop did not. Positioned boxes paint above in-flow ones, so the
    // scrim covered the dialog: the modal was behind its own backdrop,
    // blur and all, which is why Start Challenge looked like a blurred
    // page with nothing on it.
    <div
      class={`${modalStyles.modalOverlay} challenge-modal-overlay`}
      onClick={() => props.onClose?.()}
    >
      <div
        class={`${modalStyles.modalContent} challenge-modal-card`}
        role="dialog"
        aria-modal="true"
        aria-label={props.challenge.name}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header, scrolling body, pinned actions. The old markup put
            every block straight into .modalContent, which carries no
            padding — so everything sat flush to the edges, and the
            module's .modalHeader (built for "title | X") threw the icon
            out beside a centred title. */}
        <header class="challenge-modal-head">
          <span class="modal-icon">{renderIcon(props.challenge.icon)}</span>
          <div class="challenge-modal-heading">
            <h2 class="modal-title">{props.challenge.name}</h2>
            <p class="modal-desc">{props.challenge.description}</p>
          </div>
          <button
            class="challenge-modal-close"
            onClick={() => props.onClose?.()}
            aria-label="Close"
            title="Close"
          >
            <IconCloseSimple />
          </button>
        </header>

        <div class="challenge-modal-body">
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
                  <li>Run the drill again any time to beat your best.</li>
                </ul>
              }
            >
              <ul class="instructions-list">
                <li>
                  <strong>Practice Drill</strong> opens the matching exercise.
                  Your score is recorded for you.
                </li>
                <li>
                  Hit <strong>{props.challenge.targetScore}%</strong> on one run
                  to complete it.
                </li>
                <li>Retry as often as you like — your best score stands.</li>
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
                  background: getChallengeProgressColor(
                    props.challenge.progress,
                  ),
                }}
              />
            </div>
            <span class="progress-text-large">
              {props.challenge.status === 'completed'
                ? `Completed — best ${props.challenge.bestScore}%`
                : `Best ${props.challenge.bestScore}% of ${props.challenge.targetScore}% target`}
            </span>
          </div>
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

/**
 * "When did this land", for a column that is allowed to say "it hasn't".
 *
 * `challengeProgress.completedAt` and `userAchievements.unlockedAt` are both
 * nullable in D1, so an unfinished row reads back as a literal `null`. Both
 * call sites used to test `!== undefined`, which `null` passes — and
 * `new Date(null).getTime()` is `0`, not `NaN`. Every challenge nobody had
 * finished therefore claimed a completion date of 1 Jan 1970.
 *
 * One `!= null` covers both spellings of absent. Anything that is present but
 * unparseable returns undefined rather than a NaN that would render as
 * "Invalid Date" further down.
 */
export function earnedTimestamp(
  iso: string | null | undefined,
): number | undefined {
  if (iso == null) return undefined
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? undefined : ms
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

// ============================================================
// CSS Styles (inline for this component)
// ============================================================
