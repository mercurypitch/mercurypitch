import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { VoiceConstellationSurface } from '@/features/voice-constellation/VoiceConstellationSurface'

const mocks = vi.hoisted(() => ({
  listVoiceprints: vi.fn(),
}))

vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: mocks.listVoiceprints,
}))

function voiceprint(
  id: string,
  twin: string | null,
  takenAt: string,
): VoiceprintRecord {
  return {
    id,
    twin,
    takenAt,
    source: 'mirror',
    summary: {
      lowMidi: 43,
      highMidi: 72,
      semitones: 29,
      accuracy: 82,
      steadiness: 76,
    },
  }
}

function appHost(): HTMLDivElement {
  const app = document.createElement('div')
  app.id = 'app'
  document.body.append(app)
  return app
}

beforeEach(() => {
  mocks.listVoiceprints.mockReset()
  document.body.innerHTML = ''
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('VoiceConstellationSurface', () => {
  it('uses the MercuryPitch mark as an in-app return control', async () => {
    mocks.listVoiceprints.mockResolvedValue([])
    const host = appHost()
    const onClose = vi.fn()

    render(() => <VoiceConstellationSurface onClose={onClose} />, {
      container: host,
    })

    const returnControl = await screen.findByRole('button', {
      name: 'Back to MercuryPitch',
    })
    expect(returnControl.tagName).toBe('BUTTON')
    expect(returnControl.querySelector('img')).toHaveAttribute(
      'src',
      '/favicon.svg',
    )
    expect(
      screen.getByRole('link', { name: 'Explore every portrait' }),
    ).toHaveAttribute('href', 'https://about.mercurypitch.com/voice-legends/')

    fireEvent.click(returnControl)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows all 21 positions but only loads saved current and past portraits', async () => {
    mocks.listVoiceprints.mockResolvedValue([
      voiceprint('current', 'Freddie Mercury', '2026-08-05T10:00:00.000Z'),
      voiceprint('past', 'Elvis Presley', '2026-07-01T10:00:00.000Z'),
    ])
    const host = appHost()

    render(() => <VoiceConstellationSurface onClose={vi.fn()} />, {
      container: host,
    })

    const savedMatches = await screen.findByText('saved matches')
    expect(savedMatches.parentElement).toHaveTextContent('2 saved matches')
    const cards = document.querySelectorAll('[data-legend-card]')
    expect(cards).toHaveLength(21)

    const current = document.querySelector(
      '[data-legend-card="freddie-mercury"]',
    )
    expect(current).toHaveAttribute('data-legend-state', 'current')
    expect(current?.querySelector('img')).toHaveAttribute(
      'src',
      '/legends/mid/freddie.webp',
    )
    expect(current).toHaveTextContent('Tenor')
    expect(current).toHaveTextContent('Current match')

    const past = document.querySelector('[data-legend-card="elvis-presley"]')
    expect(past).toHaveAttribute('data-legend-state', 'past')
    expect(past?.querySelector('img')).toHaveAttribute(
      'src',
      '/legends/mid/elvis.webp',
    )
    expect(past).toHaveTextContent('Past match')

    const mystery = document.querySelector('[data-legend-card="frank-sinatra"]')
    expect(mystery).toHaveAttribute('data-legend-state', 'unmatched')
    expect(mystery?.querySelector('img')).toBeNull()
    expect(mystery?.innerHTML).not.toContain('/legends/')
    expect(mystery).toHaveTextContent('Baritone')
    expect(mystery).toHaveTextContent('Mystery portrait')
    expect(screen.getByText(/Your latest measured range,/)).toHaveTextContent(
      'G2–C5',
    )
  })

  it('keeps every portrait mysterious while history is loading or unavailable', async () => {
    mocks.listVoiceprints.mockRejectedValue(new Error('offline'))
    const host = appHost()

    render(() => <VoiceConstellationSurface onClose={vi.fn()} />, {
      container: host,
    })

    await screen.findByRole('alert')
    expect(document.querySelectorAll('[data-legend-card]')).toHaveLength(21)
    expect(document.querySelectorAll('[data-legend-card] img')).toHaveLength(0)
    expect(
      document.querySelector('[data-legend-card="freddie-mercury"]'),
    ).toHaveAttribute('data-legend-state', 'error')
  })

  it('traps the route surface, closes with Escape, and restores the opener', async () => {
    mocks.listVoiceprints.mockResolvedValue([])
    const host = appHost()
    const opener = document.createElement('button')
    opener.textContent = 'Explore'
    host.append(opener)
    opener.focus()

    const Fixture = () => {
      const [open, setOpen] = createSignal(true)
      return (
        <Show when={open()}>
          <VoiceConstellationSurface onClose={() => setOpen(false)} />
        </Show>
      )
    }

    render(() => <Fixture />, { container: host })

    const close = await screen.findByRole('button', {
      name: 'Close voice constellation',
    })
    await waitFor(() => expect(close).toHaveFocus())
    fireEvent.keyDown(close, { key: 'Escape' })

    await waitFor(() => expect(opener).toHaveFocus())
    expect(
      screen.queryByRole('dialog', { name: /See where your voice has landed/ }),
    ).not.toBeInTheDocument()
  })
})
