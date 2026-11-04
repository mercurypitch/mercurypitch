// ============================================================
// Studio zoom controls — zoom out, the zoom level, zoom in and Fit, at the foot of the lanes or heading the dock, and a phone's pair in the ruler's corner
// ============================================================
//
// The group sits where it always did, at the lanes' far corner, so the
// clip bar folds beside it as before (clip-bar-fold.ts). It reads as zoom at
// a glance: the level stands between the two steps, and moves as the wheel
// or a pinch zooms. Fit stays an icon: a word there folded the clip bar's
// names away in a 980 px window. In the dock, beside the open desk, the
// group is three icons in the dock's column. A phone has no foot to spare:
// zoom out and in sit in the ruler's corner, above the lane names, and
// zooming out all the way is the phone's fit.
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { FitWidth, ZoomIn, ZoomOut } from '../studio-icons'
import styles from './StudioTimeline.module.css'
import type { StudioZoomControl } from './zoom-control'
import { STUDIO_ZOOM_KEYS } from './zoom-keys'

export function StudioZoomControls(props: {
  zoom: StudioZoomControl
  /** No song to fit yet. */
  empty: boolean
  /** In the dock: icons only. */
  docked?: boolean
  /** A phone's pair in the ruler's corner. */
  compact?: boolean
  style?: JSX.CSSProperties
}) {
  const full = () => props.docked !== true && props.compact !== true
  return (
    <div
      class={styles.zoom}
      classList={{ [styles.zoomCompact]: props.compact === true }}
      role="group"
      aria-label="Timeline zoom"
      data-studio-zoom=""
      style={props.style}
    >
      <button
        type="button"
        aria-label="Zoom out"
        title={`Zoom out (${STUDIO_ZOOM_KEYS.out})`}
        aria-keyshortcuts={STUDIO_ZOOM_KEYS.out}
        disabled={!props.zoom.canStep(-1)}
        onClick={() => props.zoom.step(-1)}
      >
        <ZoomOut size={16} />
      </button>
      <Show when={full()}>
        <output
          class={styles.zoomLevel}
          aria-live="off"
          title="Zoom level: the song opens at 100%"
        >
          {props.zoom.percent()}%
        </output>
      </Show>
      <button
        type="button"
        aria-label="Zoom in"
        title={`Zoom in (${STUDIO_ZOOM_KEYS.in})`}
        aria-keyshortcuts={STUDIO_ZOOM_KEYS.in}
        disabled={!props.zoom.canStep(1)}
        onClick={() => props.zoom.step(1)}
      >
        <ZoomIn size={16} />
      </button>
      <Show when={props.compact !== true}>
        <button
          type="button"
          aria-label="Fit song to width"
          title={`Fit the whole song (${STUDIO_ZOOM_KEYS.fit})`}
          aria-keyshortcuts={STUDIO_ZOOM_KEYS.fit}
          disabled={props.empty}
          onClick={() => props.zoom.fit()}
        >
          <FitWidth size={16} />
        </button>
      </Show>
    </div>
  )
}
