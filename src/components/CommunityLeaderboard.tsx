// ============================================================
// CommunityLeaderboard — Global/Friends/Weekly Leaderboards
// ============================================================

import type { Component } from 'solid-js'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { FriendCodePanel } from '@/components/friends/FriendCodePanel'
import { CheckCircle, ChevronDown, Play } from '@/components/icons'
import type { ChallengeDefinition, ChallengeProgress, LeaderboardCategory as DBLeaderboardCategory, } from '@/db/entities'
import { loadChallengeDefinitions, loadChallengeProgress, } from '@/db/services/challenges-service'
import { follow, getFollowing, unfollow } from '@/db/services/follow-service'
import { loadLeaderboardPage } from '@/db/services/leaderboard-service'
import type { LeagueMe, LeagueRung } from '@/db/services/league-service'
import { fetchLeagueLadder, fetchLeagueMe, formatCutCountdown, msUntilNextCut, smallArt, } from '@/db/services/league-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import type { LeaderboardCategory, LeaderboardUser, LeaderboardView, } from '@/types'
import { IconCloseSimple, IconFilter } from './hidden-features-icons'

// ============================================================
// SVG Icons (Classy, minimal style)
// ============================================================

const TrophyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const IconOverall = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
)

const IconScore = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const IconAccuracy = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const IconStreak = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.4.5.7 1.3 1 2.3z" />
  </svg>
)

const IconSessions = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const IconUser = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-avatar"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
)

const IconTrophy = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const IconChallenge = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const IconSearch = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

// Helper to render icon: handles both Component functions and string values
function renderIcon(icon: Component | string) {
  return typeof icon === 'function' ? (icon as () => JSX.Element)() : icon
}

// ============================================================
// Mock Data
// ============================================================

/**
 * `friendsOnly` categories are hidden on the global board and rejected by
 * the worker there. A streak measures showing up rather than skill, and it
 * counts every practice day — worth comparing with friends who chose to see
 * each other, not a behavioural record to publish to strangers.
 */
const leaderboardCategories = [
  { id: 'overall' as const, name: 'Overall', icon: IconOverall },
  { id: 'best-score' as const, name: 'Best Score', icon: IconScore },
  { id: 'accuracy' as const, name: 'Accuracy', icon: IconAccuracy },
  {
    id: 'streak' as const,
    name: 'Longest Streak',
    icon: IconStreak,
    friendsOnly: true,
  },
  { id: 'sessions' as const, name: 'Most Sessions', icon: IconSessions },
]

/** A challenge definition joined with the user's own progress. */
interface WeeklyChallengeCard {
  challengeId: string
  name: string
  description: string
  targetScore: number
  userScore: number
  completed: boolean
}

// ============================================================
// Component
// ============================================================

export const CommunityLeaderboard: Component<LeaderboardProps> = (props) => {
  // eslint-disable-next-line solid/reactivity -- one-time signal init
  const initialView = (props.view ?? 'global') as LeaderboardView
  // eslint-disable-next-line solid/reactivity -- one-time signal init
  const initialCategory = (props.category ?? 'overall') as LeaderboardCategory
  const [activeView, setActiveView] = createSignal<LeaderboardView>(initialView)
  const [activeCategory, setActiveCategory] =
    createSignal<LeaderboardCategory>(initialCategory)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedUser, setSelectedUser] = createSignal<LeaderboardUser | null>(
    null,
  )

  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''
  const PAGE_SIZE = 25

  const visibleCategories = createMemo(() =>
    leaderboardCategories.filter(
      (c) => c.friendsOnly !== true || activeView() === 'friends',
    ),
  )

  // Leaving Friends while on a friends-only category would request one the
  // server refuses on the global board; fall back instead of showing an error.
  createEffect(() => {
    if (!visibleCategories().some((c) => c.id === activeCategory())) {
      setActiveCategory('overall')
    }
  })

  // DB-backed leaderboard data (paged)
  const [dbLeaderboardUsers, setDbLeaderboardUsers] = createSignal<
    LeaderboardUser[]
  >([])
  const [totalEntries, setTotalEntries] = createSignal(0)
  const [loadingMore, setLoadingMore] = createSignal(false)

  // Who the current user follows (drives the Friends tab + buttons)
  const [following, setFollowing] = createSignal<string[]>([])

  // Real weekly challenges: definitions + own progress
  const [weeklyChallenges, setWeeklyChallenges] = createSignal<
    WeeklyChallengeCard[]
  >([])

  function toLeaderboardUser(u: {
    userId: string
    displayName: string
    score: number
    rank: number
    streak: number
    totalSessions: number
    bestScore: number
    accuracy: number
  }): LeaderboardUser {
    return { ...u, avatar: IconUser, joinDate: 0 }
  }

  async function loadPage(offset: number): Promise<void> {
    const page = await loadLeaderboardPage({
      category: activeCategory() as DBLeaderboardCategory,
      view: activeView() === 'friends' ? 'friends' : 'global',
      limit: PAGE_SIZE,
      offset,
    })
    setTotalEntries(page.total)
    const users = page.users.map(toLeaderboardUser)
    setDbLeaderboardUsers((prev) =>
      offset === 0 ? users : [...prev, ...users],
    )
  }

  // Reload page 0 whenever the tab, category, or identity changes
  createEffect(() => {
    authVersion()
    activeCategory()
    const view = activeView()
    // The league view has its own loader below — no board page to fetch.
    if (view === 'league') return
    void loadPage(0)
  })

  // ── League view state ─────────────────────────────────────────
  const [leagueMe, setLeagueMe] = createSignal<LeagueMe | null>(null)
  const [leagueLadder, setLeagueLadder] = createSignal<LeagueRung[]>([])
  const [nowMs, setNowMs] = createSignal(Date.now())
  const cutTimer = setInterval(() => setNowMs(Date.now()), 60_000)
  onCleanup(() => clearInterval(cutTimer))

  createEffect(() => {
    authVersion()
    if (activeView() !== 'league' || !cloudConfigured) return
    void (async () => {
      const [me, ladder] = await Promise.all([
        fetchLeagueMe(),
        fetchLeagueLadder(),
      ])
      setLeagueMe(me)
      setLeagueLadder(ladder)
    })()
  })

  /** The rung one above / below the signed-in user's, for zone hints. */
  const leagueNeighbours = createMemo(() => {
    const rank = leagueMe()?.league?.rank
    if (rank == null) return { up: undefined, down: undefined }
    const ladder = leagueLadder()
    return {
      up: ladder.find((r) => r.rank === rank + 1 && !r.isMystery),
      down: ladder.find((r) => r.rank === rank - 1),
    }
  })

  createEffect(() => {
    authVersion()
    void getFollowing().then(setFollowing)
    void (async () => {
      const [defs, progress] = await Promise.all([
        loadChallengeDefinitions(),
        loadChallengeProgress(),
      ])
      const progressById = new Map<string, ChallengeProgress>(
        progress.map((p) => [p.challengeId, p]),
      )
      setWeeklyChallenges(
        defs.map((d: ChallengeDefinition) => {
          const p = progressById.get(d.id)
          return {
            challengeId: d.id,
            name: d.title,
            description: d.description,
            targetScore: d.targetScore,
            userScore: p?.currentScore ?? 0,
            completed: p?.completed ?? false,
          }
        }),
      )
    })()
  })

  async function loadMore(): Promise<void> {
    setLoadingMore(true)
    try {
      await loadPage(dbLeaderboardUsers().length)
    } finally {
      setLoadingMore(false)
    }
  }

  async function refreshFollowing(): Promise<void> {
    setFollowing(await getFollowing())
  }

  async function toggleFollow(userId: string): Promise<void> {
    const isFollowed = following().includes(userId)
    const ok = isFollowed ? await unfollow(userId) : await follow(userId)
    if (!ok) {
      showNotification('Sign in to follow players', 'warning')
      return
    }
    setFollowing(await getFollowing())
    showNotification(isFollowed ? 'Unfollowed' : 'Following player', 'info')
    if (activeView() === 'friends') void loadPage(0)
  }

  // Real data only — server-derived in cloud mode, locally-derived from
  // your own sessionRecords otherwise. Never fabricated competitors.
  const allLeaderboardUsers = createMemo(() => dbLeaderboardUsers())

  // Filter users based on search
  const filteredUsers = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return allLeaderboardUsers().filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        `#${u.userId}`.includes(query),
    )
  })

  // Podium: top 3 from the unified list
  const podiumData = createMemo(() => {
    const users = allLeaderboardUsers()
    const fallback = {
      userId: '',
      displayName: '—',
      avatar: '',
      score: 0,
      rank: 0,
      streak: 0,
      totalSessions: 0,
      bestScore: 0,
      accuracy: 0,
      joinDate: 0,
    } satisfies LeaderboardUser
    return [users[0] ?? fallback, users[1] ?? fallback, users[2] ?? fallback]
  })

  return (
    <div class="community-leaderboard">
      {/* Header */}
      <div class="leaderboard-header">
        <div class="leaderboard-header-content">
          <h2>Leaderboard</h2>
          <p class="leaderboard-subtitle">
            Compete with other singers worldwide
          </p>
        </div>
      </div>

      {/* Leaderboard Tabs */}
      <div class="leaderboard-tabs">
        <button
          class={`leaderboard-tab ${activeView() === 'global' ? 'active' : ''}`}
          onClick={() => setActiveView('global')}
        >
          <IconSearch />
          <span class="tab-name">Global</span>
          <span class="tab-count">{allLeaderboardUsers().length}</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveView('friends')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon-svg tab-icon"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span class="tab-name">Friends</span>
          <span class="tab-count">{following().length}</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveView('weekly')}
        >
          <IconStreak />
          <span class="tab-name">Weekly</span>
          <span class="tab-count">{weeklyChallenges().length}</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'league' ? 'active' : ''}`}
          onClick={() => setActiveView('league')}
          data-testid="league-tab"
        >
          <IconTrophy />
          <span class="tab-name">League</span>
        </button>
      </div>

      {/* Category Tabs */}
      {activeView() !== 'weekly' && activeView() !== 'league' && (
        <div class="category-tabs">
          <For each={visibleCategories()}>
            {(cat) => (
              <button
                class={`category-tab ${activeCategory() === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id as LeaderboardCategory)}
              >
                {renderIcon(cat.icon)}
                <span class="cat-name">{cat.name}</span>
              </button>
            )}
          </For>
        </div>
      )}

      {/* League View */}
      <Show when={activeView() === 'league'}>
        <div class="league-view" data-testid="league-view">
          <Show
            when={cloudConfigured}
            fallback={
              <p class="weekly-challenges-desc">
                Leagues need a cloud account (not available in this build).
              </p>
            }
          >
            <Show
              when={leagueMe()?.eligible === true}
              fallback={
                <div class="league-locked" data-testid="league-locked">
                  <p class="weekly-challenges-desc">
                    <Show
                      when={leagueMe()?.reason !== 'unavailable'}
                      fallback={
                        <>
                          Leagues aren’t enabled on this environment yet — its
                          database predates the league tables. Apply the D1
                          migrations that ship with this change and the ladder
                          lights up.
                        </>
                      }
                    >
                      Leagues are for registered singers — create an account in
                      Settings → Account to climb the ladder. Practice earns
                      weekly points; the top of each league advances every
                      Monday.
                    </Show>
                  </p>
                </div>
              }
            >
              <div class="league-rung-card" data-testid="league-rung-card">
                <Show when={leagueMe()?.league?.trophyAsset}>
                  <img
                    class="league-rung-trophy"
                    src={leagueMe()?.league?.trophyAsset ?? ''}
                    alt={`${leagueMe()?.league?.name ?? 'League'} trophy`}
                  />
                </Show>
                <div class="league-rung-info">
                  <span class="league-rung-label">Your league</span>
                  <h3 class="league-rung-name" data-testid="league-rung-name">
                    {leagueMe()?.league?.name}
                  </h3>
                  <p class="league-rung-stats">
                    {leagueMe()?.points ?? 0} pts this week
                    <Show when={leagueMe()?.rank != null}>
                      {' '}
                      · #{leagueMe()?.rank} of {leagueMe()?.cohortSize}
                    </Show>
                  </p>
                  <p class="league-rung-zones">
                    <Show
                      when={leagueNeighbours().up}
                      fallback={<>Top of the playable ladder — defend it.</>}
                    >
                      Top {leagueMe()?.league?.promoteCount} advance to{' '}
                      {leagueNeighbours().up?.name}.
                    </Show>{' '}
                    <Show when={(leagueMe()?.league?.relegateCount ?? 0) > 0}>
                      Bottom {leagueMe()?.league?.relegateCount} drop to{' '}
                      {leagueNeighbours().down?.name}.
                    </Show>
                  </p>
                  <span class="league-cut-countdown">
                    Weekly cut in {formatCutCountdown(msUntilNextCut(nowMs()))}
                  </span>
                </div>
              </div>

              <Show
                when={(leagueMe()?.standings?.length ?? 0) > 0}
                fallback={
                  <p class="weekly-challenges-desc">
                    Nobody has scored league points yet this week — finish an
                    exercise or challenge to open the board.
                  </p>
                }
              >
                <div class="league-standings" data-testid="league-standings">
                  <For each={leagueMe()?.standings ?? []}>
                    {(row) => (
                      <div
                        class={`league-standing-row ${
                          row.userId === getUserId() ? 'me' : ''
                        }`}
                      >
                        <span class="league-standing-rank">#{row.rank}</span>
                        <span class="league-standing-name">
                          {row.displayName}
                        </span>
                        <span class="league-standing-points">
                          {row.points} pts
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            {/* The 7-rung ladder, mystery included, for everyone */}
            <Show when={leagueLadder().length > 0}>
              <div class="league-ladder" data-testid="league-ladder">
                <For each={leagueLadder()}>
                  {(rung) => (
                    <div
                      class={`league-ladder-rung ${
                        rung.id === leagueMe()?.league?.id ? 'current' : ''
                      } ${rung.isMystery ? 'mystery' : ''}`}
                      title={rung.isMystery ? 'Coming soon' : rung.name}
                    >
                      <Show when={smallArt(rung)}>
                        <img
                          class="league-ladder-trophy"
                          src={smallArt(rung) ?? ''}
                          alt={rung.isMystery ? 'Mystery league' : rung.name}
                        />
                      </Show>
                      <span class="league-ladder-name">{rung.name}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Search Bar (board views only) */}
      <Show when={activeView() !== 'league'}>
        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="Search players..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <button class="filter-btn" aria-label="Filter" title="Filter">
            <IconFilter />
          </button>
        </div>
      </Show>

      {/* Weekly Challenges View */}
      <Show when={activeView() === 'weekly'}>
        <div class="weekly-challenges">
          <h3 class="weekly-challenges-title">Weekly Challenges</h3>
          <p class="weekly-challenges-desc">
            Complete challenges to earn special badges and climb the ranks!
          </p>

          <Show
            when={weeklyChallenges().length > 0}
            fallback={
              <p class="weekly-challenges-desc">No challenges available.</p>
            }
          >
            <div class="challenges-grid">
              <For each={weeklyChallenges()}>
                {(challenge) => (
                  <div
                    class="challenge-card"
                    data-challenge={challenge.challengeId}
                  >
                    <div class="challenge-icon">{IconChallenge()}</div>
                    <div class="challenge-content">
                      <h4 class="challenge-name">{challenge.name}</h4>
                      <p class="challenge-desc">{challenge.description}</p>
                      <div class="challenge-stats">
                        <span class="stat-user">
                          {challenge.completed
                            ? 'Completed'
                            : `Your progress: ${challenge.userScore} / ${challenge.targetScore}`}
                        </span>
                      </div>
                    </div>
                    <div class="challenge-progress">
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style={{
                            width: `${Math.min((challenge.userScore / Math.max(challenge.targetScore, 1)) * 100, 100)}%`,
                            '--progress-color': getScoreColor(
                              challenge.userScore,
                            ),
                          }}
                        />
                      </div>
                      <span class="progress-text">
                        {challenge.userScore} / {challenge.targetScore}
                      </span>
                    </div>
                    <button
                      class="challenge-join-btn"
                      disabled={challenge.completed}
                      onClick={() => props.onOpenChallenges?.()}
                      aria-label={
                        challenge.completed ? 'Completed' : 'Practice now'
                      }
                      title={challenge.completed ? 'Completed' : 'Practice now'}
                    >
                      {challenge.completed ? <CheckCircle /> : <Play />}
                      {challenge.completed ? 'Completed' : 'Practice Now'}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Leaderboard Table View */}
      <Show when={activeView() !== 'weekly' && activeView() !== 'league'}>
        <div class="leaderboard-content">
          {/* Friends tab: share/redeem codes, then the empty-state hint */}
          <Show when={activeView() === 'friends' && cloudConfigured}>
            <FriendCodePanel
              onFriendAdded={() => {
                void refreshFollowing()
                void loadPage(0)
              }}
            />
          </Show>
          <Show
            when={
              activeView() === 'friends' && allLeaderboardUsers().length === 0
            }
          >
            {/* An added friend with no ranked attempts yet produces no board
                row, and "No friends yet" would read as though the add
                failed — so distinguish "nobody added" from "nothing to rank". */}
            <p class="weekly-challenges-desc" data-testid="friends-empty">
              {!cloudConfigured
                ? 'Friends leaderboards need a cloud account (not available in this build).'
                : following().length > 0
                  ? 'Your friends are added — this fills in once they finish an exercise or challenge.'
                  : 'No friends yet — swap codes above, or open a player on the Global tab and hit Follow.'}
            </p>
          </Show>
          {/* Top 3 Podium */}
          <div class="podium-section">
            <For each={podiumData()}>
              {(user, index) => (
                <div class={`podium-item podium-${index() + 1}`}>
                  <div class="podium-rank">
                    {index() === 0 && <TrophyIcon />}
                    {index() === 1 && <IconTrophy />}
                    {index() === 2 && <IconTrophy />}
                    {index() >= 3 && `#${user.rank}`}
                  </div>
                  <div class="podium-avatar">
                    {user.avatar !== undefined ? renderIcon(user.avatar) : null}
                  </div>
                  <div class="podium-info">
                    <div class="podium-name">{user.displayName}</div>
                    <div class="podard-score">
                      {categoryMetric(user, activeCategory())}
                    </div>
                  </div>
                  <Show when={index() < 3}>
                    <div class="podium-score-display">
                      {categoryMetric(user, activeCategory())}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Leaderboard Table */}
          <div class="leaderboard-table-container">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th class="rank-th">#</th>
                  <th class="user-th">Player</th>
                  <th class="score-th">Score</th>
                  <th class="streak-th">Streak</th>
                  <th class="sessions-th">Sessions</th>
                  <th class="best-th">Best</th>
                </tr>
              </thead>
              <tbody>
                <For each={filteredUsers()}>
                  {(user) => (
                    <tr
                      class={`leaderboard-row ${user.userId === getUserId() || user.userId === 'me' ? 'is-me' : ''}`}
                      data-rank={user.rank}
                      data-user-id={user.userId}
                      onClick={() => setSelectedUser(user)}
                    >
                      <td class="rank-td">
                        {user.rank === 1 && <TrophyIcon />}
                        {(user.rank === 2 || user.rank === 3) && <IconTrophy />}
                        {user.rank > 3 && user.rank}
                      </td>
                      <td class="user-td">
                        <div class="user-cell">
                          <div class="user-avatar">
                            {user.avatar !== undefined
                              ? renderIcon(user.avatar)
                              : null}
                          </div>
                          <div class="user-details">
                            <div class="user-name">{user.displayName}</div>
                            <div class="user-streak-badge">
                              {user.streak} day streak
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="score-td">
                        <span class="score-value">
                          {user.score.toLocaleString()}
                        </span>
                      </td>
                      <td class="streak-td">
                        <div class="streak-bar">
                          <div
                            class="streak-fill"
                            style={{
                              width: `${Math.min(user.streak * 10, 100)}%`,
                              '--streak-color': getStreakColor(user.streak),
                            }}
                          />
                        </div>
                        <span class="streak-count">{user.streak}</span>
                      </td>
                      <td class="sessions-td">{user.totalSessions}</td>
                      <td class="best-td">{user.bestScore}%</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Load More (server-side pagination) */}
          <Show
            when={
              cloudConfigured && dbLeaderboardUsers().length < totalEntries()
            }
          >
            <div class="load-more-container">
              <button
                class="load-more-btn"
                aria-label="Load more players"
                title="Load more players"
                disabled={loadingMore()}
                onClick={() => void loadMore()}
              >
                <ChevronDown />
                {loadingMore()
                  ? 'Loading…'
                  : `Load More Players (${dbLeaderboardUsers().length} of ${totalEntries()})`}
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* User Profile Modal */}
      <Show when={selectedUser()}>
        <div class="leaderboard-profile-modal">
          <div
            class="profile-modal-backdrop"
            onClick={() => setSelectedUser(null)}
          />
          <div class="profile-modal-content">
            <button
              class="profile-modal-close"
              onClick={() => setSelectedUser(null)}
            >
              <IconCloseSimple />
            </button>

            <div class="profile-header">
              {(() => {
                const user = selectedUser()
                return user != null && user.avatar != null
                  ? renderIcon(user.avatar)
                  : null
              })()}
              <div class="profile-header-info">
                <div class="profile-rank-badge">
                  Rank #{selectedUser()?.rank}
                </div>
                <h2 class="profile-name">{selectedUser()?.displayName}</h2>
                <p class="profile-bio">
                  {selectedUser()?.streak} day streak •{' '}
                  {selectedUser()?.totalSessions} sessions •
                  {selectedUser()?.accuracy}% accuracy
                </p>
              </div>
            </div>

            <div class="profile-stats-grid">
              <div class="stat-card">
                <span class="stat-icon">{IconScore()}</span>
                <div class="stat-content">
                  <span class="stat-label">Best Score</span>
                  <span class="stat-value">{selectedUser()?.bestScore}%</span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">{IconSessions()}</span>
                <div class="stat-content">
                  <span class="stat-label">Total Sessions</span>
                  <span class="stat-value">
                    {selectedUser()?.totalSessions}
                  </span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">{IconStreak()}</span>
                <div class="stat-content">
                  <span class="stat-label">Current Streak</span>
                  <span class="stat-value">{selectedUser()?.streak}</span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">{IconTrophy()}</span>
                <div class="stat-content">
                  <span class="stat-label">Rank Points</span>
                  <span class="stat-value">
                    {selectedUser()?.score.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <Show when={selectedUser()?.userId !== getUserId()}>
              <div class="profile-actions">
                <button
                  class="profile-follow-btn"
                  data-testid="follow-button"
                  aria-label={
                    following().includes(selectedUser()?.userId ?? '')
                      ? 'Unfollow player'
                      : 'Follow player'
                  }
                  title={
                    following().includes(selectedUser()?.userId ?? '')
                      ? 'Unfollow player'
                      : 'Follow player'
                  }
                  onClick={() => {
                    const id = selectedUser()?.userId
                    if (id != null && id !== '') void toggleFollow(id)
                  }}
                >
                  <CheckCircle />
                  {following().includes(selectedUser()?.userId ?? '')
                    ? 'Following'
                    : 'Follow Player'}
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

interface LeaderboardProps {
  view?: LeaderboardView
  category?: LeaderboardCategory
  /** Navigate to the challenges tab (weekly cards' "Practice Now"). */
  onOpenChallenges?: () => void
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'var(--green)'
  if (score >= 50) return 'var(--accent)'
  if (score >= 25) return 'var(--teal)'
  return 'var(--yellow)'
}

function getStreakColor(streak: number): string {
  if (streak >= 30) return 'var(--green)'
  if (streak >= 15) return 'var(--accent)'
  if (streak >= 7) return 'var(--teal)'
  return 'var(--yellow)'
}

/** The prominent metric to show for a user under the active category. */
function categoryMetric(
  user: LeaderboardUser,
  category: LeaderboardCategory,
): string {
  switch (category) {
    case 'accuracy':
      return `${Math.round(user.accuracy)}%`
    case 'best-score':
      return `${Math.round(user.bestScore)}%`
    case 'streak':
      return `${user.streak} day${user.streak === 1 ? '' : 's'}`
    case 'sessions':
      return `${user.totalSessions} session${user.totalSessions === 1 ? '' : 's'}`
    case 'overall':
    default:
      return `${user.score.toLocaleString()} pts`
  }
}
