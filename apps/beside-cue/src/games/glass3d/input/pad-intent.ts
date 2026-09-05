// The thumb, turned into an intent.
// ============================================================
//
// `sim/locomotion3d` takes `{ move, jump }` and has never heard of a
// pointer. This is the other side of that seam: everything here is about
// fingers and elements, and nothing here knows what a chamber is.
//
// The layout is settled by one fact about how the game is played --
// ONE HAND, WHILE SINGING. That rules out a d-pad and a face button laid
// out for two thumbs, because the hand holding the phone is the hand
// playing it, and it reaches the bottom corner on its own side and
// nothing else.
//
// So the walk pad is a strip, not a stick: press left of its centre to
// go left, right of centre to go right, and how far from the centre sets
// how fast. Analogue because `move` is analogue -- a thumb that has
// barely moved should barely move him -- and because a strip that only
// ever answered -1 or +1 would make standing on a node a matter of
// tapping rather than of aiming.
//
// JUMPING IS ON THE PAD AS WELL AS ON ITS OWN BUTTON, and that is the
// part that makes one-handed play work. A quick tap that never leaves
// the dead zone jumps; a press that lingers or slides walks. Two thumbs
// get the button, which can be held down while the other walks; one
// thumb gets the tap, and pays for it by not being able to jump while
// already walking. Both are real ways to play, and the player picks
// without being asked.
import { isNativeInteractionTarget } from '@/interaction/selection'
import type { LocomotionIntent } from '../sim/locomotion3d'

export interface PadConfig {
  /** Fraction of the pad's half-width around the centre that reads as
   * "no direction". A thumb resting on a strip is never exactly
   * centred, and without this he creeps. */
  deadZoneRatio: number
  /** A press shorter than this may be a tap. */
  tapSeconds: number
  /** How far from the pad's centre a press may get, as a fraction of
   * its half-width, and still be a tap rather than a walk. Sits just
   * outside the dead zone: a press that never asked him to move is the
   * press that meant to jump. */
  tapSlipRatio: number
  /** How long a tapped jump is held for. Only has to outlast one fixed
   * step for the edge to be seen, but the buffer in locomotion3d is
   * 0.13 s and a pulse well inside that is one less thing to reason
   * about at low frame rates. */
  jumpPulseSeconds: number
}

export const PAD_CONFIG: PadConfig = {
  deadZoneRatio: 0.12,
  tapSeconds: 0.22,
  tapSlipRatio: 0.14,
  jumpPulseSeconds: 0.08,
}

/** A rectangle, as much of one as this needs. */
export interface PadRect {
  left: number
  width: number
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

/**
 * Where along the pad the finger is, as a -1..1 intent.
 *
 * Rescaled past the dead zone rather than merely gated, so crossing its
 * edge starts him at a crawl instead of jumping straight to
 * `deadZoneRatio` of walking speed. A pad with no width yet -- an
 * element measured before layout -- is not a pad, and answers 0.
 */
export const padMove = (
  clientX: number,
  rect: PadRect,
  deadZoneRatio: number,
): number => {
  const half = rect.width / 2
  if (!(half > 0) || !Number.isFinite(clientX)) return 0
  const off = clamp((clientX - (rect.left + half)) / half, -1, 1)
  const dz = clamp(deadZoneRatio, 0, 0.95)
  const mag = Math.abs(off)
  if (mag <= dz) return 0
  return Math.sign(off) * ((mag - dz) / (1 - dz))
}

/**
 * Was that press a tap -- brief, and it never asked him to walk?
 *
 * `offRatio` is the FURTHEST the finger got from the pad's centre over
 * the whole press, not how far it travelled. A quick jab at the far end
 * of the pad has moved him already; calling it a tap as well would make
 * one gesture mean two things.
 */
export const isTap = (
  heldSeconds: number,
  offRatio: number,
  cfg: PadConfig,
): boolean => heldSeconds <= cfg.tapSeconds && offRatio <= cfg.tapSlipRatio

/**
 * The intent as the loop reads it.
 *
 * `read` takes the time rather than calling `performance.now()` itself,
 * so a test can tap and then look at the next 200 ms without waiting for
 * them, and so a replay could drive the same object from recorded time.
 */
export interface IntentSource {
  read(nowMs: number): LocomotionIntent
  setMove(move: number): void
  setHeldJump(down: boolean): void
  pulseJump(nowMs: number): void
  /** Everything up, everything centred. For losing a pointer, leaving
   * the tab, or ending a phase. */
  release(): void
}

export const createIntentSource = (
  cfg: PadConfig = PAD_CONFIG,
): IntentSource => {
  const box = { move: 0, jump: false }
  let held = false
  let pulseUntil = -Infinity

  return {
    read(nowMs: number): LocomotionIntent {
      box.jump = held || nowMs < pulseUntil
      return box
    },
    setMove(move: number): void {
      box.move = Number.isFinite(move) ? clamp(move, -1, 1) : 0
    },
    setHeldJump(down: boolean): void {
      held = down
    },
    pulseJump(nowMs: number): void {
      pulseUntil = nowMs + cfg.jumpPulseSeconds * 1000
    },
    release(): void {
      box.move = 0
      held = false
      pulseUntil = -Infinity
    },
  }
}

/** The keys a desktop plays with. Not the shipping controls -- the ones
 * that make the game testable at a keyboard, and the reason the intent
 * is a shape rather than a touch handler. */
const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])
const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W'])

/**
 * Drive an intent source from the keyboard. Returns its own cleanup.
 *
 * Tracks which direction keys are DOWN rather than reacting to the last
 * event, because holding both and releasing one should leave him walking
 * the other way, not standing still.
 */
export const bindKeyboard = (
  source: IntentSource,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
): (() => void) => {
  const down = new Set<string>()

  const apply = (): void => {
    let move = 0
    for (const key of down) {
      if (LEFT_KEYS.has(key)) move -= 1
      if (RIGHT_KEYS.has(key)) move += 1
    }
    source.setMove(clamp(move, -1, 1))
    let jump = false
    for (const key of down) if (JUMP_KEYS.has(key)) jump = true
    source.setHeldJump(jump)
  }

  const onDown = (event: Event): void => {
    if (isNativeInteractionTarget(event)) return
    const key = (event as KeyboardEvent).key
    if (!LEFT_KEYS.has(key) && !RIGHT_KEYS.has(key) && !JUMP_KEYS.has(key)) {
      return
    }
    // Space scrolls the page, and a game that scrolls while it jumps is
    // not a game anyone finishes.
    event.preventDefault()
    down.add(key)
    apply()
  }
  const onUp = (event: Event): void => {
    down.delete((event as KeyboardEvent).key)
    apply()
  }
  // A tab switched away mid-press never sees the keyup, and he walks
  // into the wall until the player comes back and taps the key twice.
  const onBlur = (): void => {
    down.clear()
    source.release()
  }

  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)
  target.addEventListener('blur', onBlur)
  return () => {
    target.removeEventListener('keydown', onDown)
    target.removeEventListener('keyup', onUp)
    target.removeEventListener('blur', onBlur)
  }
}
