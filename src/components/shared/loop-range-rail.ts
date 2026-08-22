// Loop-range rail geometry keeps nullable A/B marks exact across full-song and focused views.
// ============================================================

export interface LoopRangeDomain {
  start: number
  end: number
}

export interface LoopRangeSpan {
  start: number
  end: number
}

export const LOOP_RANGE_FOCUS_THRESHOLD_PX = 88
export const LOOP_RANGE_FOCUS_TARGET_PX = 112

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export function normalizeLoopRangeDomain(
  domain: LoopRangeDomain,
): LoopRangeDomain {
  const start = Number.isFinite(domain.start) ? domain.start : 0
  const requestedEnd = Number.isFinite(domain.end) ? domain.end : start
  return { start, end: Math.max(start, requestedEnd) }
}

export function normalizeLoopRangeSpan(
  start: number | null,
  end: number | null,
  domain: LoopRangeDomain,
): LoopRangeSpan | null {
  if (start === null || end === null) return null
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const safeDomain = normalizeLoopRangeDomain(domain)
  const first = clamp(Math.min(start, end), safeDomain.start, safeDomain.end)
  const last = clamp(Math.max(start, end), safeDomain.start, safeDomain.end)
  return last > first ? { start: first, end: last } : null
}

export function loopRangePercent(
  value: number,
  viewport: LoopRangeDomain,
): number {
  const safeViewport = normalizeLoopRangeDomain(viewport)
  const length = safeViewport.end - safeViewport.start
  if (!(length > 0) || !Number.isFinite(value)) return 0
  return (
    ((clamp(value, safeViewport.start, safeViewport.end) - safeViewport.start) /
      length) *
    100
  )
}

export function loopRangeValueAtRatio(
  ratio: number,
  viewport: LoopRangeDomain,
): number {
  const safeViewport = normalizeLoopRangeDomain(viewport)
  const safeRatio = clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1)
  return (
    safeViewport.start + safeRatio * (safeViewport.end - safeViewport.start)
  )
}

export function loopRangeNeedsFocus(
  domain: LoopRangeDomain,
  span: LoopRangeSpan | null,
  railWidth: number,
): boolean {
  if (span === null || !(railWidth > 0)) return false
  const safeDomain = normalizeLoopRangeDomain(domain)
  const domainLength = safeDomain.end - safeDomain.start
  if (!(domainLength > 0)) return false
  const spanPixels = ((span.end - span.start) / domainLength) * railWidth
  return spanPixels < LOOP_RANGE_FOCUS_THRESHOLD_PX
}

/**
 * Give close A/B handles deliberate room without changing the musical range.
 * The focused viewport is entered only from an explicit action; completing B
 * never changes the seek map under the player's pointer.
 */
export function focusedLoopRangeViewport(
  domain: LoopRangeDomain,
  span: LoopRangeSpan | null,
  railWidth: number,
): LoopRangeDomain {
  const safeDomain = normalizeLoopRangeDomain(domain)
  if (span === null || !(railWidth > 0)) return safeDomain

  const domainLength = safeDomain.end - safeDomain.start
  const spanLength = span.end - span.start
  if (!(domainLength > 0) || !(spanLength > 0)) return safeDomain

  const targetFraction = clamp(
    LOOP_RANGE_FOCUS_TARGET_PX / railWidth,
    0.34,
    0.62,
  )
  const viewportLength = Math.min(domainLength, spanLength / targetFraction)
  if (!(viewportLength < domainLength)) return safeDomain

  const middle = (span.start + span.end) / 2
  let start = middle - viewportLength / 2
  let end = middle + viewportLength / 2
  if (start < safeDomain.start) {
    end += safeDomain.start - start
    start = safeDomain.start
  }
  if (end > safeDomain.end) {
    start -= end - safeDomain.end
    end = safeDomain.end
  }
  return {
    start: Math.max(safeDomain.start, start),
    end: Math.min(safeDomain.end, end),
  }
}
