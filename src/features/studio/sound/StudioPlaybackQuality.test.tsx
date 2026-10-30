// Studio playback quality control tests — the device's choice, and the tier Auto picks or stepped down to.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { livePlaybackProfile, notePlayout, readStoredChoice, resetPlaybackQualityForTests, TIER_PROFILES, } from '@/lib/studio/playback/playback-quality'
import { StudioPlaybackQuality } from './StudioPlaybackQuality'

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({ cores: 16, memoryGb: 8, voiceChainUs: 40 })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Studio playback quality control', () => {
  it('shows what Auto uses, and keeps a chosen tier on this device', async () => {
    render(() => <StudioPlaybackQuality />)
    const auto = screen.getByRole('radio', { name: /Auto/ })
    expect(auto).toBeChecked()
    expect(auto.closest('label')).toHaveTextContent('Using Best')
    expect(screen.getByText(/Export always uses Best/)).toBeVisible()
    await fireEvent.click(screen.getByRole('radio', { name: /Light/ }))
    expect(screen.getByRole('radio', { name: /Light/ })).toBeChecked()
    expect(readStoredChoice()).toBe('light')
    expect(livePlaybackProfile()).toBe(TIER_PROFILES.light)
    // Auto, not chosen, still says what it would pick here.
    expect(auto.closest('label')).toHaveTextContent('Picks Best')
    await fireEvent.click(auto)
    expect(readStoredChoice()).toBe('auto')
    expect(livePlaybackProfile()).toBe(TIER_PROFILES.best)
  })

  it('shows the tier Auto stepped down to for underruns', () => {
    render(() => <StudioPlaybackQuality />)
    let events = 0
    const ctx = {
      get playoutStats() {
        return { fallbackFramesEvents: events }
      },
    } as unknown as BaseAudioContext
    notePlayout(ctx, 0)
    notePlayout(ctx, 2500)
    events = 3
    notePlayout(ctx, 3000)
    expect(
      screen.getByRole('radio', { name: /Auto/ }).closest('label'),
    ).toHaveTextContent('Using Balanced')
    // The notice itself is the workspace's (StudioPlaybackNotice).
    expect(screen.queryByRole('status')).toBeNull()
  })
})
