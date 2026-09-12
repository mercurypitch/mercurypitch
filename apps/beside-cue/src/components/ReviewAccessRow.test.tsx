// ============================================================
// Review access row — a reviewer can follow the written instructions
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { ReviewAccessRow } from './ReviewAccessRow'

describe('Review access row', () => {
  it('sends the typed code and says nothing was bought', async () => {
    const onRedeem = vi.fn(() => Promise.resolve())
    render(() => (
      <ReviewAccessRow
        name="Beside Cue Deluxe"
        active={false}
        state="idle"
        onRedeem={onRedeem}
        onRevoke={() => {}}
      />
    ))
    expect(
      screen.getByText(
        'For app review. The code opens Beside Cue Deluxe on this device. Nothing is bought and nothing is charged.',
      ),
    ).toBeVisible()
    const unlock = screen.getByRole('button', { name: 'Turn on review access' })
    expect(unlock).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Review access code'), {
      target: { value: 'review-7k4m-93xq' },
    })
    fireEvent.click(unlock)
    await waitFor(() =>
      expect(onRedeem).toHaveBeenCalledWith('review-7k4m-93xq'),
    )
  })

  it('reports a code that does not match', () => {
    render(() => (
      <ReviewAccessRow
        name="Beside Cue Deluxe"
        active={false}
        state="rejected"
        onRedeem={() => {}}
        onRevoke={() => {}}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That code does not match. Check it and try again.',
    )
  })

  it('says so when the build cannot check codes at all', () => {
    render(() => (
      <ReviewAccessRow
        name="Beside Cue Deluxe"
        active={false}
        state="unavailable"
        onRedeem={() => {}}
        onRevoke={() => {}}
      />
    ))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This build cannot check review codes.',
    )
  })

  it('offers the way back out once access is on', () => {
    const onRevoke = vi.fn()
    render(() => (
      <ReviewAccessRow
        name="Beside Cue Deluxe"
        active={true}
        state="unlocked"
        onRedeem={() => {}}
        onRevoke={onRevoke}
      />
    ))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Review access is on. Beside Cue Deluxe is open on this device and nothing was bought.',
    )
    expect(
      screen.queryByLabelText('Review access code'),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Turn off review access' }),
    )
    expect(onRevoke).toHaveBeenCalledOnce()
  })
})
