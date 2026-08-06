// Guitar Night song-library tests protect honest prepared-session staging in the room UI.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightApp } from '@/features/guitar-night/GuitarNightApp'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, } from '@/features/guitar-night/song-port'

describe('GuitarNightApp prepared songs', () => {
  afterEach(() => {
    cleanup()
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

    render(() => (
      <GuitarNightApp loadSongPort={async () => Promise.resolve(port)} />
    ))

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

    render(() => (
      <GuitarNightApp loadSongPort={async () => Promise.resolve(port)} />
    ))

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
})
