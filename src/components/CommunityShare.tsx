// ============================================================
// CommunityShare — Community Sharing & Profile Tab
// ============================================================

import type { Component } from 'solid-js'
import modalStyles from '@/components/Modal.module.css'
import tabStyles from '@/components/AppNavTabs.module.css'
import profileStyles from '@/components/CommunityShare.module.css'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { loadSharedMelodies, loadSharedSessions, loadUserProfile, saveSharedMelody as saveSharedMelodyToDb, saveSharedSession as saveSharedSessionToDb, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { generateId } from '@/lib/id'
import { copyShareUrl, encodeMelodyForShare } from '@/lib/share-codec'
import { storageGet, storageSet } from '@/lib/storage'
import { bpm, getSessionHistory, keyName, melodyStore, scaleType, } from '@/stores'
import { getAllMelodies } from '@/stores/melody-store'
import { showNotification } from '@/stores/notifications-store'
import type { MelodyItem, PlaybackSession, SessionResult } from '@/types'

// ============================================================
// SVG Icons (Classy, minimal style)
// ============================================================

const IconMelody = () => (
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
  </svg>
)

const IconSession = () => (
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

const IconStats = () => (
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

const IconMic = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="23" />
    <line x1="8" x2="16" y1="23" y2="23" />
  </svg>
)

const IconGoal = () => (
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

const IconShare = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
)

const IconLink = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const IconEye = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const IconMusic = () => (
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
  </svg>
)

const IconBook = () => (
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

const IconStar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
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
  bpm?: number
  key?: string
  scale?: string
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
  const [activeTab, setActiveTab] = createSignal<
    'melodies' | 'sessions' | 'profile'
  >('melodies')
  const [searchQuery, setSearchQuery] = createSignal('')
  const [sortBy, setSortBy] = createSignal<'recent' | 'popular' | 'highest'>(
    'recent',
  )
  const [_selectedShare, _setSelectedShare] =
    createSignal<ShareableContent | null>(null)

  // DB-backed signals
  const [dbMelodies, setDbMelodies] = createSignal<SharedMelody[]>([])
  const [dbSessions, setDbSessions] = createSignal<SharedSession[]>([])
  const [dbProfile, setDbProfile] = createSignal<{
    userId: string
    displayName: string
    bio?: string
    joinDate: number
  } | null>(null)

  const [streak, setStreak] = createSignal(0)

  // Locally-shared items, kept reactive (localStorage reads are not), so a
  // newly shared melody/session shows up in the list immediately.
  const [localMelodies, setLocalMelodies] = createSignal<SharedMelody[]>(
    storageGet<SharedMelody[]>('pp_shared_melodies', [])!,
  )
  const [localSessions, setLocalSessions] = createSignal<SharedSession[]>(
    storageGet<SharedSession[]>('pp_shared_sessions', [])!,
  )

  // Which share picker is open (choose what to share from your own content)
  const [pickerType, setPickerType] = createSignal<'melody' | 'session' | null>(
    null,
  )

  // The user's own melodies (saved library + the currently-loaded one)
  const libraryMelodies = createMemo(() => {
    try {
      return getAllMelodies().filter((m) => m.items.length > 0)
    } catch {
      return []
    }
  })

  // Load on mount and whenever the signed-in identity changes
  createEffect(() => {
    authVersion()
    void (async () => {
      const [profile, melodies, sessions, currentStreak] = await Promise.all([
        loadUserProfile(),
        loadSharedMelodies(),
        loadSharedSessions(),
        getCurrentStreak(),
      ])
      setDbProfile(profile)
      if (melodies.length > 0) setDbMelodies(melodies as SharedMelody[])
      if (sessions.length > 0) setDbSessions(sessions as SharedSession[])
      setStreak(currentStreak)
    })()
  })

  // Load shared data from localStorage + DB
  const sharedMelodies = createMemo(() => {
    const db = dbMelodies()
    // DB data takes priority; merge local items not in DB
    const dbIds = new Set(db.map((m) => m.id))
    return [...db, ...localMelodies().filter((m) => !dbIds.has(m.id))]
  })

  const sharedSessions = createMemo(() => {
    const db = dbSessions()
    const dbIds = new Set(db.map((s) => s.id))
    return [...db, ...localSessions().filter((s) => !dbIds.has(s.id))]
  })

  // Current user profile (DB-backed, canonical persisted user id)
  const currentProfile = createMemo(() => {
    const userId = getUserId()

    const sessions = getSessionHistory()
    const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0)
    const avgScore = sessions.length > 0 ? totalScore / sessions.length : 0

    const dbProf = dbProfile()

    return {
      userId,
      displayName: dbProf?.displayName ?? `Singer-${userId.slice(0, 4)}`,
      avatar: IconMic(),
      bio:
        dbProf?.bio ??
        'MercuryPitch enthusiast • Learning vocals • Member since 2026',
      streak: streak(),
      totalSessions: sessions.length,
      bestScore:
        sessions.length > 0
          ? Math.max(...sessions.map((s) => s.score || 0))
          : 0,
      accuracy: sessions.length > 0 ? avgScore : 0,
      joinDate: dbProf?.joinDate ?? Date.now() - 1000 * 60 * 60 * 24 * 30,
    }
  })

  // Real recent-session series for the profile charts (oldest → newest)
  const recentSessions = createMemo(() => getSessionHistory().slice(-8))
  const recentScores = createMemo(() =>
    recentSessions().map((s) => Math.round(s.score || 0)),
  )
  const recentAccuracy = createMemo(() =>
    recentSessions().map((s) =>
      s.avgCents !== undefined
        ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(s.avgCents))))
        : Math.round(s.score || 0),
    ),
  )

  // Real personal records derived from session history (null if none yet)
  const personalRecords = createMemo(() => {
    const sessions = getSessionHistory()
    if (sessions.length === 0) return null
    const scores = sessions.map((s) => s.score || 0)
    const recent = sessions.slice(-5)
    return {
      best: Math.round(Math.max(...scores)),
      sessions: sessions.length,
      recentAvg: Math.round(
        recent.reduce((a, s) => a + (s.score || 0), 0) / recent.length,
      ),
      firstDate: new Date(
        Math.min(...sessions.map((s) => s.completedAt)),
      ).toLocaleDateString(),
    }
  })

  // Filter and sort shared melodies
  const displayMelodies = createMemo(() => {
    let result = sharedMelodies()

    if (searchQuery()) {
      const query = searchQuery().toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.tags?.some((t) => t.toLowerCase().includes(query)) ?? false),
      )
    }

    if (sortBy() === 'popular') {
      // No play/like counts yet — use melody richness as a stable proxy
      result = [...result].sort((a, b) => b.items.length - a.items.length)
    } else {
      // 'recent' and 'highest' (melodies carry no scores) → newest first
      result = [...result].sort((a, b) => b.date - a.date)
    }

    return result
  })

  // Filter and sort shared sessions
  const displaySessions = createMemo(() => {
    let result = sharedSessions()

    if (searchQuery()) {
      const query = searchQuery().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.author.toLowerCase().includes(query),
      )
    }

    const avg = (rs: number[]): number =>
      rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : 0

    if (sortBy() === 'highest') {
      result = [...result].sort((a, b) => avg(b.results) - avg(a.results))
    } else if (sortBy() === 'popular') {
      result = [...result].sort((a, b) => b.results.length - a.results.length)
    } else {
      result = [...result].sort((a, b) => b.date - a.date)
    }

    return result
  })

  // Share a specific melody (from the library or the current one).
  const shareMelody = (m: {
    name: string
    items: MelodyItem[]
    bpm?: number
    key?: string
    scale?: string
  }) => {
    if (m.items.length === 0) {
      showNotification('That melody is empty', 'warning')
      return
    }

    const bpmVal = m.bpm ?? bpm()
    const keyVal = m.key ?? keyName()
    const scaleVal = m.scale ?? scaleType()
    const encoded = encodeMelodyForShare(
      m.items,
      bpmVal,
      keyVal,
      scaleVal,
      undefined,
      m.name,
    )

    const shareable: SharedMelody = {
      id: generateId(),
      name: m.name || 'My Melody',
      items: m.items,
      author: currentProfile().displayName,
      tags: ['my-melody', 'practice'],
      date: Date.now(),
      bpm: bpmVal,
      key: keyVal || undefined,
      scale: scaleVal || undefined,
    }

    const updated = [...localMelodies(), shareable]
    setLocalMelodies(updated)
    storageSet('pp_shared_melodies', updated)
    // Dual-write to DB (fire-and-forget)
    saveSharedMelodyToDb({
      name: shareable.name,
      items: shareable.items,
      author: shareable.author,
      tags: shareable.tags,
    })
    setPickerType(null)
    setActiveTab('melodies')
    void copyShareUrl(encoded).then((ok) => {
      if (ok)
        showNotification(`Shared "${shareable.name}" — link copied!`, 'info')
      else showNotification(`Shared "${shareable.name}"`, 'info')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Share a specific practice session.
  const shareSession = (s: SessionResult) => {
    const shareable: SharedSession = {
      id: generateId(),
      name: s.sessionName || s.name || 'Practice Session',
      items: [],
      author: currentProfile().displayName,
      results: [Math.round(s.score || 0)],
      date: s.completedAt || Date.now(),
    }

    const updated = [...localSessions(), shareable]
    setLocalSessions(updated)
    storageSet('pp_shared_sessions', updated)
    // Dual-write to DB (fire-and-forget)
    saveSharedSessionToDb({
      name: shareable.name,
      items: shareable.items,
      author: shareable.author,
      results: shareable.results,
    })
    setPickerType(null)
    setActiveTab('sessions')
    showNotification(`Shared "${shareable.name}"`, 'info')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Copy shareable link to clipboard
  const copyShareLink = (type: 'melody' | 'session', id: string) => {
    if (type === 'melody') {
      const melody = sharedMelodies().find((m) => m.id === id)
      if (melody && melody.items.length > 0) {
        const encoded = encodeMelodyForShare(
          melody.items,
          melody.bpm ?? 120,
          melody.key,
          melody.scale,
          undefined,
          melody.name,
        )
        void copyShareUrl(encoded).then((ok) => {
          if (ok) showNotification('Share link copied to clipboard!', 'info')
          else showNotification('Failed to copy link', 'error')
        })
        return
      }
    }
    // Session shares use the legacy fallback format
    const link = `${window.location.origin}${window.location.pathname}#/share?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`
    void navigator.clipboard.writeText(link).then(
      () => showNotification('Share link copied to clipboard!', 'info'),
      () => showNotification(`Failed to copy link: ${link}`, 'error'),
    )
  }

  // Tabs
  const tabs = createMemo(() => [
    {
      id: 'melodies' as const,
      name: 'Melodies',
      icon: IconMelody,
      count: sharedMelodies().length,
    },
    {
      id: 'sessions' as const,
      name: 'Sessions',
      icon: IconSession,
      count: sharedSessions().length,
    },
    { id: 'profile' as const, name: 'Profile', icon: IconUser, count: 0 },
  ])

  return (
    <div class="community-share-tab">
      {/* Header */}
      <div class="community-header">
        <div class="community-header-content">
          <h2>Community</h2>
          <p class="community-subtitle">
            Share your progress, discover melodies, and connect with other
            singers
          </p>
        </div>
        <div class="community-actions">
          <button
            class="share-btn share-btn-labeled"
            onClick={() => setPickerType('melody')}
            aria-label="Share a melody"
            title="Choose one of your melodies to share"
          >
            <IconMelody />
            <span>Share Melody</span>
          </button>
          <button
            class="share-btn share-btn-labeled"
            onClick={() => setPickerType('session')}
            aria-label="Share a session"
            title="Choose one of your practice sessions to share"
          >
            <IconSession />
            <span>Share Session</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div class="search-filter-bar">
        <input
          type="text"
          class={modalStyles.searchInput}
          placeholder="Search melodies, sessions..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <div class="sort-select">
          <SafeSelect
            value={sortBy()}
            onChange={(e) =>
              setSortBy(
                e.currentTarget.value as 'recent' | 'popular' | 'highest',
              )
            }
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="highest">Highest Scores</option>
          </SafeSelect>
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
              <span class={tabStyles.tabIcon}>{tab.icon()}</span>
              <span class="tab-name">{tab.name}</span>
              {tab.count > 0 && (
                <span class={modalStyles.tabCount}>{tab.count}</span>
              )}
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
                <div
                  class="melody-card"
                  data-share-type="melody"
                  data-share-id={melody.id}
                >
                  <div class="melody-header">
                    <h3 class="melody-name">{melody.name}</h3>
                    <span class="melody-date">
                      {new Date(melody.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div class="melody-info">
                    <span class="melody-author">by {melody.author}</span>
                    <div class="melody-tags">
                      {
                        <For each={melody.tags}>
                          {(tag) => <span class="tag">{tag}</span>}
                        </For>
                      }
                    </div>
                  </div>
                  <div class="melody-footer">
                    <button
                      class={`${modalStyles.actionBtn} copy-btn`}
                      onClick={() => copyShareLink('melody', melody.id)}
                      aria-label="Copy link"
                      title="Copy link"
                    >
                      <span>
                        <IconLink />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} view-btn`}
                      aria-label="View"
                      title="View"
                    >
                      <span>
                        <IconEye />
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displayMelodies().length === 0 && (
              <div class={modalStyles.emptyState}>
                <span class="empty-icon">{IconMelody()}</span>
                <h3>No melodies shared yet</h3>
                <p>
                  Share your melodies with the community to start building your
                  library.
                </p>
                <button
                  class="primary-btn"
                  onClick={() => setPickerType('melody')}
                  aria-label="Share your first melody"
                  title="Share your first melody"
                >
                  <IconShare /> Share Your First Melody
                </button>
              </div>
            )}
          </div>
        </Show>

        <Show when={activeTab() === 'sessions'}>
          <div class="sessions-grid">
            <For each={displaySessions()}>
              {(session) => (
                <div
                  class={modalStyles.sessionCard}
                  data-share-type="session"
                  data-share-id={session.id}
                >
                  <div class="session-header">
                    <h3 class={modalStyles.sessionName}>{session.name}</h3>
                    <div class="session-scores">
                      <For each={session.results}>
                        {(score) => (
                          <span
                            class="session-score-badge"
                            style={{ '--score': score }}
                          >
                            {score}%
                          </span>
                        )}
                      </For>
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
                      <span class={profileStyles.statValue}>
                        {session.results.length} runs
                      </span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-icon">{IconStats()}</span>
                      <span class={profileStyles.statValue}>
                        {Math.round(
                          session.results.reduce((a, b) => a + b, 0) /
                            session.results.length,
                        )}
                        % avg
                      </span>
                    </div>
                  </div>
                  <div class="session-footer">
                    <button
                      class={`${modalStyles.actionBtn} copy-btn`}
                      onClick={() => copyShareLink('session', session.id)}
                      aria-label="Copy link"
                      title="Copy link"
                    >
                      <span>
                        <IconLink />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} view-btn`}
                      aria-label="View"
                      title="View"
                    >
                      <span>
                        <IconEye />
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </For>
            {displaySessions().length === 0 && (
              <div class={modalStyles.emptyState}>
                <span class="empty-icon">{IconSession()}</span>
                <h3>No sessions shared yet</h3>
                <p>
                  Share your practice sessions to track progress and inspire
                  others.
                </p>
                <button
                  class="primary-btn"
                  onClick={() => setPickerType('session')}
                  aria-label="Share your first session"
                  title="Share your first session"
                >
                  <IconShare /> Share Your First Session
                </button>
              </div>
            )}
          </div>
        </Show>

        <Show when={activeTab() === 'profile'}>
          <div class={profileStyles.profileContainer}>
            {/* Profile Header */}
            <div class={profileStyles.profileHeader}>
              <div class={profileStyles.profileAvatar}>{IconUser()}</div>
              <div class={profileStyles.profileInfo}>
                <h2 class={profileStyles.profileName}>{currentProfile()?.displayName}</h2>
                <p class={profileStyles.profileBio}>{currentProfile()?.bio}</p>
                <div class={profileStyles.profileStatsRow}>
                  <div class={profileStyles.statBadge}>
                    <span class={profileStyles.statLabel}>Streak</span>
                    <span class={`${profileStyles.statValue} ${profileStyles.statValueStreak}`}>
                      {currentProfile()?.streak} <IconStreak />
                    </span>
                  </div>
                  <div class={profileStyles.statBadge}>
                    <span class={profileStyles.statLabel}>Sessions</span>
                    <span class={profileStyles.statValue}>
                      {currentProfile()?.totalSessions}
                    </span>
                  </div>
                  <div class={profileStyles.statBadge}>
                    <span class={profileStyles.statLabel}>Best Score</span>
                    <span class={`${profileStyles.statValue} ${profileStyles.statValueScore}`}>
                      {currentProfile()?.bestScore}%
                    </span>
                  </div>
                  <div class={profileStyles.statBadge}>
                    <span class={profileStyles.statLabel}>Accuracy</span>
                    <span class={`${profileStyles.statValue} ${profileStyles.statValueAccuracy}`}>
                      {currentProfile()?.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress charts — derived from your real practice history */}
            <div class={profileStyles.profileCharts}>
              <div class="chart-card">
                <h3>Recent Scores</h3>
                <Show
                  when={recentScores().length > 0}
                  fallback={
                    <p class="chart-empty">
                      Complete a practice session to see your progress.
                    </p>
                  }
                >
                  <div class="mini-chart">
                    <For each={recentScores()}>
                      {(score) => (
                        <div class="mini-bar-wrapper">
                          <div
                            class="mini-bar"
                            style={{
                              height: `${score}%`,
                              background: getBarColor(score),
                            }}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class="chart-card">
                <h3>Accuracy</h3>
                <Show
                  when={recentAccuracy().length > 0}
                  fallback={<p class="chart-empty">No data yet.</p>}
                >
                  <div class="mini-chart">
                    <For each={recentAccuracy()}>
                      {(score) => (
                        <div class="mini-bar-wrapper">
                          <div
                            class="mini-bar line-chart"
                            style={{
                              height: `${score}%`,
                              background: getBarColor(score),
                            }}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>

            {/* Personal Records — real, derived from session history */}
            <div class="personal-records">
              <h3>Personal Records</h3>
              <Show
                when={personalRecords()}
                fallback={
                  <p class="chart-empty">
                    Complete a practice session to start building records.
                  </p>
                }
              >
                {(rec) => (
                  <div class="records-grid">
                    <div class="record-item">
                      <span class="record-icon">{IconStar()}</span>
                      <div class="record-info">
                        <span class="record-label">Best Score</span>
                        <span class="record-value">{rec().best}%</span>
                      </div>
                    </div>
                    <div class="record-item">
                      <span class="record-icon">{IconSession()}</span>
                      <div class="record-info">
                        <span class="record-label">Sessions</span>
                        <span class="record-value">{rec().sessions}</span>
                      </div>
                    </div>
                    <div class="record-item">
                      <span class="record-icon">{IconGoal()}</span>
                      <div class="record-info">
                        <span class="record-label">Recent Avg</span>
                        <span class="record-value">{rec().recentAvg}%</span>
                      </div>
                    </div>
                    <div class="record-item">
                      <span class="record-icon">{IconMelody()}</span>
                      <div class="record-info">
                        <span class="record-label">First Session</span>
                        <span class="record-value">{rec().firstDate}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Show>
            </div>

            {/* Shared Content Preview */}
            <div class="shared-content-preview">
              <h3>Shared Content</h3>
              <div class="preview-list">
                <Show when={displayMelodies().length > 0}>
                  <div class="preview-section">
                    <h4>
                      <IconMusic /> Shared Melodies
                    </h4>
                    <div class="preview-grid">
                      <For each={displayMelodies().slice(0, 3)}>
                        {(melody) => (
                          <div class="preview-card">
                            <span class="preview-name">{melody.name}</span>
                            <span class="preview-date">
                              {new Date(melody.date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
                <Show when={displaySessions().length > 0}>
                  <div class="preview-section">
                    <h4>
                      <IconBook /> Shared Sessions
                    </h4>
                    <div class="preview-grid">
                      <For each={displaySessions().slice(0, 3)}>
                        {(session) => (
                          <div class="preview-card">
                            <span class="preview-name">{session.name}</span>
                            <span class="preview-scores">
                              <For each={session.results.slice(0, 2)}>
                                {(s) => `${s}%`}
                              </For>
                              {session.results.length > 2 &&
                                `+${session.results.length - 2}`}
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

      {/* Share picker — choose which of your own melodies/sessions to share */}
      <Show when={pickerType() !== null}>
        <div class="share-picker-overlay" onClick={() => setPickerType(null)}>
          <div class="share-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div class="share-picker-header">
              <h3>
                {pickerType() === 'melody'
                  ? 'Share a Melody'
                  : 'Share a Session'}
              </h3>
              <button
                class="share-picker-close"
                onClick={() => setPickerType(null)}
                aria-label="Close"
                title="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                >
                  <path d="M14 1.4L12.6 0 7 5.6 1.4 0 0 1.4 5.6 7 0 12.6 1.4 14 7 8.4l5.6 5.6 1.4-1.4L8.4 7z" />
                </svg>
              </button>
            </div>
            <p class="share-picker-hint">
              {pickerType() === 'melody'
                ? 'Pick one of your melodies to publish to the community and copy a share link.'
                : 'Pick one of your practice sessions to publish to the community.'}
            </p>
            <div class="share-picker-list">
              <Show when={pickerType() === 'melody'}>
                <Show when={melodyHasNotes(melodyStore.currentMelody())}>
                  <div class="share-picker-row">
                    <div class="share-picker-info">
                      <span class="share-picker-name">
                        {melodyStore.currentMelody()?.name ?? 'Current melody'}
                      </span>
                      <span class="share-picker-meta">
                        Current &middot;{' '}
                        {melodyStore.currentMelody()?.items.length} notes
                      </span>
                    </div>
                    <button
                      class="primary-btn share-picker-action"
                      onClick={() => {
                        const c = melodyStore.currentMelody()
                        if (c)
                          shareMelody({
                            name: c.name || 'Current melody',
                            items: c.items,
                          })
                      }}
                    >
                      Share
                    </button>
                  </div>
                </Show>
                <For each={libraryMelodies()}>
                  {(m) => (
                    <div class="share-picker-row">
                      <div class="share-picker-info">
                        <span class="share-picker-name">{m.name}</span>
                        <span class="share-picker-meta">
                          {m.items.length} notes &middot; {m.bpm} BPM
                          {m.key ? ` · ${m.key}` : ''}
                        </span>
                      </div>
                      <button
                        class="primary-btn share-picker-action"
                        onClick={() =>
                          shareMelody({
                            name: m.name,
                            items: m.items,
                            bpm: m.bpm,
                            key: m.key,
                            scale: m.scaleType,
                          })
                        }
                      >
                        Share
                      </button>
                    </div>
                  )}
                </For>
                <Show
                  when={
                    libraryMelodies().length === 0 &&
                    !melodyHasNotes(melodyStore.currentMelody())
                  }
                >
                  <p class="share-picker-empty">
                    No melodies yet — create one in the Compose tab first.
                  </p>
                </Show>
              </Show>

              <Show when={pickerType() === 'session'}>
                <For each={getSessionHistory()}>
                  {(s) => (
                    <div class="share-picker-row">
                      <div class="share-picker-info">
                        <span class="share-picker-name">
                          {s.sessionName || s.name || 'Practice Session'}
                        </span>
                        <span class="share-picker-meta">
                          {Math.round(s.score || 0)}% &middot;{' '}
                          {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        class="primary-btn share-picker-action"
                        onClick={() => shareSession(s)}
                      >
                        Share
                      </button>
                    </div>
                  )}
                </For>
                <Show when={getSessionHistory().length === 0}>
                  <p class="share-picker-empty">
                    No practice sessions yet — complete a session to share it.
                  </p>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )

  function melodyHasNotes(
    m: ReturnType<typeof melodyStore.currentMelody>,
  ): boolean {
    return m !== null && m !== undefined && m.items.length > 0
  }

  function getBarColor(score: number): string {
    if (score >= 90) return 'var(--green)'
    if (score >= 75) return 'var(--accent)'
    if (score >= 60) return 'var(--teal)'
    return 'var(--yellow)'
  }
}
