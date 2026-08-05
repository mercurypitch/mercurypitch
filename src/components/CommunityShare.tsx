// ============================================================
// CommunityShare — Community Sharing & Profile Tab
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, For, Show, } from 'solid-js'
import tabStyles from '@/components/AppNavTabs.module.css'
import profileStyles from '@/components/CommunityShare.module.css'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import modalStyles from '@/components/Modal.module.css'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { loadBadgeDefinitions, loadUserBadges, } from '@/db/services/challenges-service'
import { loadSessionRecords, sessionRecordVersion, } from '@/db/services/session-service'
import { canPostToCommunity, loadSharedMelodies, loadSharedSessions, loadUserProfile, saveSharedMelody as saveSharedMelodyToDb, saveSharedSession as saveSharedSessionToDb, unpublishShared, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { ProfileView } from '@/features/community/ProfileView'
import { alreadyShared, melodyFingerprint, sessionFingerprint, } from '@/features/community/share-identity'
import { openVoiceConstellation } from '@/features/voice-constellation/navigation'
import { fuzzyMatch } from '@/lib/fuzzy-match'
import { generateId } from '@/lib/id'
import { copyShareUrl, encodeMelodyForShare, generateShareFullUrl, } from '@/lib/share-codec'
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

const IconCloseSmall = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
  /** Content fingerprint, so the same melody cannot be shared twice.
   *  Optional: cards shared before this existed simply carry none and
   *  never block a new share. */
  shareFingerprint?: string
}

export interface SharedSession {
  id: string
  name: string
  items: PlaybackSession['items']
  author: string
  results: number[]
  date: number
  /** Identifies the RUN, so the same one cannot be published twice.
   *  Optional for cards shared before this existed. */
  shareFingerprint?: string
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
  // The voice twin shown on the profile is the newest measured one.
  // Keyed on authVersion because signing in changes WHOSE voice this is,
  // and an unkeyed resource would keep the previous identity's twin.
  const [voiceprints] = createResource(authVersion, listVoiceprints)
  const latestTwin = (): string | undefined => {
    const twin = voiceprints()?.[0]?.twin
    return twin === null || twin === undefined || twin === '' ? undefined : twin
  }

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

  // Filter and sort shared melodies
  const displayMelodies = createMemo(() => {
    let result = sharedMelodies()

    if (searchQuery()) {
      // Fuzzy, not substring: "warmup" should still find "Warm-up", and a
      // typo should not make the shelf look empty.
      const query = searchQuery()
      result = result.filter(
        (m) =>
          fuzzyMatch(query, m.name) ||
          (m.tags?.some((t) => fuzzyMatch(query, t)) ?? false),
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
      const query = searchQuery()
      result = result.filter(
        (s) => fuzzyMatch(query, s.name) || fuzzyMatch(query, s.author),
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

    // Nothing stopped the same melody being shared over and over, filling
    // the shelf with identical cards and a DB row for each. Keyed on the
    // notes, not the title — renaming is not re-composing.
    const fingerprint = melodyFingerprint({
      items: m.items,
      bpm: bpmVal,
      key: keyVal,
      scale: scaleVal,
    })
    if (alreadyShared(fingerprint, localMelodies())) {
      showNotification(
        `You have already shared this melody — it is on your Melodies shelf.`,
        'info',
      )
      setPickerType(null)
      setActiveTab('melodies')
      return
    }

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
      shareFingerprint: fingerprint,
    }

    const updated = [...localMelodies(), shareable]
    setLocalMelodies(updated)
    storageSet('pp_shared_melodies', updated)
    // Dual-write to DB (fire-and-forget). Without an account it is the
    // shelf and the link only — see the notification below.
    saveSharedMelodyToDb({
      name: shareable.name,
      items: shareable.items,
      author: shareable.author,
      tags: shareable.tags,
    })
    setPickerType(null)
    setActiveTab('melodies')
    void copyShareUrl(encoded).then((ok) => {
      if (canPostToCommunity()) {
        showNotification(
          ok
            ? `Shared "${shareable.name}" — link copied!`
            : `Shared "${shareable.name}"`,
          'info',
        )
        return
      }
      showNotification(
        ok
          ? `Saved "${shareable.name}" to your shelf and copied the link — anyone you send it to can sing it. Create an account to list it on the Community board.`
          : `Saved "${shareable.name}" to your shelf. Create an account to list it on the Community board.`,
        'info',
      )
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Share a specific practice session.
  /**
   * The badges this singer has actually earned, newest first.
   *
   * Definitions carry the name, tier and icon; the user rows carry when
   * each was earned. Joined here so the profile shows medals rather than
   * ids, and so a friend viewing the profile sees the same thing.
   */
  const [badgeData] = createResource(
    () => [authVersion(), sessionRecordVersion()] as const,
    async () => {
      const [defs, mine] = await Promise.all([
        loadBadgeDefinitions(),
        loadUserBadges(),
      ])
      return { defs, mine }
    },
  )
  const earnedBadges = createMemo(() => {
    const data = badgeData()
    if (data === undefined) return []
    const byId = new Map(data.defs.map((d) => [d.id, d]))
    return data.mine
      .slice()
      .sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1))
      .flatMap((ub) => {
        const def = byId.get(ub.badgeId)
        if (def === undefined) return []
        return [{ iconName: def.icon, name: def.name, tier: def.tier }]
      })
  })

  /**
   * Runs a singer could share: every finished attempt, whatever produced
   * it. The picker used to read the local session-mode history, so
   * exercises and challenges were unshareable and a singer who only did
   * those saw an empty picker forever.
   */
  /** The share awaiting "yes, take it down". */
  const [unpublishing, setUnpublishing] = createSignal<{
    kind: 'melody' | 'session'
    id: string
    name: string
  } | null>(null)

  /**
   * Take a share off the shelf.
   *
   * The shelf is the MERGE of the DB list and the local one, with the DB
   * copy winning — so dropping only the local entry took nothing off
   * screen for anyone signed in, which is everyone who can publish. The
   * card stayed put and the button looked broken even though the row was
   * being deleted server-side. Both lists have to lose it.
   *
   * A share that never reached the DB still disappears, which is the
   * point: the singer asked for it gone.
   */
  const doUnpublish = (): void => {
    const target = unpublishing()
    if (target === null) return
    if (target.kind === 'melody') {
      const next = localMelodies().filter((m) => m.id !== target.id)
      setLocalMelodies(next)
      storageSet('pp_shared_melodies', next)
      setDbMelodies((prev) => prev.filter((m) => m.id !== target.id))
    } else {
      const next = localSessions().filter((x) => x.id !== target.id)
      setLocalSessions(next)
      storageSet('pp_shared_sessions', next)
      setDbSessions((prev) => prev.filter((s) => s.id !== target.id))
    }
    void unpublishShared(target.kind, target.id)
    showNotification(`"${target.name}" is no longer shared.`, 'info')
    setUnpublishing(null)
  }

  const [runRecords] = createResource(
    () => [authVersion(), sessionRecordVersion()] as const,
    async () => await loadSessionRecords(50),
  )
  const RUN_KIND: Record<string, string> = {
    practice: 'session',
    exercise: 'exercise',
    challenge: 'challenge',
    weekly: 'weekly challenge',
  }
  const shareableRuns = createMemo(() =>
    (runRecords() ?? []).map((r) => ({
      id: r.id,
      name: r.melodyName || 'Practice session',
      score: Math.round(r.score ?? 0),
      kind: RUN_KIND[r.source ?? 'practice'] ?? 'session',
      completedAt: new Date(r.endedAt ?? r.startedAt).getTime(),
    })),
  )

  const shareSession = (s: SessionResult) => {
    const name = s.sessionName || s.name || 'Practice Session'
    const completedAt = s.completedAt || Date.now()
    // The run, not the routine: two runs of the same drill on different
    // days are different results and both belong. This only stops the
    // SAME run being published twice.
    const fingerprint = sessionFingerprint({
      name,
      score: Math.round(s.score || 0),
      completedAt,
    })
    if (alreadyShared(fingerprint, localSessions())) {
      showNotification(
        'You have already shared this run — it is on your Sessions shelf.',
        'info',
      )
      setPickerType(null)
      setActiveTab('sessions')
      return
    }

    const shareable: SharedSession = {
      id: generateId(),
      name,
      items: [],
      author: currentProfile().displayName,
      results: [Math.round(s.score || 0)],
      date: completedAt,
      shareFingerprint: fingerprint,
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
    showNotification(
      canPostToCommunity()
        ? `Shared "${shareable.name}"`
        : `Saved "${shareable.name}" to your shelf. Create an account to list it on the Community board.`,
      'info',
    )
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

  /**
   * Open a shared item, rather than only offering its link.
   *
   * Both eye buttons carried no onClick at all — they looked like
   * controls and did nothing. A melody opens through the same encoded
   * share URL the copy button produces, so the app's existing
   * load-from-URL path handles it and there is one format to maintain.
   */
  const openShared = (type: 'melody' | 'session', id: string) => {
    if (type === 'melody') {
      const melody = sharedMelodies().find((m) => m.id === id)
      if (melody && melody.items.length > 0) {
        window.location.href = generateShareFullUrl(
          encodeMelodyForShare(
            melody.items,
            melody.bpm ?? 120,
            melody.key,
            melody.scale,
            undefined,
            melody.name,
          ),
        )
        return
      }
      showNotification('That melody has no notes to open.', 'error')
      return
    }
    // Sessions use the legacy share route, same as their copy link.
    window.location.href = `${window.location.origin}${window.location.pathname}#/share?type=session&id=${encodeURIComponent(id)}`
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

      {/* One toolbar row: which list, then how to narrow it. Stacking
          these as separate bands cost ~150px of chrome before any
          content appeared. Search is hidden on Profile, which has
          nothing to search. */}
      <div class="community-toolbar">
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
        <Show when={activeTab() !== 'profile'}>
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
        </Show>
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
                      class={`${modalStyles.actionBtn} ${modalStyles.copyBtn}`}
                      onClick={() => copyShareLink('melody', melody.id)}
                      aria-label="Copy link"
                      title="Copy link"
                    >
                      <span>
                        <IconLink />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} unpublish-btn`}
                      onClick={() =>
                        setUnpublishing({
                          kind: 'melody',
                          id: melody.id,
                          name: melody.name,
                        })
                      }
                      aria-label={`Unpublish ${melody.name}`}
                      title="Unpublish"
                    >
                      <span>
                        <IconCloseSmall />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} view-btn`}
                      onClick={() => openShared('melody', melody.id)}
                      aria-label={`Open ${melody.name}`}
                      title="Open this melody"
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
              <div
                class={`${modalStyles.emptyState} empty-state empty-state-compact`}
              >
                <span class="empty-icon">{IconMelody()}</span>
                {/* An active search means the shelf is not empty — the
                    filter is. Saying "nothing shared yet" there sends
                    someone off to re-share things they already have. */}
                <Show
                  when={searchQuery().trim() === ''}
                  fallback={
                    <>
                      <h3>No melodies match "{searchQuery()}"</h3>
                      <p>
                        {sharedMelodies().length} shared melod
                        {sharedMelodies().length === 1
                          ? 'y is'
                          : 'ies are'}{' '}
                        here — try a different word, or clear the search.
                      </p>
                      <button
                        class="primary-btn"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear the search"
                        title="Clear the search"
                      >
                        Clear search
                      </button>
                    </>
                  }
                >
                  <h3>No melodies shared yet</h3>
                  <p>
                    Melodies you share appear here, and anyone with the link can
                    open them.
                  </p>
                  <button
                    class="primary-btn"
                    onClick={() => setPickerType('melody')}
                    aria-label="Share your first melody"
                    title="Share your first melody"
                  >
                    <IconShare /> Share a melody
                  </button>
                </Show>
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
                      class={`${modalStyles.actionBtn} ${modalStyles.copyBtn}`}
                      onClick={() => copyShareLink('session', session.id)}
                      aria-label="Copy link"
                      title="Copy link"
                    >
                      <span>
                        <IconLink />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} unpublish-btn`}
                      onClick={() =>
                        setUnpublishing({
                          kind: 'session',
                          id: session.id,
                          name: session.name,
                        })
                      }
                      aria-label={`Unpublish ${session.name}`}
                      title="Unpublish"
                    >
                      <span>
                        <IconCloseSmall />
                      </span>
                    </button>
                    <button
                      class={`${modalStyles.actionBtn} view-btn`}
                      onClick={() => openShared('session', session.id)}
                      aria-label={`Open ${session.name}`}
                      title="Open this session"
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
              <div
                class={`${modalStyles.emptyState} empty-state empty-state-compact`}
              >
                <span class="empty-icon">{IconSession()}</span>
                <Show
                  when={searchQuery().trim() === ''}
                  fallback={
                    <>
                      <h3>No sessions match "{searchQuery()}"</h3>
                      <p>
                        {sharedSessions().length} shared session
                        {sharedSessions().length === 1 ? ' is' : 's are'} here —
                        try a different word, or clear the search.
                      </p>
                      <button
                        class="primary-btn"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear the search"
                        title="Clear the search"
                      >
                        Clear search
                      </button>
                    </>
                  }
                >
                  <h3>No sessions shared yet</h3>
                  <p>
                    Share a session to keep a record of how it went, and to let
                    others sing along with it.
                  </p>
                  <button
                    class="primary-btn"
                    onClick={() => setPickerType('session')}
                    aria-label="Share your first session"
                    title="Share your first session"
                  >
                    <IconShare /> Share a session
                  </button>
                </Show>
              </div>
            )}
          </div>
        </Show>

        <Show when={activeTab() === 'profile'}>
          <ProfileView
            displayName={currentProfile().displayName}
            bio={currentProfile().bio}
            sessions={getSessionHistory()}
            streak={currentProfile().streak}
            sharedMelodies={displayMelodies().length}
            sharedSessions={displaySessions().length}
            twinName={latestTwin()}
            badges={earnedBadges()}
            onExploreVoiceConstellation={openVoiceConstellation}
          />
        </Show>
      </div>

      <ConfirmDialog
        open={unpublishing() !== null}
        title="Unpublish this?"
        message={`"${unpublishing()?.name ?? ''}" comes off your shelf and anyone holding its link stops being able to open it. You can share it again later.`}
        confirmLabel="Unpublish"
        onConfirm={doUnpublish}
        onCancel={() => setUnpublishing(null)}
      />

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
                {/* Every finished run, not just session mode's local copy.
                    This listed getSessionHistory(), which only session mode
                    appends to and only when a run produced a scored item —
                    so it read "no practice sessions yet" however much the
                    singer had actually practised, and Community > Sessions
                    could never fill up. */}
                <For each={shareableRuns()}>
                  {(s) => (
                    <div class="share-picker-row">
                      <div class="share-picker-info">
                        <span class="share-picker-name">{s.name}</span>
                        <span class="share-picker-meta">
                          {s.score}% &middot; {s.kind} &middot;{' '}
                          {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        class="primary-btn share-picker-action"
                        onClick={() =>
                          shareSession({
                            name: s.name,
                            sessionName: s.name,
                            score: s.score,
                            completedAt: s.completedAt,
                          } as SessionResult)
                        }
                      >
                        Share
                      </button>
                    </div>
                  )}
                </For>
                <Show when={shareableRuns().length === 0}>
                  <p class="share-picker-empty">
                    Nothing to share yet — finish a session, exercise or
                    challenge and it will appear here.
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
}
