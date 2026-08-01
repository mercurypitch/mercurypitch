// ============================================================
// Overview mapping — the zoom in/out desync regression net
// ============================================================
// The owner-reported bug: zoomed out, the playhead no longer sat where
// the waveform showed the audio (an over-long window was clamped for
// the waveform but not for the playhead). These tests pin the two
// invariants that make that impossible: the window can never overhang
// the song, and a sample's time and its drawn column agree at every
// zoom level.

import { describe, expect, it } from 'vitest'
import { clampOverviewWindow, columnSampleRange, timeToX, } from '@/features/stem-mixer/overview-mapping'

const SONG = 1080 // the 18-minute song that surfaced it
const SR = 44100
const SAMPLES = SONG * SR
const WIDTH = 1000

describe('clampOverviewWindow', () => {
  it('zooming out near the end pulls the window back instead of overhanging', () => {
    const win = clampOverviewWindow(1000, 150, SONG)
    expect(win.start + win.duration).toBeLessThanOrEqual(SONG)
    expect(win.duration).toBe(150)
    expect(win.start).toBe(SONG - 150)
  })

  it('duration caps at the song length (no 150s ceiling)', () => {
    const win = clampOverviewWindow(0, 99999, SONG)
    expect(win.duration).toBe(SONG)
    expect(win.start).toBe(0)
  })

  it('enforces the minimum window on deep zoom-in', () => {
    const win = clampOverviewWindow(500, 0.5, SONG)
    expect(win.duration).toBe(4)
  })

  it('short songs bound the minimum too', () => {
    const win = clampOverviewWindow(0, 0.5, 2)
    expect(win.duration).toBe(2)
  })
})

describe('time/column agreement (the desync invariant)', () => {
  const zoomLevels: Array<[number, number]> = [
    [0, SONG], // fully zoomed out
    [SONG - 150, 150], // zoomed near the end
    [500, 30], // typical zoom-in
    [SONG - 8, 4], // deepest zoom at the very end
  ]

  for (const [start, duration] of zoomLevels) {
    it(`x(t) and the drawing column agree at window ${start}s+${duration}s`, () => {
      const win = { start, duration }
      for (const frac of [0, 0.25, 0.5, 0.75, 0.999]) {
        const t = start + frac * duration
        const x = Math.floor(timeToX(t, win, WIDTH))
        const range = columnSampleRange(x, WIDTH, win, SONG, SAMPLES)
        expect(range).not.toBeNull()
        const colT0 = (range!.sStart / SAMPLES) * SONG
        const colT1 = (range!.sEnd / SAMPLES) * SONG
        // The sample slice drawn at the playhead's column contains the
        // playhead's time (within one column's width of slack).
        const colWidthSec = duration / WIDTH
        expect(t).toBeGreaterThanOrEqual(colT0 - colWidthSec)
        expect(t).toBeLessThanOrEqual(colT1 + colWidthSec)
      }
    })
  }

  it('an overhanging window draws silence past the end instead of stretching', () => {
    // The pre-fix failure mode: window [1000, 1150] on a 1080s song —
    // the waveform used to squeeze the last 80s across the full width.
    const win = { start: 1000, duration: 150 }
    const xAtSongEnd = Math.floor(timeToX(SONG, win, WIDTH))
    // Columns past the song end draw nothing.
    expect(columnSampleRange(xAtSongEnd + 2, WIDTH, win, SONG, SAMPLES)).toBe(
      null,
    )
    // The column just inside the end still maps to end-of-song samples,
    // not to a stretched mid-song slice.
    const inside = columnSampleRange(xAtSongEnd - 1, WIDTH, win, SONG, SAMPLES)
    expect(inside).not.toBeNull()
    expect((inside!.sEnd / SAMPLES) * SONG).toBeGreaterThan(SONG - 1)
  })

  it('a shorter stem buffer maps through its own duration, not the transport', () => {
    // Stem decodes can be a hair shorter than the transport duration.
    const bufferDur = SONG - 2
    const bufferSamples = bufferDur * SR
    const win = { start: 0, duration: SONG }
    const x = Math.floor(timeToX(bufferDur - 0.5, win, WIDTH))
    const range = columnSampleRange(x, WIDTH, win, bufferDur, bufferSamples)
    expect(range).not.toBeNull()
    // Near its own end, the buffer's LAST samples are drawn there.
    expect(range!.sEnd).toBeGreaterThan(bufferSamples * 0.999)
  })
})
