// Journey plaque placement — fit the duplicate selected title around fixed museum controls.

export interface JourneyLabelBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export type JourneyPlaquePlacement = 'below' | 'right' | 'left' | 'hidden'

function fits(
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: JourneyLabelBounds,
  obstacles: readonly JourneyLabelBounds[],
): boolean {
  const right = left + width
  const bottom = top + height
  if (
    left < viewport.left + 8 ||
    top < viewport.top + 8 ||
    right > viewport.right - 8 ||
    bottom > viewport.bottom - 8
  )
    return false
  for (const obstacle of obstacles) {
    if (
      right + 8 > obstacle.left &&
      left - 8 < obstacle.right &&
      bottom + 8 > obstacle.top &&
      top - 8 < obstacle.bottom
    )
      return false
  }
  return true
}

export function journeyPlaquePlacement(
  button: JourneyLabelBounds,
  width: number,
  height: number,
  viewport: JourneyLabelBounds,
  obstacles: readonly JourneyLabelBounds[],
): JourneyPlaquePlacement {
  if (width <= 0 || height <= 0) return 'hidden'
  const centerX = (button.left + button.right) / 2
  const sideTop = (button.top + button.bottom - height) / 2
  if (
    fits(centerX - width / 2, button.bottom, width, height, viewport, obstacles)
  )
    return 'below'
  if (fits(button.right + 8, sideTop, width, height, viewport, obstacles))
    return 'right'
  if (
    fits(button.left - 8 - width, sideTop, width, height, viewport, obstacles)
  )
    return 'left'
  return 'hidden'
}
