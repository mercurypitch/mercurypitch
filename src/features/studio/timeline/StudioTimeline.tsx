// Studio timeline — one aligned scroll surface for real audio clips, track headers and silent seeking.
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Index, on, onCleanup, Show, } from 'solid-js'
import { Plus } from '@/components/icons'
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { FitWidth, InfoCircle, ZoomIn, ZoomOut } from '../studio-icons'
import { StudioViewControls } from '../StudioViewControls'
import { studioSourcePresentation } from './source-presentation'
import { StudioClipToolbar } from './StudioClipToolbar'
import styles from './StudioTimeline.module.css'
import { StudioTimelineClip } from './StudioTimelineClip'
import { StudioTrackControls } from './StudioTrackControls'
import { formatStudioTime, frameToPixel, pixelToFrame, studioContentEnd, studioPixelsPerSecond, studioRulerTicks, } from './timeline-geometry'
import { studioTrackColor, studioTrackHue } from './track-hues'
import type { StudioTimelineProps } from './types'
import { useStudioPointer } from './useStudioPointer'
import { createStudioWaveformResource } from './waveform-resource'

export type { StudioTimelineNotice, StudioTimelineProps } from './types'

function TrackName(props: {
  id: string
  name: string
  source?: string
  onDetails(id: string): void
}) {
  return (
    <button
      type="button"
      class={styles.trackName}
      data-studio-track-header={props.id}
      title={`${props.name} details`}
      aria-label={`${props.name} details`}
      onClick={() => props.onDetails(props.id)}
    >
      <span class={styles.trackNameText}>{props.name}</span>
      <Show when={props.source}>
        {(source) => <span class={styles.sourceLabel}>{source()}</span>}
      </Show>
    </button>
  )
}

/** Zoom stops in pixels per second; Fit may land between them. */
export const STUDIO_ZOOM_STOPS = [10, 15, 20, 30, 40, 60, 80, 120, 160, 200]
/** How far a press on a playing song's ruler moves before it becomes a drag, in pixels. */
const RULER_DRAG_SLOP_PX = 4

export function StudioTimeline(props: StudioTimelineProps) {
  let viewport!: HTMLDivElement
  const [width, setWidth] = createSignal(800)
  const [gutter, setGutter] = createSignal(0)
  const [floor, setFloor] = createSignal(0)
  const [height, setHeight] = createSignal(400)
  const [scroll, setScroll] = createSignal(0)
  const [snap, setSnap] = createSignal(true)
  let lastFillerTap = -Infinity
  const headerWidth = () =>
    props.phone ? 104 : props.tablet === true ? 232 : 240
  // With the desk open, zoom and the clip bar leave the lanes for a dock.
  const docked = () => !props.phone && props.deskOpen === true
  const contentWidth = createMemo(() => Math.max(1, width() - headerWidth()))
  // Memos, not functions: every clip reads the scale and its own record on
  // every scroll step and in every waveform draw, and each read of a plain
  // function walked every clip of the song again.
  const contentEnd = createMemo(() => studioContentEnd(props.project.clips))
  const endFrame = createMemo(() =>
    props.phone
      ? // An empty song spans 30 s, so its ruler counts whole seconds.
        Math.max(STUDIO_SAMPLE_RATE, contentEnd() || 30 * STUDIO_SAMPLE_RATE)
      : Math.max(
          60 * STUDIO_SAMPLE_RATE,
          contentEnd() + 10 * STUDIO_SAMPLE_RATE,
        ),
  )
  const scale = createMemo(() =>
    props.phone
      ? // The end keeps room for the last ruler label.
        (contentWidth() - 32) / (endFrame() / STUDIO_SAMPLE_RATE)
      : Math.min(
          studioPixelsPerSecond(props.pixelsPerSecond),
          8_000_000 / (endFrame() / STUDIO_SAMPLE_RATE),
        ),
  )
  const timeWidth = createMemo(() =>
    Math.max(contentWidth(), frameToPixel(endFrame(), scale())),
  )
  const assets = createMemo(
    () => new Map(props.assets.map((asset) => [asset.id, asset])),
  )
  const tracks = createMemo(
    () => new Map(props.project.tracks.map((track) => [track.id, track])),
  )
  const clips = createMemo(
    () => new Map(props.project.clips.map((clip) => [clip.id, clip])),
  )
  const laneClips = createMemo(() => {
    const lanes = new Map<string, StudioClip[]>()
    for (const clip of props.project.clips) {
      const lane = lanes.get(clip.trackId)
      if (lane) lane.push(clip)
      else lanes.set(clip.trackId, [clip])
    }
    return lanes
  })
  const projectId = createMemo(() => props.project.id)
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  const selectedClip = () =>
    props.project.clips.find((item) => item.id === props.selectedClipId)
  const selectedTrack = () => {
    const clip = selectedClip()
    return clip
      ? props.project.tracks.find((track) => track.id === clip.trackId)
      : undefined
  }
  const selectedName = () => selectedTrack()?.name
  const selectedColor = () => {
    const track = selectedTrack()
    return track
      ? studioTrackColor(studioTrackHue(track, trackIds().indexOf(track.id)))
      : undefined
  }
  // A muted lane, or any lane outside an active solo, draws dimmed.
  const anySolo = createMemo(() =>
    props.project.tracks.some((track) => track.solo),
  )
  // Read three times a scroll step: the labels, the grid and its minor ticks.
  const ticks = createMemo(() =>
    studioRulerTicks(
      scroll(),
      contentWidth(),
      scale(),
      endFrame(),
      props.project.ruler === 'bars' ? props.project.tempoBpm : undefined,
    ),
  )
  // Grid and minor ticks are drawn by CSS from the major tick spacing.
  const major = () => {
    const [first, second] = ticks()
    return second === undefined ? 80 : second.pixel - first.pixel
  }
  const minorCount = () => {
    const [first, second] = ticks()
    if (props.project.ruler === 'bars' || second === undefined) return 4
    const seconds = (second.frame - first.frame) / STUDIO_SAMPLE_RATE
    const lead = seconds / Math.pow(10, Math.floor(Math.log10(seconds)))
    return Math.round(lead) === 5 ? 5 : 4
  }
  const resource = createMemo(() => {
    void projectId()
    const read = props.readCanonicalAsset
    const value = createStudioWaveformResource(read)
    onCleanup(value.dispose)
    return value
  })
  const pointer = useStudioPointer(props, {
    viewport: () => viewport,
    scale,
    width,
    headerWidth,
    snap,
  })
  // Gesture results and notices stay readable to assistive tech; the visible pill fades.
  const [statusText, setStatusText] = createSignal('')
  const [statusShown, setStatusShown] = createSignal(false)
  let statusTimer: ReturnType<typeof setTimeout> | undefined

  function showStatus(message: string): void {
    clearTimeout(statusTimer)
    setStatusText(message)
    setStatusShown(message !== '')
    if (message !== '')
      statusTimer = setTimeout(() => setStatusShown(false), 4000)
  }
  createEffect(on(pointer.message, showStatus))
  createEffect(
    on(
      () => props.notice,
      (notice) => {
        if (notice) showStatus(notice.text)
      },
      { defer: true },
    ),
  )
  onCleanup(() => clearTimeout(statusTimer))
  // Seven docked buttons stack in one column when the arrangement is tall
  // enough (the sizes in .dock), and go two to a row when it is not.
  const dockColumns = () =>
    height() + floor() >= (props.tablet === true ? 7 * 44 + 4 : 7 * 30 + 26)
      ? 1
      : 2
  const measure = () => {
    setWidth(viewport.clientWidth)
    setGutter(viewport.offsetWidth - viewport.clientWidth)
    setFloor(viewport.offsetHeight - viewport.clientHeight)
    setHeight(viewport.clientHeight)
  }
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
  onCleanup(() => observer?.disconnect())

  // Dragging along the ruler scrubs. A stopped song follows the pointer. A
  // playing one jumps where the press lands, at once, as a DAW's does; a
  // drag from there moves its playhead line and jumps again on release, so
  // it does not jump under every pointer move.
  const [scrubFrame, setScrubFrame] = createSignal<number | null>(null)
  const shownPlayhead = () => scrubFrame() ?? props.playheadFrame
  let press: { x: number; dragged: boolean } | null = null

  function rulerFrame(event: PointerEvent, ruler: HTMLElement): number {
    const rect = ruler.getBoundingClientRect()
    return pixelToFrame(event.clientX - rect.left, scale(), endFrame())
  }

  function scrubTo(event: PointerEvent, ruler: HTMLElement): void {
    const frame = rulerFrame(event, ruler)
    setScrubFrame(frame)
    if (props.playing !== true) props.onSeek(frame)
  }

  function pressRuler(event: PointerEvent, ruler: HTMLElement): void {
    press = { x: event.clientX, dragged: false }
    if (props.playing === true) props.onSeek(rulerFrame(event, ruler))
    else scrubTo(event, ruler)
  }

  function dragRuler(event: PointerEvent, ruler: HTMLElement): void {
    if (!press) return
    // A hand that stays put on a playing song already jumped it on the press.
    const near = Math.abs(event.clientX - press.x) < RULER_DRAG_SLOP_PX
    if (props.playing === true && !press.dragged && near) return
    press.dragged = true
    scrubTo(event, ruler)
  }

  function endScrub(commit: boolean): void {
    const frame = scrubFrame()
    press = null
    setScrubFrame(null)
    if (commit && frame !== null) props.onSeek(frame)
  }

  function zoomStep(direction: 1 | -1): void {
    const current = props.pixelsPerSecond
    const next =
      direction > 0
        ? STUDIO_ZOOM_STOPS.find((stop) => stop > current + 0.5)
        : [...STUDIO_ZOOM_STOPS].reverse().find((stop) => stop < current - 0.5)
    if (next !== undefined) props.onZoom?.(next)
  }

  function zoomToFit(): void {
    const seconds = Math.max(1, contentEnd() / STUDIO_SAMPLE_RATE + 1)
    // Fit may go below the first zoom stop: a long song must still fit. It
    // rounds down to a tenth, so a narrow window is filled, not three-quarters.
    const fit = Math.floor(((contentWidth() - 24) / seconds) * 10) / 10
    props.onZoom?.(
      Math.max(
        1,
        Math.min(STUDIO_ZOOM_STOPS[STUDIO_ZOOM_STOPS.length - 1], fit),
      ),
    )
    viewport.scrollLeft = 0
  }

  // Zoom floats at the arrangement's foot, or heads the dock beside it.
  const zoomControls = (place?: JSX.CSSProperties) => (
    <div
      class={styles.zoom}
      role="group"
      aria-label="Timeline zoom"
      style={place}
    >
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={props.pixelsPerSecond <= STUDIO_ZOOM_STOPS[0]}
        onClick={() => zoomStep(-1)}
      >
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={
          props.pixelsPerSecond >=
          STUDIO_ZOOM_STOPS[STUDIO_ZOOM_STOPS.length - 1]
        }
        onClick={() => zoomStep(1)}
      >
        <ZoomIn size={15} />
      </button>
      <button
        type="button"
        aria-label="Fit song to width"
        title="Fit song to width"
        disabled={props.project.clips.length === 0}
        onClick={zoomToFit}
      >
        <FitWidth size={15} />
      </button>
    </div>
  )
  // A floating bar steps aside during a drag; a docked one covers nothing.
  const clipBar = (inDock: boolean) => (
    <Show
      when={
        !props.phone &&
        (inDock || (!pointer.active() && props.drawerOpen !== true)) &&
        selectedClip()
      }
    >
      {(selected) => (
        <StudioClipToolbar
          clip={selected()}
          label={selectedName() ?? 'Clip'}
          color={selectedColor()}
          left={headerWidth() + 12}
          bottom={floor() + 12}
          docked={inDock}
          playheadFrame={props.playheadFrame}
          writable={props.writable}
          onCommand={props.onCommand}
          onDetails={() => props.onClipDetails(selected().id)}
          onRemove={() => props.onSelectClip(null)}
        />
      )}
    </Show>
  )

  return (
    <div
      class={styles.timeline}
      classList={{
        [styles.phone]: props.phone,
        [styles.tablet]: !props.phone && props.tablet === true,
        [styles.editing]: pointer.active(),
        [styles.docking]: docked(),
      }}
      aria-label="Song arrangement"
      data-tour={props.phone ? 'studio.timeline-overview' : 'studio.timeline'}
      data-studio-scale={scale()}
      style={{
        '--studio-header-width': `${headerWidth()}px`,
        '--studio-time-width': `${timeWidth()}px`,
        '--studio-major': `${major()}px`,
        '--studio-minor': `${major() / minorCount()}px`,
        // A phone overview shares its height among the lanes.
        '--studio-row-height': props.phone
          ? `${Math.max(64, Math.min(112, Math.floor((height() - 32) / Math.max(1, props.project.tracks.length))))}px`
          : undefined,
      }}
    >
      <div
        class={styles.viewport}
        data-studio-timeline-viewport=""
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
              <Show when={!props.phone}>
                <StudioViewControls
                  project={props.project}
                  writable={props.writable}
                  snap={snap()}
                  onSnap={setSnap}
                  onCommand={props.onCommand}
                />
              </Show>
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
              onPointerDown={(event) => {
                if (event.button !== 0) return
                const ruler = event.currentTarget
                event.preventDefault()
                ruler.focus({ preventScroll: true })
                ruler.setPointerCapture(event.pointerId)
                pressRuler(event, ruler)
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  dragRuler(event, event.currentTarget)
              }}
              onPointerUp={() => endScrub(true)}
              onPointerCancel={() => endScrub(false)}
              onLostPointerCapture={() => endScrub(true)}
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
              {/* By position: a scroll moves the same labels, it does not make new ones. */}
              <Index each={ticks()}>
                {(tick) => (
                  <span
                    class={styles.tick}
                    style={{ left: `${tick().pixel}px` }}
                    aria-hidden="true"
                  >
                    {tick().label}
                  </span>
                )}
              </Index>
              <span
                class={styles.playheadCap}
                aria-hidden="true"
                style={{
                  transform: `translateX(${frameToPixel(shownPlayhead(), scale())}px)`,
                }}
              />
            </div>
          </div>
          <For each={trackIds()}>
            {(id, index) => {
              const track = () => tracks().get(id)!
              const lane = () => laneClips().get(id) ?? []
              const color = createMemo(() =>
                studioTrackColor(studioTrackHue(track(), index())),
              )
              const source = () =>
                studioSourcePresentation(assets().get(lane()[0]?.assetId))
              const clipIds = createMemo(
                () => lane().map((clip) => clip.id),
                [],
                {
                  equals: (before, after) =>
                    before.length === after.length &&
                    before.every((clipId, at) => clipId === after[at]),
                },
              )
              return (
                <div
                  class={styles.lane}
                  data-track-id={id}
                  data-studio-track={id}
                  data-selected={props.selectedTrackId === id ? '' : undefined}
                  data-silent={
                    track().mute || (anySolo() && !track().solo)
                      ? ''
                      : undefined
                  }
                  style={{ '--studio-track': color() }}
                >
                  <div class={styles.trackHeader}>
                    <Show
                      when={!props.phone}
                      fallback={
                        <TrackName
                          id={id}
                          name={track().name}
                          onDetails={props.onTrackDetails}
                        />
                      }
                    >
                      <StudioTrackControls
                        track={track()}
                        writable={props.writable}
                        tablet={props.tablet === true}
                        soloedOut={anySolo() && !track().solo}
                        onCommand={props.onCommand}
                        identity={
                          <TrackName
                            id={id}
                            name={track().name}
                            source={source().label}
                            onDetails={props.onTrackDetails}
                          />
                        }
                      />
                    </Show>
                  </div>
                  <div
                    class={styles.laneAudio}
                    data-studio-lane-audio=""
                    onClick={(event) => {
                      if (event.target !== event.currentTarget) return
                      props.onSelectClip(null)
                      props.onSelectTrack?.(id)
                    }}
                  >
                    <For each={clipIds()}>
                      {(clipId) => {
                        const clip = () => clips().get(clipId)!
                        return (
                          <StudioTimelineClip
                            clip={clip()}
                            asset={assets().get(clip().assetId)}
                            keyboardPreview={props.keyboardPreviewClip}
                            trackName={track().name}
                            selected={props.selectedClipId === clipId}
                            writable={props.writable}
                            phone={props.phone}
                            tablet={props.tablet === true}
                            scale={scale()}
                            scroll={scroll()}
                            contentWidth={contentWidth()}
                            color={color()}
                            pointer={pointer}
                            resource={resource()}
                            onSelect={() => props.onSelectClip(clipId)}
                            onDetails={() => props.onClipDetails(clipId)}
                          />
                        )
                      }}
                    </For>
                  </div>
                </div>
              )
            }}
          </For>
          <Show when={!props.phone && props.project.tracks.length > 0}>
            <div
              class={styles.newLane}
              data-studio-new-lane=""
              aria-label="New lane"
            >
              <Show
                when={props.onNewLane}
                fallback={
                  <span class={styles.newLaneLabel}>
                    <Plus size={14} />
                    New lane
                  </span>
                }
              >
                {(add) => (
                  <button
                    type="button"
                    class={styles.newLaneLabel}
                    onClick={() => add()()}
                  >
                    <Plus size={14} />
                    New lane
                  </button>
                )}
              </Show>
              <span class={styles.newLaneDrop}>
                <span>
                  {pointer.active()
                    ? 'Drop here to start a new lane'
                    : 'Drag a clip here to give it its own lane'}
                </span>
              </span>
            </div>
          </Show>
          <div class={styles.filler} aria-hidden="true">
            <span
              class={styles.fillerHeader}
              data-studio-new-lane-area=""
              title={
                props.onNewLane ? 'Double-click for a new lane' : undefined
              }
              onPointerUp={(event) => {
                // Double-click with a mouse, double-tap with a finger: the
                // browser's dblclick is unreliable on touch screens.
                if (!props.onNewLane || event.button !== 0) return
                if (event.timeStamp - lastFillerTap < 400) {
                  lastFillerTap = -Infinity
                  props.onNewLane()
                } else lastFillerTap = event.timeStamp
              }}
            />
          </div>
          <Show
            when={
              pointer.draft()?.snapFrame !== null &&
              pointer.draft()?.snapFrame !== undefined
            }
          >
            <div
              class={styles.snapLine}
              aria-hidden="true"
              style={{
                left: `calc(var(--studio-header-width) + ${frameToPixel(pointer.draft()!.snapFrame!, scale())}px)`,
              }}
            />
          </Show>
          <Show when={props.project.tracks.length > 0}>
            <div
              class={styles.playhead}
              aria-hidden="true"
              style={{
                transform: `translateX(${frameToPixel(shownPlayhead(), scale())}px)`,
              }}
            />
          </Show>
        </div>
        <Show
          when={props.project.tracks.length === 0 && props.drawerOpen !== true}
        >
          <div class={styles.empty}>
            <svg
              class={styles.emptyArt}
              viewBox="0 0 160 72"
              aria-hidden="true"
            >
              <rect x="0" y="4" width="92" height="16" rx="3" />
              <rect x="28" y="28" width="132" height="16" rx="3" />
              <rect x="52" y="52" width="64" height="16" rx="3" />
            </svg>
            <p>Add a take to start your song.</p>
            <Show when={props.onAddTakes}>
              {(add) => (
                <button
                  type="button"
                  class={styles.emptyAction}
                  disabled={!props.writable}
                  onClick={() => add()()}
                >
                  <Plus size={16} /> Add takes
                </button>
              )}
            </Show>
          </div>
        </Show>
      </div>
      <Show
        when={docked()}
        fallback={
          <>
            <Show when={!props.phone}>
              {zoomControls({
                right: `${gutter() + 12}px`,
                bottom: `${floor() + 12}px`,
              })}
            </Show>
            {clipBar(false)}
          </>
        }
      >
        <div
          class={styles.dock}
          classList={{ [styles.dockPaired]: dockColumns() === 2 }}
          data-studio-dock=""
          style={{ '--studio-dock-columns': dockColumns() }}
        >
          {zoomControls()}
          {clipBar(true)}
        </div>
      </Show>
      <p
        class={styles.status}
        classList={{ [styles.statusVisible]: statusShown() }}
        role="status"
        aria-live="polite"
      >
        {statusText()}
      </p>
      <Show when={props.phone && selectedName()}>
        {(name) => (
          <p class={styles.phoneNote}>
            <InfoCircle size={16} />
            <strong>{name()}</strong>
            <span>Edit clips on a tablet or computer.</span>
          </p>
        )}
      </Show>
    </div>
  )
}
