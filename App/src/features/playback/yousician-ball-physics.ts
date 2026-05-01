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
  /** Current Y position (0 to 1, normalized height from top) */
  y: number
  /** Current vertical velocity (jump velocity, positive = up) */
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
  /** Speed of the ball moving horizontally (base multiplier) */
  speed: number
  /** Gravity strength */
  gravity?: number
  /** Bounciness (0-1) */
  bounce?: number
  /** Size of the ball in pixels */
  radius?: number
  /** Padding from edges */
  padding?: { top: number; bottom: number; left: number; right: number }
  /** Base horizontal speed at 120 BPM */
  baseSpeedBpm120?: number
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
  /** BPM for speed scaling */
  bpm: number
}

/**
 * Get horizontal speed based on BPM - faster BPM = faster ball
 * At 120 BPM, ball moves through about 2 beats per second
 */
function getHorizontalSpeed(bpm: number, baseSpeed: number): number {
  const baseAt120 = baseSpeed
  const scale = bpm / 120
  return baseAt120 * scale
}

export function getBallPhysics(
  state: BallPhysicsState,
  config: BallPhysicsConfig,
): { x: number; y: number; note: NoteBounds | null } {
  let { x, y, vy, vx, gravity, bounce } = state
  const { notes, rowHeight, radius, padding, bpm } = config
  let note = null

  // Get ball's current horizontal velocity based on BPM
  const currentVx = getHorizontalSpeed(bpm, vx)

  // Update horizontal position
  x += currentVx

  // Apply gravity
  vy += gravity

  // Apply vertical position
  y += vy

  // Get the note at current position
  const currentNoteAtPosition = getCurrentNote(x, notes)

  // Check note collisions (bounce on notes)
  if (currentNoteAtPosition) {
    // Ball's X position in beats (accounting for padding)
    const ballX = x + padding.left

    // Check if ball's X is within note's time range with some padding
    const noteLeft = currentNoteAtPosition.startBeat
    const noteRight = currentNoteAtPosition.endBeat

    // Ball radius in beats (approximate)
    const ballRadiusBeats = radius / 48 // Assuming 48px = 1 beat at default zoom

    if (
      noteLeft - ballRadiusBeats <= ballX + ballRadiusBeats &&
      ballX <= noteRight + ballRadiusBeats &&
      y <= radius
    ) {
      // Keep ball just above the note surface
      y = radius + 1

      // Add extra upward velocity to stay above the note
      // The higher the note in the scale, the more we need to bounce
      const midiHeight = 127 - currentNoteAtPosition.midi
      const extraBounce = Math.max(2, midiHeight * 0.1)

      vy = -(Math.abs(vy) * bounce + extraBounce)

      // Scale vertical bounce with BPM for responsiveness
      const speedScale = bpm / 120
      vy *= Math.min(speedScale, 1.5)

      note = currentNoteAtPosition
    }
  }

  // Floor collision (bottom of the piano roll)
  const maxMidi = notes.length > 0 ? Math.max(...notes.map((n) => n.midi)) : 88
  const maxY = (maxMidi * rowHeight) - radius - padding.bottom

  if (y > maxY && vy > 0) {
    y = maxY
    vy = -vy * bounce

    // Friction when on ground
    vx *= 0.98
  }

  // Keep ball within horizontal bounds
  const containerWidth = 1000
  const minX = padding.left + radius
  const maxX = containerWidth - padding.right - radius

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

/**
 * Find the note at a specific X position (in beats)
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
    baseSpeedBpm120 = 1.5,
  } = options

  return {
    x: radius + padding.left,
    y: radius + padding.top,
    vy: 0,
    vx: baseSpeedBpm120,
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
