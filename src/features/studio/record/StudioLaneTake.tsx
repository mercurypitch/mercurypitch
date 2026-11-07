// Studio lane take — the armed lane's level and the take growing in its lane as it records, drawn only where the lane is in view.
//
// Each chunk the recorder hands over (about every 85 ms) adds peaks, and
// the columns they add are drawn (live-wave.ts): one canvas the width of
// the view, clipped to the take as it grows, and nothing at all once the
// take is out of view. No animation frame runs: a draw follows a chunk, a
// scroll or a zoom, and nothing else.
import { createEffect, createMemo, Show } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioLiveTake } from '@/lib/studio/record/studio-recorder'
import { studioPassTitle } from '@/lib/studio/record/take-passes'
import { MicSmall } from '../studio-icons'
import { frameToPixel } from '../timeline/timeline-geometry'
import { createStudioLiveWave } from './live-wave'
import { StudioInputMeter } from './StudioInputMeter'
import styles from './StudioRecord.module.css'

export interface StudioLaneTakeProps {
  live: StudioLiveTake | null
  level: number
  /** Show the level: armed, counting in or recording. */
  listening: boolean
  /** Pixels per second. */
  scale: number
  /** The view's left edge in the lane, in pixels. */
  scroll: number
  contentWidth: number
}

/**
 * The take's span on the timeline: from where its clip will start to what
 * has arrived, inside a punch's range. A loop shows the pass it records
 * now, over the range again each pass. `origin` is the song frame the
 * take's first sample is drawn on, and `pass` the pass shown, from 0.
 */
export function liveTakeSpan(live: StudioLiveTake): {
  from: number
  to: number
  origin: number
  pass: number
} {
  const from = Math.max(0, live.fromFrame ?? live.heardFirst)
  const arrived =
    (live.count * live.peaks.bucketFrames * STUDIO_SAMPLE_RATE) /
    live.sampleRate
  const reached = live.heardFirst + arrived
  const cut = live.cut ?? null
  if (cut === null)
    return {
      from,
      to: Math.max(from, reached),
      origin: live.heardFirst,
      pass: 0,
    }
  const { startFrame, endFrame } = cut.range
  if (cut.mode === 'punch')
    return {
      from,
      to: Math.max(from, Math.min(endFrame, reached)),
      origin: live.heardFirst,
      pass: 0,
    }
  const length = endFrame - startFrame
  const pass = Math.max(0, Math.floor((reached - startFrame) / length))
  const shift = pass * length
  return {
    from,
    to: Math.max(from, Math.min(endFrame, reached - shift)),
    origin: live.heardFirst - shift,
    pass,
  }
}

/**
 * The live take's name as its clip will show it, without the file's
 * extension ("Take 3", not "Take 3.wav"): a loop's with the pass it records.
 */
export function liveTakeName(live: StudioLiveTake): string {
  if (live.cut?.mode !== 'loop') return live.title
  return studioPassTitle(live.title, liveTakeSpan(live).pass)
}

export function StudioLaneTake(props: StudioLaneTakeProps) {
  let canvas: HTMLCanvasElement | undefined
  const wave = createStudioLiveWave()
  // A memo: the level does not move the take, and only a chunk, a scroll
  // or a zoom draws it.
  const box = createMemo(() => {
    const live = props.live
    if (live === null) return null
    const span = liveTakeSpan(live)
    const left = frameToPixel(span.from, props.scale)
    const width = frameToPixel(span.to - span.from, props.scale)
    const shownFrom = Math.max(left, props.scroll)
    const shownTo = Math.min(left + width, props.scroll + props.contentWidth)
    return { live, span, left, width, shownFrom, shownTo }
  })
  createEffect(() => {
    const shown = box()
    if (canvas === undefined || shown === null) return
    const width = Math.floor(shown.shownTo - shown.shownFrom)
    if (width <= 0) return
    const framesPerPixel = STUDIO_SAMPLE_RATE / props.scale
    wave.draw(canvas, {
      live: shown.live,
      origin: shown.span.origin,
      firstFrame:
        shown.span.from + (shown.shownFrom - shown.left) * framesPerPixel,
      framesPerPixel,
      width,
      viewWidth: Math.max(1, Math.ceil(props.contentWidth)),
    })
  })
  return (
    <>
      <Show when={box()}>
        {(shown) => (
          <div
            class={styles.liveTake}
            data-studio-live-take=""
            style={{ left: `${shown().left}px`, width: `${shown().width}px` }}
          >
            <Show when={shown().shownTo > shown().shownFrom}>
              <div
                class={styles.liveShown}
                style={{
                  left: `${shown().shownFrom - shown().left}px`,
                  width: `${Math.floor(shown().shownTo - shown().shownFrom)}px`,
                }}
              >
                <span class={styles.liveTitle}>
                  {liveTakeName(shown().live)}
                </span>
                <canvas
                  ref={(element) => {
                    canvas = element
                    wave.reset()
                  }}
                  class={styles.liveWave}
                  style={{ width: `${Math.ceil(props.contentWidth)}px` }}
                />
              </div>
            </Show>
          </div>
        )}
      </Show>
      <Show when={props.listening}>
        <span
          class={styles.laneMeter}
          data-studio-lane-meter=""
          style={{ left: `${props.scroll + 8}px` }}
        >
          <MicSmall />
          <StudioInputMeter level={props.level} />
        </span>
      </Show>
    </>
  )
}
