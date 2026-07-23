export interface MarkerPathTarget {
  lineIdx: number
  wordIdx: number
  progress: number
}

export interface MarkerPathSample {
  target: MarkerPathTarget
  elapsed: number
}

const MIN_TRANSITION_SECONDS = 0.001

/**
 * Reconstruct the word boundaries crossed between two pointer samples.
 *
 * Browsers may coalesce a quick drag into a single event. Spreading those
 * boundaries across the elapsed interval gives every crossed word a real,
 * positive duration instead of stamping the whole run at one timestamp.
 */
export function buildForwardMarkerPath(
  previous: MarkerPathTarget,
  target: MarkerPathTarget,
  previousElapsed: number,
  currentElapsed: number,
): MarkerPathSample[] {
  if (
    previous.lineIdx !== target.lineIdx ||
    target.wordIdx <= previous.wordIdx
  ) {
    return [{ target, elapsed: Math.max(previousElapsed, currentElapsed) }]
  }

  const transitionCount = target.wordIdx - previous.wordIdx
  const start = Math.max(0, previousElapsed)
  const end = Math.max(
    start + transitionCount * MIN_TRANSITION_SECONDS,
    currentElapsed,
  )
  const step = (end - start) / transitionCount
  const samples: MarkerPathSample[] = [{ target: previous, elapsed: start }]

  for (let offset = 1; offset <= transitionCount; offset++) {
    const wordIdx = previous.wordIdx + offset
    samples.push({
      target: {
        lineIdx: target.lineIdx,
        wordIdx,
        progress: wordIdx === target.wordIdx ? target.progress : 1,
      },
      elapsed: start + step * offset,
    })
  }

  return samples
}
