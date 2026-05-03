// ============================================================
// CommunityLeaderboard — Global/Friends/Weekly Leaderboards
// ============================================================

import type { Component } from 'solid-js'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { LeaderboardCategory, LeaderboardUser, LeaderboardView, WeeklyChallengeResult, } from '@/types'

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

const IconGuitar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
    <path d="M11 14a3 3 0 1 0-4 0" />
  </svg>
)

const IconWizard = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    <path d="M12 11a5 5 0 0 1 5 5v3H7v-3a5 5 0 0 1 5-5z" />
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

const IconFire = () => (
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

const IconFilter = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)

// Helper to render icon: handles both Component functions and string values
function renderIcon(icon: Component | string) {
  return typeof icon === 'function' ? (icon as () => JSX.Element)() : icon
}

// ============================================================
// Mock Data
// ============================================================

const leaderboardCategories = [
  { id: 'overall' as const, name: 'Overall', icon: IconOverall },
  { id: 'best-score' as const, name: 'Best Score', icon: IconScore },
  { id: 'accuracy' as const, name: 'Accuracy', icon: IconAccuracy },
  { id: 'streak' as const, name: 'Longest Streak', icon: IconStreak },
  { id: 'sessions' as const, name: 'Most Sessions', icon: IconSessions },
]

const mockLeaderboardUsers: LeaderboardUser[] = [
  {
    userId: 'u1',
    displayName: 'MelodyMaven',
    avatar: IconUser,
    score: 1543200,
    rank: 1,
    streak: 45,
    totalSessions: 324,
    bestScore: 98,
    accuracy: 92,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
  },
  {
    userId: 'u2',
    displayName: 'VocalVirtuoso',
    avatar: IconUser,
    score: 1498500,
    rank: 2,
    streak: 38,
    totalSessions: 289,
    bestScore: 97,
    accuracy: 91,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365 * 2,
  },
  {
    userId: 'u3',
    displayName: 'PitchPerfectPro',
    avatar: IconUser,
    score: 1421000,
    rank: 3,
    streak: 52,
    totalSessions: 356,
    bestScore: 96,
    accuracy: 90,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365 * 3,
  },
  {
    userId: 'u4',
    displayName: 'SingingStar',
    avatar: IconUser,
    score: 1385000,
    rank: 4,
    streak: 28,
    totalSessions: 198,
    bestScore: 95,
    accuracy: 88,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365 * 2,
  },
  {
    userId: 'u5',
    displayName: 'HarmonyKing',
    avatar: IconUser,
    score: 1312000,
    rank: 5,
    streak: 31,
    totalSessions: 245,
    bestScore: 94,
    accuracy: 87,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
  },
  {
    userId: 'u6',
    displayName: 'ToneMaster',
    avatar: IconUser,
    score: 1248000,
    rank: 6,
    streak: 22,
    totalSessions: 187,
    bestScore: 93,
    accuracy: 86,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
  },
  {
    userId: 'u7',
    displayName: 'VoiceWizard',
    avatar: IconWizard,
    score: 1183000,
    rank: 7,
    streak: 25,
    totalSessions: 156,
    bestScore: 92,
    accuracy: 85,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
  },
  {
    userId: 'u8',
    displayName: 'SoundSaga',
    avatar: IconUser,
    score: 1125000,
    rank: 8,
    streak: 19,
    totalSessions: 134,
    bestScore: 91,
    accuracy: 84,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 365,
  },
  {
    userId: 'me',
    displayName: 'SingerPro',
    avatar: IconUser,
    score: 875000,
    rank: 42,
    streak: 7,
    totalSessions: 45,
    bestScore: 85,
    accuracy: 78,
    joinDate: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
]

const weeklyChallengesData: WeeklyChallengeResult[] = [
  {
    challengeId: 'c1',
    name: 'High Note King',
    description: 'Achieve 90%+ accuracy on all C5+ notes in 3 sessions',
    icon: IconChallenge,
    userRank: 15,
    globalRank: 127,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
    type: 'high-notes',
    targetScore: 100,
    userScore: 0,
  },
  {
    challengeId: 'c2',
    name: 'Speed Demon',
    description: 'Complete 10 scales in under 30 seconds each',
    icon: IconChallenge,
    userRank: 8,
    globalRank: 89,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 1,
    type: 'speed',
    targetScore: 100,
    userScore: 35,
  },
  {
    challengeId: 'c3',
    name: 'Perfect Pitch Master',
    description: 'Get 100% accuracy on 3 consecutive sessions',
    icon: IconChallenge,
    userRank: 23,
    globalRank: 156,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 3,
    type: 'perfect',
    targetScore: 100,
    userScore: 0,
  },
  {
    challengeId: 'c4',
    name: 'Scale Surfer',
    description: 'Complete 20 different scale types',
    icon: IconChallenge,
    userRank: 5,
    globalRank: 67,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 4,
    type: 'scales',
    targetScore: 20,
    userScore: 18,
  },
]

// ============================================================
// Component
// ============================================================

export const CommunityLeaderboard: Component<LeaderboardProps> = (props) => {
  const [activeView, setActiveView] = createSignal<LeaderboardView>(
    props.view || 'global',
  )
  const [activeCategory, setActiveCategory] = createSignal<LeaderboardCategory>(
    props.category || 'overall',
  )
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedUser, setSelectedUser] = createSignal<LeaderboardUser | null>(
    null,
  )

  // Current user's data
  const currentUser = createMemo(() => {
    return mockLeaderboardUsers.find((u) => u.userId === 'me') || null
  })

  // Filter users based on search
  const filteredUsers = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return mockLeaderboardUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        `#${u.userId}`.includes(query),
    )
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
          <span class="tab-count">
            {Math.floor(mockLeaderboardUsers.length / 1000)}.$
            {Math.floor(mockLeaderboardUsers.length / 100) % 10}
          </span>
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
          <span class="tab-count">8</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveView('weekly')}
        >
          <IconStreak />
          <span class="tab-name">Weekly</span>
          <span class="tab-count">3</span>
        </button>
      </div>

      {/* Category Tabs */}
      {activeView() !== 'weekly' && (
        <div class="category-tabs">
          <For each={leaderboardCategories}>
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

      {/* Search Bar */}
      <div class="search-container">
        <input
          type="text"
          class="search-input"
          placeholder="Search players..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <button class="filter-btn">
          <span>⚙️</span> Filter
        </button>
      </div>

      {/* Weekly Challenges View */}
      <Show when={activeView() === 'weekly'}>
        <div class="weekly-challenges">
          <h3 class="weekly-challenges-title">Weekly Challenges</h3>
          <p class="weekly-challenges-desc">
            Complete challenges to earn special badges and climb the ranks!
          </p>

          <div class="challenges-grid">
            <For each={weeklyChallengesData}>
              {(challenge) => (
                <div
                  class="challenge-card"
                  data-challenge={challenge.challengeId}
                >
                  <div class="challenge-icon">{renderIcon(challenge.icon)}</div>
                  <div class="challenge-content">
                    <h4 class="challenge-name">{challenge.name}</h4>
                    <p class="challenge-desc">{challenge.description}</p>
                    <div class="challenge-stats">
                      <span class="stat-user">
                        Your Rank: #{challenge.userRank}
                      </span>
                      <span class="stat-global">
                        Global: #{challenge.globalRank}
                      </span>
                    </div>
                  </div>
                  <div class="challenge-progress">
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        style={{
                          width: `${(challenge.userScore / challenge.targetScore) * 100}%`,
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
                    disabled={challenge.userScore >= challenge.targetScore}
                  >
                    {challenge.userScore >= challenge.targetScore
                      ? 'Completed'
                      : 'Join Challenge'}
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Leaderboard Table View */}
      <Show when={activeView() !== 'weekly'}>
        <div class="leaderboard-content">
          {/* Top 3 Podium */}
          <div class="podium-section">
            <For each={getPodiumData()}>
              {(user, index) => (
                <div class={`podium-item podium-${index() + 1}`}>
                  <div class="podium-rank">
                    {index() === 0 && <TrophyIcon />}
                    {index() === 1 && <IconTrophy />}
                    {index() === 2 && <IconTrophy />}
                    {index() >= 3 && `#${user.rank}`}
                  </div>
                  <div class="podium-avatar">
                    {user.avatar ? renderIcon(user.avatar) : null}
                  </div>
                  <div class="podium-info">
                    <div class="podium-name">{user.displayName}</div>
                    <div class="podard-score">
                      {user.score.toLocaleString()} pts
                    </div>
                  </div>
                  <Show when={index() < 3}>
                    <div class="podium-score-display">
                      {user.score.toLocaleString()}
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
                  {(user, index) => (
                    <tr
                      class={`leaderboard-row ${user.userId === 'me' ? 'is-me' : ''}`}
                      data-rank={index() + 1}
                      data-user-id={user.userId}
                      onClick={() => setSelectedUser(user)}
                    >
                      <td class="rank-td">
                        {index() < 3 && index() === 0 && <TrophyIcon />}
                        {index() < 3 && index() === 1 && <IconTrophy />}
                        {index() < 3 && index() === 2 && <IconTrophy />}
                        {index() >= 3 && index() + 1}
                      </td>
                      <td class="user-td">
                        <div class="user-cell">
                          <div class="user-avatar">
                            {user.avatar ? renderIcon(user.avatar) : null}
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

          {/* Load More */}
          <div class="load-more-container">
            <button class="load-more-btn">Load More Players</button>
          </div>
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
              ✕
            </button>

            <div class="profile-header">
              {(() => {
                const user = selectedUser()
                return user?.avatar ? renderIcon(user.avatar) : null
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

            <div class="profile-charts">
              <h4>Weekly Performance</h4>
              <div class="mini-chart">
                {[75, 82, 68, 90, 85, 92, 78].map(
                  (score: number, i: number) => (
                    <div class="mini-bar-wrapper">
                      <div
                        class="mini-bar leaderboard-bar"
                        style={{
                          width: `${score}%`,
                          background: getBarColor(score),
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            <div class="profile-actions">
              <button class="profile-follow-btn">Follow Player</button>
              <button class="profile-view-btn">View Profile</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

interface LeaderboardProps {
  view?: LeaderboardView
  category?: LeaderboardCategory
}

function getPodiumData(): LeaderboardUser[] {
  return [
    mockLeaderboardUsers[0] || {
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
    },
    mockLeaderboardUsers[1] || {
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
    },
    mockLeaderboardUsers[2] || {
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
    },
  ]
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

function getBarColor(score: number): string {
  if (score >= 90) return 'var(--green)'
  if (score >= 75) return 'var(--accent)'
  if (score >= 60) return 'var(--teal)'
  return 'var(--yellow)'
}
