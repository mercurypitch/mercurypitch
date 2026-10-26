// Studio timeline — one aligned scroll surface for real audio clips, source headers and silent seeking.
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { studioSourcePresentation } from './source-presentation'
import { StudioClipToolbar } from './StudioClipToolbar'
import styles from './StudioTimeline.module.css'
import { StudioTrackControls } from './StudioTrackControls'
import { StudioWaveform } from './StudioWaveform'
import { clipEndFrame, formatStudioTime, frameToPixel, pixelToFrame, studioContentEnd, studioPixelsPerSecond, studioRulerTicks, } from './timeline-geometry'
import type { StudioTimelineProps } from './types'
import { createStudioWaveformResource } from './waveform-resource'

export type { StudioTimelineProps } from './types'

export function StudioTimeline(props: StudioTimelineProps) {
  let viewport!: HTMLDivElement
  const [width, setWidth] = createSignal(800)
  const [scroll, setScroll] = createSignal(0)
  const headerWidth = () => (props.phone ? 96 : width() < 1050 ? 176 : 232)
  const contentWidth = () => Math.max(1, width() - headerWidth())
  const contentEnd = () => studioContentEnd(props.project.clips)
  const endFrame = () =>
    props.phone
      ? Math.max(STUDIO_SAMPLE_RATE, contentEnd())
      : Math.max(
          60 * STUDIO_SAMPLE_RATE,
          contentEnd() + 10 * STUDIO_SAMPLE_RATE,
        )
  const scale = () =>
    props.phone
      ? contentWidth() / (endFrame() / STUDIO_SAMPLE_RATE)
      : Math.min(
          studioPixelsPerSecond(props.pixelsPerSecond),
          8_000_000 / (endFrame() / STUDIO_SAMPLE_RATE),
        )
  const timeWidth = () =>
    Math.max(contentWidth(), frameToPixel(endFrame(), scale()))
  const assets = createMemo(
    () => new Map(props.assets.map((asset) => [asset.id, asset])),
  )
  const projectId = createMemo(() => props.project.id)
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  const ticks = () =>
    studioRulerTicks(
      scroll(),
      contentWidth(),
      scale(),
      endFrame(),
      props.project.ruler === 'bars' ? props.project.tempoBpm : undefined,
    )
  const resource = createMemo(() => {
    void projectId()
    const read = props.readCanonicalAsset
    const value = createStudioWaveformResource(read)
    onCleanup(value.dispose)
    return value
  })
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => setWidth(viewport.clientWidth))
  onCleanup(() => observer?.disconnect())

  function seekRuler(event: MouseEvent): void {
    const rect =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getBoundingClientRect()
        : null
    if (rect !== null)
      props.onSeek(pixelToFrame(event.clientX - rect.left, scale(), endFrame()))
  }

  return (
    <div
      class={styles.timeline}
      classList={{
        [styles.phone]: props.phone,
        [styles.tablet]: !props.phone && width() < 1050,
      }}
      aria-label="Song arrangement"
      style={{
        '--studio-header-width': `${headerWidth()}px`,
        '--studio-time-width': `${timeWidth()}px`,
      }}
    >
      <div
        class={styles.viewport}
        ref={(element) => {
          viewport = element
          setWidth(element.clientWidth || 800)
          observer?.observe(element)
        }}
        onScroll={() => setScroll(viewport.scrollLeft)}
      >
        <div class={styles.surface}>
          <div class={styles.rulerRow}>
            <div class={styles.corner}>
              <label>
                <span>
                  {props.project.ruler === 'bars' ? 'Beats' : 'Seconds'}
                </span>
                <input
                  type="number"
                  min="0"
                  max={endFrame() / STUDIO_SAMPLE_RATE}
                  step="0.001"
                  aria-label="Playhead in seconds"
                  value={(props.playheadFrame / STUDIO_SAMPLE_RATE).toFixed(3)}
                  onChange={(event) => {
                    const seconds = event.currentTarget.valueAsNumber
                    if (Number.isFinite(seconds))
                      props.onSeek(
                        Math.round(
                          Math.max(
                            0,
                            Math.min(endFrame() / STUDIO_SAMPLE_RATE, seconds),
                          ) * STUDIO_SAMPLE_RATE,
                        ),
                      )
                  }}
                />
              </label>
            </div>
            <div
              class={styles.ruler}
              role="slider"
              tabIndex={0}
              aria-label="Song playhead"
              aria-valuemin={0}
              aria-valuemax={endFrame() / STUDIO_SAMPLE_RATE}
              aria-valuenow={props.playheadFrame / STUDIO_SAMPLE_RATE}
              aria-valuetext={formatStudioTime(props.playheadFrame)}
              onClick={seekRuler}
              onKeyDown={(event) => {
                const direction =
                  event.key === 'ArrowLeft'
                    ? -1
                    : event.key === 'ArrowRight'
                      ? 1
                      : 0
                if (direction !== 0) {
                  event.preventDefault()
                  props.onSeek(
                    Math.max(
                      0,
                      Math.min(
                        endFrame(),
                        props.playheadFrame + direction * STUDIO_SAMPLE_RATE,
                      ),
                    ),
                  )
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault()
                  props.onSeek(event.key === 'Home' ? 0 : contentEnd())
                }
              }}
            >
              <For each={ticks()}>
                {(tick) => (
                  <span
                    class={styles.tick}
                    style={{ left: `${tick.pixel}px` }}
                    aria-hidden="true"
                  >
                    {tick.label}
                  </span>
                )}
              </For>
            </div>
          </div>
          <For each={trackIds()}>
            {(id) => {
              const track = () =>
                props.project.tracks.find((item) => item.id === id)!
              const clips = () =>
                props.project.clips.filter((clip) => clip.trackId === id)
              const source = () =>
                studioSourcePresentation(assets().get(clips()[0]?.assetId))
              const clipIds = createMemo(() => clips().map((clip) => clip.id))
              return (
                <div class={styles.lane} data-track-id={id}>
                  <div
                    class={styles.trackHeader}
                    style={{ '--studio-source': source().color }}
                  >
                    <button
                      type="button"
                      class={styles.trackName}
                      title={`${track().name} details`}
                      aria-label={`${track().name} details`}
                      onClick={() => props.onTrackDetails(id)}
                    >
                      {track().name}
                    </button>
                    <Show when={!props.phone}>
                      <p class={styles.sourceLabel}>{source().label}</p>
                      <StudioTrackControls
                        track={track()}
                        writable={props.writable}
                        tablet={width() < 1050}
                        onCommand={props.onCommand}
                      />
                    </Show>
                  </div>
                  <div
                    class={styles.laneAudio}
                    onClick={(event) => {
                      if (event.target === event.currentTarget)
                        props.onSelectClip(null)
                    }}
                  >
                    <For each={ticks()}>
                      {(tick) => (
                        <span
                          class={styles.gridLine}
                          style={{ left: `${tick.pixel}px` }}
                          aria-hidden="true"
                        />
                      )}
                    </For>
                    <For each={clipIds()}>
                      {(clipId) => {
                        const clip = () =>
                          props.project.clips.find(
                            (item) => item.id === clipId,
                          )!
                        const asset = () => assets().get(clip().assetId)
                        const left = () =>
                          frameToPixel(clip().startFrame, scale())
                        const right = () =>
                          frameToPixel(clipEndFrame(clip()), scale())
                        const visibleLeft = () => Math.max(left(), scroll())
                        const visibleRight = () =>
                          Math.min(right(), scroll() + contentWidth())
                        const title = () =>
                          asset()?.originalName ?? track().name
                        const selected = () => props.selectedClipId === clipId
                        return (
                          <Show when={visibleRight() > visibleLeft()}>
                            <button
                              type="button"
                              class={styles.clip}
                              classList={{ [styles.selectedClip]: selected() }}
                              aria-label={`${track().name}, ${title()}, ${formatStudioTime(clip().startFrame)} to ${formatStudioTime(clipEndFrame(clip()))}`}
                              aria-pressed={selected()}
                              style={{
                                left: `${left()}px`,
                                width: `${Math.max(1, right() - left())}px`,
                                '--studio-source':
                                  studioSourcePresentation(asset()).color,
                              }}
                              onClick={() => props.onSelectClip(clipId)}
                              onDblClick={() => props.onClipDetails(clipId)}
                            >
                              <span
                                class={styles.clipTitle}
                                style={{
                                  'padding-left': `${Math.max(8, visibleLeft() - left() + 8)}px`,
                                }}
                              >
                                {title()}
                              </span>
                              <span
                                class={styles.visibleWave}
                                style={{
                                  left: `${visibleLeft() - left()}px`,
                                  width: `${visibleRight() - visibleLeft()}px`,
                                }}
                              >
                                <StudioWaveform
                                  clip={clip()}
                                  asset={asset()}
                                  resource={resource()}
                                  sourceInFrame={
                                    clip().sourceInFrame +
                                    pixelToFrame(
                                      visibleLeft() - left(),
                                      scale(),
                                      clip().sourceOutFrame -
                                        clip().sourceInFrame,
                                    )
                                  }
                                  sourceOutFrame={
                                    clip().sourceInFrame +
                                    pixelToFrame(
                                      visibleRight() - left(),
                                      scale(),
                                      clip().sourceOutFrame -
                                        clip().sourceInFrame,
                                    )
                                  }
                                />
                              </span>
                            </button>
                          </Show>
                        )
                      }}
                    </For>
                    <Show
                      when={
                        !props.phone &&
                        clips().find((clip) => clip.id === props.selectedClipId)
                      }
                    >
                      {(selected) => (
                        <StudioClipToolbar
                          clip={selected()}
                          playheadFrame={props.playheadFrame}
                          writable={props.writable}
                          left={Math.max(
                            scroll() + 4,
                            Math.min(
                              frameToPixel(selected().startFrame, scale()),
                              scroll() + contentWidth() - 300,
                            ),
                          )}
                          onCommand={props.onCommand}
                          onDetails={() => props.onClipDetails(selected().id)}
                          onRemove={() => props.onSelectClip(null)}
                        />
                      )}
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
          <Show when={props.project.tracks.length === 0}>
            <div class={styles.empty}>Add a take to start your song.</div>
          </Show>
          <div
            class={styles.playhead}
            aria-hidden="true"
            style={{
              left: `calc(var(--studio-header-width) + ${frameToPixel(props.playheadFrame, scale())}px)`,
            }}
          />
        </div>
      </div>
      <Show when={props.selectedClipId !== null && props.phone}>
        <p class={styles.phoneNote}>Edit clips on a tablet or computer.</p>
      </Show>
    </div>
  )
}
