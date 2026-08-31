// Guitar Night song-library tests protect honest prepared-session staging in the room UI.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingSession, GuitarBackingTrackState, GuitarBackingTransport, GuitarBackingTransportStatus, } from '@/features/guitar/backing/guitar-backing-transport'
import { GuitarNightApp } from '@/features/guitar-night/GuitarNightApp'
import type { GuitarNightPreparationPort, GuitarNightPreparationResult, } from '@/features/guitar-night/preparation-port'
import type { GuitarNightReferencePort, GuitarNightTranscriptionPort, } from '@/features/guitar-night/reference-port'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, GuitarNightSongSummary, } from '@/features/guitar-night/song-port'
import { acquireLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function chooseAudio(file: File): void {
  const input = screen.getByTestId(
    'guitar-night-file-input',
  ) as HTMLInputElement
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  })
  fireEvent.change(input)
}

function mixedBackingResult(
  sessionId: string,
  release = vi.fn(),
): GuitarNightOpenBackingResult {
  return {
    ok: true,
    lease: {
      sessionId,
      title: `${sessionId}.wav`,
      stems: [
        { kind: 'instrumental', url: 'blob:instrumental', sizeBytes: 100 },
      ],
      defaultMix: {
        kind: 'mixed-instrumental',
        audible: ['instrumental'],
        muted: [],
      },
      release,
    },
  }
}

/** The same two-stem lease, but marked as the app's demo rather than a
 *  separation this device holds. */
function demoBackingResult(sessionId: string): GuitarNightOpenBackingResult {
  const base = mixedBackingResult(sessionId)
  if (!base.ok) return base
  return { ok: true, lease: { ...base.lease, source: 'demo' } }
}

/**
 * A device whose library is long enough to page: newest song first.
 *
 * `demos` are appended the way the composed port appends them — a
 * separate source that shares one list and is told apart by `source`.
 */
function libraryPort(count: number, demos = 0): GuitarNightSongPort {
  const songs: GuitarNightSongSummary[] = Array.from(
    { length: count },
    (_, index) => {
      const ordinal = String(index + 1).padStart(2, '0')
      return {
        sessionId: `session-${ordinal}`,
        title: `Song ${ordinal}.wav`,
        createdAt: Date.UTC(2026, 7, 6) - index * 86_400_000,
      }
    },
  )
  for (let index = 0; index < demos; index++) {
    songs.push({
      sessionId:
        index === 0 ? 'karaoke-night-demo' : `karaoke-night-demo:${index}`,
      title: `Demo Song ${index + 1}`,
      createdAt: 0,
      source: 'demo',
      subtitle: 'Demo song · Josh Woodward',
    })
  }
  return {
    initialize: vi.fn(async () => undefined),
    completedSongs: () => songs,
    openSession: vi.fn(async (sessionId: string) =>
      mixedBackingResult(sessionId),
    ),
  }
}

function fakeBackingTransport() {
  let status: GuitarBackingTransportStatus = 'idle'
  let playbackRate = 1
  let currentSession: GuitarBackingSession | null = null
  let trackStates: GuitarBackingTrackState[] = []
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const configure = vi.fn((session: GuitarBackingSession | null) => {
    currentSession = session
    status = session === null ? 'idle' : 'armed'
    trackStates =
      session?.tracks.map((track) => ({
        id: track.id,
        label: track.label,
        muted: track.muted ?? false,
        level: track.level ?? 1,
        available: true,
      })) ?? []
    emit()
  })
  const transport: GuitarBackingTransport = {
    configure,
    activate: async () => true,
    play: vi.fn(async () => {
      if (currentSession === null) return false
      status = 'playing'
      emit()
      return true
    }),
    pause: vi.fn(() => {
      status = 'paused'
      emit()
    }),
    stop: vi.fn(() => {
      status = currentSession === null ? 'idle' : 'ready'
      emit()
    }),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(async (rate) => {
      playbackRate = rate
      emit()
      return true
    }),
    setMasterVolume: vi.fn(),
    setElectricAmpParameters: vi.fn(),
    setTrackMuted: vi.fn((id, muted) => {
      trackStates = trackStates.map((track) =>
        track.id === id ? { ...track, muted } : track,
      )
      emit()
    }),
    getAudioContext: () => null,
    getAudioGraph: () => null,
    getLoadMode: () => null,
    getLoadProgress: () => null,
    getStatus: () => status,
    getCurrentTime: () => 0,
    getDuration: () =>
      Math.max(
        0,
        ...(currentSession?.tracks.map((track) => track.durationSeconds ?? 0) ??
          []),
      ),
    getPlaybackRate: () => playbackRate,
    getMasterVolume: () => 0.78,
    getTrackStates: () => trackStates,
    getError: () => null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: vi.fn(async () => undefined),
  }
  return { configure, transport }
}

describe('GuitarNightApp prepared songs', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('guards the standalone document while a local Keep is pending', async () => {
    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(0))} />
    ))

    const beforeKeep = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(beforeKeep)).toBe(true)

    const releaseLock = acquireLocalSaveNavigationLock('guitar unload test')
    try {
      await Promise.resolve()
      const duringKeep = new Event('beforeunload', { cancelable: true })
      expect(window.dispatchEvent(duringKeep)).toBe(false)
      expect(duringKeep.defaultPrevented).toBe(true)
    } finally {
      releaseLock()
    }

    await Promise.resolve()
    const afterKeep = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(afterKeep)).toBe(true)
  })

  it('stages a prepared full-band session with guitar muted by default', async () => {
    const release = vi.fn()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-velvet',
          title: 'Velvet Demo.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: {
            sessionId: 'session-velvet',
            title: 'Velvet Demo.wav',
            stems: [
              { kind: 'drums', url: 'blob:drums', sizeBytes: 100 },
              { kind: 'bass', url: 'blob:bass', sizeBytes: 100 },
              { kind: 'guitar', url: 'blob:guitar', sizeBytes: 100 },
            ],
            defaultMix: {
              kind: 'parts',
              audible: ['drums', 'bass'],
              muted: ['guitar'],
            },
            release,
          },
        }),
      ),
    }

    render(() => <GuitarNightApp loadSongPort={() => Promise.resolve(port)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Velvet Demo\.wav/ }),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Velvet Demo\.wav/ }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'The guitar part is staged separately and defaults muted.',
        ),
      ).toBeInTheDocument(),
    )
    expect(window.location.search).toBe('?session=session-velvet')

    cleanup()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('enters a quiet play-along room and exposes only real stem controls', async () => {
    const backingTransport = fakeBackingTransport()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-room',
          title: 'Quiet Room.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: {
            sessionId: 'session-room',
            title: 'Quiet Room.wav',
            stems: [
              {
                kind: 'drums',
                url: 'blob:drums',
                sizeBytes: 100,
                durationSeconds: 12,
              },
              {
                kind: 'guitar',
                url: 'blob:guitar',
                sizeBytes: 100,
                durationSeconds: 12,
              },
            ],
            defaultMix: {
              kind: 'parts',
              audible: ['drums'],
              muted: ['guitar'],
            },
            release: vi.fn(),
          },
        }),
      ),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(port)}
        createBackingTransport={() => backingTransport.transport}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /^Quiet Room\.wav/ }),
    )

    const enterRoom = await screen.findByRole('button', {
      name: 'Enter room',
    })
    expect(backingTransport.configure).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-room' }),
    )
    fireEvent.click(enterRoom)

    expect(screen.getByTestId('guitar-night-room')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Quiet Room.wav' }),
    ).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Play backing' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Guitar muted' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(backingTransport.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-room',
        tracks: expect.arrayContaining([
          expect.objectContaining({ id: 'guitar', muted: true }),
        ]),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play backing' }))
    expect(
      await screen.findByRole('button', { name: 'Pause backing' }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Songs' }))
    expect(backingTransport.transport.pause).toHaveBeenCalledOnce()
    const resumeSong = await screen.findByRole('button', {
      name: /^Quiet Room\.wav/,
    })
    expect(resumeSong).toHaveTextContent('Resume')
    fireEvent.click(resumeSong)

    expect(
      await screen.findByRole('button', { name: 'Resume backing' }),
    ).toBeVisible()
    expect(backingTransport.configure).toHaveBeenCalledTimes(1)
  })

  it('keeps a two-stem room honest and omits a fake guitar channel', async () => {
    const backingTransport = fakeBackingTransport()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-mixed',
          title: 'Drums Only.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(async () => mixedBackingResult('session-mixed')),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(port)}
        createBackingTransport={() => backingTransport.transport}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Drums Only\.wav/ }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Enter room' }))

    expect(
      screen.getByText(
        'Backing ready. Guitar remains inside this mix, so it cannot be muted independently.',
      ),
    ).toBeInTheDocument()
    // No guitar *channel*: a mute chip is named "<track> on"/"<track> muted".
    // The stage's instrument picker also says "Guitar", and it is not a claim
    // about the mix, so match the channel naming rather than the word.
    expect(
      screen.queryByRole('button', { name: /^Guitar (on|muted)$/ }),
    ).toBeNull()
  })

  it('describes available band parts honestly when no separate guitar stem exists', async () => {
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-rhythm',
          title: 'Rhythm Room.wav',
          createdAt: Number.MAX_VALUE,
        },
      ],
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: {
            sessionId: 'session-rhythm',
            title: 'Rhythm Room.wav',
            stems: [
              { kind: 'drums', url: 'blob:drums', sizeBytes: 100 },
              { kind: 'bass', url: 'blob:bass', sizeBytes: 100 },
            ],
            defaultMix: {
              kind: 'parts',
              audible: ['drums', 'bass'],
              muted: [],
            },
            release: vi.fn(),
          },
        }),
      ),
    }

    render(() => <GuitarNightApp loadSongPort={() => Promise.resolve(port)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    const song = await screen.findByRole('button', {
      name: /Rhythm Room\.wav/,
    })
    expect(song).toHaveTextContent('Date unavailable')

    fireEvent.click(song)

    expect(
      await screen.findByText(
        'The available band parts are staged without a separate guitar track.',
      ),
    ).toBeInTheDocument()
  })

  it('detaches measured notes when a different backing session is staged', async () => {
    const songs = [
      {
        sessionId: 'session-a',
        title: 'Session A.wav',
        createdAt: Date.UTC(2026, 7, 6),
      },
      {
        sessionId: 'session-b',
        title: 'Session B.wav',
        createdAt: Date.UTC(2026, 7, 5),
      },
    ]
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => songs,
      openSession: vi.fn(
        async (sessionId: string): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: {
            sessionId,
            title: `${sessionId}.wav`,
            stems: [
              {
                kind: 'bass',
                url: `blob:${sessionId}:bass`,
                sizeBytes: 100,
              },
            ],
            defaultMix: {
              kind: 'parts',
              audible: ['bass'],
              muted: [],
            },
            release: vi.fn(),
          },
        }),
      ),
    }
    const referencePort: GuitarNightReferencePort = {
      listReferences: () => [],
      openReference: () => ({ ok: false, code: 'not-found' }),
      suggestInstrument: () => null,
      readSource: () => null,
      rememberTrack: vi.fn(),
      importReference: vi.fn(async () => {
        throw new Error('Not used in this test')
      }),
    }
    const transcribeStem = vi.fn(async () => ({
      coverage: 0.9,
      analysedSeconds: 1,
      notes: [
        {
          midi: 40,
          noteName: 'E2',
          startSeconds: 0,
          durationSeconds: 0.5,
          confidence: 0.9,
        },
      ],
    }))
    const transcriptionPort: GuitarNightTranscriptionPort = { transcribeStem }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadReferencePort={() => Promise.resolve(referencePort)}
        loadTranscriptionPort={() => Promise.resolve(transcriptionPort)}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Session A\.wav/ }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Transcribe the bass line',
      }),
    )

    expect(
      await screen.findByText('Bass line transcribed from this recording'),
    ).toBeInTheDocument()
    expect(transcribeStem).toHaveBeenCalledWith(
      'blob:session-a:bass',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Session B\.wav/ }))

    await waitFor(() =>
      expect(window.location.search).toBe('?session=session-b'),
    )
    await waitFor(() =>
      expect(
        screen.queryByText('Bass line transcribed from this recording'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByText(
        'No scores on this device yet. Use Choose a file above to open Guitar Pro or MIDI — without one the stage stays in honest free play.',
      ),
    ).toBeInTheDocument()
  })

  it('offers the guitar stem on the same terms as the bass', async () => {
    // Bass was the only stem offered, on the grounds that it is effectively
    // monophonic and monophonic is what pitch detection handles. Guitar is
    // offered now on the same terms: the reader is the same reader, and a
    // stem it cannot make sense of already reports that and leaves the stage
    // in free play. Nothing downstream needed changing — `followStem` has
    // always tuned the stage from `stemKind`.
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-band',
          title: 'Full Band.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(
        async (sessionId: string): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: {
            sessionId,
            title: `${sessionId}.wav`,
            stems: [
              { kind: 'drums', url: `blob:${sessionId}:drums`, sizeBytes: 100 },
              { kind: 'bass', url: `blob:${sessionId}:bass`, sizeBytes: 100 },
              {
                kind: 'guitar',
                url: `blob:${sessionId}:guitar`,
                sizeBytes: 100,
              },
            ],
            defaultMix: { kind: 'parts', audible: ['drums'], muted: [] },
            release: vi.fn(),
          },
        }),
      ),
    }
    const referencePort: GuitarNightReferencePort = {
      listReferences: () => [],
      openReference: () => ({ ok: false, code: 'not-found' }),
      suggestInstrument: () => null,
      readSource: () => null,
      rememberTrack: vi.fn(),
      importReference: vi.fn(async () => {
        throw new Error('Not used in this test')
      }),
    }
    const reading = deferred<{
      coverage: number
      analysedSeconds: number
      notes: {
        midi: number
        noteName: string
        startSeconds: number
        durationSeconds: number
        confidence: number
      }[]
    }>()
    const transcribeStem = vi.fn(async () => reading.promise)
    const transcriptionPort: GuitarNightTranscriptionPort = { transcribeStem }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadReferencePort={() => Promise.resolve(referencePort)}
        loadTranscriptionPort={() => Promise.resolve(transcriptionPort)}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Full Band\.wav/ }),
    )

    // Both are on offer, guitar first: this is Guitar Night.
    const guitar = await screen.findByRole('button', {
      name: 'Transcribe the guitar line',
    })
    const bass = screen.getByRole('button', {
      name: 'Transcribe the bass line',
    })
    expect(
      guitar.compareDocumentPosition(bass) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(guitar)

    // The guitar stem's own audio, not the bass's.
    await waitFor(() =>
      expect(transcribeStem).toHaveBeenCalledWith(
        'blob:session-band:guitar',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )

    // One reader at a time: while guitar runs, bass cannot be started, and it
    // says so rather than silently doing nothing.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Reading the guitar notes/ }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: 'Transcribe the bass line' }),
    ).toBeDisabled()

    reading.resolve({
      coverage: 0.9,
      analysedSeconds: 1,
      notes: [
        {
          midi: 64,
          noteName: 'E4',
          startSeconds: 0,
          durationSeconds: 0.5,
          confidence: 0.9,
        },
      ],
    })

    expect(
      await screen.findByText('Guitar line transcribed from this recording'),
    ).toBeInTheDocument()
    // And the offer comes back for both once the reader is free.
    expect(
      screen.getByRole('button', { name: 'Transcribe the bass line' }),
    ).toBeEnabled()
  })

  it('prepares chosen audio, reports progress, and auto-stages without playback', async () => {
    const preparation = deferred<GuitarNightPreparationResult>()
    const prepare = vi.fn<GuitarNightPreparationPort['prepare']>(
      (_file, options) => {
        options.onUpdate({ phase: 'separating', progress: 42 })
        return preparation.promise
      },
    )
    let prepared = false
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () =>
        prepared
          ? [
              {
                sessionId: 'session-upload',
                title: 'practice-room.wav',
                createdAt: Date.UTC(2026, 7, 6),
              },
            ]
          : [],
      openSession: vi.fn(async () => mixedBackingResult('session-upload')),
    }
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadPreparationPort={() => Promise.resolve({ prepare })}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))

    const file = new File(['RIFFdata'], 'practice-room.wav', {
      type: 'audio/wav',
    })
    chooseAudio(file)

    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    const progress = screen.getByRole('progressbar', {
      name: 'Preparing practice-room.wav',
    })
    expect(
      within(progress.parentElement as HTMLElement).getByRole('status'),
    ).toHaveTextContent('Separating vocals and accompaniment · 42%')
    expect(progress).toHaveAttribute('value', '42')

    prepared = true
    preparation.resolve({
      status: 'completed',
      sessionId: 'session-upload',
    })

    await waitFor(() =>
      expect(songPort.openSession).toHaveBeenCalledWith(
        'session-upload',
        expect.any(AbortSignal),
      ),
    )
    expect(
      await screen.findByText(
        'Guitar is still inside this instrumental mix, so no guitar-mute control is shown.',
      ),
    ).toBeInTheDocument()
    expect(songPort.initialize).toHaveBeenCalledTimes(2)
    expect(window.location.search).toBe('?session=session-upload')
    expect(play).not.toHaveBeenCalled()
  })

  it('routes MIDI through the score library without starting audio preparation', async () => {
    const prepare = vi.fn<GuitarNightPreparationPort['prepare']>()
    const importReference = vi.fn<GuitarNightReferencePort['importReference']>(
      async () => ({
        songId: 'score-import',
        title: 'One String Study',
        trackCount: 1,
        importedAt: Date.UTC(2026, 7, 12),
      }),
    )
    const referencePort: GuitarNightReferencePort = {
      listReferences: () => [],
      openReference: () => ({ ok: false, code: 'not-found' }),
      suggestInstrument: () => null,
      readSource: () => null,
      rememberTrack: vi.fn(),
      importReference,
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(libraryPort(0))}
        loadPreparationPort={() => Promise.resolve({ prepare })}
        loadReferencePort={() => Promise.resolve(referencePort)}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))

    chooseAudio(new File(['MThd'], 'one-string.mid', { type: 'audio/midi' }))

    await waitFor(() => expect(importReference).toHaveBeenCalledTimes(1))
    expect(importReference.mock.calls[0][0].name).toBe('one-string.mid')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('keeps score import available while audio preparation is running', async () => {
    const preparation = deferred<GuitarNightPreparationResult>()
    const prepare = vi.fn<GuitarNightPreparationPort['prepare']>(
      () => preparation.promise,
    )
    const importReference = vi.fn<GuitarNightReferencePort['importReference']>(
      async () => ({
        songId: 'score-import',
        title: 'One String Study',
        trackCount: 1,
        importedAt: Date.UTC(2026, 7, 12),
      }),
    )
    const referencePort: GuitarNightReferencePort = {
      listReferences: () => [],
      openReference: () => ({ ok: false, code: 'not-found' }),
      suggestInstrument: () => null,
      readSource: () => null,
      rememberTrack: vi.fn(),
      importReference,
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(libraryPort(0))}
        loadPreparationPort={() => Promise.resolve({ prepare })}
        loadReferencePort={() => Promise.resolve(referencePort)}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    chooseAudio(new File(['RIFFdata'], 'slow-room.wav', { type: 'audio/wav' }))
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))

    const picker = screen.getByTestId(
      'guitar-night-file-input',
    ) as HTMLInputElement
    expect(picker).not.toBeDisabled()
    chooseAudio(new File(['MThd'], 'while-waiting.mid', { type: 'audio/midi' }))

    await waitFor(() => expect(importReference).toHaveBeenCalledTimes(1))
    expect(prepare).toHaveBeenCalledTimes(1)

    preparation.resolve({ status: 'cancelled' })
  })

  it('cancels preparation and ignores a late completion', async () => {
    const preparation = deferred<GuitarNightPreparationResult>()
    let preparationSignal: AbortSignal | null = null
    const prepare = vi.fn<GuitarNightPreparationPort['prepare']>(
      (_file, options) => {
        preparationSignal = options.signal
        return preparation.promise
      },
    )
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(async () => mixedBackingResult('late-session')),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadPreparationPort={() => Promise.resolve({ prepare })}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    chooseAudio(new File(['RIFFdata'], 'cancel-me.wav', { type: 'audio/wav' }))

    await waitFor(() => expect(preparationSignal).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' }))

    expect((preparationSignal as AbortSignal | null)?.aborted).toBe(true)
    expect(screen.getByText('Preparation cancelled')).toBeInTheDocument()

    preparation.resolve({ status: 'completed', sessionId: 'late-session' })
    await Promise.resolve()
    await Promise.resolve()

    expect(songPort.openSession).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('cancels a late stem-opening handoff and releases its lease', async () => {
    const opening = deferred<GuitarNightOpenBackingResult>()
    const release = vi.fn()
    let openingSignal: AbortSignal | null = null
    const preparationPort: GuitarNightPreparationPort = {
      prepare: vi.fn<GuitarNightPreparationPort['prepare']>(async () => ({
        status: 'completed' as const,
        sessionId: 'session-opening',
      })),
    }
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn((_sessionId, signal) => {
        openingSignal = signal
        return opening.promise
      }),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadPreparationPort={() => Promise.resolve(preparationPort)}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    chooseAudio(
      new File(['RIFFdata'], 'opening-room.wav', { type: 'audio/wav' }),
    )

    await waitFor(() => expect(openingSignal).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' }))
    expect((openingSignal as AbortSignal | null)?.aborted).toBe(true)

    opening.resolve(mixedBackingResult('session-opening', release))
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Preparation cancelled')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('retries a recoverable failure with the same file', async () => {
    const prepare = vi
      .fn<GuitarNightPreparationPort['prepare']>()
      .mockResolvedValueOnce({
        status: 'error',
        message: 'The decoder could not read this song.',
      })
      .mockResolvedValueOnce({
        status: 'existing',
        sessionId: 'session-retry',
      })
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(async () => mixedBackingResult('session-retry')),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadPreparationPort={() => Promise.resolve({ prepare })}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    const file = new File(['RIFFdata'], 'retry-room.wav', {
      type: 'audio/wav',
    })
    chooseAudio(file)

    expect(
      await screen.findByText('The decoder could not read this song.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(songPort.openSession).toHaveBeenCalledWith(
        'session-retry',
        expect.any(AbortSignal),
      ),
    )
    expect(prepare.mock.calls[0][0]).toBe(file)
    expect(prepare.mock.calls[1][0]).toBe(file)
  })

  it('rejects invalid audio without releasing the staged song', async () => {
    const release = vi.fn()
    const prepare = vi.fn<GuitarNightPreparationPort['prepare']>()
    const songPort: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-ready',
          title: 'Ready Song.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(async () =>
        mixedBackingResult('session-ready', release),
      ),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadPreparationPort={() => Promise.resolve({ prepare })}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Song\.wav/ }),
    )
    await waitFor(() =>
      expect(window.location.search).toBe('?session=session-ready'),
    )

    chooseAudio(new File(['notes'], 'chords.txt', { type: 'text/plain' }))

    expect(
      await screen.findByText('Choose MP3, WAV, FLAC, MIDI, or Guitar Pro.'),
    ).toBeInTheDocument()
    expect(prepare).not.toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?session=session-ready')
  })

  it('opens on the newest five prepared songs and reveals the rest on request', async () => {
    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(12))} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    expect(
      await screen.findByText('5 of 12 on this device'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Song 01\.wav/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Song 06\.wav/ }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show 7 more' }))

    expect(await screen.findByText('12 on this device')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Song 12\.wav/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Show \d+ more/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps the routed song reachable when it sits below the first page', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-11')

    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(12))} />
    ))

    expect(
      await screen.findByRole('button', { name: /Song 11\.wav/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Song 06\.wav/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('6 of 12 on this device')).toBeInTheDocument()
  })

  it('opens the tab library when a prepared song is restored from the URL', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-01')
    const referencePort: GuitarNightReferencePort = {
      listReferences: () => [
        {
          songId: 'saved-score',
          title: 'Saved Score',
          trackCount: 1,
          importedAt: Date.UTC(2026, 7, 6),
        },
      ],
      openReference: () => ({ ok: false, code: 'not-found' }),
      suggestInstrument: () => null,
      readSource: () => null,
      rememberTrack: vi.fn(),
      importReference: vi.fn(async () => {
        throw new Error('Not used in this test')
      }),
    }
    const loadReferencePort = vi.fn(async () => referencePort)

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(libraryPort(1))}
        loadReferencePort={loadReferencePort}
      />
    ))

    expect(
      await screen.findByRole('button', { name: /Saved Score/ }),
    ).toBeInTheDocument()
    expect(loadReferencePort).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText('Opening your score library…'),
    ).not.toBeInTheDocument()
  })

  it('counts only the rows a press actually reveals, not the raw page step', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-13')

    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(20))} />
    ))

    // Song 13 is pinned above the fold already, so the next page adds nine
    // unseen rows rather than the full ten-song step.
    expect(
      await screen.findByText('6 of 20 on this device'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 9 more' }))

    expect(
      await screen.findByText('15 of 20 on this device'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Show 5 more' }),
    ).toBeInTheDocument()
  })

  // ── The demo song ────────────────────────────────────────────
  //
  // The room's library is this device's own separations, so a guitarist
  // who has never run one used to open it to an empty shelf and no way to
  // hear what the room does.

  it('offers the demo to a device that has separated nothing', async () => {
    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(0, 1))} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))

    // The empty shelf is still the truth about this device…
    expect(
      await screen.findByText('No prepared songs on this device yet.'),
    ).toBeInTheDocument()
    expect(screen.getByText('0 on this device')).toBeInTheDocument()
    // …and the demo is right underneath it, which is the whole point.
    expect(
      screen.getByRole('button', { name: /Demo Song 1/ }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('guitar-night-demo-kicker')).toHaveTextContent(
      'Nothing separated yet? Play along with the demo.',
    )
  })

  it('shows a demo’s own line instead of a prepared date', async () => {
    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(0, 1))} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    const row = await screen.findByRole('button', { name: /Demo Song 1/ })

    // It was never prepared here, so a prepared date would be a fiction —
    // and `createdAt: 0` would print 1970.
    expect(row).toHaveTextContent('Demo song · Josh Woodward')
    expect(row).not.toHaveTextContent('1970')
  })

  it('keeps the demo visible behind a library that has to page', async () => {
    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(libraryPort(12, 1))}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))

    // Twelve, not thirteen: the demo is not on this device and is not
    // paginated away with the songs that are.
    expect(
      await screen.findByText('5 of 12 on this device'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Song 06\.wav/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Demo Song 1/ }),
    ).toBeInTheDocument()
    // "Nothing separated yet?" would be a lie to somebody with twelve.
    expect(screen.getByTestId('guitar-night-demo-kicker')).toHaveTextContent(
      'Or play along with the demo.',
    )
  })

  it('opens the demo exactly the way a prepared song opens', async () => {
    const port = libraryPort(1, 1)
    render(() => <GuitarNightApp loadSongPort={() => Promise.resolve(port)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    const rows = await screen.findAllByRole('button', { name: /Demo Song 1/ })
    // Exactly one row: the demo belongs to the demo group, and a device
    // list that also carried it would offer the same song twice.
    expect(rows).toHaveLength(1)
    fireEvent.click(rows[0]!)

    await waitFor(() =>
      expect(port.openSession).toHaveBeenCalledWith(
        'karaoke-night-demo',
        expect.anything(),
      ),
    )
    expect(window.location.search).toBe('?session=karaoke-night-demo')
  })

  it('withholds the paid band split from the demo', async () => {
    const backingTransport = fakeBackingTransport()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'karaoke-night-demo',
          title: 'Demo Song 1',
          createdAt: 0,
          source: 'demo',
          subtitle: 'Demo song · Josh Woodward',
        },
      ],
      openSession: vi.fn(async () => demoBackingResult('karaoke-night-demo')),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(port)}
        createBackingTransport={() => backingTransport.transport}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(await screen.findByRole('button', { name: /Demo Song 1/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enter room' }))

    // The mix is two-stem, which is exactly what normally offers the
    // upgrade — but "Separate guitar" reconnects to a durable separation
    // record the demo has never had, and then names a price in credits.
    expect(screen.queryByRole('button', { name: /Separate guitar/ })).toBeNull()
  })

  it('still offers the band split for a two-stem song of the visitor’s own', async () => {
    const backingTransport = fakeBackingTransport()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [
        {
          sessionId: 'session-mixed',
          title: 'Mine.wav',
          createdAt: Date.UTC(2026, 7, 6),
        },
      ],
      openSession: vi.fn(async () => mixedBackingResult('session-mixed')),
    }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(port)}
        createBackingTransport={() => backingTransport.transport}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    fireEvent.click(await screen.findByRole('button', { name: /Mine\.wav/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enter room' }))

    expect(
      screen.getByRole('button', { name: /Separate guitar/ }),
    ).toBeInTheDocument()
  })

  it('says nothing about a demo when the app is offering none', async () => {
    render(() => (
      <GuitarNightApp loadSongPort={() => Promise.resolve(libraryPort(2))} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    expect(await screen.findByText('2 on this device')).toBeInTheDocument()
    expect(screen.queryByTestId('guitar-night-demo-kicker')).toBeNull()
  })

  it('announces asynchronous library loading and failure', async () => {
    const pendingPort = deferred<GuitarNightSongPort>()
    const view = render(() => (
      <GuitarNightApp loadSongPort={() => pendingPort.promise} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
    const library = screen.getByRole('region', { name: 'Prepared songs' })
    expect(library).toHaveAttribute('aria-busy', 'true')
    expect(within(library).getByRole('status')).toHaveTextContent(
      'Opening your local library',
    )

    view.unmount()
    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.reject(new Error('device storage failed'))}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your local library could not be opened',
    )
  })
})
