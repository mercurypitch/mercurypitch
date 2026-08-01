// ============================================================
// Overview mapping — ONE time<->pixel mapping for the waveform overview
// ============================================================
//
// The zoom-out desync (owner testing, 18-minute song): the waveform
// stretched its CLAMPED sample range across the full canvas width while
// the playhead mapped the UNCLAMPED time window — whenever the window
// overran the song end the two disagreed, worst near the ending. Wheel
// zoom also clamped to a hardcoded 10..150s regardless of song length
// and never re-clamped windowStart.
//
// Every consumer (waveform columns, playhead, loop markers, zoom
// setters) now goes through these pure functions, and the mapping is
// pinned by tests: x(t) is linear in the window for every zoom level,
// and a column never draws samples from outside its own time slice.

export interface OverviewWindow {
  /** Window start, seconds. */
  start: number
  /** Window length, seconds. */
  duration: number
}

/** The window may not out-zoom the song or hang past its edges. */
export function clampOverviewWindow(
  start: number,
  duration: number,
  songDuration: number,
  minDuration = 4,
): OverviewWindow {
  if (!(songDuration > 0)) {
    return { start: Math.max(0, start), duration: Math.max(1, duration) }
  }
  const dur = Math.max(
    Math.min(minDuration, songDuration),
    Math.min(songDuration, duration),
  )
  const maxStart = Math.max(0, songDuration - dur)
  return { start: Math.max(0, Math.min(maxStart, start)), duration: dur }
}

/** Time -> x. Linear in the window; callers guard visibility themselves. */
export function timeToX(
  t: number,
  win: OverviewWindow,
  width: number,
): number {
  return ((t - win.start) / Math.max(1e-9, win.duration)) * width
}

/**
 * The sample range column `x` must draw, mapped through the BUFFER's own
 * duration (stem buffers can differ slightly from the transport
 * duration; mapping through the transport skewed long tracks). Null =
 * the column's time slice lies outside the buffer — draw silence, never
 * stretch neighbours in.
 */
export function columnSampleRange(
  x: number,
  width: number,
  win: OverviewWindow,
  bufferDuration: number,
  totalSamples: number,
): { sStart: number; sEnd: number } | null {
  if (!(bufferDuration > 0) || totalSamples <= 0 || width <= 0) return null
  const t0 = win.start + (x / width) * win.duration
  const t1 = win.start + ((x + 1) / width) * win.duration
  const c0 = Math.max(0, Math.min(bufferDuration, t0))
  const c1 = Math.max(0, Math.min(bufferDuration, t1))
  if (c1 <= c0) return null
  const sStart = Math.min(
    totalSamples - 1,
    Math.floor((c0 / bufferDuration) * totalSamples),
  )
  const sEnd = Math.min(
    totalSamples,
    Math.max(sStart + 1, Math.floor((c1 / bufferDuration) * totalSamples)),
  )
  return { sStart, sEnd }
}
