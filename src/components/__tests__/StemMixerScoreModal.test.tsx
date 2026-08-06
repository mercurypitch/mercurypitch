// ============================================================
// StemMixerScoreModal — genuine scorecard visibility callbacks
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
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
