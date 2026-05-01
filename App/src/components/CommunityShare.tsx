// ============================================================
// CommunityShare — Community Sharing & Profile Tab
// ============================================================

import type { Component } from 'solid-js'
import { For, Show, createSignal, createMemo, onMount } from 'solid-js'
import { appStore, getSessionHistory, melodyStore } from '@/stores'
import type { SessionResult, MelodyItem, PlaybackSession } from '@/types'
import { generateId } from '@/lib/id'
import { frequenciesToNoteName } from '@/lib/frequency-to-note'

// ============================================================
// Types
// ============================================================

export type ShareableContent = 'melody' | 'session' | 'result' | 'profile'

export interface SharedMelody {
  id: string
  name: string
  items: MelodyItem[]
  author: string
  tags?: string[]
  date: number
}

export interface SharedSession {
  id: string
  name: string
  items: PlaybackSession['items']
  author: string
  results: number[]
  date: number
}

export interface UserStats {
  userId: string
  displayName: string
  avatar?: string
  bio?: string
  streak: number
  totalSessions: number
  bestScore: number
  accuracy: number
  joinDate: number
}

export interface SharedProfile {
  userId: string
  avatar?: string
  stats: UserStats
  sharedMelodies: SharedMelody[]
  sharedSessions: SharedSession[]
}

// ============================================================
// Component
// ============================================================

export const CommunityShare: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'melodies' | 'sessions' | 'profile'>('melodies')
  const [userProfile, setUserProfile] = createSignal<SharedProfile | null>(null)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [sortBy, setSortBy] = createSignal<'recent' | 'popular' | 'highest'>('recent')
  const [selectedShare, setSelectedShare] = createSignal<ShareableContent | null>(null)

  // Load shared data from localStorage
  const sharedMelodies = createMemo(() => {
    try {
      const stored = localStorage.getItem('pp_shared_melodies')
      if (stored) {
        return JSON.parse(stored) as SharedMelody[]
      }
    } catch { }
    return []
  })

  const sharedSessions = createMemo(() => {
    try {
      const stored = localStorage.getItem('pp_shared_sessions')
      if (stored) {
        return JSON.parse(stored) as SharedSession[]
      }
    } catch { }
    return []
  })

  // Current user profile (in-memory for demo)
  const currentProfile = createMemo(() => {
    const userId = localStorage.getItem('pp_user_id') || `user_${Date.now()}`
    localStorage.setItem('pp_user_id', userId)

    const sessions = getSessionHistory()
    const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0)
    const avgScore = sessions.length > 0 ? totalScore / sessions.length : 0
    const maxStreak = 5
    const currentStreak = 2

    return {
      userId,
      displayName: 'SingerPro',
      avatar: '🎤',
      bio: 'PitchPerfect enthusiast • Learning vocals • Member since 2026',
      streak: currentStreak,
      totalSessions: sessions.length,
      bestScore: sessions.length > 0 ? Math.max(...sessions.map(s => s.score || 0)) : 0,
      accuracy: sessions.length > 0 ? avgScore : 0,
      joinDate: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
    }
  })

  // Filter and sort shared melodies
  const displayMelodies = createMemo(() => {
    let result = sharedMelodies()

    if (searchQuery()) {
      const query = searchQuery().toLowerCase()
      result = result.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.tags?.some(t => t.toLowerCase().includes(query))
      )
    }

    if (sortBy() === 'recent') {
      result = [...result].sort((a, b) => b.date - a.date)
    } else if (sortBy() === 'popular') {
      result = [...result].sort((a, b) => (b.date - a.date) * 0.7 + Math.random() * 0.3)
    }

    return result
  })

  // Filter and sort shared sessions
  const displaySessions = createMemo(() => {
    let result = sharedSessions()

    if (searchQuery()) {
      const query = searchQuery().toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.results.some(r => r >= 80) // Show sessions with good scores
      )
    }

    if (sortBy() === 'recent') {
      result = [...result].sort((a, b) => b.date - a.date)
    }

    return result
  })

  // Export current melody as shareable
  const exportMelody = () => {
    const items = melodyStore.currentMelody()?.items || []
    if (items.length === 0) {
      alert('No melody to share!')
      return
    }

    const shareable: SharedMelody = {
      id: generateId(),
      name: 'My Melody',
      items,
      author: currentProfile().displayName,
      tags: ['my-melody', 'practice'],
      date: Date.now(),
    }

    const updated = [...sharedMelodies(), shareable]
    localStorage.setItem('pp_shared_melodies', JSON.stringify(updated))
    alert('Melody shared successfully!')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Export current session as shareable
  const exportSession = () => {
    const sessions = appStore.getSessionHistory()
    if (sessions.length === 0) {
      alert('No session to share!')
      return
    }

    const shareable: SharedSession = {
      id: generateId(),
      name: 'My Practice Session',
      items: [],
      author: currentProfile().displayName,
      results: sessions.map(s => s.score || 0),
      date: Date.now(),
    }

    const updated = [...sharedSessions(), shareable]
    localStorage.setItem('pp_shared_sessions', JSON.stringify(updated))
    alert('Session shared successfully!')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Copy shareable link to clipboard
  const copyShareLink = (type: 'melody' | 'session', id: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/share?type=${type}&id=${id}`
    navigator.clipboard.writeText(link)
    alert('Share link copied to clipboard!')
  }

  // Generate shareable URL for content
  const generateShareUrl = (type: ShareableContent, id: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/share?type=${type}&id=${id}`
  }

  // Tabs
  const tabs = [
    { id: 'melodies' as const, name: 'Melodies', icon: '🎵', count: sharedMelodies().length },
    { id: 'sessions' as const, name: 'Sessions', icon: '📚', count: sharedSessions().length },
    { id: 'profile' as const, name: 'Profile', icon: '👤', count: 0 },
  ]

  return (
    <div class="community-share-tab">
      {/* Header */}
      <div class="community-header">
        <div class="community-header-content">
          <h2>Community</h2>
          <p class="community-subtitle">Share your progress, discover melodies, and connect with other singers</p>
        </div>
        <div class="community-actions">
          <button class="share-btn" onClick={exportMelody}>
            <span>📤</span> Share Melody
          </button>
          <button class="share-btn" onClick={exportSession}>
            <span>📤</span> Share Session
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div class="search-filter-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search melodies, sessions..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <div class="sort-select">
          <select value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value as any)}>
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="highest">Highest Scores</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div class="community-tabs">
        <For each={tabs}>
          {(tab) => (
            <button
              class={`community-tab ${activeTab() === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span class="tab-icon">{tab.icon}</span>
              <span class="tab-name">{tab.name}</span>
              {tab.count > 0 && <span class="tab-count">{tab.count}</span>}
            </button>
          )}
        </For>
      </div>

      {/* Content */}
      <div class="community-content">
        <Show when={activeTab() === 'melodies'}>
          <div class="melodies-grid">
            <For each={displayMelodies()}>
              {(melody) => (
                <div class="melody-card" data-share-type="melody" data-share-id={melody.id}>
                  <div class="melody-header">
                    <h3 class="melody-name">{melody.name}</h3>
                    <span class="melody-date">
                      {new Date(melody.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div class="melody-info">
                    <span class="melody-author">by {melody.author}</span>
                    <div class="melody-tags">
                      {melody.tags?.map(tag => (
                        <span class="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div class="melody-footer">
                    <button class="action-btn copy-btn" onClick={() => copyShareLink('melody', melody.id)}>
                      <span>🔗</span> Copy Link
                    </button>
                    <button class="action-btn view-btn">
                      <span>👀</span> View
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displayMelodies().length === 0 && (
              <div class="empty-state">
                <span class="empty-icon">🎼</span>
                <h3>No melodies shared yet</h3>
                <p>Share your melodies with the community to start building your library.</p>
                <button class="primary-btn" onClick={exportMelody}>
                  Share Your First Melody
                </button>
              </div>
            )}
          </div>
        </Show>

        <Show when={activeTab() === 'sessions'}>
          <div class="sessions-grid">
            <For each={displaySessions()}>
              {(session) => (
                <div class="session-card" data-share-type="session" data-share-id={session.id}>
                  <div class="session-header">
                    <h3 class="session-name">{session.name}</h3>
                    <div class="session-scores">
                      {session.results.map((score, i) => (
                        <span class="session-score-badge" style={{ '--score': score }}>
                          {score}%
                        </span>
                      ))}
                    </div>
                  </div>
                  <div class="session-info">
                    <span class="session-author">by {session.author}</span>
                    <span class="session-date">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div class="session-stats">
                    <div class="stat-item">
                      <span class="stat-icon">📊</span>
                      <span class="stat-value">{session.results.length} runs</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-icon">📈</span>
                      <span class="stat-value">
                        {Math.round(session.results.reduce((a,b) => a+b,0)/session.results.length)}% avg
                      </span>
                    </div>
                  </div>
                  <div class="session-footer">
                    <button class="action-btn copy-btn" onClick={() => copyShareLink('session', session.id)}>
                      <span>🔗</span> Copy Link
                    </button>
                    <button class="action-btn view-btn">
                      <span>👀</span> View
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displaySessions().length === 0 && (
              <div class="empty-state">
                <span class="empty-icon">📚</span>
                <h3>No sessions shared yet</h3>
                <p>Share your practice sessions to track progress and inspire others.</p>
                <button class="primary-btn" onClick={exportSession}>
                  Share Your First Session
                </button>
              </div>
            )}
          </div>
        </Show>

        <Show when={activeTab() === 'profile'}>
          <div class="profile-container">
            {/* Profile Header */}
            <div class="profile-header">
              <div class="profile-avatar">{userProfile()?.avatar || '👤'}</div>
              <div class="profile-info">
                <h2 class="profile-name">{currentProfile()?.displayName}</h2>
                <p class="profile-bio">{currentProfile()?.bio}</p>
                <div class="profile-stats-row">
                  <div class="stat-badge">
                    <span class="stat-label">Streak</span>
                    <span class="stat-value streak">{currentProfile()?.streak} 🔥</span>
                  </div>
                  <div class="stat-badge">
                    <span class="stat-label">Sessions</span>
                    <span class="stat-value">{currentProfile()?.totalSessions}</span>
                  </div>
                  <div class="stat-badge">
                    <span class="stat-label">Best Score</span>
                    <span class="stat-value score">{currentProfile()?.bestScore}%</span>
                  </div>
                  <div class="stat-badge">
                    <span class="stat-label">Accuracy</span>
                    <span class="stat-value accuracy">{currentProfile()?.accuracy}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Chart Placeholder */}
            <div class="profile-charts">
              <div class="chart-card">
                <h3>Weekly Progress</h3>
                <div class="mini-chart">
                  {[65, 78, 72, 85, 90, 82, 75].map((score, i) => (
                    <div class="mini-bar-wrapper">
                      <div
                        class="mini-bar"
                        style={{
                          width: `${score}%`,
                          background: getBarColor(score),
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div class="chart-card">
                <h3>Accuracy Over Time</h3>
                <div class="mini-chart">
                  {[70, 72, 71, 75, 78, 80, 82].map((score, i) => (
                    <div class="mini-bar-wrapper">
                      <div
                        class="mini-bar line-chart"
                        style={{
                          height: `${score}%`,
                          background: getBarColor(score),
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Personal Records */}
            <div class="personal-records">
              <h3>Personal Records</h3>
              <div class="records-grid">
                <div class="record-item">
                  <span class="record-icon">🎤</span>
                  <div class="record-info">
                    <span class="record-label">Highest Note</span>
                    <span class="record-value">C5</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">🎯</span>
                  <div class="record-info">
                    <span class="record-label">Perfect Run</span>
                    <span class="record-value">27 notes</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">⚡</span>
                  <div class="record-info">
                    <span class="record-label">Fastest Scale</span>
                    <span class="record-value">8 notes/sec</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">🎵</span>
                  <div class="record-info">
                    <span class="record-label">First Session</span>
                    <span class="record-value">2026-04-01</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared Content Preview */}
            <div class="shared-content-preview">
              <h3>Shared Content</h3>
              <div class="preview-list">
                <Show when={displayMelodies().length > 0}>
                  <div class="preview-section">
                    <h4>🎵 Shared Melodies</h4>
                    <div class="preview-grid">
                      <For each={displayMelodies().slice(0, 3)}>
                        {(melody) => (
                          <div class="preview-card">
                            <span class="preview-name">{melody.name}</span>
                            <span class="preview-date">{new Date(melody.date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
                <Show when={displaySessions().length > 0}>
                  <div class="preview-section">
                    <h4>📚 Shared Sessions</h4>
                    <div class="preview-grid">
                      <For each={displaySessions().slice(0, 3)}>
                        {(session) => (
                          <div class="preview-card">
                            <span class="preview-name">{session.name}</span>
                            <span class="preview-scores">
                              {session.results.slice(0, 2).map(s => `${s}%`)}
                              {session.results.length > 2 && `+${session.results.length - 2}`}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )

  function getBarColor(score: number): string {
    if (score >= 90) return 'var(--green)'
    if (score >= 75) return 'var(--accent)'
    if (score >= 60) return 'var(--teal)'
    return 'var(--yellow)'
  }
}
