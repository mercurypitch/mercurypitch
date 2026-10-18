// ============================================================
// LipRollRoom: buzz your lips over three waves, and the bay lights
// ============================================================
//
// The premium Lip roll (design: DESIGN-lip-roll.md, storyboard
// 03-lip-roll; L0: lip-l0/L0-REPORT.md). One room over a night bay:
//
//   intro     the first wave unlit, its dotted crest, Merc at its foot
//             buzzing, his line, the mic
//   settle    no root yet: the singer sings an easy note first
//   run       the count-in (the first root's tone, the bay rolling in
//             while the camera zooms from screen 1's wave to the run's),
//             then three waves: the bay scrolls under the playhead, the
//             voice's ribbon follows the dots and sheds bubbles, and each
//             wave lights wherever the voice followed it. "Wave 2 of 3" in
//             the chip; Merc rides the voice; he speaks only in the breaths
//   result    the view pulls back to the whole bay, its three waves lit
//             as the take lit them: the share lit, a chip for the breaks
//             (and the jumps, and the tops at Pro), the best, Again and
//             Done
//
// Drawn full-bleed (the shell's premium-rooms.ts, D1). The chip's and the
// controls' heights are CSS custom properties (LipRollRoom.module.css),
// read once a resize, so the bay keeps Merc clear of both (bay-layout.ts).
// Merc's sound rings are off for the whole room: the buzz beside his mouth
// is the bay's own mark (BuzzMarks.tsx).
//
// The page around the bay is the glide rooms' own (room-kit
// glide/GlideRoomScreen.tsx, on the room kit's shell): the chip, the
// result, Merc's line, the mic, the level and "?". This room brings its
// world (BayScene.tsx) and where Merc's head is in it, its words, its
// stylesheet and its test ids; at the result Merc stands on the left, so
// his line moves to the right, over the buttons (.bubbleResult).
//
// "How it works" (demo/) plays over the same room: Merc buzzes one wave
// the way not to and one the way to, through the room's own engine, with
// the demo kit's layer, cards and take pill over it. A first visit opens
// on it; the "?" plays it again from the intro or a result. Its tooltips
// keep clear of where Merc will ride while they are up (`mercLane`).

import type { JSX } from 'solid-js'
import type { Rect } from '@/components/demo-kit/tip-place'
import type { GlideScreenClear, GlideScreenWords, } from '@/components/room-kit/glide/GlideRoomScreen'
import { GlideRoomScreen } from '@/components/room-kit/glide/GlideRoomScreen'
import { MercView } from '@/components/room-kit/MercView'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import surface from '@/components/room-kit/RoomSurface.module.css'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { routineRun } from '@/components/room-kit/routine-stop'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import { WAVE } from './bay-geometry'
import type { BayLayout } from './bay-layout'
import { layoutBay, MERC_INTRO_X, mercBoxAt, zoomAt } from './bay-layout'
import { LIP_MOUTH } from './bay-ride'
import { BayScene } from './BayScene'
import { aimLipTip } from './demo/tip-targets'
import type { LipDemo } from './demo/useLipDemo'
import { useLipDemo } from './demo/useLipDemo'
import type { LipController } from './lip-controller-contract'
import type { LipSummary } from './lip-run'
import { bestText, resultChips } from './lip-run'
import styles from './LipRollRoom.module.css'
import { useLipController } from './useLipController'

export interface LipRollRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /**
   * The run, when it is not the room's own: the dev fixtures' pinned
   * frames (fixture/LipFixture.tsx). Read once. A room on another's run
   * has no demo.
   */
  controller?: LipController
  /** No animation at all (the fixtures). */
  still?: boolean
  /** Every picture the scene shows has decoded (the fixtures wait for it). */
  onSettled?: () => void
  /**
   * A stop of the Warm-up (room-kit routine-stop.ts): the room in warm-up
   * mode, its run started from the stop's note when it keeps none of its
   * own, and its demo never starting by itself. Read once.
   */
  routine?: RoutineStop
}

/**
 * Merc's bubble sits this far down his canvas: just over his head (the
 * top of his head is about 0.2 down it).
 */
const BUBBLE_OVER_MERC = 0.17
/**
 * How far ahead a tooltip keeps clear of Merc, s: the longest a tooltip
 * stays up inside a take (demo-cues.ts), while he rides on under it.
 */
const TIP_LANE_SECONDS = 3.2

/** The chip's and the controls' heights (LipRollRoom.module.css). */
const LIP_CLEAR: GlideScreenClear = {
  chip: '--lip-chip-clear',
  controls: '--lip-controls-clear',
}

/**
 * Lip roll's words on the page. The level reads as the waves' rules
 * (LIP_ROLL_LEVELS, DESIGN-lip-roll.md 3): how fast each wave goes, how
 * close to the dots the voice must stay, whether the next note plays in
 * the breath, and whether the top must be reached.
 */
const LIP_WORDS: GlideScreenWords<LipSummary> = {
  start: 'Start: buzz your lips over the waves',
  levels: {
    learning:
      'Slow waves with plenty of room around the dots. The next note plays in every breath.',
    singer:
      'Steady waves, closer to the dots. The next note still plays in every breath.',
    professional:
      'Quick waves, close to the dots, and no notes in the breaths. Each wave must reach its top in tune.',
  },
  lit: 'of the waves lit',
  chips: resultChips,
  best: bestText,
}

/**
 * Merc's line over his head as he waits at a root, at the intro's camera
 * or the run's, whichever holds him higher: the count-in zooms between the
 * two while he listens.
 */
function mercHead(l: BayLayout): number {
  return Math.min(
    ...[0, 1].map((z) => {
      const merc = mercBoxAt(l, zoomAt(z), MERC_INTRO_X, WAVE.rootY)
      return merc.top + merc.size * BUBBLE_OVER_MERC
    }),
  )
}

export function LipRollRoom(props: LipRollRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const own = props.controller === undefined
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const stop = props.routine
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useLipController(routineRun(stop))
  const demo: LipDemo | null = own
    ? useLipDemo(room, { autoPlay: stop === undefined })
    : null
  const reduced = prefersReducedMotion()

  /** Merc's canvas over the next moments of the demo's take, px. */
  const mercLane = (l: BayLayout): Rect[] =>
    room.mercAhead(TIP_LANE_SECONDS).map((spot) => {
      const box = mercBoxAt(l, zoomAt(spot.zoom), spot.x, spot.feetY)
      return { x: box.left, y: box.top, w: box.size, h: box.size }
    })

  return (
    <GlideRoomScreen
      room={room}
      exercise={EXERCISE_LIP_ROLL_BAY}
      routine={stop}
      demo={demo}
      ids="lip"
      testId="lip-roll-room"
      class={`${styles.room} ${surface.surface} mp-dark-stage`}
      styles={styles}
      clear={LIP_CLEAR}
      words={LIP_WORDS}
      layout={layoutBay}
      mercHead={mercHead}
      bubbleAtResult={styles.bubbleResult}
      aim={(tip, layer, l) =>
        aimLipTip(tip.target, layer, l === null ? [] : mercLane(l))
      }
      onDone={() => props.onDone()}
      still={props.still}
      scene={(l) => (
        <BayScene
          layout={l()}
          path={room.lines().path}
          named={room.lines().root !== null}
          reduced={reduced}
          showResult={room.showResult()}
          still={props.still}
          onSettled={props.onSettled}
          onReady={(view) => room.attach(view)}
          merc={
            <MercView
              state={room.mercState}
              voice={room.mercVoice}
              rings={false}
              mouth={LIP_MOUTH}
              sparkles="left"
              testId="lip-merc"
            />
          }
        />
      )}
    />
  )
}
