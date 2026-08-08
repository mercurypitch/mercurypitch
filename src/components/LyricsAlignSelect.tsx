// ============================================================
// LyricsAlignSelect — lyric text alignment, in one control
// ============================================================
//
// Alignment was three icon buttons living only in the performance layout, so
// every other layout could show centred lyrics with no way to change them.
// Three more buttons do not fit the grid layout's header — it already carries
// zoom, columns, note labels, search, upload and remove.
//
// So: one chip the width of a single button. The icon shows the current
// alignment and a native <select> sits transparently over it to supply the
// menu. Native on purpose — a hand-rolled popover in this header is the
// mistake docs/agent/MISTAKES.md already records (clipped by the panel,
// stacked under the sidebar, no outside-click close). It also gets keyboard
// support and touch pickers for free.

import type { Accessor, Component, Setter } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { LyricsAlign } from '@/features/stem-mixer/useStemMixerLyricsController'

const ALIGN_LABELS: Record<LyricsAlign, string> = {
  left: 'Left',
  center: 'Middle',
  right: 'Right',
}

function isAlign(value: string): value is LyricsAlign {
  return value === 'left' || value === 'center' || value === 'right'
}

/** Three lines anchored to the chosen edge. */
function alignIcon(align: LyricsAlign) {
  const widths = align === 'center' ? [14, 18, 12] : [18, 12, 16]
  const xFor = (w: number) =>
    align === 'left' ? 3 : align === 'right' ? 21 - w : 12 - w / 2
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <rect
        x={xFor(widths[0])}
        y="3.5"
        width={widths[0]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xFor(widths[1])}
        y="10.5"
        width={widths[1]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xFor(widths[2])}
        y="17.5"
        width={widths[2]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
    </svg>
  )
}

export interface LyricsAlignSelectProps {
  lyricsAlign: Accessor<LyricsAlign>
  setLyricsAlign: Setter<LyricsAlign>
}

export const LyricsAlignSelect: Component<LyricsAlignSelectProps> = (props) => {
  return (
    <span
      class="sm-lyrics-align-select"
      title={`Lyric alignment: ${ALIGN_LABELS[props.lyricsAlign()]}`}
    >
      {alignIcon(props.lyricsAlign())}
      {/* SafeSelect, not <select>: the workspace panels are draggable, so a
          transformed ancestor is one layout change away and that breaks the
          iOS picker outright. */}
      <SafeSelect
        aria-label="Lyric alignment"
        value={props.lyricsAlign()}
        onChange={(e) => {
          const next = e.currentTarget.value
          if (isAlign(next)) props.setLyricsAlign(next)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="left">Left</option>
        <option value="center">Middle</option>
        <option value="right">Right</option>
      </SafeSelect>
    </span>
  )
}
