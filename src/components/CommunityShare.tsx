// ============================================================
// CommunityShare — Community Sharing & Profile Tab
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { generateId } from '@/lib/id'
import { appStore, getSessionHistory, melodyStore } from '@/stores'
import type { MelodyItem, PlaybackSession } from '@/types'

// ============================================================
// SVG Icons (Classy, minimal style)
// ============================================================

const IconMelody = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
)

const IconSession = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
)

const _IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
)

const IconStats = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
)

const _IconHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
)

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-avatar"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
)

const IconStreak = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.4.5.7 1.3 1 2.3z"/></svg>
)

const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="23"/><line x1="8" x2="16" y1="23" y2="23"/></svg>
)

const IconGoal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
)

const IconShare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
)

const IconLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
)

const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
)

const _IconUser2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-avatar"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
)

const IconMusic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
)

const IconBook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
)

const _IconStreak2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.4.5.7 1.3 1 2.3z"/></svg>
)

const _IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polyline points="20 6 9 17 4 12"/></svg>
)

const _IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
)

const _IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
)

const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
)

const _IconTrophy2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
)

const _IconEmblem = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
)

const _IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)

const _IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
)

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
  const [_userProfile, _setUserProfile] = createSignal<SharedProfile | null>(null)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [sortBy, setSortBy] = createSignal<'recent' | 'popular' | 'highest'>('recent')
  const [_selectedShare, _setSelectedShare] = createSignal<ShareableContent | null>(null)

  // Load shared data from localStorage
  const sharedMelodies = createMemo(() => {
    try {
      const stored = localStorage.getItem('pp_shared_melodies')
      if (stored !== null) {
        return JSON.parse(stored) as SharedMelody[]
      }
    } catch {
      // Ignore parse errors
    }
    return []
  })

  const sharedSessions = createMemo(() => {
    try {
      const stored = localStorage.getItem('pp_shared_sessions')
      if (stored !== null) {
        return JSON.parse(stored) as SharedSession[]
      }
    } catch {
      // Ignore parse errors
    }
    return []
  })

  // Current user profile (in-memory for demo)
  const currentProfile = createMemo(() => {
    const userId = localStorage.getItem('pp_user_id') ?? `user_${Date.now()}`
    localStorage.setItem('pp_user_id', userId)

    const sessions = getSessionHistory()
    const totalScore = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0)
    const avgScore = sessions.length > 0 ? totalScore / sessions.length : 0
    const _maxStreak = 5
    const currentStreak = 2

    return {
      userId,
      displayName: 'SingerPro',
      avatar: IconMic(),
      bio: 'PitchPerfect enthusiast • Learning vocals • Member since 2026',
      streak: currentStreak,
      totalSessions: sessions.length,
      bestScore: sessions.length > 0 ? Math.max(...sessions.map(s => s.score ?? 0)) : 0,
      accuracy: sessions.length > 0 ? avgScore : 0,
      joinDate: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
    }
  })

  // Filter and sort shared melodies
  const displayMelodies = createMemo(() => {
    let result = sharedMelodies()

    if (searchQuery()) {
      const query = searchQuery().toLowerCase()
      result = result.filter((m) =>
        m.name.toLowerCase().includes(query) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(query))
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
      result = result.filter((s) =>
        s.name.toLowerCase().includes(query) ||
        s.results.some((r) => r >= 80)
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
  const _generateShareUrl = (type: ShareableContent, id: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/share?type=${type}&id=${id}`
  }

  // Tabs
  const tabs = createMemo(() => [
    { id: 'melodies' as const, name: 'Melodies', icon: IconMelody, count: sharedMelodies().length },
    { id: 'sessions' as const, name: 'Sessions', icon: IconSession, count: sharedSessions().length },
    { id: 'profile' as const, name: 'Profile', icon: IconUser, count: 0 },
  ])

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
            <span><IconShare /></span> Share Melody
          </button>
          <button class="share-btn" onClick={exportSession}>
            <span><IconShare /></span> Share Session
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
          <select
            value={sortBy()}
            onChange={(e) => setSortBy(e.currentTarget.value as 'recent' | 'popular' | 'highest')}
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="highest">Highest Scores</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div class="community-tabs">
        <For each={tabs()}>
          {(tab) => (
            <button
              class={`community-tab ${activeTab() === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span class="tab-icon">{tab.icon()}</span>
              <span class="tab-name">{tab.name}</span>
              {tab.count !== 0 && <span class="tab-count">{tab.count}</span>}
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
                      {melody.tags !== null && <For each={melody.tags}>{(tag) => (
                        <span class="tag">{tag}</span>
                      )}</For>}
                    </div>
                  </div>
                  <div class="melody-footer">
                    <button class="action-btn copy-btn" onClick={() => copyShareLink('melody', melody.id)}>
                      <span><IconLink /></span> Copy Link
                    </button>
                    <button class="action-btn view-btn">
                      <span><IconEye /></span> View
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displayMelodies().length === 0 && (
              <div class="empty-state">
                <span class="empty-icon">{IconMelody()}</span>
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
                      <For each={session.results}>{(score) => (
                        <span class="session-score-badge" style={{ '--score': score }}>
                          {score}%
                        </span>
                      )}</For>
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
                      <span class="stat-icon">{IconSession()}</span>
                      <span class="stat-value">{session.results.length} runs</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-icon">{IconStats()}</span>
                      <span class="stat-value">
                        {Math.round(session.results.reduce((a,b) => a+b,0)/session.results.length)}% avg
                      </span>
                    </div>
                  </div>
                  <div class="session-footer">
                    <button class="action-btn copy-btn" onClick={() => copyShareLink('session', session.id)}>
                      <span><IconLink /></span> Copy Link
                    </button>
                    <button class="action-btn view-btn">
                      <span><IconEye /></span> View
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displaySessions().length === 0 && (
              <div class="empty-state">
                <span class="empty-icon">{IconSession()}</span>
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
              <div class="profile-avatar">{_userProfile()?.avatar ?? IconUser()}</div>
              <div class="profile-info">
                <h2 class="profile-name">{currentProfile()?.displayName}</h2>
                <p class="profile-bio">{currentProfile()?.bio}</p>
                <div class="profile-stats-row">
                  <div class="stat-badge">
                    <span class="stat-label">Streak</span>
                    <span class="stat-value streak">{currentProfile()?.streak} <IconStreak /></span>
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
                  <For each={[65, 78, 72, 85, 90, 82, 75]}>{(score) => (
                    <div class="mini-bar-wrapper">
                      <div
                        class="mini-bar"
                        style={{
                          width: `${score}%`,
                          background: getBarColor(score),
                        }}
                      />
                    </div>
                  )}</For>
                </div>
              </div>
              <div class="chart-card">
                <h3>Accuracy Over Time</h3>
                <div class="mini-chart">
                  <For each={[70, 72, 71, 75, 78, 80, 82]}>{(score) => (
                    <div class="mini-bar-wrapper">
                      <div
                        class="mini-bar line-chart"
                        style={{
                          height: `${score}%`,
                          background: getBarColor(score),
                        }}
                      />
                    </div>
                  )}</For>
                </div>
              </div>
            </div>

            {/* Personal Records */}
            <div class="personal-records">
              <h3>Personal Records</h3>
              <div class="records-grid">
                <div class="record-item">
                  <span class="record-icon">{IconMic()}</span>
                  <div class="record-info">
                    <span class="record-label">Highest Note</span>
                    <span class="record-value">C5</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">{IconGoal()}</span>
                  <div class="record-info">
                    <span class="record-label">Perfect Run</span>
                    <span class="record-value">27 notes</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">{IconStar()}</span>
                  <div class="record-info">
                    <span class="record-label">Fastest Scale</span>
                    <span class="record-value">8 notes/sec</span>
                  </div>
                </div>
                <div class="record-item">
                  <span class="record-icon">{IconMelody()}</span>
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
                    <h4><IconMusic /> Shared Melodies</h4>
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
                    <h4><IconBook /> Shared Sessions</h4>
                    <div class="preview-grid">
                      <For each={displaySessions().slice(0, 3)}>
                        {(session) => (
                          <div class="preview-card">
                            <span class="preview-name">{session.name}</span>
                            <span class="preview-scores">
                              <For each={session.results.slice(0, 2)}>{s => `${s}%`}</For>
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
