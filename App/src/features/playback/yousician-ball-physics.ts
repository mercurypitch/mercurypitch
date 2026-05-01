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
  /** Current Y position in row-height units (not pixels) */
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
  /** Last note's endBeat where the ball bounced */
  lastEndBeat: number
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
  let { x, y, vy, vx, gravity, bounce, lastEndBeat } = state
  const { notes, rowHeight, radius, padding, bpm } = config
  let note = null

  // Get ball's current horizontal velocity based on BPM
  const currentVx = getHorizontalSpeed(bpm, vx)

  // Find all note endBeats that are ahead of the ball (potential jump targets)
  const jumpTargets: number[] = []
  for (const n of notes) {
    if (n.endBeat > x && n.endBeat > lastEndBeat) {
      jumpTargets.push(n.endBeat)
    }
  }

  // Get the nearest jump target
  const nearestJumpTarget = Math.min(...jumpTargets, Infinity)

  if (nearestJumpTarget !== Infinity) {
    // Ball needs to reach the jump target
    const distanceToTarget = nearestJumpTarget - x

    // Move towards the target
    if (distanceToTarget > currentVx) {
      // Not there yet, just move horizontally
      x += currentVx
    } else {
      // We've reached/near the jump target - snap to it
      x = nearestJumpTarget
      lastEndBeat = nearestJumpTarget

      // Check if there's a note at this X position
      const currentNote = getCurrentNote(x, notes)

      if (currentNote && currentNote.endBeat === nearestJumpTarget) {
        // This is a valid jump point (note endBeat)
        // Jump at the TOP of the note (above the note block)
        y = radius + 1

        // Calculate note height in row units
        const noteHeightRows = 1
        // Bounce at the TOP of the note (row height + radius spacing)
        vy = -12 // Fixed upward velocity for reliable jump

        // Add more bounce for higher notes (lower MIDI = higher up on screen)
        const midiHeight = 127 - currentNote.midi
        vy -= midiHeight * 0.15

        note = currentNote
      }
    }
  } else {
    // No more jump targets, just move freely
    x += currentVx
  }

  // Apply gravity
  vy += gravity

  // Apply vertical position
  y += vy

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
    lastEndBeat = x
  }
  if (x > maxX) {
    x = maxX
    vx = -Math.abs(vx) * 0.5
    lastEndBeat = x
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
    lastEndBeat: radius,
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
