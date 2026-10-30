// Studio playback notice tests — Auto's step down is said where Studio says things, whichever panel is open.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioPlaybackTier } from '@/lib/studio/playback/playback-quality'
import { notePlayout, resetPlaybackQualityForTests, } from '@/lib/studio/playback/playback-quality'
import { StudioPlaybackNotice } from './StudioPlaybackNotice'

/** Three underruns in a row from `at` ms, after Auto's first two seconds at `tier`. */
function breakUp(tier: StudioPlaybackTier, at = 0): void {
  let events = 0
  const ctx = {
    get playoutStats() {
      return { fallbackFramesEvents: events }
    },
  } as unknown as BaseAudioContext
  notePlayout(ctx, at, tier)
  notePlayout(ctx, at + 2500, tier)
  events = 3
  notePlayout(ctx, at + 3000, tier)
}

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({ cores: 16, memoryGb: 8, voiceChainUs: 40 })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Studio playback notice', () => {
  it('says nothing until Auto steps down, then says so and opens the setting', async () => {
    const onShow = vi.fn()
    render(() => <StudioPlaybackNotice onShow={onShow} />)
    expect(screen.queryByRole('status')).toBeNull()
    breakUp('best')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Playback was breaking up, so Studio moved to Balanced for this session. It applies from the next Play.',
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Playback quality' }),
    )
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('goes when dismissed, and comes back for the next step down', async () => {
    render(() => <StudioPlaybackNotice onShow={() => {}} />)
    breakUp('best')
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
    // The next run, built at Balanced, breaks up too.
    breakUp('balanced', 10_000)
    expect(screen.getByRole('status')).toHaveTextContent('moved to Light')
  })
})
