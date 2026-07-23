import { describe, expect, it } from 'vitest'
import { findLyricsRow } from '@/lib/lyrics-row'
import { getPitchWindowResumeState } from '@/lib/pitch-window'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'

describe('stem mixer playback helpers', () => {
  it('offers one shared complete speed range to transport and mapper', () => {
    expect([...STEM_MIXER_PLAYBACK_SPEEDS]).toEqual([
      0.5, 0.75, 0.85, 1, 1.2, 1.5, 1.75, 2,
    ])
    expect(formatPlaybackSpeed(1)).toBe('1x natural')
    expect(formatPlaybackSpeed(0.85)).toBe('0.85x')
  })

  it('snaps a pitch window to the current time after mapping', () => {
    expect(getPitchWindowResumeState(75, 30, 0.3)).toEqual({
      anchor: 0.3,
      windowStart: 66,
    })
    expect(getPitchWindowResumeState(2, 30, 0.3)).toEqual({
      anchor: 0.3,
      windowStart: 0,
    })
  })

  it('finds the canonical line after a rest row', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <span class="sm-lyrics-line" data-lyrics-index="0">First</span>
      <div class="sm-lyrics-rest" data-lyrics-index="1">Rest</div>
      <span class="sm-lyrics-line" data-lyrics-index="2">Second</span>
      <div data-lyrics-index="3" data-lyrics-end-index="5">Repeated block</div>
    `

    expect(findLyricsRow(container, 1)?.textContent).toBe('Rest')
    expect(findLyricsRow(container, 2)?.textContent).toBe('Second')
    expect(findLyricsRow(container, 4)?.textContent).toBe('Repeated block')
    expect(findLyricsRow(container, -1)).toBeNull()
  })
})
