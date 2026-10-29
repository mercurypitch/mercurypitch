// Studio clip surface — stable focus, viewport-bounded waveforms in the lane's hue and separate pointer handles.
//
// Every clip of the song hears every scroll step, so what a step changes is
// a memo of plain arithmetic, and a clip whose drawn span stays the same
// changes nothing. The drawn span snaps outward to a 512 px grid: a clip that
// runs off the edge of the view redraws once per 512 px of scrolling, not on
// every step.
import { createMemo, Show } from 'solid-js'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import type { StudioGestureKind } from './gesture-draft'
import styles from './StudioTimeline.module.css'
import { StudioWaveform } from './StudioWaveform'
import { clipEndFrame, formatStudioTime, frameToPixel, pixelToFrame, } from './timeline-geometry'
import type { StudioPointerEditor } from './useStudioPointer'
import type { StudioWaveformResource } from './waveform-resource'

// The title band names the take; the file's extension adds nothing there.
const AUDIO_EXTENSION = /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|aiff?)$/i
/** The drawn span's grid, in CSS pixels: a scroll redraws a clip once per this much. */
export const STUDIO_WAVE_SPAN_GRID = 512

/** The part of a clip to draw, from its own left edge: the view's part, widened to the grid. */
export function studioWaveSpan(
  clipWidth: number,
  viewFrom: number,
  viewTo: number,
): { from: number; to: number } | null {
  const from = Math.max(0, viewFrom)
  const to = Math.min(clipWidth, viewTo)
  if (to <= from) return null
  return {
    from: Math.floor(from / STUDIO_WAVE_SPAN_GRID) * STUDIO_WAVE_SPAN_GRID,
    to: Math.min(
      clipWidth,
      Math.ceil(to / STUDIO_WAVE_SPAN_GRID) * STUDIO_WAVE_SPAN_GRID,
    ),
  }
}

interface StudioTimelineClipProps {
  clip: StudioClip
  keyboardPreview?: StudioClip | null
  asset?: StudioAsset
  trackName: string
  selected: boolean
  writable: boolean
  phone: boolean
  tablet: boolean
  scale: number
  scroll: number
  contentWidth: number
  /** The lane's colour: its waveform reads the drawn colour again when it changes. */
  color?: string
  pointer: StudioPointerEditor
  resource: StudioWaveformResource
  onSelect(): void
  onDetails(): void
}

export function StudioTimelineClip(props: StudioTimelineClipProps) {
  const ownDraft = createMemo(() => {
    const draft = props.pointer.draft()
    return draft?.clip.id === props.clip.id ? draft : null
  })
  const clip = createMemo(() => {
    const saved = props.clip
    const preview = props.keyboardPreview
    return ownDraft()?.clip ?? (preview?.id === saved.id ? preview : saved)
  })
  const left = createMemo(() => frameToPixel(clip().startFrame, props.scale))
  const right = createMemo(() =>
    frameToPixel(clipEndFrame(clip()), props.scale),
  )
  // The title stays readable at the view's left edge.
  const visibleLeft = createMemo(() => Math.max(left(), props.scroll))
  const span = createMemo(
    () =>
      studioWaveSpan(
        right() - left(),
        props.scroll - left(),
        props.scroll + props.contentWidth - left(),
      ),
    null,
    {
      equals: (before, after) =>
        before?.from === after?.from && before?.to === after?.to,
    },
  )
  const sourceFrame = (pixel: number) =>
    clip().sourceInFrame +
    pixelToFrame(
      pixel,
      props.scale,
      clip().sourceOutFrame - clip().sourceInFrame,
    )
  const title = () => props.asset?.originalName ?? props.trackName
  const handleSize = () => (props.tablet ? 44 : 28)
  const handles = () =>
    !props.phone &&
    props.selected &&
    props.writable &&
    props.asset !== undefined &&
    (right() - left() >= handleSize() * 2 || ownDraft() !== null)
  const fadePosition = (kind: 'in' | 'out') => {
    const source =
      kind === 'in'
        ? (clip().fades.in?.toSourceFrame ?? clip().sourceInFrame)
        : (clip().fades.out?.fromSourceFrame ?? clip().sourceOutFrame)
    return frameToPixel(
      Math.max(
        0,
        Math.min(
          clip().sourceOutFrame - clip().sourceInFrame,
          source - clip().sourceInFrame,
        ),
      ),
      props.scale,
    )
  }
  const fadeHandles = () =>
    handles() &&
    (fadePosition('out') - fadePosition('in') >= handleSize() ||
      ownDraft()?.kind === 'fade-in' ||
      ownDraft()?.kind === 'fade-out')
  const start = (event: PointerEvent, kind: StudioGestureKind) =>
    props.pointer.start(event, props.clip, kind)
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (event.detail === 0) props.onDetails()
  }
  return (
    <div
      class={styles.clipShell}
      classList={{
        [styles.draggingClip]: ownDraft() !== null,
        [styles.invalidClip]: ownDraft()?.valid === false,
      }}
      style={{
        left: `${left()}px`,
        width: `${Math.max(1, right() - left())}px`,
        transform: ownDraft()
          ? `translateY(${props.pointer.offsetY()}px)`
          : undefined,
      }}
    >
      <button
        type="button"
        class={styles.clip}
        classList={{
          [styles.selectedClip]: props.selected,
          [styles.editableClip]:
            props.selected && props.writable && !props.phone,
        }}
        data-studio-clip={props.clip.id}
        data-clip-id={props.clip.id}
        aria-label={`${props.trackName}, ${title()}, ${formatStudioTime(clip().startFrame)} to ${formatStudioTime(clipEndFrame(clip()))}`}
        aria-pressed={props.selected}
        onPointerDown={(event) => start(event, 'move')}
        onClick={(event) => {
          if (!props.pointer.suppressClick(event)) props.onSelect()
        }}
        onDblClick={() => props.onDetails()}
      >
        <span
          class={styles.clipTitle}
          style={{
            'padding-left': `${Math.max(8, visibleLeft() - left() + 8)}px`,
          }}
        >
          {title().replace(AUDIO_EXTENSION, '')}
        </span>
        <Show when={span()}>
          {(drawn) => (
            <span
              class={styles.visibleWave}
              style={{
                left: `${drawn().from}px`,
                width: `${drawn().to - drawn().from}px`,
              }}
            >
              <StudioWaveform
                clip={clip()}
                asset={props.asset}
                resource={props.resource}
                width={drawn().to - drawn().from}
                color={props.color}
                sourceInFrame={sourceFrame(drawn().from)}
                sourceOutFrame={sourceFrame(drawn().to)}
              />
            </span>
          )}
        </Show>
      </button>
      <Show when={handles()}>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.trimHead}`}
          aria-label="Trim start"
          title="Trim start. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'trim-head')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.trimTail}`}
          aria-label="Trim end"
          title="Trim end. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'trim-tail')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
      </Show>
      <Show when={fadeHandles()}>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.fadeHandle}`}
          style={{ left: `${fadePosition('in')}px` }}
          aria-label="Fade in"
          title="Fade in. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'fade-in')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`${styles.editHandle} ${styles.fadeHandle}`}
          style={{ left: `${fadePosition('out')}px` }}
          aria-label="Fade out"
          title="Fade out. Use Details for a numeric edit."
          onPointerDown={(event) => start(event, 'fade-out')}
          onClick={handleClick}
        >
          <span aria-hidden="true" />
        </button>
      </Show>
    </div>
  )
}
