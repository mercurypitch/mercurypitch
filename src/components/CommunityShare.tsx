// ============================================================
// CommunityShare — Community Sharing & Profile Tab
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show, } from 'solid-js'
import tabStyles from '@/components/AppNavTabs.module.css'
import profileStyles from '@/components/CommunityShare.module.css'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import modalStyles from '@/components/Modal.module.css'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { accountHeld } from '@/db/services/auth-service'
import { loadBadgeDefinitions, loadUserBadges, } from '@/db/services/challenges-service'
import { loadSessionRecords, sessionRecordVersion, } from '@/db/services/session-service'
import { canPostToCommunity, loadSharedMelodies, loadSharedSessions, loadUserProfile, saveSharedMelody as saveSharedMelodyToDb, saveSharedSession as saveSharedSessionToDb, unpublishShared, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { authVersion, getUserId } from '@/db/services/user-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { ProfileView } from '@/features/community/ProfileView'
import { alreadyShared, melodyFingerprint, sessionFingerprint, } from '@/features/community/share-identity'
import { isProgressRun, runFromRecord, runKindOf, } from '@/features/progress/run-kinds'
import { RunKindChip } from '@/features/progress/RunKindPills'
import { WhatCountsModal } from '@/features/progress/WhatCountsModal'
import { openVoiceConstellation } from '@/features/voice-constellation/navigation'
import { fuzzyMatch } from '@/lib/fuzzy-match'
import { generateId } from '@/lib/id'
import { copyShareUrl, encodeMelodyForShare, generateShareFullUrl, } from '@/lib/share-codec'
import { encodeSharedRunResult, parseSharedRunResult, } from '@/lib/shared-run-result'
import { storageGet, storageSet } from '@/lib/storage'
import { provideTourSetting } from '@/lib/tour-screen'
import { bpm, getSessionHistory, keyName, melodyStore, scaleType, } from '@/stores'
import { getAllMelodies } from '@/stores/melody-store'
import { showNotification } from '@/stores/notifications-store'
import type { MelodyItem, PlaybackSession, SessionResult } from '@/types'
import type { ShareRemoval } from './community-share-merge'
import { mergeMelodyCards, mergeSessionCards, removalAriaLabel, removalDialog, removalLabel, } from './community-share-merge'
import { usePublishedShareCounts } from './usePublishedShareCounts'

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
  /** Who published it, on a card from the board. Absent on a share that
   *  only ever lived in this browser's list (`pp_shared_melodies`). */
  userId?: string
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
  /** Who published it. See SharedMelody.userId. */
  userId?: string
  /** Stable source run identity, retained internally for exact matching. */
  sourceSessionId?: string
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
  // The tour's search and feed steps need a feed: from Profile it opens
  // Melodies, and Profile comes back once the tour ends (tour-screen.ts).
  onCleanup(
    // eslint-disable-next-line solid/reactivity -- read once, untracked, as a step shows
    provideTourSetting('community.feed', () => {
      if (activeTab() !== 'profile') return null
      setActiveTab('melodies')
      return () => setActiveTab('profile')
    }),
  )
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
  const publications = usePublishedShareCounts()
  const [publishing, setPublishing] = createSignal(false)
  const [removing, setRemoving] = createSignal(false)
  let disposed = false
  const removedBoardIds = new Set<string>()
  onCleanup(() => {
    disposed = true
  })
  const captureIdentity = () => {
    const userId = getUserId()
    const version = authVersion()
    return () =>
      !disposed && getUserId() === userId && authVersion() === version
  }

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
    const isCurrent = captureIdentity()
    removedBoardIds.clear()
    setDbProfile(null)
    setDbMelodies([])
    setDbSessions([])
    setStreak(0)
    setPickerType(null)
    setUnpublishing(null)
    setPublishing(false)
    setRemoving(false)
    void (async () => {
      const [profile, melodies, sessions, currentStreak] = await Promise.all([
        loadUserProfile(),
        loadSharedMelodies(),
        loadSharedSessions(),
        getCurrentStreak(),
      ])
      if (!isCurrent()) return
      setDbProfile(profile)
      setDbMelodies(
        (melodies as SharedMelody[]).filter(
          (row) => !removedBoardIds.has(row.id),
        ),
      )
      setDbSessions(
        (sessions as SharedSession[]).filter(
          (row) => !removedBoardIds.has(row.id),
        ),
      )
      setStreak(currentStreak)
    })()
  })

  // Load shared data from localStorage + DB
  const sharedMelodies = createMemo(() => {
    authVersion()
    return mergeMelodyCards(dbMelodies(), localMelodies(), getUserId())
  })

  const sharedSessions = createMemo(() => {
    authVersion()
    return mergeSessionCards(dbSessions(), localSessions(), getUserId())
  })

  // Current user profile (DB-backed, canonical persisted user id)
  // The voice twin shown on the profile is the newest measured one.
  // Keyed on authVersion because signing in changes WHOSE voice this is,
  // and an unkeyed resource would keep the previous identity's twin.
  const [voiceprints] = createResource(authVersion, listVoiceprints)
  const latestTwin = (): string | undefined => {
    if (voiceprints.loading) return undefined
    const twin = voiceprints()?.[0]?.twin
    return twin === null || twin === undefined || twin === '' ? undefined : twin
  }

  const currentProfile = createMemo(() => {
    authVersion()
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
  const shareMelody = async (m: {
    name: string
    items: MelodyItem[]
    bpm?: number
    key?: string
    scale?: string
  }) => {
    if (publishing()) return
    const isCurrent = captureIdentity()
    const publishToBoard = canPostToCommunity()
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
    if (
      alreadyShared(
        fingerprint,
        localMelodies().filter((share) => isOwnShare(share, localMelodies())),
      )
    ) {
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

    setPublishing(true)
    try {
      if (publishToBoard) {
        const saved = await saveSharedMelodyToDb({
          name: shareable.name,
          items: shareable.items,
          author: shareable.author,
          tags: shareable.tags,
        })
        if (!isCurrent()) return
        if (!saved) {
          showNotification(
            'Could not publish this melody. Try sharing it again.',
            'error',
          )
          return
        }
        shareable.id = saved.id
        shareable.userId = saved.userId
      }
      setLocalMelodies((previous) => {
        const updated = [...previous, shareable]
        storageSet('pp_shared_melodies', updated)
        return updated
      })
      if (publishToBoard) void publications.refresh()
      setPickerType(null)
      setActiveTab('melodies')
      const copied = await copyShareUrl(encoded)
      if (!isCurrent()) return
      const clipboardMessage = copied ? ' Link copied.' : ''
      showNotification(
        publishToBoard
          ? `Shared "${shareable.name}".${clipboardMessage}`
          : `Saved "${shareable.name}" to your shelf.${clipboardMessage} Create an account to list it on the Community board.`,
        'info',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      if (isCurrent()) setPublishing(false)
    }
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
   * Whether a card is this singer's own: the only card that may offer
   * Unpublish. The board lists everyone's shares, and every card used to
   * offer it. Pressed on somebody else's, it took the card off this screen
   * and announced success while the worker refused the delete
   * (canWriteRow), so the share came back on the next load.
   *
   * A share in this browser's own list is this browser's by definition:
   * without an account it never reached the board and carries no owner.
   */
  const isOwnShare = (
    share: { id: string; userId?: string },
    local: readonly { id: string }[],
  ): boolean => {
    authVersion() // signing in changes whose shares these are
    return share.userId !== undefined
      ? share.userId === getUserId()
      : local.some((own) => own.id === share.id)
  }

  /** The share awaiting "yes, take it down". */
  const [unpublishing, setUnpublishing] = createSignal<
    (ShareRemoval & { id: string }) | null
  >(null)

  const removal = createMemo(() => removalDialog(unpublishing()))

  function removeBoardShare(kind: 'melody' | 'session', id: string): void {
    if (kind === 'melody')
      setDbMelodies((rows) => rows.filter((row) => row.id !== id))
    else setDbSessions((rows) => rows.filter((row) => row.id !== id))
  }

  /** Remove a published card only after the server confirms the delete. */
  const doUnpublish = async (): Promise<void> => {
    const target = unpublishing()
    if (target === null || removing()) return
    const isCurrent = captureIdentity()
    const local = target.kind === 'melody' ? localMelodies() : localSessions()
    const board = target.kind === 'melody' ? dbMelodies() : dbSessions()
    // A board response must never turn an already-open local-only removal
    // into a server delete. Only search the records that action can affect.
    const candidates = target.published ? [...board, ...local] : local
    const share = candidates.find((row) => row.id === target.id)
    if (!share || !isOwnShare(share, local)) return
    const published = target.published
    setRemoving(true)
    try {
      if (published) {
        const removed = await unpublishShared(target.kind, target.id)
        if (!isCurrent()) return
        if (!removed) {
          showNotification(
            'Could not unpublish this share. Try again.',
            'error',
          )
          return
        }
      }
      if (target.kind === 'melody') {
        setLocalMelodies((previous) => {
          const next = previous.filter((row) => row.id !== target.id)
          storageSet('pp_shared_melodies', next)
          return next
        })
      } else {
        setLocalSessions((previous) => {
          const next = previous.filter((row) => row.id !== target.id)
          storageSet('pp_shared_sessions', next)
          return next
        })
      }
      if (published) {
        removeBoardShare(target.kind, target.id)
        removedBoardIds.add(target.id)
        void publications.refresh()
      }
      showNotification(
        published
          ? `"${target.name}" was removed from the Community board.`
          : `"${target.name}" was removed from this shelf.`,
        'info',
      )
      setUnpublishing(null)
    } finally {
      if (isCurrent()) setRemoving(false)
    }
  }

  /**
   * Runs a singer could share: every finished attempt, whatever produced
   * it. The picker used to read the local session-mode history, so
   * exercises and challenges were unshareable and a singer who only did
   * those saw an empty picker forever.
   */
  const [runRecords] = createResource(
    () => [authVersion(), sessionRecordVersion()] as const,
    async () => await loadSessionRecords(50),
  )
  // Labels come from the run-kind taxonomy rather than a second map here.
  // The map this replaced called a practice run a "session" while the
  // Progress card called a published setlist the same thing.
  const shareableRuns = createMemo(() =>
    (runRecords() ?? []).map((r) => ({
      id: r.id,
      name: r.melodyName || 'Practice session',
      score: Math.round(r.score ?? 0),
      kind: runKindOf(r.source),
      completedAt: new Date(r.endedAt ?? r.startedAt).getTime(),
    })),
  )

  // The same runs, in the shape every counting surface reads.
  const profileRuns = createMemo(() =>
    (runRecords() ?? []).map(runFromRecord).filter(isProgressRun),
  )

  // How far those runs follow the singer. NOT the same question as which
  // store they came from: a lazily provisioned anonymous identity holds a
  // valid token and has real cloud rows, but that identity lives in this
  // browser's localStorage — so "counted across your account, on every
  // device" would be false for them. `accountHeld` reads `authVersion()`,
  // so this re-derives when somebody signs in or out.
  const runScope = createMemo<'account' | 'device'>(() =>
    accountHeld() ? 'account' : 'device',
  )
  const [explainingRuns, setExplainingRuns] = createSignal(false)

  const shareSession = async (s: SessionResult, sourceSessionId: string) => {
    if (publishing()) return
    const isCurrent = captureIdentity()
    const publishToBoard = canPostToCommunity()
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
    if (
      sharedSessions().some(
        (share) =>
          isOwnShare(share, localSessions()) &&
          (share.sourceSessionId === sourceSessionId ||
            (share.sourceSessionId === undefined &&
              share.shareFingerprint === fingerprint)),
      )
    ) {
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
      sourceSessionId,
      name,
      items: [],
      author: currentProfile().displayName,
      results: [Math.round(s.score || 0)],
      date: completedAt,
      shareFingerprint: fingerprint,
    }

    if (!parseSharedRunResult(shareable)) {
      showNotification('This run has no shareable result.', 'error')
      return
    }

    setPublishing(true)
    try {
      if (publishToBoard) {
        const saved = await saveSharedSessionToDb({
          name: shareable.name,
          items: shareable.items,
          author: shareable.author,
          results: shareable.results,
          sourceSessionId,
        })
        if (!isCurrent()) return
        if (!saved) {
          showNotification(
            'Could not publish this run. Try sharing it again.',
            'error',
          )
          return
        }
        shareable.id = saved.id
        shareable.userId = saved.userId
      }
      setLocalSessions((previous) => {
        const updated = [...previous, shareable]
        storageSet('pp_shared_sessions', updated)
        return updated
      })
      if (publishToBoard) void publications.refresh()
      setPickerType(null)
      setActiveTab('sessions')
      showNotification(
        publishToBoard
          ? `Shared "${shareable.name}"`
          : `Saved "${shareable.name}" to your shelf. Create an account to list it on the Community board.`,
        'info',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      if (isCurrent()) setPublishing(false)
    }
  }

  const sessionShareLink = (id: string): string | null => {
    const session = sharedSessions().find((item) => item.id === id)
    if (!session) return null
    const base = `${window.location.origin}${window.location.pathname}`
    if (session.userId !== undefined && session.userId !== '')
      return `${base}#/share?type=session&id=${encodeURIComponent(session.id)}`
    const payload = encodeSharedRunResult(session)
    return payload !== null ? `${base}#/result/${payload}` : null
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
    const link = type === 'session' ? sessionShareLink(id) : null
    if (link === null) {
      showNotification('This result is unavailable.', 'error')
      return
    }
    void navigator.clipboard.writeText(link).then(
      () => showNotification('Share link copied to clipboard!', 'info'),
      () => showNotification('Failed to copy link', 'error'),
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
    const link = sessionShareLink(id)
    if (link !== null) window.location.href = link
    else showNotification('This result is unavailable.', 'error')
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
                <span class={`${tabStyles.tabIcon} community-tab-icon`}>
                  {tab.icon()}
                </span>
                <span class="tab-name">{tab.name}</span>
                {tab.count > 0 && (
                  <span class={`${modalStyles.tabCount} community-tab-count`}>
                    {tab.count}
                  </span>
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
                    <Show when={isOwnShare(melody, localMelodies())}>
                      <button
                        class={`${modalStyles.actionBtn} unpublish-btn`}
                        onClick={() =>
                          setUnpublishing({
                            kind: 'melody',
                            id: melody.id,
                            name: melody.name,
                            published: melody.userId !== undefined,
                            retainedLocalCopy: melody.retainedLocalCopy,
                          })
                        }
                        aria-label={removalAriaLabel(melody)}
                        title={removalLabel(melody)}
                      >
                        <span>
                          <IconCloseSmall />
                        </span>
                      </button>
                    </Show>
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
          {/* Publishing a copy of a result does not record another run. */}
          <p class={profileStyles.countsNote}>
            These are results the community has shared from completed runs.
            Publishing or viewing a result does not add a run to your practice
            history.{' '}
            <button
              type="button"
              class={profileStyles.countsNoteLink}
              onClick={() => setExplainingRuns(true)}
            >
              What counts where?
            </button>
          </p>
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
                    <Show when={isOwnShare(session, localSessions())}>
                      <button
                        class={`${modalStyles.actionBtn} unpublish-btn`}
                        onClick={() =>
                          setUnpublishing({
                            kind: 'session',
                            id: session.id,
                            name: session.name,
                            published: session.userId !== undefined,
                            retainedLocalCopy: session.retainedLocalCopy,
                          })
                        }
                        aria-label={removalAriaLabel(session)}
                        title={removalLabel(session)}
                      >
                        <span>
                          <IconCloseSmall />
                        </span>
                      </button>
                    </Show>
                    <button
                      class={`${modalStyles.actionBtn} view-btn`}
                      onClick={() => openShared('session', session.id)}
                      aria-label={`Open ${session.name}`}
                      title="Open this result"
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
                  <p>Share a completed run so others can see your result.</p>
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
            runs={profileRuns()}
            runScope={runScope()}
            onExplainRuns={() => setExplainingRuns(true)}
            streak={currentProfile().streak}
            sharedMelodies={publications.counts().melodies}
            sharedResults={publications.counts().sessions}
            twinName={latestTwin()}
            badges={earnedBadges()}
            onExploreVoiceConstellation={openVoiceConstellation}
          />
        </Show>
      </div>

      <Show when={explainingRuns()}>
        <WhatCountsModal onClose={() => setExplainingRuns(false)} />
      </Show>

      <ConfirmDialog
        open={unpublishing() !== null}
        title={removal().title}
        message={removal().message}
        confirmLabel={removal().label}
        busy={removing()}
        onConfirm={() => {
          void doUnpublish()
        }}
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
                      disabled={publishing()}
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
                        disabled={publishing()}
                        onClick={() => {
                          void shareMelody({
                            name: m.name,
                            items: m.items,
                            bpm: m.bpm,
                            key: m.key,
                            scale: m.scaleType,
                          })
                        }}
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
                    singer had actually practiced, and Community > Sessions
                    could never fill up. */}
                <For each={shareableRuns()}>
                  {(s) => (
                    <div class="share-picker-row">
                      <div class="share-picker-info">
                        <span class="share-picker-name">{s.name}</span>
                        <span class="share-picker-meta">
                          <RunKindChip kind={s.kind} /> {s.score}% &middot;{' '}
                          {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        class="primary-btn share-picker-action"
                        disabled={publishing()}
                        onClick={() => {
                          void shareSession(
                            {
                              name: s.name,
                              sessionName: s.name,
                              score: s.score,
                              completedAt: s.completedAt,
                            } as SessionResult,
                            s.id,
                          )
                        }}
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
