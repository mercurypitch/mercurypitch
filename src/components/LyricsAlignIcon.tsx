// ============================================================
// LyricsAlignIcon — three lines against the edge they align to
// ============================================================
//
// The glyph both alignment controls draw: the one-chip select in the stem
// mixer's crowded header, and the three-button group a jam room's header
// has the room for. It lived inside the select, and a second control that
// wanted the same picture had two choices -- import the select (and drag
// its stylesheet and a native <select> wrapper into a graph that uses
// neither) or paste the SVG. This is the third choice.
//
// The names live here too, for the same reason: "Middle" in one control
// and "Centre" in the other is the drift a shared constant exists to stop.

import type { Component } from 'solid-js'

/**
 * The three places a lyric can sit.
 *
 * Structurally the stem mixer's `LyricsAlign` and the room's
 * `JamLyricsAlign`, so either signal fits either control without a
 * mapping. Declared here rather than imported because src/components may
 * not depend on a feature, and the mixer's copy lives in one.
 */
export type LyricsAlign = 'left' | 'center' | 'right'

/** Reading order, which is also the order the buttons sit in. */
export const LYRICS_ALIGNS: readonly LyricsAlign[] = ['left', 'center', 'right']

/** What each alignment is called, wherever it is offered. */
export const LYRICS_ALIGN_LABELS: Record<LyricsAlign, string> = {
  left: 'Left',
  center: 'Middle',
  right: 'Right',
}

export function isLyricsAlign(value: unknown): value is LyricsAlign {
  return value === 'left' || value === 'center' || value === 'right'
}

/** Bar widths, top to bottom, in a 24-unit box. */
const EDGE_WIDTHS = [18, 12, 16] as const
const CENTER_WIDTHS = [14, 18, 12] as const

/** Where each bar starts vertically. */
const BAR_TOPS = ['3.5', '10.5', '17.5'] as const

export interface LyricsAlignIconProps {
  align: LyricsAlign
  /** Rendered size in CSS pixels. 11 is the mixer chip's. */
  size?: number
}

export const LyricsAlignIcon: Component<LyricsAlignIconProps> = (props) => {
  // Read through props every time: the select shows the CURRENT alignment,
  // so its one icon has to redraw when the value changes.
  const widthOf = (row: 0 | 1 | 2): number =>
    (props.align === 'center' ? CENTER_WIDTHS : EDGE_WIDTHS)[row]
  const xOf = (row: 0 | 1 | 2): number => {
    const width = widthOf(row)
    if (props.align === 'left') return 3
    if (props.align === 'right') return 21 - width
    return 12 - width / 2
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 11}
      height={props.size ?? 11}
      aria-hidden="true"
    >
      <rect
        x={xOf(0)}
        y={BAR_TOPS[0]}
        width={widthOf(0)}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xOf(1)}
        y={BAR_TOPS[1]}
        width={widthOf(1)}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xOf(2)}
        y={BAR_TOPS[2]}
        width={widthOf(2)}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
    </svg>
  )
}
