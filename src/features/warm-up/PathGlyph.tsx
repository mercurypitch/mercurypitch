// ============================================================
// The glyphs inside the Warm-up path's orbs
// ============================================================
//
// Traced from the storyboard's stops (DESIGN-warm-up.md §1.2): a wave for
// Lip roll, an arch for Ng slides, a lantern for Long note, Echo's small
// constellation, and beamed notes for the song. Drawn in a box 0.2 W
// across (100 units), with the storyboard's stroke, 0.0126 W (6.3 units),
// in currentColor: the orb's state sets the colour. The lantern and the
// constellation follow the picker's glyphs (premium-exercises/glyphs.tsx),
// redrawn here at the stops' size and stroke.

import type { JSX } from 'solid-js'
import { Match, Switch } from 'solid-js'
import type { StopGlyph } from './path-view'

/** The storyboard's stroke, in the box's units (0.0126 W of 0.2 W). */
const STROKE = 6.3

/** A four-point star at (x, y), `r` from its centre to each point. */
function star(x: number, y: number, r: number): string {
  const n = r * 0.32
  return `M${x} ${y - r}L${x + n} ${y - n}L${x + r} ${y}L${x + n} ${y + n}L${x} ${y + r}L${x - n} ${y + n}L${x - r} ${y}L${x - n} ${y - n}Z`
}

export interface PathGlyphProps {
  glyph: StopGlyph
  class?: string
  style?: JSX.CSSProperties
}

export function PathGlyph(props: PathGlyphProps): JSX.Element {
  return (
    <svg
      class={props.class}
      style={props.style}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      stroke-width={STROKE}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      data-glyph={props.glyph}
    >
      <Switch>
        <Match when={props.glyph === 'wave'}>
          {/* 0.128 x 0.058 W: one swell, up and back down. */}
          <path d="M18 54C26 54 29 36 40 36S54 54 60 61S74 54 82 46" />
        </Match>
        <Match when={props.glyph === 'arch'}>
          {/* 0.116 x 0.080 W: the bridge's arch. */}
          <path d="M21 70C21 17 79 17 79 70" />
        </Match>
        <Match when={props.glyph === 'lantern'}>
          {/* 0.075 x 0.126 W: the picker's lantern at the stops' size. */}
          <g
            transform="translate(50 50) scale(3.4) translate(-12 -12)"
            stroke-width={STROKE / 3.4}
          >
            <path d="M10.2 4.6a1.8 1.8 0 0 1 3.6 0" />
            <path d="M8 7.4h8l-1.4-2.2H9.4z" />
            <rect x="7" y="7.4" width="10" height="11.4" rx="2.4" />
            <path d="M9 21h6" />
            <path d="M12 10.8c1.3 1.4 1.9 2.5 1.9 3.4a1.9 1.9 0 0 1-3.8 0c0-.9.6-2 1.9-3.4z" />
          </g>
        </Match>
        <Match when={props.glyph === 'stars'}>
          {/* Echo's constellation: three stars and the two lines between. */}
          <path d="M27 64 48 37 73 52" stroke-width={STROKE * 0.6} />
          <path d={star(27, 64, 11)} fill="currentColor" stroke="none" />
          <path d={star(48, 37, 13)} fill="currentColor" stroke="none" />
          <path d={star(73, 52, 11)} fill="currentColor" stroke="none" />
        </Match>
        <Match when={props.glyph === 'notes'}>
          {/* 0.111 x 0.093 W: two beamed notes. */}
          <path d="M38 70V30L74 22V62" />
          <path d="M38 34L74 26" stroke-width={STROKE * 1.6} />
          <ellipse
            cx="30"
            cy="71"
            rx="9"
            ry="7"
            transform="rotate(-18 30 71)"
            fill="currentColor"
            stroke="none"
          />
          <ellipse
            cx="66"
            cy="63"
            rx="9"
            ry="7"
            transform="rotate(-18 66 63)"
            fill="currentColor"
            stroke="none"
          />
        </Match>
      </Switch>
    </svg>
  )
}
