// ============================================================
// useStemMixerTransportController — Karaoke playlist & zen transport
// ============================================================
//
// Manages karaoke playlist playback lifecycle, countdown, scoring transition,
// library-wide zen browsing, autoplay, and document title synchronization.
//

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { KaraokeLibrarySong } from '@/components/KaraokePlaylistSidebar'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { autoAdvanceTarget, nextSessionId, orderedLibrarySessions, playlistEndAction, prevSessionId, } from '@/features/stem-mixer/zen-navigation'
import { extractTitle } from '@/lib/lyrics-service'
import type { ComparisonPoint, MicScore } from '@/lib/mic-scoring'
import { createPersistedSignal } from '@/lib/storage'
import { isNarrow } from '@/lib/use-viewport'
import * as playlist from '@/stores/karaoke-playlist-store'
import { karaokeZen, setKaraokeZen } from '@/stores/ui-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'

export type { KaraokeLibrarySong }

export interface UseStemMixerTransportControllerDeps {
  getSessionId: () => string
  getSongTitle: () => string | undefined
  onPickSession?: (sessionId: string) => void
  onBack?: () => void
  mic: {
    micActive: Accessor<boolean>
    toggleMic: () => Promise<void>
    showScore: Accessor<boolean>
    setShowScore: (v: boolean) => void
    score: Accessor<MicScore | null>
    computeScore: () => MicScore | null
    comparisonData: Accessor<ComparisonPoint[]>
  }
  audio: {
    playing: Accessor<boolean>
    loading: Accessor<boolean>
    loadError: Accessor<string | null | boolean>
    duration: Accessor<number>
    handlePlay: () => void
    handlePause: () => void
  }
  setTrackVolume: (label: string, volume: number) => void
}

export interface UseStemMixerTransportControllerReturn {
  playlistSidebarOpen: Accessor<boolean>
  setPlaylistSidebarOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  playlistSidebarMounted: Accessor<boolean>
  setPlaylistSidebarMounted: (v: boolean | ((prev: boolean) => boolean)) => void
  autoplayEnabled: Accessor<boolean>
  setAutoplayEnabled: (v: boolean | ((prev: boolean) => boolean)) => void
  zenStage: Accessor<boolean>
  handleZenBack: () => void
  isCurrentPlaylistSong: () => boolean
  handlePlaylistSongEnded: () => void
  handlePlaylistStart: () => void
  handlePlaylistPrev: () => void
  handlePlaylistNext: () => void
  handlePlaylistStopAll: () => void
  handleScoreModalClose: () => void
  orderedLibrary: () => ReturnType<typeof orderedLibrarySessions>
  orderedLibraryIds: () => string[]
  libraryDrawerSongs: () => KaraokeLibrarySong[]
  canLibraryNav: () => boolean
  hasPrevItem: () => boolean
  hasNextItem: () => boolean
  goPrevItem: () => void
  goNextItem: () => void
  handleSongEnded: () => void
}

export function useStemMixerTransportController(
  deps: UseStemMixerTransportControllerDeps,
): UseStemMixerTransportControllerReturn {
  const [playlistSidebarOpen, setPlaylistSidebarOpen] = createPersistedSignal(
    'sm-karaoke-playlist-sidebar',
    false,
  )
  const [playlistSidebarMounted, setPlaylistSidebarMounted] = createSignal(
    playlistSidebarOpen(),
  )
  const [autoplayEnabled, setAutoplayEnabled] = createPersistedSignal(
    'sm-zen-autoplay',
    false,
  )

  let pendingAdvance = false
  let playStarted = false

  const zenStage = () => isNarrow() || karaokeZen()

  const handleZenBack = (): void => {
    if (karaokeZen() && !isNarrow()) {
      setKaraokeZen(false)
    } else {
      deps.onBack?.()
    }
  }

  const isCurrentPlaylistSong = () =>
    playlist.isPlaylistActive() &&
    playlist.currentSong()?.sessionId === deps.getSessionId()

  const handlePlaylistSongEnded = () => {
    if (!isCurrentPlaylistSong() || playlist.phase() !== 'playing') return
    const action = playlistEndAction(
      zenStage(),
      deps.mic.micActive(),
      deps.mic.comparisonData().length,
    )
    if (action === 'defer-to-score-modal') {
      pendingAdvance = true
    } else {
      playlist.reportSongScore(
        action === 'advance-with-score' ? deps.mic.computeScore() : null,
      )
      playlist.advance()
    }
  }

  const handleScoreModalClose = () => {
    deps.mic.setShowScore(false)
    if (playlist.isPlaylistActive() && pendingAdvance) {
      pendingAdvance = false
      playlist.reportSongScore(deps.mic.score())
      playlist.advance()
    }
  }

  createEffect(() => {
    if (!zenStage() || !deps.mic.showScore()) return
    handleScoreModalClose()
  })

  const handlePlaylistStart = () => {
    if (!deps.mic.micActive()) {
      void deps.mic.toggleMic().finally(() => playlist.beginCountdown())
    } else {
      playlist.beginCountdown()
    }
  }

  const handlePlaylistPrev = () => {
    deps.audio.handlePause()
    playlist.prev()
  }

  const handlePlaylistNext = () => {
    deps.audio.handlePause()
    playlist.advance()
  }

  const handlePlaylistStopAll = () => {
    deps.audio.handlePause()
    playlist.stopPlaylist()
  }

  const orderedLibrary = () =>
    orderedLibrarySessions(getAllUvrSessionsReactive(), DEMO_SESSION_ID)

  const orderedLibraryIds = (): string[] =>
    orderedLibrary().map((session) => session.sessionId)

  const libraryDrawerSongs = (): KaraokeLibrarySong[] =>
    orderedLibrary().map((session) => ({
      sessionId: session.sessionId,
      title: extractTitle(session.originalFile?.name ?? session.sessionId),
      availableStems: [
        ...(session.outputs?.vocal !== undefined ||
        session.stemMeta?.vocal !== undefined
          ? (['vocal'] as const)
          : []),
        ...(session.outputs?.instrumental !== undefined ||
        session.stemMeta?.instrumental !== undefined
          ? (['instrumental'] as const)
          : []),
      ],
    }))

  const canLibraryNav = (): boolean => deps.onPickSession !== undefined

  const hasPrevItem = (): boolean =>
    playlist.isPlaylistActive()
      ? playlist.currentIndex() > 0
      : canLibraryNav() &&
        prevSessionId(orderedLibraryIds(), deps.getSessionId()) !== null

  const hasNextItem = (): boolean =>
    playlist.isPlaylistActive()
      ? playlist.nextSong() !== null
      : canLibraryNav() &&
        nextSessionId(orderedLibraryIds(), deps.getSessionId()) !== null

  const goPrevItem = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistPrev()
      return
    }
    const id = prevSessionId(orderedLibraryIds(), deps.getSessionId())
    if (id !== null) deps.onPickSession?.(id)
  }

  const goNextItem = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistNext()
      return
    }
    const id = nextSessionId(orderedLibraryIds(), deps.getSessionId())
    if (id !== null) deps.onPickSession?.(id)
  }

  const handleSongEnded = (): void => {
    if (playlist.isPlaylistActive()) {
      handlePlaylistSongEnded()
      return
    }
    const target = autoAdvanceTarget(
      autoplayEnabled(),
      orderedLibraryIds(),
      deps.getSessionId(),
    )
    if (target !== null) deps.onPickSession?.(target)
  }

  createEffect(() => {
    if (
      isCurrentPlaylistSong() &&
      playlist.phase() === 'playing' &&
      !playStarted &&
      !deps.audio.loading() &&
      Boolean(deps.audio.loadError()) === false &&
      deps.audio.duration() > 0
    ) {
      playStarted = true
      const vocalPref = playlist.currentSong()?.vocalVolume
      if (vocalPref !== undefined) deps.setTrackVolume('Vocal', vocalPref)
      deps.audio.handlePlay()
      setPlaylistSidebarOpen(false)
    }
  })

  // Reflect the playing song in the browser tab title
  const baseDocTitle = typeof document !== 'undefined' ? document.title : ''
  createEffect(() => {
    if (typeof document === 'undefined') return
    const songName = (deps.getSongTitle() ?? '').replace(/\.[^.]+$/, '').trim()
    document.title =
      deps.audio.playing() && songName
        ? `MercuryPitch — ${songName}`
        : baseDocTitle
  })
  onCleanup(() => {
    if (typeof document !== 'undefined') document.title = baseDocTitle
  })

  return {
    playlistSidebarOpen,
    setPlaylistSidebarOpen,
    playlistSidebarMounted,
    setPlaylistSidebarMounted,
    autoplayEnabled,
    setAutoplayEnabled,
    zenStage,
    handleZenBack,
    isCurrentPlaylistSong,
    handlePlaylistSongEnded,
    handlePlaylistStart,
    handlePlaylistPrev,
    handlePlaylistNext,
    handlePlaylistStopAll,
    handleScoreModalClose,
    orderedLibrary,
    orderedLibraryIds,
    libraryDrawerSongs,
    canLibraryNav,
    hasPrevItem,
    hasNextItem,
    goPrevItem,
    goNextItem,
    handleSongEnded,
  }
}
