// Guitar Night song-library tests protect honest prepared-session staging in the room UI.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
