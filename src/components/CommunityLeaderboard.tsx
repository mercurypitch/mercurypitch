// ============================================================
// CommunityLeaderboard — Global/Friends/Weekly Leaderboards
// ============================================================

import type { Component } from 'solid-js'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { FriendCodePanel } from '@/components/friends/FriendCodePanel'
import { CheckCircle, ChevronDown, Play } from '@/components/icons'
import type { ChallengeDefinition, ChallengeProgress, LeaderboardCategory as DBLeaderboardCategory, } from '@/db/entities'
import { hasValidToken } from '@/db/services/auth-service'
import { loadChallengeDefinitions, loadChallengeProgress, } from '@/db/services/challenges-service'
import { follow, getFollowing, unfollow } from '@/db/services/follow-service'
import { loadLeaderboardPage } from '@/db/services/leaderboard-service'
import type { LeagueMe, LeagueRung, LeagueStanding, } from '@/db/services/league-service'
import { fetchLeagueLadder, fetchLeagueMe, formatCutCountdown, msUntilNextCut, } from '@/db/services/league-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { peekPendingFriendCode } from '@/lib/pending-friend-code'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal } from '@/stores/ui-store'
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

/** A podium place nobody has claimed: a question inside the avatar ring. */
const IconUnclaimedPlace = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
    aria-hidden="true"
  >
    <path d="M9.2 9a2.9 2.9 0 1 1 3.85 2.74c-.7.25-1.05.86-1.05 1.6v.51" />
    <circle cx="12" cy="17.1" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

/**
 * The three podium places, in order. Deliberately NOT the league badges in
 * `public/leagues/` — those denote ladder rungs, so a Bronze-league singer
 * topping the board would wear gold here and bronze on their league card.
 *
 * Each render is the whole card, not a thumbnail above it — see
 * `.podium-item` in vocal-analysis.css for why the art is full-bleed.
 */
const PODIUM_MEDALS: ReadonlyArray<{ src: string; alt: string }> = [
  { src: '/leaderboard/place-1.webp', alt: 'First place' },
  { src: '/leaderboard/place-2.webp', alt: 'Second place' },
  { src: '/leaderboard/place-3.webp', alt: 'Third place' },
]

/** Two singers with the second still an outline — nobody there yet. */
const IconFriendsEmpty = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <circle cx="9" cy="7.5" r="3.5" />
    <path d="M2.5 20v-1.5A5.5 5.5 0 0 1 8 13h2a5.5 5.5 0 0 1 5.5 5.5V20" />
    <circle cx="17.5" cy="7.5" r="2.75" stroke-dasharray="2.6 2.6" />
    <path d="M15 13.4A4.6 4.6 0 0 1 21.5 17.6V20" stroke-dasharray="2.6 2.6" />
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
  // An invite link (#/leaderboard?add=CODE) stashes its code before the
  // router erases the query; landing from one should open straight onto the
  // Friends view where the panel prefills it. Peek, don't take — the panel
  // is the consumer.

  const initialView = (
    peekPendingFriendCode() != null
      ? 'friends'
      : // eslint-disable-next-line solid/reactivity -- one-time signal init
        (props.view ?? 'league')
  ) as LeaderboardView
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
  /** hasValidToken reads localStorage, not a signal — authVersion is what
   *  makes it re-evaluate when someone signs in or out mid-view. */
  const signedIn = createMemo(() => {
    authVersion()
    return hasValidToken()
  })
  const PAGE_SIZE = 25

  const visibleCategories = createMemo(() =>
    leaderboardCategories.filter(
      (c) => c.friendsOnly !== true || activeView() === 'friends',
    ),
  )

  // Leaving Friends while on a friends-only category would send the boards
  // a request the server refuses (streak is friends-only); fall back instead
  // of erroring. League never queries a board, so merely passing through it
  // must not clobber the selection — Friends+streak → League → Friends
  // should come back still on streak.
  createEffect(() => {
    const view = activeView()
    if (view === 'league' || view === 'friends') return
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
    longestStreak: number
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
      // Both fetchers resolve empty on network failure. Keep whatever was
      // already loaded rather than blanking the rail — and, worse, showing a
      // signed-in user the "create an account" copy — over a blip.
      if (me != null) setLeagueMe(me)
      if (ladder.length > 0) setLeagueLadder(ladder)
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

  type LeagueBoardItem =
    | { kind: 'row'; row: LeagueStanding; zone: '' | 'promote' | 'demote' }
    | { kind: 'divider'; zone: 'promote' | 'demote'; to?: string }

  /**
   * Standings cut into promotion / safe / relegation zones, with divider
   * rows at the boundaries (the Duolingo pattern). Mirrors the server cut
   * (league-cut.ts): only members with points promote, up to promoteCount;
   * the bottom relegateCount of the REST relegate; small cohorts can have no
   * safe band at all. The relegation boundary is derived from the full
   * cohortSize, not the visible slice, because the server caps standings at
   * its top rows.
   */
  const leagueBoard = createMemo<LeagueBoardItem[]>(() => {
    const me = leagueMe()
    const rows = me?.standings ?? []
    const n = rows.length
    const total = me?.cohortSize ?? n
    const promoteCount = me?.league?.promoteCount ?? 0
    const relegateCount = me?.league?.relegateCount ?? 0
    // Only active members promote — trim trailing zero-point rows out.
    let promoteEnd = Math.min(promoteCount, n)
    while (promoteEnd > 0 && (rows[promoteEnd - 1]?.points ?? 0) <= 0)
      promoteEnd--
    const demoteStart =
      relegateCount > 0 ? Math.max(promoteEnd, total - relegateCount) : total
    const items: LeagueBoardItem[] = []
    rows.forEach((row, i) => {
      if (promoteEnd > 0 && promoteEnd < total && i === promoteEnd)
        items.push({
          kind: 'divider',
          zone: 'promote',
          to: leagueNeighbours().up?.name,
        })
      if (demoteStart < total && i === demoteStart)
        items.push({
          kind: 'divider',
          zone: 'demote',
          to: leagueNeighbours().down?.name,
        })
      items.push({
        kind: 'row',
        row,
        zone: i < promoteEnd ? 'promote' : i >= demoteStart ? 'demote' : '',
      })
    })
    return items
  })

  /**
   * The climb reveals the art: rungs ABOVE yours show a draped, veiled
   * trophy instead of their render — the name stays, the prize is the
   * surprise. Your rung and everything below it (already climbed through)
   * show real art; the mystery league keeps its own '?' identity. Display
   * gating only — the public ladder API still serves every trophyAsset.
   * With no league yet (signed out, still loading), only rung 1 shows.
   */
  const LOCKED_TROPHY = '/leagues/locked.webp'
  const rungRevealed = (rung: LeagueRung): boolean =>
    rung.isMystery || rung.rank <= (leagueMe()?.league?.rank ?? 1)

  // Center the signed-in rung in the trophy rail (it scrolls on phones).
  let stripEl: HTMLDivElement | undefined
  const centerCurrentRung = (): void => {
    const strip = stripEl
    if (!strip) return
    requestAnimationFrame(() => {
      const cur = strip.querySelector<HTMLElement>('[data-current="true"]')
      if (cur)
        strip.scrollLeft =
          cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2
    })
  }
  createEffect(() => {
    leagueLadder()
    leagueMe()
    centerCurrentRung()
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

  /** The number the table's streak column shows — see the header. */
  const rowStreak = (user: LeaderboardUser): number =>
    activeCategory() === 'streak' ? user.longestStreak : user.streak

  // Filter users based on search
  const filteredUsers = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return allLeaderboardUsers().filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        `#${u.userId}`.includes(query),
    )
  })

  /**
   * What stands in for a board with nobody on it.
   *
   * Four different situations produced the same nothing before: a build
   * with no backend, friends added but yet to sing, no friends at all, and
   * a global board where nobody has qualified. Saying which one it is
   * costs one branch and is the difference between "broken" and "not yet".
   */
  const emptyBoard = (): JSX.Element => (
    <div
      class="empty-state empty-state-compact board-empty"
      data-testid={activeView() === 'friends' ? 'friends-empty' : 'board-empty'}
    >
      <div class="empty-icon" aria-hidden="true">
        <IconFriendsEmpty />
      </div>
      <Show
        when={cloudConfigured}
        fallback={
          <>
            <h3>Boards need the cloud</h3>
            <p>
              This build has no account backend, so there is nobody to compare
              with here.
            </p>
          </>
        }
      >
        <Show
          when={activeView() === 'friends'}
          fallback={
            <>
              <h3>Nobody on the board yet</h3>
              <p>
                The global board carries singers who opted in and have a scored
                run behind them. Finish an exercise or a Legend and yours lands
                here.
              </p>
              <Show when={props.onOpenChallenges !== undefined}>
                <button
                  type="button"
                  class="primary-btn"
                  onClick={() => props.onOpenChallenges?.()}
                >
                  <IconChallenge /> Take on a challenge
                </button>
              </Show>
            </>
          }
        >
          <Show
            when={following().length > 0}
            fallback={
              <>
                <h3>No friends yet</h3>
                <p>
                  Swap the code above, or open a singer on the Global board and
                  follow them.
                </p>
                <button
                  type="button"
                  class="primary-btn"
                  onClick={() => setActiveView('global')}
                >
                  <IconSearch /> Browse the Global board
                </button>
              </>
            }
          >
            {/* An added friend with no ranked attempts yet produces no
                board row, and "No friends yet" would read as though the
                add had failed. */}
            <h3>Waiting on their first run</h3>
            <p>
              {following().length === 1
                ? 'Your friend is added.'
                : `All ${following().length} friends are added.`}{' '}
              The board fills in once they finish an exercise or a challenge.
            </p>
          </Show>
        </Show>
      </Show>
    </div>
  )

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
      longestStreak: 0,
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
      {/* League leads: it is the main event, and the ladder is the reason
          to come back weekly. Global — a flat all-time list — reads as a
          wall of strangers, so it sits last. */}
      <div class="leaderboard-tabs">
        <button
          class={`leaderboard-tab ${activeView() === 'league' ? 'active' : ''}`}
          onClick={() => setActiveView('league')}
          data-testid="league-tab"
        >
          <IconTrophy />
          <span class="tab-name">League</span>
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
          class={`leaderboard-tab ${activeView() === 'global' ? 'active' : ''}`}
          onClick={() => setActiveView('global')}
          data-testid="global-tab"
        >
          <IconSearch />
          <span class="tab-name">Global</span>
          <span class="tab-count">{allLeaderboardUsers().length}</span>
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
            {/* The trophy rail — the first thing the tab shows. All seven
                rungs at full size; the signed-in rung is spotlit and
                auto-centered, the rest step back. Scrolls sideways on
                phones instead of shrinking the art. All rungs are visible
                for now — gating the view to "your league and below" (the
                surprise reveal) is a planned follow-up. */}
            <Show when={leagueLadder().length > 0}>
              <div
                class={`league-strip ${leagueMe()?.league != null ? 'has-current' : ''}`}
                data-testid="league-ladder"
                ref={(el) => {
                  stripEl = el
                  centerCurrentRung()
                }}
              >
                <For each={leagueLadder()}>
                  {(rung) => (
                    <div
                      class={`league-strip-rung ${
                        rung.id === leagueMe()?.league?.id ? 'current' : ''
                      } ${rung.isMystery ? 'mystery' : ''} ${
                        rungRevealed(rung) ? '' : 'locked'
                      }`}
                      data-current={
                        rung.id === leagueMe()?.league?.id ? 'true' : undefined
                      }
                      title={
                        rung.isMystery
                          ? 'Coming soon'
                          : rungRevealed(rung)
                            ? rung.name
                            : `Reach ${rung.name} to unveil its trophy`
                      }
                    >
                      <Show when={rung.trophyAsset}>
                        <img
                          class="league-strip-trophy"
                          src={
                            rungRevealed(rung)
                              ? (rung.trophyAsset ?? '')
                              : LOCKED_TROPHY
                          }
                          alt={
                            rung.isMystery
                              ? 'Mystery league'
                              : rungRevealed(rung)
                                ? rung.name
                                : `${rung.name} trophy, veiled until you reach it`
                          }
                        />
                      </Show>
                      <span class="league-strip-name">{rung.name}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show
              when={leagueMe()?.eligible === true}
              fallback={
                <div class="league-locked" data-testid="league-locked">
                  <p class="weekly-challenges-desc">
                    {/* Signed out, /api/league/me answers 401 and never
                        resolves — so a visitor would sit on "Loading your
                        league…" forever. This is now the landing view, so
                        that state has to be the invitation instead. */}
                    <Show
                      when={signedIn()}
                      fallback={
                        <>
                          Leagues are for registered singers. Practice earns
                          weekly points; the top of each league advances every
                          Monday.
                        </>
                      }
                    >
                      {/* Signed in: until the fetch answers, say nothing
                          committal — a blip must not tell a signed-in user
                          to go create an account. */}
                      <Show
                        when={leagueMe() != null}
                        fallback={<>Loading your league…</>}
                      >
                        <Show
                          when={leagueMe()?.reason !== 'unavailable'}
                          fallback={
                            <>
                              Leagues aren’t enabled on this environment yet —
                              its database predates the league tables. Apply the
                              D1 migrations that ship with this change and the
                              ladder lights up.
                            </>
                          }
                        >
                          Leagues are for registered singers. Practice earns
                          weekly points; the top of each league advances every
                          Monday.
                        </Show>
                      </Show>
                    </Show>
                  </p>
                  {/* The trophies above are the pitch; this is the door.
                      Better than sending them off to hunt through Settings. */}
                  <Show when={!signedIn()}>
                    <button
                      type="button"
                      class="challenge-join-btn league-join-cta"
                      onClick={() => openAuthModal('register')}
                    >
                      Create an account to climb
                    </button>
                  </Show>
                </div>
              }
            >
              {/* Your league, written large. The trophy itself lives in the
                  rail above — spotlit — so the hero is pure typography. */}
              <div class="league-hero" data-testid="league-rung-card">
                <span class="league-hero-eyebrow">Your league</span>
                <h3 class="league-hero-name" data-testid="league-rung-name">
                  {leagueMe()?.league?.name}
                </h3>
                <p class="league-hero-stats">
                  <strong>{leagueMe()?.points ?? 0} pts</strong> this week
                  <Show when={leagueMe()?.rank != null}>
                    {' '}
                    · #{leagueMe()?.rank} of {leagueMe()?.cohortSize}
                  </Show>
                </p>
                {/* Zone sentence needs the ladder for neighbour names; if it
                    hasn't loaded, saying nothing beats a wrong "top of the
                    ladder" or a dangling "drop to ." */}
                <Show when={leagueLadder().length > 0}>
                  <p class="league-hero-zones">
                    <Show
                      when={leagueNeighbours().up}
                      fallback={<>Top of the playable ladder — defend it.</>}
                    >
                      Top {leagueMe()?.league?.promoteCount} advance to{' '}
                      {leagueNeighbours().up?.name}.
                    </Show>{' '}
                    <Show
                      when={
                        (leagueMe()?.league?.relegateCount ?? 0) > 0 &&
                        leagueNeighbours().down != null
                      }
                    >
                      Bottom {leagueMe()?.league?.relegateCount} drop to{' '}
                      {leagueNeighbours().down?.name}.
                    </Show>
                  </p>
                </Show>
                <span class="league-cut-countdown">
                  Weekly cut in {formatCutCountdown(msUntilNextCut(nowMs()))}
                </span>
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
                  <For each={leagueBoard()}>
                    {(item) =>
                      item.kind === 'divider' ? (
                        <div class={`league-zone-divider ${item.zone}`}>
                          <svg
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                            aria-hidden="true"
                          >
                            <path
                              fill="currentColor"
                              d={
                                item.zone === 'promote'
                                  ? 'M12 4l7 8h-4.5v8h-5v-8H5z'
                                  : 'M12 20l-7-8h4.5V4h5v8H19z'
                              }
                            />
                          </svg>
                          <span>
                            {item.zone === 'promote'
                              ? 'Promotion zone'
                              : 'Relegation zone'}
                            <Show when={item.to}> · {item.to}</Show>
                          </span>
                        </div>
                      ) : (
                        <div
                          class={`league-standing-row ${
                            item.row.userId === getUserId() ? 'me' : ''
                          } ${item.zone}`}
                        >
                          <span class="league-standing-rank">
                            {item.row.rank}
                          </span>
                          <span class="league-standing-name">
                            <span class="league-standing-name-text">
                              {item.row.displayName}
                            </span>
                            <Show when={item.row.userId === getUserId()}>
                              <span class="league-standing-you">you</span>
                            </Show>
                          </span>
                          <span class="league-standing-points">
                            {item.row.points} pts
                          </span>
                        </div>
                      )
                    }
                  </For>
                </div>
              </Show>
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
                    </div>
                    {/* One reading of the number, not two. The stats row
                        said "Your progress: 0 / 55" and the bar's caption
                        said "0 / 55" directly beneath it. Label, bar, count
                        — and the bar spans the card instead of the 80px the
                        shared .progress-bar gives it. */}
                    <div class="challenge-progress">
                      <span class="challenge-progress-label">
                        {challenge.completed ? 'Completed' : 'Your progress'}
                      </span>
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
          {/* Everything below needs somebody on the board. The podium pads
              itself to three with "—" placeholders, so an empty board used
              to answer "no friends yet" with three ghost winners over an
              empty table; the fallback is the state instead. */}
          <Show when={allLeaderboardUsers().length > 0} fallback={emptyBoard()}>
            {/* Top 3 Podium */}
            <div class="podium-section">
              <For each={podiumData()}>
                {(user, index) => {
                  // podiumData() pads to three with a blank row, and a blank
                  // row is not a singer with no picture — it is an open
                  // place. It carries an empty userId, which is the only
                  // field that says so; `avatar` is `''` on it, so the old
                  // `!== undefined` test never fired and places 2 and 3 sat
                  // as empty grey rings.
                  const claimed = user.userId !== ''
                  return (
                    <div
                      class={`podium-item podium-${index() + 1} ${
                        claimed ? '' : 'podium-open'
                      }`}
                    >
                      {/* The medal is the card. It used to be a 44px
                          thumbnail stacked above an avatar, a name and a
                          score — four rows in which the one thing worth
                          looking at was the smallest. */}
                      <Show when={PODIUM_MEDALS[index()]}>
                        {(medal) => (
                          <img
                            class="podium-art"
                            src={medal().src}
                            alt={medal().alt}
                            width="384"
                            height="384"
                          />
                        )}
                      </Show>
                      <div class="podium-veil" aria-hidden="true" />
                      <div class="podium-strip">
                        <div class="podium-avatar">
                          {/* Accounts carry no picture yet — this is the
                              slot one goes in. */}
                          {claimed ? (
                            renderIcon(user.avatar ?? IconUser)
                          ) : (
                            <IconUnclaimedPlace />
                          )}
                        </div>
                        <div class="podium-ident">
                          <span class="podium-name">
                            {claimed ? user.displayName : 'Open place'}
                          </span>
                          <Show
                            when={claimed}
                            fallback={
                              <span class="podium-score-display podium-score-open">
                                Yours to take
                              </span>
                            }
                          >
                            <span class="podium-score-display">
                              {categoryMetric(user, activeCategory())}
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )
                }}
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
                    {/* The column follows the ranking: under "Longest Streak"
                      a column of current streaks would look shuffled. */}
                    <th class="streak-th">
                      {activeCategory() === 'streak' ? 'Longest' : 'Streak'}
                    </th>
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
                          {(user.rank === 2 || user.rank === 3) && (
                            <IconTrophy />
                          )}
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
                              {/* The server only publishes streaks on the
                                friends view (your own row aside); a zero
                                here means "not shared", not "zero days". */}
                              <Show when={user.streak > 0}>
                                <div class="user-streak-badge">
                                  {user.streak} day streak
                                </div>
                              </Show>
                            </div>
                          </div>
                        </td>
                        <td class="score-td">
                          <span class="score-value">
                            {user.score.toLocaleString()}
                          </span>
                        </td>
                        <td class="streak-td">
                          <Show
                            when={rowStreak(user) > 0}
                            fallback={<span class="streak-count">—</span>}
                          >
                            <div class="streak-bar">
                              <div
                                class="streak-fill"
                                style={{
                                  width: `${Math.min(rowStreak(user) * 10, 100)}%`,
                                  '--streak-color': getStreakColor(
                                    rowStreak(user),
                                  ),
                                }}
                              />
                            </div>
                            <span class="streak-count">{rowStreak(user)}</span>
                          </Show>
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
      // The category is "Longest Streak", so the number under a name has to
      // be the longest one — showing the current streak here made the board
      // look mis-sorted whenever someone's record outlived their run.
      return `${user.longestStreak} day${user.longestStreak === 1 ? '' : 's'}`
    case 'sessions':
      return `${user.totalSessions} session${user.totalSessions === 1 ? '' : 's'}`
    case 'overall':
    default:
      return `${user.score.toLocaleString()} pts`
  }
}
