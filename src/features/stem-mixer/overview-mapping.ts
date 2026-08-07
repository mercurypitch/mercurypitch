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
export function timeToX(t: number, win: OverviewWindow, width: number): number {
  return ((t - win.start) / Math.max(1e-9, win.duration)) * width
}

/** x -> time. The inverse of {@link timeToX}, for hit-testing a pointer. */
export function xToTime(x: number, win: OverviewWindow, width: number): number {
  if (!(width > 0)) return win.start
  return win.start + (x / width) * win.duration
}

/** A mapped word start, as the overview needs to know it. */
export interface WordMarker {
  time: number
  lineIdx: number
  wordIdx: number
  /** Word 0 of a line — drawn taller, and kept when ticks are thinned. */
  isLineStart: boolean
}

/**
 * The marker nearest `x`, or null when nothing is close enough.
 *
 * Ties go to the earlier marker so a click between two words picks the one
 * that has already started, which is the one being sung.
 */
export function nearestMarker(
  markers: readonly WordMarker[],
  x: number,
  win: OverviewWindow,
  width: number,
  tolerancePx = 8,
): WordMarker | null {
  let best: WordMarker | null = null
  let bestDistance = Infinity
  for (const marker of markers) {
    const distance = Math.abs(timeToX(marker.time, win, width) - x)
    if (distance > tolerancePx || distance >= bestDistance) continue
    best = marker
    bestDistance = distance
  }
  return best
}

/**
 * Markers inside the window, thinned so ticks never overplot.
 *
 * Zoomed out, a three-minute song puts ~400 words across ~1200 px — roughly a
 * tick every 3 px, which reads as a picket fence rather than as structure.
 * Thinning drops inner words that land within `minGapPx` of the last tick
 * kept, and **never drops a line start**: the shape of the song survives at
 * any zoom, and the words fill in as you zoom into them.
 *
 * Assumes `markers` is sorted by time, which is how the mapper stores them.
 */
export function visibleMarkers(
  markers: readonly WordMarker[],
  win: OverviewWindow,
  width: number,
  minGapPx = 4,
): WordMarker[] {
  const visible: WordMarker[] = []
  let lastX = -Infinity
  for (const marker of markers) {
    const x = timeToX(marker.time, win, width)
    // A tick just off-screen still owns its pixel gap, or the first visible
    // inner word would jump in and out as the window scrolls past it.
    if (x < -minGapPx || x > width + minGapPx) continue
    if (!marker.isLineStart && x - lastX < minGapPx) continue
    visible.push(marker)
    lastX = x
  }
  return visible
}

/** Flatten the mapper's per-line word times into sorted markers. */
export function wordMarkersFrom(
  wordTimings: Readonly<Record<number, readonly number[]>>,
): WordMarker[] {
  const markers: WordMarker[] = []
  for (const key of Object.keys(wordTimings)) {
    const lineIdx = Number(key)
    const times = wordTimings[lineIdx]
    for (let wordIdx = 0; wordIdx < times.length; wordIdx++) {
      const time = times[wordIdx]
      if (typeof time !== 'number' || !Number.isFinite(time)) continue
      markers.push({ time, lineIdx, wordIdx, isLineStart: wordIdx === 0 })
    }
  }
  return markers.sort((a, b) => a.time - b.time)
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
