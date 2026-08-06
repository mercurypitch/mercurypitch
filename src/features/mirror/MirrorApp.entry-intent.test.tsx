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

  it('keeps the general Voice Mirror entry unchanged', () => {
    render(() => (
      <MirrorLanding
        entryIntent="voice-mirror"
        onStart={vi.fn()}
        onHowItWorks={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'See your voice. 60 seconds.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /just sing/i }),
    ).toBeInTheDocument()
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
