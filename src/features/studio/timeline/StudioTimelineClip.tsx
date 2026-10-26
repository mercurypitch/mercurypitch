// Studio clip surface — stable focus, viewport-bounded waveforms and separate pointer handles.
import { Show } from 'solid-js'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import type { StudioGestureKind } from './gesture-draft'
import { studioSourcePresentation } from './source-presentation'
import styles from './StudioTimeline.module.css'
import { StudioWaveform } from './StudioWaveform'
import { clipEndFrame, formatStudioTime, frameToPixel, pixelToFrame, } from './timeline-geometry'
import type { StudioPointerEditor } from './useStudioPointer'
import type { StudioWaveformResource } from './waveform-resource'

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
  pointer: StudioPointerEditor
  resource: StudioWaveformResource
  onSelect(): void
  onDetails(): void
}

export function StudioTimelineClip(props: StudioTimelineClipProps) {
  const ownDraft = () =>
    props.pointer.draft()?.clip.id === props.clip.id
      ? props.pointer.draft()
      : null
  const clip = () =>
    ownDraft()?.clip ??
    (props.keyboardPreview?.id === props.clip.id
      ? props.keyboardPreview
      : props.clip)
  const left = () => frameToPixel(clip().startFrame, props.scale)
  const right = () => frameToPixel(clipEndFrame(clip()), props.scale)
  const visibleLeft = () => Math.max(left(), props.scroll)
  const visibleRight = () =>
    Math.min(right(), props.scroll + props.contentWidth)
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
    handles() && (fadePosition('out') - fadePosition('in') >= handleSize() || ownDraft()?.kind === 'fade-in' || ownDraft()?.kind === 'fade-out')
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
        style={{
          '--studio-source': studioSourcePresentation(props.asset).color,
        }}
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
          {title()}
        </span>
        <Show when={visibleRight() > visibleLeft()}>
          <span
            class={styles.visibleWave}
            style={{
              left: `${visibleLeft() - left()}px`,
              width: `${visibleRight() - visibleLeft()}px`,
            }}
          >
            <StudioWaveform
              clip={clip()}
              asset={props.asset}
              resource={props.resource}
              sourceInFrame={
                clip().sourceInFrame +
                pixelToFrame(
                  visibleLeft() - left(),
                  props.scale,
                  clip().sourceOutFrame - clip().sourceInFrame,
                )
              }
              sourceOutFrame={
                clip().sourceInFrame +
                pixelToFrame(
                  visibleRight() - left(),
                  props.scale,
                  clip().sourceOutFrame - clip().sourceInFrame,
                )
              }
            />
          </span>
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
