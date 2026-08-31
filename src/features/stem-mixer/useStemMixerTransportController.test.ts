// ============================================================
// useStemMixerTransportController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))

import type { ComparisonPoint, MicScore } from '@/lib/mic-scoring'
import * as playlist from '@/stores/karaoke-playlist-store'
import { setKaraokeZen } from '@/stores/ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { saveAllUvrSessions } from '@/stores/uvr-store'
import { useStemMixerTransportController } from './useStemMixerTransportController'

describe('useStemMixerTransportController', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    playlist.stopPlaylist()
    setKaraokeZen(false)
    for (const pl of playlist.getPlaylistsReactive().slice()) {
      await playlist.deletePlaylist(pl.id)
    }
  })

  it('handles navigation, autoplay, and library browsing when no playlist is active', async () => {
    saveAllUvrSessions([
      {
        sessionId: 'session-0',
        status: 'completed',
        createdAt: 1000,
        originalFile: { name: 'Track0.mp3', size: 100, type: 'audio/mp3' },
        stemMeta: {
          vocal: { name: 'vocal.mp3', size: 50, mimeType: 'audio/mp3' },
        },
      } as unknown as UvrSession,
      {
        sessionId: 'session-1',
        status: 'completed',
        createdAt: 2000,
        originalFile: { name: 'Track1.mp3', size: 100, type: 'audio/mp3' },
        outputs: { instrumental: 'file:///inst.mp3' },
      } as unknown as UvrSession,
      {
        sessionId: 'session-2',
        status: 'completed',
        createdAt: 3000,
        originalFile: { name: 'Track2.mp3', size: 100, type: 'audio/mp3' },
        outputs: { vocal: 'file:///vocal.mp3' },
      } as unknown as UvrSession,
    ])

    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const onPickSession = vi.fn()
        const onBack = vi.fn()
        const [playing, setPlaying] = createSignal(false)
        const [loading] = createSignal(false)
        const [loadError] = createSignal(false)
        const [duration] = createSignal(120)
        const [micActive] = createSignal(false)
        const [showScore, setShowScore] = createSignal(false)
        const [score] = createSignal<MicScore | null>(null)
        const [comparisonData] = createSignal<ComparisonPoint[]>([])
        const setTrackVolume = vi.fn()

        const controller = useStemMixerTransportController({
          getSessionId: () => 'session-1',
          getSongTitle: () => 'Song 1.mp3',
          onPickSession,
          onBack,
          mic: {
            micActive,
            toggleMic: vi.fn(async () => {}),
            showScore,
            setShowScore,
            score,
            computeScore: vi.fn(() => null),
            comparisonData,
          },
          audio: {
            playing,
            loading,
            loadError,
            duration,
            handlePlay: vi.fn(),
            handlePause: vi.fn(),
          },
          setTrackVolume,
        })

        expect(controller.playlistSidebarOpen()).toBe(false)
        controller.setPlaylistSidebarOpen(true)
        expect(controller.playlistSidebarOpen()).toBe(true)

        expect(controller.playlistSidebarMounted()).toBe(false)
        controller.setPlaylistSidebarMounted(true)
        expect(controller.playlistSidebarMounted()).toBe(true)

        // Test handleZenBack
        setKaraokeZen(true)
        controller.handleZenBack()

        // Test library drawer songs
        const songs = controller.libraryDrawerSongs()
        expect(songs.length).toBeGreaterThan(0)

        // Test library navigation functions
        expect(controller.canLibraryNav()).toBe(true)
        expect(controller.hasPrevItem()).toBe(true)
        expect(controller.hasNextItem()).toBe(true)
        controller.goPrevItem()
        expect(onPickSession).toHaveBeenCalledWith('session-2')
        controller.goNextItem()
        expect(onPickSession).toHaveBeenCalledWith('session-0')

        // Test autoplay end-of-song
        controller.setAutoplayEnabled(true)
        expect(controller.autoplayEnabled()).toBe(true)
        controller.handleSongEnded()
        expect(onPickSession).toHaveBeenCalledWith('session-0')

        // Title effect
        setPlaying(true)
        await Promise.resolve()

        dispose()
        resolve()
      })
    })
  })

  it('handles playlist actions, countdown, and scoring flow during active playlist', async () => {
    const pl = await playlist.createPlaylist('Party Set')
    await playlist.addItem(pl.id, {
      kind: 'session',
      refId: 'session-1',
      singerName: 'Alice',
      vocalVolume: 0.7,
    })
    await playlist.addItem(pl.id, {
      kind: 'session',
      refId: 'session-2',
      singerName: 'Bob',
    })
    playlist.startPlaylist(pl.id)

    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const onPickSession = vi.fn()
        const [playing, setPlaying] = createSignal(false)
        const [loading] = createSignal(false)
        const [loadError] = createSignal(false)
        const [duration] = createSignal(100)
        const [micActive, setMicActive] = createSignal(false)
        const [showScore, setShowScore] = createSignal(false)
        const [score] = createSignal<MicScore | null>({
          totalNotes: 10,
          matchedNotes: 8,
          accuracyPct: 80,
          avgCentsOff: 12,
          grade: 'B',
        })
        const [comparisonData] = createSignal<ComparisonPoint[]>([])
        const setTrackVolume = vi.fn()
        const handlePlay = vi.fn(() => setPlaying(true))
        const handlePause = vi.fn(() => setPlaying(false))
        const toggleMic = vi.fn(async () => {
          setMicActive(true)
        })

        const controller = useStemMixerTransportController({
          getSessionId: () => 'session-1',
          getSongTitle: () => 'Song 1',
          onPickSession,
          mic: {
            micActive,
            toggleMic,
            showScore,
            setShowScore,
            score,
            computeScore: vi.fn(() => score()),
            comparisonData,
          },
          audio: {
            playing,
            loading,
            loadError,
            duration,
            handlePlay,
            handlePause,
          },
          setTrackVolume,
        })

        expect(controller.isCurrentPlaylistSong()).toBe(true)
        expect(controller.hasNextItem()).toBe(true)
        expect(controller.hasPrevItem()).toBe(false)

        // Test start countdown with inactive mic (triggers toggleMic)
        controller.handlePlaylistStart()
        await new Promise((r) => setTimeout(r, 0))
        expect(toggleMic).toHaveBeenCalled()

        // Test countdown flipping to playing starts audio
        playlist.beginCurrentSong()
        await new Promise((r) => setTimeout(r, 0))
        expect(handlePlay).toHaveBeenCalled()
        expect(setTrackVolume).toHaveBeenCalledWith('Vocal', 0.7)

        // Test playlist song ended
        controller.handleSongEnded()

        // Test score modal close
        controller.handleScoreModalClose()

        // Test next/prev/stop item
        controller.goNextItem()
        expect(handlePause).toHaveBeenCalled()
        controller.handlePlaylistPrev()
        controller.handlePlaylistStopAll()

        dispose()
        resolve()
      })
    })
  })
})
