// ── JamLaneZoomControl ────────────────────────────────────────────────
// Minus, a readout, plus -- how close the pitch lanes are.
//
// The gestures (ctrl+wheel, two-finger pinch) are the fast path and the
// one people find by accident. This is the discoverable one, the keyboard
// one, and the one a screen reader can operate: three real buttons with
// names, rather than a surface you have to already know is zoomable.
//
// The readout is a button too. Getting back to 1x by wheeling is eight
// notches of guesswork; clicking the number that says how far in you are
// is the shortest way out of wherever a stray trackpad gesture left you.
//
// It is the lanes' control first, and everything about it defaults to
// them. A second scalar in the same room -- how big the lyrics are --
// wants exactly these three buttons and none of these words, so a host
// may hand in a `subject` that says what is being scaled: its range, its
// resting value, its readout and its names. Leave it out and nothing
// here changes.

import type { Component } from 'solid-js'
import { Minus, Plus } from '@/components/icons'
import { formatJamZoom, isJamZoomDefault, JAM_ZOOM_MAX, JAM_ZOOM_MIN, } from '@/lib/jam/jam-lane-zoom'
import styles from './JamLaneZoomControl.module.css'

/**
 * What the three buttons are changing, for a host that is not the lanes.
 *
 * One object rather than eight optional props, so a host either describes
 * its scalar completely or not at all -- a control that says "Larger
 * lyrics" on one button and "Reset the zoom" on the next because a prop
 * was forgotten is worse than either.
 */
export interface JamZoomSubject {
  /** Where the minus button goes quiet. */
  min: number
  /** Where the plus button goes quiet. */
  max: number
  /** True where a reset would change nothing, so the readout goes quiet. */
  isDefault: (value: number) => boolean
  /** The readout's text. */
  format: (value: number) => string
  /** Accessible name of the minus button, and its tooltip. */
  outLabel: string
  outTitle: string
  /** ...and of the plus button. */
  inLabel: string
  inTitle: string
  /** The readout's accessible name, given what it currently shows. */
  readoutLabel: (shown: string) => string
  resetTitle: string
  /** `data-testid`, so two of these in one room can be told apart. */
  testId: string
}

/** The pitch lanes: what this control says when nobody says otherwise. */
const LANE_SUBJECT: JamZoomSubject = {
  min: JAM_ZOOM_MIN,
  max: JAM_ZOOM_MAX,
  isDefault: isJamZoomDefault,
  format: formatJamZoom,
  outLabel: 'Show more of the song in the pitch lanes',
  outTitle: 'Zoom out',
  inLabel: 'Look closer at the pitch lanes',
  inTitle: 'Zoom in',
  readoutLabel: (shown) =>
    `Pitch lane zoom ${shown}. Reset to ${formatJamZoom(JAM_ZOOM_MIN)}`,
  resetTitle: 'Reset the zoom',
  testId: 'jam-lane-zoom',
}

export interface JamLaneZoomControlProps {
  zoom: () => number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  /** What is being scaled. Omitted, it is the pitch lanes. */
  subject?: JamZoomSubject
}

export const JamLaneZoomControl: Component<JamLaneZoomControlProps> = (
  props,
) => {
  const subject = (): JamZoomSubject => props.subject ?? LANE_SUBJECT

  return (
    <div
      class={styles.zoom}
      data-testid={subject().testId}
      data-zoom={props.zoom().toFixed(3)}
    >
      <button
        type="button"
        class={styles.btn}
        aria-label={subject().outLabel}
        title={subject().outTitle}
        disabled={props.zoom() <= subject().min}
        onClick={() => props.onZoomOut()}
      >
        <Minus size={13} />
      </button>
      <button
        type="button"
        class={styles.readout}
        aria-label={subject().readoutLabel(subject().format(props.zoom()))}
        title={subject().resetTitle}
        disabled={subject().isDefault(props.zoom())}
        onClick={() => props.onReset()}
      >
        {subject().format(props.zoom())}
      </button>
      <button
        type="button"
        class={styles.btn}
        aria-label={subject().inLabel}
        title={subject().inTitle}
        disabled={props.zoom() >= subject().max}
        onClick={() => props.onZoomIn()}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
