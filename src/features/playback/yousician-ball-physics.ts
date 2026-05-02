// ============================================================
// YousicianBall Physics — Ball jumps through notes with curved arcs
// ============================================================

export interface NoteBounds {
  startBeat: number
  endBeat: number
  midi: number
  duration: number
  freq: number
}

export interface BallPhysicsState {
  /** Current X position in beats */
  x: number
  /** Current Y position in row-height units */
  y: number
  /** Current vertical velocity */
  vy: number
  /** Current horizontal velocity */
  vx: number
  /** Gravity constant */
  gravity: number
  /** Bounce energy */
  bounce: number
  /** Is ball in the air */
  isJumping: boolean
  /** Last note touched */
  lastNote: NoteBounds | null
  /** Last note's endBeat where ball jumped from */
  lastEndBeat: number
}

export interface BallPhysicsOptions {
  /** Speed multiplier */
  speed: number
  /** Gravity strength */
  gravity?: number
  /** Bounciness */
  bounce?: number
  /** Size of the ball in pixels */
  radius?: number
  /** Padding from edges */
  padding?: { top: number; bottom: number; left: number; right: number }
  /** Arc height in pixels above notes */
  arcHeight?: number
  /** Time scale for animation speed */
  timeScale?: number
}

export interface BallPhysicsConfig {
  /** All note bounds */
  notes: NoteBounds[]
  /** Row height in pixels */
  rowHeight: number
  /** Ball radius in pixels */
  radius: number
  /** Padding for the ball */
  padding: { top: number; bottom: number; left: number; right: number }
  /** BPM */
  bpm: number
}

/**
 * Quadratic Bezier curve calculation
 * B(t) = (1-t)²·P0 + 2(1-t)·t·P1 + t²·P2
 */
function bezierQuadratic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const oneMinusT = 1 - t
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
  }
}

/**
 * Get horizontal speed based on BPM
 */
function getHorizontalSpeed(bpm: number, baseSpeed: number): number {
  const baseAt120 = baseSpeed
  const scale = bpm / 120
  return baseAt120 * scale
}

export function getBallPhysics(
  state: BallPhysicsState,
  config: BallPhysicsConfig,
): { x: number; y: number; note: NoteBounds | null; progress: number } {
  let { x, y, vy, vx, lastEndBeat } = state
  const { notes, rowHeight, radius, padding, bpm } = config
  let progress = 0
  const startY = y
  const gravity = state.gravity
  const bounce = state.bounce
  let note: NoteBounds | null = null

  // Get horizontal speed
  const currentVx = getHorizontalSpeed(bpm, vx)

  // Find next note's endBeat to jump to
  const nextNoteEndBeat = findNextNoteEndBeat(x, lastEndBeat, notes)

  if (nextNoteEndBeat !== null) {
    const startX = lastEndBeat
    const endX = nextNoteEndBeat
    const endY = startY

    // Calculate arc height
    const arcHeight = 120 // Pixels above the note

    // Control point for quadratic Bezier arc
    // Creates a parabolic path from startY to endY with peak at arcHeight
    const midX = (startX + endX) / 2
    const midY = Math.min(startY, endY) - arcHeight // Peak is ABOVE both points

    const controlPoint = { x: midX, y: midY }

    // Check if we need to jump
    const remainingX = nextNoteEndBeat - x
    const speed = currentVx

    if (remainingX <= speed * 2) {
      // We're near the target - do the jump
      progress += 0.1
      if (progress > 1) progress = 1

      const pos = bezierQuadratic(
        { x: startX, y: startY },
        controlPoint,
        { x: endX, y: endY },
        progress,
      )

      x = pos.x
      y = pos.y
    } else {
      // Move horizontally towards jump point
      x = startX + speed
      // Add slight wave to Y as we approach
      const wave = Math.sin((x / 100) * Math.PI) * 5
      y = startY + wave
    }

    // Check if we reached the end of the jump
    if (progress >= 1) {
      lastEndBeat = nextNoteEndBeat

      // Check for note at this position
      note = getCurrentNote(x, notes)
    }

    // If jumping between two different notes
    if (note !== null && note !== undefined) {
      // Snap to top-right corner of the note
      x = note.endBeat
      y = note.midi * rowHeight + rowHeight / 2 + padding.top
    }
  } else {
    // No more notes ahead - continue linearly
    x = lastEndBeat + currentVx

    // Add small vertical oscillation when traveling long distance
    if (notes.length > 0 && x > lastEndBeat + notes[0].endBeat) {
      const travelTime = (x - lastEndBeat) / currentVx
      const oscillate = Math.sin(travelTime * 2) * 3
      y += oscillate * 0.01
    }
  }

  // Apply gravity when falling
  if (y > startY) {
    y += vy
    vy += gravity * 0.5
    if (y > startY) {
      y = startY
      vy = 0
    }
  }

  // Floor collision
  const maxMidi = notes.length > 0 ? Math.max(...notes.map((n) => n.midi)) : 88
  const maxY = (maxMidi * rowHeight) - radius - padding.bottom

  if (y > maxY && vy > 0) {
    y = maxY
    vy = -vy * bounce * 0.3
  }

  // Keep within bounds
  const containerWidth = 1000
  const minX = padding.left + radius
  const maxX = containerWidth - padding.right - radius

  if (x < minX) {
    x = minX
    vx = Math.abs(vx) * 0.5
    lastEndBeat = x
  }
  if (x > maxX) {
    x = maxX
    vx = -Math.abs(vx) * 0.5
    lastEndBeat = x
  }

  const _isJumping = progress > 0 && progress < 1

  return {
    x,
    y,
    note,
    progress,
  }
}

/**
 * Find next note's endBeat after current position
 */
function findNextNoteEndBeat(x: number, lastEndBeat: number, notes: NoteBounds[]): number | null {
  const candidates: number[] = []
  for (const n of notes) {
    if (n.endBeat > x && n.endBeat > lastEndBeat) {
      candidates.push(n.endBeat)
    }
  }
  if (candidates.length === 0) return null
  return Math.min(...candidates)
}

/**
 * Find the note at a specific X position
 */
function getCurrentNote(beatPosition: number, notes: NoteBounds[]): NoteBounds | null {
  for (const n of notes) {
    if (n.startBeat <= beatPosition && beatPosition < n.endBeat) {
      return n
    }
  }
  return null
}

export function createBallPhysics(options: BallPhysicsOptions): BallPhysicsState {
  const {
    speed = 0.05,
    gravity = 0.003,
    bounce = 0.8,
    radius = 8,
    padding = { top: 5, bottom: 5, left: 0, right: 0 },
    timeScale = 1,
  } = options

  return {
    x: radius + padding.left,
    y: radius + padding.top,
    vy: 0,
    vx: speed * timeScale,
    gravity,
    bounce,
    isJumping: false,
    lastNote: null,
    lastEndBeat: radius + padding.left,
  }
}

// Generate multiple ball instances
export function createMultipleBalls(count: number, options: BallPhysicsOptions) {
  return Array.from({ length: count }, (_, i) =>
    createBallPhysics({
      ...options,
      speed: options.speed * (1 + i * 0.1),
    }),
  )
}
