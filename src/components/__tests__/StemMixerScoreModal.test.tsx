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
    expect(
      screen.getByRole('button', { name: 'Preparing replay' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Private replay status')).toBeInTheDocument()
  })

  it('keeps the disabled keep action in place while saving', () => {
    const onClose = vi.fn()
    render(() => (
      <StemMixerScoreModal
        showScore={() => true}
        score={() => VOICE_SCORE}
        voiceTakeState="saving"
        voiceTakeMessage="Saving locally"
        onKeepVoiceTake={vi.fn()}
        onClose={onClose}
      />
    ))

    const keep = screen.getByRole('button', { name: 'Keeping take' })
    expect(keep).toBeDisabled()
    expect(keep).toHaveAttribute('aria-busy', 'true')

    const dialog = screen.getByRole('dialog', { name: 'Karaoke score' })
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Close score' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()

    fireEvent.click(dialog.parentElement!)
    fireEvent.keyDown(dialog, { key: 'Escape', bubbles: true })
    expect(onClose).not.toHaveBeenCalled()
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

describe('StemMixerScoreModal keyboard ownership', () => {
  it('traps focus, closes on Escape, and restores the opener', async () => {
    const [showScore, setShowScore] = createSignal(false)
    const onClose = vi.fn(() => setShowScore(false))

    render(() => (
      <>
        <button type="button" onClick={() => setShowScore(true)}>
          Show score
        </button>
        <StemMixerScoreModal
          showScore={showScore}
          score={() => VOICE_SCORE}
          voiceTakeState="ready"
          voiceTakeMessage="Replay ready"
          onKeepVoiceTake={vi.fn()}
          onClose={onClose}
        />
      </>
    ))

    const opener = screen.getByRole('button', { name: 'Show score' })
    opener.focus()
    await fireEvent.click(opener)

    const dialog = await screen.findByRole('dialog', {
      name: 'Karaoke score',
    })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const close = screen.getByRole('button', { name: 'Close score' })
    const notNow = screen.getByRole('button', { name: 'Not now' })
    await waitFor(() => expect(close).toHaveFocus())

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(notNow).toHaveFocus()
    fireEvent.keyDown(notNow, { key: 'Tab' })
    expect(close).toHaveFocus()

    const leakedToPage = vi.fn()
    document.addEventListener('keydown', leakedToPage)
    fireEvent.keyDown(close, { key: 'm', bubbles: true })
    expect(leakedToPage).not.toHaveBeenCalled()

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    close.dispatchEvent(escape)
    document.removeEventListener('keydown', leakedToPage)

    expect(escape.defaultPrevented).toBe(true)
    expect(leakedToPage).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Karaoke score' }),
      ).not.toBeInTheDocument()
      expect(opener).toHaveFocus()
    })
  })
})
