// ============================================================
// Punched time dial readiness — viewport, clipping, and scroll arbitration
// ============================================================
//
// A record may sit inside the page scroller or onboarding's nested stage.
// Pointer turns are eligible only after every clipping boundary exposes most
// of the record and the active scroller has been quiet for a short beat.

export interface TimeDialPointerReadiness {
  readonly isReady: () => boolean
  readonly revision: () => number
  readonly dispose: () => void
}

export interface TimeDialPointerReadinessOptions {
  readonly minimumVisibleRatio?: number
  readonly scrollSettleMs?: number
  readonly now?: () => number
}

const DEFAULT_MINIMUM_VISIBLE_RATIO = 0.8
const DEFAULT_SCROLL_SETTLE_MS = 180

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function overflowClips(value: string): boolean {
  return /^(?:auto|clip|hidden|scroll)$/u.test(value)
}

export function visibleElementRatio(element: HTMLElement): number {
  const bounds = element.getBoundingClientRect()
  const totalArea = bounds.width * bounds.height
  if (totalArea <= 0) return 0

  const visualViewport = window.visualViewport
  const hasVisualViewport =
    visualViewport !== null && visualViewport !== undefined
  const viewportLeft = visualViewport?.offsetLeft ?? 0
  const viewportTop = visualViewport?.offsetTop ?? 0
  const viewportWidth =
    hasVisualViewport && visualViewport.width > 0
      ? visualViewport.width
      : window.innerWidth
  const viewportHeight =
    hasVisualViewport && visualViewport.height > 0
      ? visualViewport.height
      : window.innerHeight
  let visibleLeft = Math.max(bounds.left, viewportLeft)
  let visibleTop = Math.max(bounds.top, viewportTop)
  let visibleRight = Math.min(bounds.right, viewportLeft + viewportWidth)
  let visibleBottom = Math.min(bounds.bottom, viewportTop + viewportHeight)

  let ancestor = element.parentElement
  while (ancestor !== null) {
    const style = window.getComputedStyle(ancestor)
    const ancestorBounds = ancestor.getBoundingClientRect()
    const overflowX = style.overflowX || style.overflow
    const overflowY = style.overflowY || style.overflow
    if (overflowClips(overflowX) && ancestorBounds.width > 0) {
      visibleLeft = Math.max(visibleLeft, ancestorBounds.left)
      visibleRight = Math.min(visibleRight, ancestorBounds.right)
    }
    if (overflowClips(overflowY) && ancestorBounds.height > 0) {
      visibleTop = Math.max(visibleTop, ancestorBounds.top)
      visibleBottom = Math.min(visibleBottom, ancestorBounds.bottom)
    }
    ancestor = ancestor.parentElement
  }

  const visibleWidth = Math.max(0, visibleRight - visibleLeft)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  return clamp((visibleWidth * visibleHeight) / totalArea, 0, 1)
}

export function createTimeDialPointerReadiness(
  element: HTMLElement,
  options: TimeDialPointerReadinessOptions = {},
): TimeDialPointerReadiness {
  const minimumVisibleRatio =
    options.minimumVisibleRatio ?? DEFAULT_MINIMUM_VISIBLE_RATIO
  const scrollSettleMs = options.scrollSettleMs ?? DEFAULT_SCROLL_SETTLE_MS
  const now = options.now ?? (() => performance.now())
  let lastScrollAt = Number.NEGATIVE_INFINITY
  let scrollRevision = 0

  const noteViewportMovement = (): void => {
    scrollRevision += 1
    lastScrollAt = now()
  }
  window.addEventListener('scroll', noteViewportMovement, {
    capture: true,
    passive: true,
  })
  window.visualViewport?.addEventListener('scroll', noteViewportMovement, {
    passive: true,
  })
  window.visualViewport?.addEventListener('resize', noteViewportMovement, {
    passive: true,
  })

  return {
    isReady: () =>
      now() - lastScrollAt >= scrollSettleMs &&
      visibleElementRatio(element) >= minimumVisibleRatio,
    revision: () => scrollRevision,
    dispose: () => {
      window.removeEventListener('scroll', noteViewportMovement, true)
      window.visualViewport?.removeEventListener('scroll', noteViewportMovement)
      window.visualViewport?.removeEventListener('resize', noteViewportMovement)
    },
  }
}
