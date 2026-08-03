// ============================================================
// StemMixerScoreModal — genuine scorecard visibility callbacks
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MicScore } from '@/lib/mic-scoring'
import { StemMixerScoreModal } from '../StemMixerScoreModal'

const GENUINE_SCORE: MicScore = {
  totalNotes: 12,
  matchedNotes: 9,
  accuracyPct: 75,
  avgCentsOff: 18,
  grade: 'B',
  notesTotal: 3,
  notesHit: 2,
}

afterEach(cleanup)

describe('StemMixerScoreModal visibility milestone', () => {
  it('reports a genuine score only when its card becomes visible', async () => {
    const [showScore, setShowScore] = createSignal(false)
    const [score] = createSignal<MicScore | null>(GENUINE_SCORE)
    const onViewed = vi.fn()

    render(() => (
      <StemMixerScoreModal
        showScore={showScore}
        score={score}
        onViewed={onViewed}
        onClose={() => undefined}
      />
    ))
    expect(onViewed).not.toHaveBeenCalled()

    setShowScore(true)
    await waitFor(() => expect(onViewed).toHaveBeenCalledWith(GENUINE_SCORE))

    setShowScore(false)
    setShowScore(true)
    await waitFor(() => expect(onViewed).toHaveBeenCalledTimes(1))
  })

  it('does not report an empty synthetic score', async () => {
    const [showScore] = createSignal(true)
    const [score] = createSignal<MicScore | null>({
      ...GENUINE_SCORE,
      totalNotes: 0,
      matchedNotes: 0,
    })
    const onViewed = vi.fn()

    render(() => (
      <StemMixerScoreModal
        showScore={showScore}
        score={score}
        onViewed={onViewed}
        onClose={() => undefined}
      />
    ))

    await Promise.resolve()
    expect(onViewed).not.toHaveBeenCalled()
  })
})

const VOICE_SCORE: MicScore = {
  totalNotes: 100,
  matchedNotes: 40,
  accuracyPct: 40,
  avgCentsOff: 62,
  grade: 'D',
}

describe('StemMixerScoreModal voice keep action', () => {
  it('disables keep while the private replay is still processing', () => {
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={() => VOICE_SCORE}
        voiceTakeState="processing"
        voiceTakeMessage="Private replay status"
        onKeepVoiceTake={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Preparing replay' }),
    ).toBeDisabled()
    expect(screen.getByText('Private replay status')).toBeInTheDocument()
  })

  it('requires an explicit keep after the replay is ready', async () => {
    const onKeep = vi.fn()
    const onClose = vi.fn()
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={() => VOICE_SCORE}
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
