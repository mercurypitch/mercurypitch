// ============================================================
// YousicianBall Physics — Ball jumps through notes like on platforms
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
  /** Current Y position (0 to 1, normalized height) */
  y: number
  /** Current vertical velocity (jump velocity) */
  vy: number
  /** Current horizontal velocity */
  vx: number
  /** Gravity constant */
  gravity: number
  /** Bounce energy (0-1, where 1 = perfect bounce) */
  bounce: number
  /** Is ball in the air */
  isJumping: boolean
  /** Last note touched */
  lastNote: NoteBounds | null
}

export interface BallPhysicsOptions {
  /** Speed of the ball moving horizontally */
  speed: number
  /** Gravity strength */
  gravity?: number
  /** Bounciness (0-1) */
  bounce?: number
  /** Size of the ball in pixels */
  radius?: number
  /** Padding from edges */
  padding?: { top: number; bottom: number; left: number; right: number }
}

export interface BallPhysicsConfig {
  /** Current X position in beats */
  currentBeat: number
  /** All note bounds for collision detection */
  notes: NoteBounds[]
  /** Row height in pixels */
  rowHeight: number
  /** Ball radius in pixels */
  radius: number
  /** Padding for the ball (horizontal and vertical) */
  padding: { top: number; bottom: number; left: number; right: number }
}

export function getBallPhysics(
  state: BallPhysicsState,
  config: BallPhysicsConfig,
): { x: number; y: number; note: NoteBounds | null } {
  let { x, y, vy, vx, gravity, bounce } = state
  const { notes, rowHeight, radius, padding } = config
  let note = null

  // Update horizontal position
  x += vx

  // Apply gravity
  vy += gravity

  // Apply vertical position
  y += vy

  // Check note collisions (bounce on notes)
  for (const n of notes) {
    // Check if ball's X is within note's time range
    const noteLeft = n.startBeat
    const noteRight = n.endBeat

    // Ball's X position in beats (accounting for padding)
    const ballX = x + padding.left

    // Check collision
    if (
      noteLeft <= ballX + radius * 2 &&
      ballX <= noteRight &&
      y <= radius &&
      y >= 0
    ) {
      // Bounce!
      y = radius
      vy = -vy * bounce
      note = n
      break
    }
  }

  // Floor collision (bottom of the piano roll)
  const maxRow = notes.length > 0
    ? Math.max(...notes.map((n) => n.midi)) + 1
    : 88 // Default 3 octaves
  const maxY = (maxRow * rowHeight) - radius - padding.bottom

  if (y > maxY && vy > 0) {
    y = maxY
    vy = -vy * bounce

    // Friction when on ground
    vx *= 0.98
  }

  // Keep ball within horizontal bounds
  const minX = padding.left + radius
  const maxX = 1000 - padding.right - radius // Default wide canvas

  if (x < minX) {
    x = minX
    vx = Math.abs(vx) * 0.5
  }
  if (x > maxX) {
    x = maxX
    vx = -Math.abs(vx) * 0.5
  }

  const isJumping = vy !== 0

  return {
    x,
    y,
    note,
  }
}

export function createBallPhysics(options: BallPhysicsOptions): BallPhysicsState {
  const {
    speed = 0.05,
    gravity = 0.003,
    bounce = 0.8,
    radius = 8,
    padding = { top: 5, bottom: 5, left: 0, right: 0 },
  } = options

  return {
    x: radius + padding.left,
    y: radius + padding.top,
    vy: 0,
    vx: speed,
    gravity,
    bounce,
    isJumping: false,
    lastNote: null,
  }
}

// Generate multiple ball instances for a more dynamic effect
export function createMultipleBalls(count: number, options: BallPhysicsOptions) {
  return Array.from({ length: count }, (_, i) =>
    createBallPhysics({
      ...options,
      speed: speedWithVariation(options.speed, i, count),
    }),
  )
}

function speedWithVariation(baseSpeed: number, index: number, total: number): number {
  // Spread balls at different horizontal positions
  const totalWidth = 1000
  const spacing = totalWidth / (total + 1)
  const startX = spacing * (index + 1)
  return baseSpeed
}
