// ============================================================
// StemMixerScoreModal tests — explicit karaoke voice-history keep states
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StemMixerScoreModal } from '../StemMixerScoreModal'

afterEach(cleanup)

const score = () => ({
  totalNotes: 100,
  matchedNotes: 40,
  accuracyPct: 40,
  avgCentsOff: 62,
  grade: 'D' as const,
})

describe('StemMixerScoreModal voice keep action', () => {
  it('disables keep while the private replay is still processing', () => {
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={score}
        voiceTakeState="processing"
        voiceTakeMessage="Private replay status"
        onKeepVoiceTake={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Preparing replay' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Preparing replay' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Private replay status')).toBeInTheDocument()
  })

  it('keeps the disabled keep action in place while saving', () => {
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={score}
        voiceTakeState="saving"
        voiceTakeMessage="Saving locally"
        onKeepVoiceTake={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    const keep = screen.getByRole('button', { name: 'Keeping take' })
    expect(keep).toBeDisabled()
    expect(keep).toHaveAttribute('aria-busy', 'true')
  })

  it('requires an explicit keep after the replay is ready', async () => {
    const onKeep = vi.fn()
    const onClose = vi.fn()
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={score}
        voiceTakeState="ready"
        voiceTakeMessage="Replay ready"
        onKeepVoiceTake={onKeep}
        onClose={onClose}
      />
    ))

    await fireEvent.click(
      screen.getByRole('button', { name: 'Keep in Hear Yourself' }),
    )
    expect(onKeep).toHaveBeenCalledOnce()

    await fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
