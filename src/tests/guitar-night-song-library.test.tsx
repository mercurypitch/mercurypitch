// Guitar Night song-library tests protect honest prepared-session staging in the room UI.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingSession, GuitarBackingTrackState, GuitarBackingTransport, GuitarBackingTransportStatus, } from '@/features/guitar/backing/guitar-backing-transport'
import { GuitarNightApp } from '@/features/guitar-night/GuitarNightApp'
import type { GuitarNightPreparationPort, GuitarNightPreparationResult, } from '@/features/guitar-night/preparation-port'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, } from '@/features/guitar-night/song-port'

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
    'guitar-night-song-input',
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

function fakeBackingTransport() {
  let status: GuitarBackingTransportStatus = 'idle'
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
    setMasterVolume: vi.fn(),
    setTrackMuted: vi.fn((id, muted) => {
      trackStates = trackStates.map((track) =>
        track.id === id ? { ...track, muted } : track,
      )
      emit()
    }),
    getAudioContext: () => null,
    getAudioGraph: () => null,
    getLoadMode: () => null,
    getStatus: () => status,
    getCurrentTime: () => 0,
    getDuration: () =>
      Math.max(
        0,
        ...(currentSession?.tracks.map((track) => track.durationSeconds ?? 0) ??
          []),
      ),
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
      await screen.findByRole('button', { name: /Quiet Room\.wav/ }),
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

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    expect(backingTransport.transport.pause).toHaveBeenCalledOnce()
    const resumeSong = await screen.findByRole('button', {
      name: /Quiet Room\.wav/,
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
    expect(screen.queryByRole('button', { name: /Guitar/ })).toBeNull()
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
    expect(screen.getByRole('status')).toHaveTextContent(
      'Separating vocals and accompaniment · 42%',
    )
    expect(
      screen.getByRole('progressbar', {
        name: 'Preparing practice-room.wav',
      }),
    ).toHaveAttribute('value', '42')

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
      await screen.findByText(
        'That format is not supported. Choose MP3, WAV, or FLAC audio.',
      ),
    ).toBeInTheDocument()
    expect(prepare).not.toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?session=session-ready')
  })
})
