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

import type { Component } from 'solid-js'
import { Minus, Plus } from '@/components/icons'
import { formatJamZoom, isJamZoomDefault, JAM_ZOOM_MAX, JAM_ZOOM_MIN, } from '@/lib/jam/jam-lane-zoom'
import styles from './JamLaneZoomControl.module.css'

export interface JamLaneZoomControlProps {
  zoom: () => number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export const JamLaneZoomControl: Component<JamLaneZoomControlProps> = (
  props,
) => {
  return (
    <div
      class={styles.zoom}
      data-testid="jam-lane-zoom"
      data-zoom={props.zoom().toFixed(3)}
    >
      <button
        type="button"
        class={styles.btn}
        aria-label="Show more of the song in the pitch lanes"
        title="Zoom out"
        disabled={props.zoom() <= JAM_ZOOM_MIN}
        onClick={() => props.onZoomOut()}
      >
        <Minus size={13} />
      </button>
      <button
        type="button"
        class={styles.readout}
        aria-label={`Pitch lane zoom ${formatJamZoom(props.zoom())}. Reset to ${formatJamZoom(JAM_ZOOM_MIN)}`}
        title="Reset the zoom"
        disabled={isJamZoomDefault(props.zoom())}
        onClick={() => props.onReset()}
      >
        {formatJamZoom(props.zoom())}
      </button>
      <button
        type="button"
        class={styles.btn}
        aria-label="Look closer at the pitch lanes"
        title="Zoom in"
        disabled={props.zoom() >= JAM_ZOOM_MAX}
        onClick={() => props.onZoomIn()}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
