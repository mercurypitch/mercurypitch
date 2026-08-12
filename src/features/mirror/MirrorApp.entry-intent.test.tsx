import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RangeResult } from '@/lib/mirror/metrics'
import { MirrorLanding, VocalRangeResultSummary } from './MirrorApp'

afterEach(cleanup)

describe('Voice Mirror search entry copy', () => {
  it('leads the vocal-range entry with the requested outcome and one guided CTA', () => {
    const onStart = vi.fn()
    render(() => (
      <MirrorLanding
        entryIntent="vocal-range"
        onStart={onStart}
        onHowItWorks={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Find your vocal range.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/lowest comfortable note/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /just sing/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Test my vocal range' }))
    expect(onStart).toHaveBeenCalledWith('guided')
  })

  // The landing offers exactly one door. "Just sing" used to sit beside the
  // guided CTA and split the decision at the moment the visitor had already
  // committed to singing — two options with nothing to choose between them.
  it('offers the general entry a single guided door, naming the payoff', () => {
    const onStart = vi.fn()
    render(() => (
      <MirrorLanding
        entryIntent="voice-mirror"
        onStart={onStart}
        onHowItWorks={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Meet your voice twin.' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /just sing/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Find my voice twin' }))
    expect(onStart).toHaveBeenCalledWith('guided')
  })

  // Free Sing is unreachable from the landing by design, so its own entry is
  // the only way in — and it must start the free take, not the guided run.
  it('starts the open take at the dedicated free-sing entry', () => {
    const onStart = vi.fn()
    render(() => (
      <MirrorLanding
        entryIntent="free-sing"
        onStart={onStart}
        onHowItWorks={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Just sing.' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /just sing/i }))
    expect(onStart).toHaveBeenCalledWith('free')
  })

  it('keeps the privacy promise reachable without spending body copy on it', () => {
    render(() => (
      <MirrorLanding
        entryIntent="voice-mirror"
        onStart={vi.fn()}
        onHowItWorks={vi.fn()}
      />
    ))

    const info = screen.getByRole('button', {
      name: /privacy: how your audio is handled/i,
    })
    expect(info).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('note')).toHaveTextContent(
      /never leaves this device/i,
    )
  })

  it('presents the measured range before qualifying the voice-type guide', () => {
    const range: RangeResult = {
      lowMidi: 48,
      highMidi: 72,
      lowNote: 'C3',
      highNote: 'C5',
      semitones: 24,
      qualifyingMidis: [],
      voiceHint: 'Tenor',
    }

    render(() => <VocalRangeResultSummary range={range} />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Your vocal range: C3–C5',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/24 semitones/i)).toHaveTextContent(
      'closest overlap: Tenor',
    )
    expect(screen.getByText(/broad guide, not a verdict/i)).toBeInTheDocument()
  })
})
