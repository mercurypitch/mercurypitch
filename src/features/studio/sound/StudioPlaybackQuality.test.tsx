// Studio playback quality control tests — the device's choice, and the tier Auto picks for the open song.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { livePlaybackProfile, notePlayout, readStoredChoice, resetPlaybackQualityForTests, TIER_PROFILES, } from '@/lib/studio/playback/playback-quality'
import { MEDIUM_SONG, roleSong, SMALL_SONG, THIS_DESKTOP_US, } from '@/lib/studio/playback/song.test-fixtures'
import { StudioPlaybackQuality } from './StudioPlaybackQuality'

const small = roleSong(SMALL_SONG)
const auto = () => screen.getByRole('radio', { name: /^Auto/ })

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({
    cores: 24,
    memoryGb: 8,
    voiceChainUs: THIS_DESKTOP_US,
  })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Studio playback quality control', () => {
  it('names the tier Auto plays this song at, and keeps a chosen tier on this device', async () => {
    render(() => <StudioPlaybackQuality song={small} />)
    expect(auto()).toBeChecked()
    expect(auto().closest('label')).toHaveTextContent('Auto (Best)')
    expect(screen.getByText(/Export always uses Best/)).toBeVisible()
    await fireEvent.click(screen.getByRole('radio', { name: /^Light/ }))
    expect(screen.getByRole('radio', { name: /^Light/ })).toBeChecked()
    expect(readStoredChoice()).toBe('light')
    expect(livePlaybackProfile(small)).toBe(TIER_PROFILES.light)
    // Auto, not chosen, still says what it would play.
    expect(auto().closest('label')).toHaveTextContent('Auto (Best)')
    await fireEvent.click(auto())
    expect(readStoredChoice()).toBe('auto')
    expect(livePlaybackProfile(small)).toBe(TIER_PROFILES.best)
  })

  it('follows the song: muting half its lanes moves Auto up', () => {
    const [song, setSong] = createSignal(roleSong(MEDIUM_SONG))
    render(() => <StudioPlaybackQuality song={song()} />)
    expect(auto().closest('label')).toHaveTextContent('Auto (Light)')
    setSong(roleSong(MEDIUM_SONG, [0, 2, 4, 6, 8, 10]))
    expect(auto().closest('label')).toHaveTextContent('Auto (Best)')
  })

  it('names the tier Auto stepped down to for underruns', () => {
    render(() => <StudioPlaybackQuality song={small} />)
    let events = 0
    const ctx = {
      get playoutStats() {
        return { fallbackFramesEvents: events }
      },
    } as unknown as BaseAudioContext
    notePlayout(ctx, 0, 'best')
    notePlayout(ctx, 2500, 'best')
    events = 3
    notePlayout(ctx, 3000, 'best')
    expect(auto().closest('label')).toHaveTextContent('Auto (Balanced)')
    // The notice itself is the workspace's (StudioPlaybackNotice).
    expect(screen.queryByRole('status')).toBeNull()
  })
})
