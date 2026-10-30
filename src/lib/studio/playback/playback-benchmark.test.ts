// Studio playback benchmark tests — Auto's device benchmark runs once, after Studio opens, never while playing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPlaybackBenchmarkForTests, schedulePlaybackBenchmark, } from './playback-benchmark'
import { autoPlaybackTier, needsPlaybackBenchmark, readStoredBenchmark, resetPlaybackQualityForTests, } from './playback-quality'
import { roleSong, SMALL_SONG } from './song.test-fixtures'

/** A wait that holds its callbacks until `fire` runs them. */
function manualWait() {
  const pending: (() => void)[] = []
  return {
    wait: vi.fn((callback: () => void) => {
      pending.push(callback)
      return () => {
        const index = pending.indexOf(callback)
        if (index >= 0) pending.splice(index, 1)
      }
    }),
    fire: () => pending.splice(0).forEach((callback) => callback()),
    get pending() {
      return pending.length
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  resetPlaybackQualityForTests({ cores: 16, memoryGb: 8 })
  resetPlaybackBenchmarkForTests()
})
afterEach(() => localStorage.clear())

describe('the playback benchmark schedule', () => {
  it('waits while Studio plays, then measures once, keeps the result and sizes songs with it', async () => {
    const timer = manualWait()
    let playing = true
    const run = vi.fn(async () => 40)
    schedulePlaybackBenchmark({ busy: () => playing, run, wait: timer.wait })
    expect(run).not.toHaveBeenCalled()
    timer.fire()
    // Still playing: it waits again rather than competing with playback.
    expect(run).not.toHaveBeenCalled()
    expect(timer.pending).toBe(1)
    playing = false
    timer.fire()
    expect(run).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(needsPlaybackBenchmark()).toBe(false))
    expect(readStoredBenchmark()).toBe(40)
    // Auto sizes the song with it from the next Play: Best for four lanes here.
    expect(autoPlaybackTier(roleSong(SMALL_SONG))).toBe('best')
    // A second Studio open this session measures nothing more.
    const again = manualWait()
    schedulePlaybackBenchmark({ busy: () => false, run, wait: again.wait })
    expect(again.wait).not.toHaveBeenCalled()
  })

  it('does nothing where Auto already has a result, and stops when Studio closes first', () => {
    const timer = manualWait()
    const run = vi.fn(async () => 40)
    const cancel = schedulePlaybackBenchmark({
      busy: () => false,
      run,
      wait: timer.wait,
    })
    cancel()
    timer.fire()
    expect(run).not.toHaveBeenCalled()
    resetPlaybackQualityForTests({ cores: 16, memoryGb: 8, voiceChainUs: 90 })
    const stored = manualWait()
    schedulePlaybackBenchmark({ busy: () => false, run, wait: stored.wait })
    expect(stored.wait).not.toHaveBeenCalled()
  })

  it('keeps no result when the device cannot render offline', async () => {
    const timer = manualWait()
    const run = vi.fn(async () => null)
    schedulePlaybackBenchmark({ busy: () => false, run, wait: timer.wait })
    timer.fire()
    await vi.waitFor(() => expect(run).toHaveBeenCalled())
    expect(needsPlaybackBenchmark()).toBe(true)
    expect(autoPlaybackTier(roleSong(SMALL_SONG))).toBe('balanced')
  })
})
