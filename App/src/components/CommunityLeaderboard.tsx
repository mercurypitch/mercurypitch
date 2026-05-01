// ============================================================
// CommunityLeaderboard — Global/Friends/Weekly Leaderboards
// ============================================================

import type { Component } from 'solid-js'
import { For, createSignal, createMemo, onMount, Show } from 'solid-js'
import type { LeaderboardUser, LeaderboardView, LeaderboardCategory, WeeklyChallengeResult } from '@/types'

// ============================================================
// Mock Data
// ============================================================

const leaderboardCategories = [
  { id: 'overall' as const, name: 'Overall', icon: '📊' },
  { id: 'best-score' as const, name: 'Best Score', icon: '🎯' },
  { id: 'accuracy' as const, name: 'Accuracy', icon: '✨' },
  { id: 'streak' as const, name: 'Longest Streak', icon: '🔥' },
  { id: 'sessions' as const, name: 'Most Sessions', icon: '📚' },
]

const mockLeaderboardUsers: LeaderboardUser[] = [
  {
    userId: 'u1',
    displayName: 'MelodyMaven',
    avatar: '🎤',
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
    avatar: '🎶',
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
    avatar: '🎵',
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
    avatar: '⭐',
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
    avatar: '👑',
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
    avatar: '🎸',
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
    avatar: '🧙‍♀️',
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
    avatar: '🎵',
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
    avatar: '🎤',
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
    icon: '🎤',
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
    icon: '⚡',
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
    icon: '🎯',
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
    icon: '🌊',
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
  const [activeView, setActiveView] = createSignal<LeaderboardView>(props.view || 'global')
  const [activeCategory, setActiveCategory] = createSignal<LeaderboardCategory>(props.category || 'overall')
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedUser, setSelectedUser] = createSignal<LeaderboardUser | null>(null)

  // Current user's data
  const currentUser = createMemo(() => {
    return mockLeaderboardUsers.find(u => u.userId === 'me') || null
  })

  // Filter users based on search
  const filteredUsers = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return mockLeaderboardUsers.filter(u =>
      u.displayName.toLowerCase().includes(query) ||
      `#${u.userId}`.includes(query)
    )
  })

  return (
    <div class="community-leaderboard">
      {/* Header */}
      <div class="leaderboard-header">
        <div class="leaderboard-header-content">
          <h2>🏆 Leaderboard</h2>
          <p class="leaderboard-subtitle">Compete with other singers worldwide</p>
        </div>
      </div>

      {/* Leaderboard Tabs */}
      <div class="leaderboard-tabs">
        <button
          class={`leaderboard-tab ${activeView() === 'global' ? 'active' : ''}`}
          onClick={() => setActiveView('global')}
        >
          <span class="tab-icon">🌍</span>
          <span class="tab-name">Global</span>
          <span class="tab-count">{Math.floor(mockLeaderboardUsers.length / 1000)}.${Math.floor(mockLeaderboardUsers.length / 100) % 10}</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveView('friends')}
        >
          <span class="tab-icon">👥</span>
          <span class="tab-name">Friends</span>
          <span class="tab-count">8</span>
        </button>
        <button
          class={`leaderboard-tab ${activeView() === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveView('weekly')}
        >
          <span class="tab-icon">🔥</span>
          <span class="tab-name">Weekly</span>
          <span class="tab-count">⭐</span>
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
                {cat.icon}
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
          <h3 class="weekly-challenges-title">🔥 Weekly Challenges</h3>
          <p class="weekly-challenges-desc">Complete challenges to earn special badges and climb the ranks!</p>

          <div class="challenges-grid">
            <For each={weeklyChallengesData}>
              {(challenge) => (
                <div class="challenge-card" data-challenge={challenge.challengeId}>
                  <div class="challenge-icon">{challenge.icon}</div>
                  <div class="challenge-content">
                    <h4 class="challenge-name">{challenge.name}</h4>
                    <p class="challenge-desc">{challenge.description}</p>
                    <div class="challenge-stats">
                      <span class="stat-user">Your Rank: #{challenge.userRank}</span>
                      <span class="stat-global">Global: #{challenge.globalRank}</span>
                    </div>
                  </div>
                  <div class="challenge-progress">
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        style={{
                          width: `${(challenge.userScore / challenge.targetScore) * 100}%`,
                          '--progress-color': getScoreColor(challenge.userScore),
                        }}
                      />
                    </div>
                    <span class="progress-text">
                      {challenge.userScore} / {challenge.targetScore}
                    </span>
                  </div>
                  <button class="challenge-join-btn" disabled={challenge.userScore >= challenge.targetScore}>
                    {challenge.userScore >= challenge.targetScore ? '✓ Completed' : 'Join Challenge'}
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
                    {index() === 0 && '🥇'}
                    {index() === 1 && '🥈'}
                    {index() === 2 && '🥉'}
                    {index() >= 3 && `#${user.rank}`}
                  </div>
                  <div class="podium-avatar">{user.avatar}</div>
                  <div class="podium-info">
                    <div class="podium-name">{user.displayName}</div>
                    <div class="podard-score">{user.score.toLocaleString()} pts</div>
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
                  <th class="streak-th">🔥</th>
                  <th class="sessions-th">📊</th>
                  <th class="best-th">🎯</th>
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
                        {index() < 3 && (
                          <>
                            {index() === 0 && '🥇'}
                            {index() === 1 && '🥈'}
                            {index() === 2 && '🥉'}
                          </>
                        )}
                        {index() >= 3 && index() + 1}
                      </td>
                      <td class="user-td">
                        <div class="user-cell">
                          <div class="user-avatar">{user.avatar}</div>
                          <div class="user-details">
                            <div class="user-name">{user.displayName}</div>
                            <div class="user-streak-badge">
                              {user.streak} day streak
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="score-td">
                        <span class="score-value">{user.score.toLocaleString()}</span>
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
          <div class="profile-modal-backdrop" onClick={() => setSelectedUser(null)} />
          <div class="profile-modal-content">
            <button class="profile-modal-close" onClick={() => setSelectedUser(null)}>
              ✕
            </button>

            <div class="profile-header">
              <div class="profile-avatar-large">{selectedUser()?.avatar}</div>
              <div class="profile-header-info">
                <div class="profile-rank-badge">
                  Rank #{selectedUser()?.rank}
                </div>
                <h2 class="profile-name">{selectedUser()?.displayName}</h2>
                <p class="profile-bio">
                  {selectedUser()?.streak} day streak • {selectedUser()?.totalSessions} sessions •
                  {selectedUser()?.accuracy}% accuracy
                </p>
              </div>
            </div>

            <div class="profile-stats-grid">
              <div class="stat-card">
                <span class="stat-icon">🎯</span>
                <div class="stat-content">
                  <span class="stat-label">Best Score</span>
                  <span class="stat-value">{selectedUser()?.bestScore}%</span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">📊</span>
                <div class="stat-content">
                  <span class="stat-label">Total Sessions</span>
                  <span class="stat-value">{selectedUser()?.totalSessions}</span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">🔥</span>
                <div class="stat-content">
                  <span class="stat-label">Current Streak</span>
                  <span class="stat-value">{selectedUser()?.streak}</span>
                </div>
              </div>
              <div class="stat-card">
                <span class="stat-icon">⭐</span>
                <div class="stat-content">
                  <span class="stat-label">Rank Points</span>
                  <span class="stat-value">{selectedUser()?.score.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="profile-charts">
              <h4>Weekly Performance</h4>
              <div class="mini-chart">
                {[75, 82, 68, 90, 85, 92, 78].map((score: number, i: number) => (
                  <div class="mini-bar-wrapper">
                    <div
                      class="mini-bar leaderboard-bar"
                      style={{
                        width: `${score}%`,
                        background: getBarColor(score),
                      }}
                    />
                  </div>
                ))}
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
    mockLeaderboardUsers[0] || { userId: '', displayName: '—', avatar: '', score: 0, rank: 0, streak: 0, totalSessions: 0, bestScore: 0, accuracy: 0, joinDate: 0 },
    mockLeaderboardUsers[1] || { userId: '', displayName: '—', avatar: '', score: 0, rank: 0, streak: 0, totalSessions: 0, bestScore: 0, accuracy: 0, joinDate: 0 },
    mockLeaderboardUsers[2] || { userId: '', displayName: '—', avatar: '', score: 0, rank: 0, streak: 0, totalSessions: 0, bestScore: 0, accuracy: 0, joinDate: 0 },
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
