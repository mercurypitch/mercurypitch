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
//
// The chip owns its own stylesheet. It used to be styled from the string in
// StemMixer.tsx, which meant it rendered as a bare <span> anywhere the mixer
// was not mounted.
//
// A header with room for three buttons wants LyricsAlignButtons instead —
// same values, same accessor/setter pair, no operating-system menu. A jam
// room's lyric column started on this chip and moved to that for exactly
// that reason.

import type { Accessor, Component, Setter } from 'solid-js'
import './LyricsAlignSelect.css'
import type { LyricsAlign } from '@/components/LyricsAlignIcon'
import { isLyricsAlign, LYRICS_ALIGN_LABELS, LyricsAlignIcon, } from '@/components/LyricsAlignIcon'
import { SafeSelect } from '@/components/shared/SafeSelect'

/**
 * How much room the host can spare for the chip.
 *
 * `compact` matches the other chips in the mixer's dense header, which
 * has six controls competing for one row. `roomy` grows it past the 24px
 * touch floor on a coarse pointer, for headers that can afford it.
 * Explicit at every call site rather than defaulted, so a new host has to
 * decide rather than inherit somebody else's crowding.
 */
export type LyricsAlignHitTarget = 'compact' | 'roomy'

export interface LyricsAlignSelectProps {
  lyricsAlign: Accessor<LyricsAlign>
  setLyricsAlign: Setter<LyricsAlign>
  hitTarget: LyricsAlignHitTarget
}

export const LyricsAlignSelect: Component<LyricsAlignSelectProps> = (props) => {
  return (
    <span
      class="sm-lyrics-align-select"
      data-hit-target={props.hitTarget}
      title={`Lyric alignment: ${LYRICS_ALIGN_LABELS[props.lyricsAlign()]}`}
    >
      <LyricsAlignIcon align={props.lyricsAlign()} />
      {/* SafeSelect, not <select>: the workspace panels are draggable, so a
          transformed ancestor is one layout change away and that breaks the
          iOS picker outright. */}
      <SafeSelect
        aria-label="Lyric alignment"
        value={props.lyricsAlign()}
        onChange={(e) => {
          const next = e.currentTarget.value
          if (isLyricsAlign(next)) props.setLyricsAlign(next)
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
