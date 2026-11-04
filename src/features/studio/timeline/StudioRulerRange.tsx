// ============================================================
// Studio ruler range — the stretch of the song Repeat loops and Punch records in, drawn on the ruler with a handle at each end
// ============================================================
//
// A drag along the ruler draws a range, as in REAPER (ruler-gesture.ts:
// a click seeks instead), and a clip's toolbar sets one to the clip
// (StudioClipToolbar.tsx). Each end has a handle to drag, or to move with
// the arrow keys a grid step at a time, and the cross clears it. A drag
// shows its range as it goes and sets it once, on release: a range Repeat
// plays is followed by the playing song (loop-range.ts), and one change is
// one re-plan, not one per pointer move. While a take runs the range holds
// still (take-running.ts): its handles go, and a drag draws nothing. The
// range is the session's view, like the zoom: it is not saved with the song.
//
// The range lies over the ruler but beside it in the page, not inside it:
// the ruler is the playhead's slider, and a slider's children are
// presentational, so handles and a button inside one would be lost to
// assistive tech. Each handle is a slider of its own, with its bounds.
import type { Accessor } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import { STUDIO_MIN_LOOP_FRAMES } from '@/lib/studio/playback/loop-range'
import { studioTakeRunning } from '../record/take-running'
import { CrossSmall } from '../studio-icons'
import styles from './StudioRulerRange.module.css'
import { formatStudioTime, frameToPixel } from './timeline-geometry'
import { snapStudioPosition, studioGridInterval } from './timeline-snap'
import type { StudioTimelineProps } from './types'

/** A range from two frames in either order, or null when it is too short to loop. */
export function studioRangeBetween(
  a: number,
  b: number,
): StudioFrameRange | null {
  const startFrame = Math.max(0, Math.round(Math.min(a, b)))
  const endFrame = Math.round(Math.max(a, b))
  return endFrame - startFrame >= STUDIO_MIN_LOOP_FRAMES
    ? { startFrame, endFrame }
    : null
}

/** One end of `range` moved to `frame`, never past the other end's shortest loop. */
export function studioRangeEdge(
  range: StudioFrameRange,
  edge: 'start' | 'end',
  frame: number,
): StudioFrameRange {
  const at = Math.round(frame)
  return edge === 'start'
    ? {
        startFrame: Math.max(
          0,
          Math.min(at, range.endFrame - STUDIO_MIN_LOOP_FRAMES),
        ),
        endFrame: range.endFrame,
      }
    : {
        startFrame: range.startFrame,
        endFrame: Math.max(at, range.startFrame + STUDIO_MIN_LOOP_FRAMES),
      }
}

/**
 * Draws a range on the ruler: from the frame a drag started at to the
 * pointer, both snapped. It shows as it goes and is set once, on release.
 */
export function createStudioRangeDraw(options: {
  frameAt(event: { clientX: number }): number
  snap(frame: number): number
  commit(range: StudioFrameRange): void
  /** A take is running: nothing starts. */
  locked?(): boolean
}) {
  const [draft, setDraft] = createSignal<StudioFrameRange | null>(null)
  let from: number | null = null
  return {
    draft: draft as Accessor<StudioFrameRange | null>,
    /** Starts a range at `frame`; false while a take holds the range still. */
    start(frame: number): boolean {
      if (options.locked?.() === true) return false
      from = options.snap(frame)
      setDraft(null)
      return true
    },
    move(event: { clientX: number }): void {
      if (from === null) return
      setDraft(studioRangeBetween(from, options.snap(options.frameAt(event))))
    },
    /** Release sets the range drawn and returns it; a cancel or a range too short sets none. */
    end(commit: boolean): StudioFrameRange | null {
      const drawn = from === null ? null : draft()
      from = null
      setDraft(null)
      if (!commit || drawn === null) return null
      options.commit(drawn)
      return drawn
    },
  }
}

/** What the ruler's range needs from the timeline: the frame under a pointer, snapping, and its props for the song, the playhead and where a drawn range goes. */
export function createStudioRangeTools(options: {
  frameAt(event: { clientX: number }): number
  scale(): number
  snapping(): boolean
  timeline: Pick<StudioTimelineProps, 'project' | 'playheadFrame' | 'onRange'>
}) {
  const timeline = options.timeline
  const tempoBpm = () =>
    timeline.project.ruler === 'bars' ? timeline.project.tempoBpm : undefined
  const snap = (frame: number) =>
    snapStudioPosition({
      value: frame,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      pixelsPerSecond: options.scale(),
      tempoBpm: tempoBpm(),
      playheadFrame: timeline.playheadFrame,
      clips: timeline.project.clips,
      excludeClipId: '',
      enabled: options.snapping(),
    }).value
  return {
    frameAt: options.frameAt,
    snap,
    /** The grid step the arrow keys move an end by. */
    step: () => studioGridInterval(options.scale(), tempoBpm()),
    draw: createStudioRangeDraw({
      frameAt: options.frameAt,
      snap,
      commit: (range) => timeline.onRange?.(range),
      locked: studioTakeRunning,
    }),
  }
}

export type StudioRangeTools = ReturnType<typeof createStudioRangeTools>

interface StudioRulerRangeProps {
  tools: StudioRangeTools
  range: StudioFrameRange | null
  /** Pixels per second. */
  scale: number
  /** The ruler's end: the furthest an end handle says it goes. */
  endFrame: number
  onChange(range: StudioFrameRange | null): void
}

/** Where each end of `range` can go, in seconds: past the other end by the shortest loop at least. */
function edgeBounds(
  range: StudioFrameRange,
  edge: 'start' | 'end',
  endFrame: number,
): { min: number; max: number } {
  return edge === 'start'
    ? { min: 0, max: range.endFrame - STUDIO_MIN_LOOP_FRAMES }
    : {
        min: range.startFrame + STUDIO_MIN_LOOP_FRAMES,
        max: Math.max(endFrame, range.endFrame),
      }
}

/** The range over the ruler: its band, a handle at each end, and a cross to clear it. */
export function StudioRulerRange(props: StudioRulerRangeProps) {
  const [moving, setMoving] = createSignal<StudioFrameRange | null>(null)
  const shown = () => moving() ?? props.tools.draw.draft() ?? props.range
  const handle = (edge: 'start' | 'end') => {
    const frame = () =>
      edge === 'start' ? shown()!.startFrame : shown()!.endFrame
    const bounds = () => edgeBounds(shown()!, edge, props.endFrame)
    const move = (to: number) =>
      props.range && setMoving(studioRangeEdge(props.range, edge, to))
    return (
      <span
        class={styles.handle}
        classList={{ [styles.end]: edge === 'end' }}
        role="slider"
        tabIndex={0}
        aria-label={edge === 'start' ? 'Range start' : 'Range end'}
        aria-valuemin={bounds().min / STUDIO_SAMPLE_RATE}
        aria-valuemax={bounds().max / STUDIO_SAMPLE_RATE}
        aria-valuenow={frame() / STUDIO_SAMPLE_RATE}
        aria-valuetext={formatStudioTime(frame())}
        data-studio-range-handle={edge}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.stopPropagation()
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            move(props.tools.snap(props.tools.frameAt(event)))
        }}
        onPointerUp={(event) => {
          event.stopPropagation()
          const moved = moving()
          setMoving(null)
          if (moved) props.onChange(moved)
        }}
        onPointerCancel={() => setMoving(null)}
        onKeyDown={(event) => {
          const direction =
            event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
          if (direction === 0 || !props.range) return
          event.preventDefault()
          event.stopPropagation()
          props.onChange(
            studioRangeEdge(
              props.range,
              edge,
              frame() + direction * props.tools.step(),
            ),
          )
        }}
      />
    )
  }
  return (
    <div class={styles.layer}>
      <Show when={shown()}>
        {(range) => (
          <span
            class={styles.range}
            classList={{
              [styles.draft]: props.range === null,
              [styles.narrow]:
                frameToPixel(
                  range().endFrame - range().startFrame,
                  props.scale,
                ) < 64,
            }}
            data-studio-range=""
            style={{
              left: `${frameToPixel(range().startFrame, props.scale)}px`,
              width: `${frameToPixel(range().endFrame - range().startFrame, props.scale)}px`,
            }}
          >
            <Show when={props.range && !studioTakeRunning()}>
              {handle('start')}
              {handle('end')}
              <button
                type="button"
                class={styles.clear}
                aria-label="Clear range"
                title="Clear range"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => props.onChange(null)}
              >
                <CrossSmall size={12} />
              </button>
            </Show>
          </span>
        )}
      </Show>
    </div>
  )
}

/** The range's tint down the lanes, under the clips' edges and the playhead. */
export function StudioRangeShade(props: {
  tools: StudioRangeTools
  range?: StudioFrameRange | null
  scale: number
}) {
  return (
    <Show when={props.tools.draw.draft() ?? props.range}>
      {(range) => (
        <div
          class={styles.shade}
          aria-hidden="true"
          style={{
            left: `calc(var(--studio-header-width) + ${frameToPixel(range().startFrame, props.scale)}px)`,
            width: `${frameToPixel(range().endFrame - range().startFrame, props.scale)}px`,
          }}
        />
      )}
    </Show>
  )
}
