// ============================================================
// NgSlidesRoom: hum five slides, and the glass bridge lights
// ============================================================
//
// The premium Ng slides (design: DESIGN-ng-slides.md, storyboard
// 02-ng-slides; art: ART-FIDELITY.md 4). One room over a night river:
//
//   intro     the bridge unlit, Merc on the pier, his line, the mic
//   settle    no root yet: the singer hums an easy note first
//   run       the count-in (the first root's tone, the bridge rolling in),
//             then five slides: the bridge scrolls under the playhead,
//             the voice's ribbon follows the line, and the glass lights
//             wherever the voice followed it. "Slide 2 of 5" in the chip;
//             Merc rides the voice; he speaks only in the breaths
//   result    the view pulls back to the whole bridge, lit as the slides
//             lit it: the share lit, a chip for the jumps, the best,
//             Again and Done
//
// Drawn full-bleed (the shell's premium-rooms.ts, D1). The head's and the
// controls' heights are CSS custom properties (NgSlidesRoom.module.css),
// read once a resize, so the bridge keeps Merc and the note names clear of
// both (bridge-layout.ts).
//
// The page around the bridge is the glide rooms' own (room-kit
// glide/GlideRoomScreen.tsx, on the room kit's shell): the chip, the
// result, Merc's line, the mic, the level and "?". This room brings its
// world (BridgeScene.tsx) and where Merc's head is on its deck, its words,
// its stylesheet and its test ids.
//
// "How it works" (demo/) plays over the same room: Merc hums one slide the
// way not to and one the way to, through the room's own engine, with the
// demo kit's layer, cards and take pill over it. A first visit opens on
// it; the "?" plays it again from the intro or a result.

import type { JSX } from 'solid-js'
import type { GlideScreenClear, GlideScreenWords, } from '@/components/room-kit/glide/GlideRoomScreen'
import { GlideRoomScreen } from '@/components/room-kit/glide/GlideRoomScreen'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import surface from '@/components/room-kit/RoomSurface.module.css'
import { ARCH } from './bridge-geometry'
import type { BridgeLayout } from './bridge-layout'
import { layoutBridge, yOf } from './bridge-layout'
import { BridgeScene } from './BridgeScene'
import { aimNgTip } from './demo/tip-targets'
import type { NgDemo } from './demo/useNgDemo'
import { useNgDemo } from './demo/useNgDemo'
import type { NgController } from './ng-controller-contract'
import type { NgSummary } from './ng-run'
import { bestText, jumpsText, topsText } from './ng-run'
import styles from './NgSlidesRoom.module.css'
import { useNgController } from './useNgController'

export interface NgSlidesRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /**
   * The run, when it is not the room's own: the dev fixtures' pinned
   * frames (fixture/NgFixture.tsx). Read once. A room on another's run has
   * no demo.
   */
  controller?: NgController
  /** No animation at all (the fixtures). */
  still?: boolean
  /** Every picture the scene shows has decoded (the fixtures wait for it). */
  onSettled?: () => void
}

/**
 * Merc's bubble sits this far down his canvas: just over his head (the
 * top of his head is 0.21 down it, measured on the intro fixture).
 */
const BUBBLE_OVER_MERC = 0.17

/** The head's and the controls' heights (NgSlidesRoom.module.css). */
const NG_CLEAR: GlideScreenClear = {
  chip: '--ng-chip-clear',
  controls: '--ng-controls-clear',
}

/** The result's chips: the jumps, and the tops at Pro. */
export function resultChips(summary: NgSummary): string[] {
  const tops = topsText(summary)
  return tops === null ? [jumpsText(summary)] : [jumpsText(summary), tops]
}

/**
 * Ng slides' words on the page. The level reads as the slides' rules
 * (NG_SLIDES_LEVELS, DESIGN-ng-slides.md 3): how fast each slide goes, how
 * close to the line the voice must stay, whether the next note plays in
 * the breath, and whether the top must land in tune.
 */
const NG_WORDS: GlideScreenWords<NgSummary> = {
  start: 'Start: hum the slides over the bridge',
  levels: {
    learning:
      'Slow slides with plenty of room around the line. The next note plays in every breath.',
    singer:
      'Steady slides, closer to the line. The next note still plays in every breath.',
    professional:
      'Quick slides, close to the line, and no notes in the breaths. Each top must land in tune.',
  },
  lit: 'of the bridge lit',
  chips: resultChips,
  best: bestText,
}

/** Merc's line over his head as he stands on the deck. */
function mercHead(l: BridgeLayout): number {
  return (
    yOf(l, ARCH.deckY) - l.mercSize * MERC_FEET + l.mercSize * BUBBLE_OVER_MERC
  )
}

export function NgSlidesRoom(props: NgSlidesRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const own = props.controller === undefined
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useNgController()
  const demo: NgDemo | null = own ? useNgDemo(room) : null
  const reduced = prefersReducedMotion()

  return (
    <GlideRoomScreen
      room={room}
      demo={demo}
      ids="ng"
      testId="ng-slides-room"
      class={`${styles.room} ${surface.surface} mp-dark-stage`}
      styles={styles}
      clear={NG_CLEAR}
      words={NG_WORDS}
      layout={layoutBridge}
      mercHead={mercHead}
      aim={(tip, layer) => aimNgTip(tip.target, layer)}
      onDone={() => props.onDone()}
      still={props.still}
      scene={(l) => (
        <BridgeScene
          layout={l()}
          path={room.lines().path}
          root={room.lines().root}
          reduced={reduced}
          showResult={room.showResult()}
          still={props.still}
          onSettled={props.onSettled}
          onReady={(view) => room.attach(view)}
          merc={
            <MercView
              state={room.mercState}
              voice={room.mercVoice}
              sparkles="left"
              testId="ng-merc"
            />
          }
        />
      )}
    />
  )
}
