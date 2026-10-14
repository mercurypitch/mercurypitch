// ============================================================
// BuzzMarks: the lip buzz, drawn beside Merc's mouth
// ============================================================
//
// DESIGN-lip-roll.md 1: the buzz is two or three short wavy lines and a few
// small bubbles beside his mouth, an overlay that rides with his canvas,
// never a pucker (the storyboards' puckered mouths read as a "3"). Lines
// on his left, by his cheek; bubbles on his right, off his mouth (screens
// 1, 2 and 4). It shows while he buzzes (his own at the intro, the voice in
// a run); the lines quiver and the bubbles bob, still under reduced motion.
// Merc's own sound rings are off in this room (MercView `rings`), so the
// buzz is the only sound he shows.

import type { JSX } from 'solid-js'
import styles from './LipRollRoom.module.css'

/** A short wavy line from (x, y), `n` waves `w` wide each, in a 100 x 100 box. */
function wavy(x: number, y: number, w: number, n: number, amp: number): string {
  let d = `M${x} ${y}`
  for (let i = 0; i < n; i++) d += ` q${w / 4} ${-amp} ${w / 2} 0 t${w / 2} 0`
  return d
}

export interface BuzzMarksProps {
  /**
   * The overlay, handed to the scene: it sets `data-on` as he starts and
   * stops buzzing, a frame at a time, never through a signal.
   */
  ref: (el: SVGSVGElement) => void
}

export function BuzzMarks(props: BuzzMarksProps): JSX.Element {
  return (
    <svg
      ref={props.ref}
      class={styles.buzz}
      viewBox="0 0 100 100"
      aria-hidden="true"
      data-testid="lip-buzz"
      data-on="false"
    >
      <g
        class={styles.buzzLines}
        fill="none"
        stroke="#bfe9ff"
        stroke-width="1.6"
        stroke-linecap="round"
      >
        <path d={wavy(9, 37, 4.2, 3, 2.6)} />
        <path d={wavy(6, 43.5, 4.2, 3, 2.6)} />
        <path d={wavy(10, 50, 4.2, 2, 2.6)} />
      </g>
      <g
        class={styles.buzzBubbles}
        fill="none"
        stroke="#9fe6ff"
        stroke-width="1.2"
      >
        <circle cx="80" cy="47" r="2.4" />
        <circle cx="86.5" cy="41" r="1.8" />
        <circle cx="83" cy="34.5" r="1.3" />
      </g>
    </svg>
  )
}
