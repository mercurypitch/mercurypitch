// Studio timeline — one aligned scroll surface for real audio clips, track headers and silent seeking.
import { createEffect, createMemo, createSignal, For, Index, on, onCleanup, Show, untrack, } from 'solid-js'
import { Plus } from '@/components/icons'
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { setStudioRecordCardAside } from '../record/record-card-aside'
import { StudioRecordLane } from '../record/StudioRecordLane'
import { studioTakeRunning } from '../record/take-running'
import { StudioViewControls } from '../StudioViewControls'
import { studioLaneHeight } from './lane-height'
import { studioLaneLinesRequest } from './lane-lines-request'
import { attachStudioLaneNavigation } from './lane-navigation'
import { createStudioLineEditor } from './line-editor'
import { createStudioPlayheadMotion } from './playhead-motion'
import { createStudioRulerGesture } from './ruler-gesture'
import { publishStudioScrubGrid } from './scrub-step'
import { StudioClipToolbar } from './StudioClipToolbar'
import { StudioLineBar } from './StudioLineBar'
import { StudioPhoneClipNote } from './StudioPhoneClipNote'
import { createStudioRangeTools, StudioRangeShade, StudioRulerRange, } from './StudioRulerRange'
import styles from './StudioTimeline.module.css'
import type { StudioLaneView } from './StudioTimelineLane'
import { StudioTimelineLane } from './StudioTimelineLane'
import { StudioZoomControls } from './StudioZoomControls'
import type { StudioRulerTick } from './timeline-geometry'
import { formatStudioTime, frameToPixel, pixelToFrame, studioAriaSeconds, studioContentEnd, studioPixelsPerSecond, studioRulerKeyFrame, studioRulerTicks, } from './timeline-geometry'
import { studioTrackColor, studioTrackHue } from './track-hues'
import type { StudioTimelineProps } from './types'
import { useStudioPointer } from './useStudioPointer'
import { createStudioWaveformResource } from './waveform-resource'
import { createStudioZoom } from './zoom-control'
import { installStudioZoomKeys } from './zoom-keys'
import { roundStudioZoom, studioFitZoom, studioZoomFloor } from './zoom-math'

export type { StudioTimelineNotice, StudioTimelineProps } from './types'

export function StudioTimeline(props: StudioTimelineProps) {
  let viewport!: HTMLDivElement
  const [width, setWidth] = createSignal(800)
  const [gutter, setGutter] = createSignal(0)
  const [floor, setFloor] = createSignal(0)
  const [height, setHeight] = createSignal(400)
  const [scroll, setScroll] = createSignal(0)
  const [snap, setSnap] = createSignal(true)
  let lastFillerTap = -Infinity
  // A header holds the lane's instrument chip, its name, the arm, Mute and
  // Solo, on a tablet under the name; a tall lane adds its lines, fader and
  // knob, which want a wider tablet header. A phone's holds the glyph and name.
  // The ruler's corner is as wide: a tablet's needs 224 px for Snap, Time and
  // Beats and the tempo, each 44 px wide.
  const tall = () => !props.phone && studioLaneHeight() === 'tall'
  const headerWidth = () =>
    props.phone ? 88 : props.tablet === true ? (tall() ? 256 : 224) : 240
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
  // A phone opens on the whole song, its end clear of the last ruler label;
  // zoomed in, it scrolls as a tablet does.
  const [phoneFit, setPhoneFit] = createSignal(true)
  const phoneFitScale = () =>
    (contentWidth() - 32) / (endFrame() / STUDIO_SAMPLE_RATE)
  const scale = createMemo(() => {
    const zoomed = Math.min(
      studioPixelsPerSecond(props.pixelsPerSecond),
      8_000_000 / (endFrame() / STUDIO_SAMPLE_RATE),
    )
    if (!props.phone) return zoomed
    return phoneFit() ? phoneFitScale() : Math.max(phoneFitScale(), zoomed)
  })
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
  // Grid and minor ticks are drawn by CSS from the major tick spacing: from
  // the step in frames, so it stays the same number at every scroll position.
  const major = createMemo(() => {
    const [first, second] = ticks()
    return second === undefined
      ? 80
      : frameToPixel(second.frame - first.frame, scale())
  })
  // A fixed set of label slots for the zoom: a scroll fills them again and
  // hides the spare ones. It never adds or removes an element, because each
  // one costs a style pass over the whole page (a :has() rule in the app's
  // stylesheets watches every insertion).
  const tickSlots = createMemo(
    () =>
      Array.from(
        {
          length: Math.min(
            100,
            Math.max(ticks().length, Math.floor(contentWidth() / major()) + 2),
          ),
        },
        (_, slot) => slot,
      ),
    [],
    { equals: (before, after) => before.length === after.length },
  )
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
    const value = createStudioWaveformResource(read, props.assetPeaks)
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
  // One lane's volume or pan line is open at a time (line-editor.ts). A
  // chosen clip, the lane going or another song closes it. A take holds it.
  // On a phone, an armed lane's line bar stands where the record card
  // floats, which steps aside for it; a take closes the line there, so the
  // card is back for the count-in and after the take.
  const lines = createStudioLineEditor(studioTakeRunning)
  createEffect(
    on(
      studioTakeRunning,
      (running) => {
        if (running && props.phone) lines.close()
      },
      { defer: true },
    ),
  )
  createEffect(() =>
    setStudioRecordCardAside(props.phone && lines.view() !== null),
  )
  onCleanup(() => setStudioRecordCardAside(false))
  const lineTrack = () => {
    const open = lines.view()
    return open ? tracks().get(open.trackId) : undefined
  }
  createEffect(
    on(
      () => props.selectedClipId,
      (id) => {
        if (id !== null) lines.close()
      },
      { defer: true },
    ),
  )
  createEffect(() => {
    if (lines.view() && !lineTrack()) untrack(lines.close)
  })
  createEffect(on(projectId, () => lines.close(), { defer: true }))
  // A lane's details open its lines when its header has no toggle for them.
  createEffect(
    on(
      studioLaneLinesRequest,
      (request) => {
        const track = request ? tracks().get(request.trackId) : undefined
        if (!track || lines.held()) return
        props.onSelectClip(null)
        props.onSelectTrack?.(track.id)
        lines.open(track)
      },
      { defer: true },
    ),
  )
  // A phone overview shares its height among the lanes.
  const phoneRow = () =>
    Math.max(
      56,
      Math.min(
        112,
        Math.floor((height() - 48) / Math.max(1, props.project.tracks.length)),
      ),
    )
  const lane: StudioLaneView = {
    assets,
    clips,
    scale,
    scroll,
    contentWidth,
    timeWidth,
    anySolo,
    snap,
    pointer,
    resource,
    lines,
    tall,
    status: showStatus,
  }
  // The docked buttons, zoom's four (with Tall lanes) and the clip bar's four
  // or the line bar's five, stack in one column when the arrangement is tall
  // enough (the sizes in .dock), go two to a row when it is not, and four
  // beside as little as one compact lane, where the desk can leave it.
  const dockColumns = () => {
    const bar = lineTrack() ? 5 : 4
    const fits = (columns: number) => {
      const rows = Math.ceil(4 / columns) + Math.ceil(bar / columns)
      return (
        height() + floor() >=
        (props.tablet === true ? rows * 44 + 4 : rows * 32 + 12)
      )
    }
    return fits(1) ? 1 : fits(2) ? 2 : 4
  }
  const measure = () => {
    setWidth(viewport.clientWidth)
    setGutter(viewport.offsetWidth - viewport.clientWidth)
    setFloor(viewport.offsetHeight - viewport.clientHeight)
    setHeight(viewport.clientHeight)
  }
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
  onCleanup(() => observer?.disconnect())

  // A click on the ruler seeks, a drag draws the range, and the playhead's
  // handle scrubs (ruler-gesture.ts). The range snaps as a clip's edge does.
  let ruler!: HTMLDivElement
  const rulerFrame = (event: { clientX: number }) =>
    pixelToFrame(
      event.clientX - ruler.getBoundingClientRect().left,
      scale(),
      endFrame(),
    )
  const range = createStudioRangeTools({
    frameAt: rulerFrame,
    scale,
    snapping: snap,
    timeline: props,
  })
  const gesture = createStudioRulerGesture({
    frameAt: rulerFrame,
    playheadFrame: () => props.playheadFrame,
    playing: () => props.playing === true,
    seek: (frame) => props.onSeek(frame),
    draw: {
      ...range.draw,
      start: (frame) => props.onRange !== undefined && range.draw.start(frame),
    },
  })
  const shownPlayhead = () => gesture.scrubFrame() ?? props.playheadFrame
  // A playing song's line runs on the compositor, checked against the clock
  // on every tick; dragged, or with the song stopped, it stands where its
  // style puts it.
  const motion = createStudioPlayheadMotion({
    sampleRate: STUDIO_SAMPLE_RATE,
    frameNow: () => props.playheadClock?.frameNow() ?? props.playheadFrame,
    pixels: (frame) => frameToPixel(frame, untrack(scale)),
    endFrame: () => untrack(endFrame),
  })
  const following = () =>
    props.playing === true &&
    gesture.scrubFrame() === null &&
    props.playheadClock !== undefined
  createEffect(() => {
    if (!following()) motion.stop()
  })
  createEffect(on([scale, endFrame], () => motion.restart(), { defer: true }))
  createEffect(() => {
    const clock = props.playheadClock
    if (!clock) return
    onCleanup(
      clock.ticks(() => {
        if (untrack(following)) motion.check()
      }),
    )
  })
  const playheadStyle = () =>
    motion.moving()
      ? {}
      : { transform: `translateX(${frameToPixel(shownPlayhead(), scale())}px)` }
  // Fit shows the whole song: a long one below the first stop, and on a
  // phone the overview it opens on. The keys and the buttons zoom about the
  // playhead, the wheel and a pinch about the pointer (zoom-control.ts).
  const fitZoom = () => studioFitZoom(contentWidth(), contentEnd())
  const zoom = createStudioZoom({
    viewport: () => viewport,
    headerWidth,
    contentWidth,
    scale,
    floor: () => (props.phone ? phoneFitScale() : studioZoomFloor(fitZoom())),
    playheadFrame: () => props.playheadFrame,
    apply: (next) => {
      const fitted = props.phone && next <= phoneFitScale() + 0.05
      if (props.phone) setPhoneFit(fitted)
      if (!fitted) props.onZoom?.(next)
    },
    fit: () => {
      if (props.project.clips.length === 0) return
      if (props.phone) setPhoneFit(true)
      else props.onZoom?.(fitZoom())
      viewport.scrollLeft = 0
    },
  })
  onCleanup(
    installStudioZoomKeys({
      scope: () => viewport?.closest('[data-tour="studio.workspace"]') ?? null,
      zoom,
    }),
  )
  // The clock in the transport scrubs along this grid (scrub-step.ts).
  createEffect(() =>
    publishStudioScrubGrid({
      snap: snap(),
      pixelsPerSecond: scale(),
      tempoBpm:
        props.project.ruler === 'bars' ? props.project.tempoBpm : undefined,
    }),
  )
  onCleanup(() => publishStudioScrubGrid(null))
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
          frameNow={props.playheadClock?.frameNow}
          writable={props.writable}
          onCommand={props.onCommand}
          onRange={props.onRange}
          onDetails={() => props.onClipDetails(selected().id)}
          onRemove={() => props.onSelectClip(null)}
        />
      )}
    </Show>
  )

  // The open line's bar takes the clip bar's place: opening a line lets go of the clip.
  const lineBar = (inDock: boolean) => (
    <Show when={(inDock || props.drawerOpen !== true) && lineTrack()}>
      {(track) => (
        <StudioLineBar
          track={track()}
          editor={lines}
          color={studioTrackColor(
            studioTrackHue(track(), trackIds().indexOf(track().id)),
          )}
          playheadFrame={props.playheadFrame}
          writable={props.writable}
          phone={props.phone}
          touch={props.phone || props.tablet === true}
          left={headerWidth() + 12}
          bottom={floor() + 12}
          docked={inDock}
          onCommand={props.onCommand}
          onStatus={showStatus}
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
        [styles.tall]: tall(),
        [styles.editing]: pointer.active(),
        [styles.docking]: docked(),
        [styles.armed]: props.record != null,
      }}
      aria-label="Song arrangement"
      data-tour={props.phone ? 'studio.timeline-overview' : 'studio.timeline'}
      data-studio-scale={roundStudioZoom(scale())}
      style={{
        '--studio-header-width': `${headerWidth()}px`,
        '--studio-time-width': `${timeWidth()}px`,
        '--studio-major': `${major()}px`,
        '--studio-minor': `${major() / minorCount()}px`,
        '--studio-row-height': props.phone ? `${phoneRow()}px` : undefined,
      }}
    >
      <div
        class={styles.viewport}
        data-studio-timeline-viewport=""
        ref={(element) => {
          viewport = element
          setWidth(element.clientWidth || 800)
          observer?.observe(element)
          onCleanup(attachStudioLaneNavigation(element, zoom))
        }}
        onScroll={() => setScroll(viewport.scrollLeft)}
        // A second finger is a pinch: the ruler lets go (ruler-gesture.ts).
        onTouchStart={(event) => {
          if (event.touches.length > 1) gesture.cancel()
        }}
      >
        <div class={styles.surface}>
          <div class={styles.rulerRow}>
            <div class={styles.corner}>
              <Show
                when={!props.phone}
                fallback={
                  <StudioZoomControls
                    zoom={zoom}
                    empty={props.project.clips.length === 0}
                    compact
                  />
                }
              >
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
              aria-valuemax={studioAriaSeconds(endFrame())}
              aria-valuenow={studioAriaSeconds(props.playheadFrame)}
              aria-valuetext={formatStudioTime(props.playheadFrame)}
              ref={(element) => (ruler = element)}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.preventDefault()
                ruler.focus({ preventScroll: true })
                ruler.setPointerCapture(event.pointerId)
                const target = event.target as Element
                gesture.press(
                  event,
                  target.closest('[data-studio-playhead-handle]') !== null,
                )
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  gesture.move(event)
              }}
              onPointerUp={(event) => gesture.release(event)}
              onPointerCancel={() => gesture.cancel()}
              onLostPointerCapture={(event) => gesture.release(event)}
              onKeyDown={(event) => {
                const frame = studioRulerKeyFrame(
                  event.key,
                  props.playheadFrame,
                  endFrame(),
                  contentEnd(),
                )
                if (frame === null) return
                event.preventDefault()
                props.onSeek(frame)
              }}
            >
              {/* By slot: a scroll moves the same labels, it does not make new ones. */}
              <Index each={tickSlots()}>
                {(slot) => {
                  const tick = (): StudioRulerTick | undefined =>
                    ticks()[slot()]
                  return (
                    <span
                      class={styles.tick}
                      style={{
                        left: `${tick()?.pixel ?? 0}px`,
                        display: tick() === undefined ? 'none' : undefined,
                      }}
                      aria-hidden="true"
                    >
                      {/* Never empty: an empty label would be a new text node. */}
                      {tick()?.label ?? ' '}
                    </span>
                  )
                }}
              </Index>
              {/* The playhead's handle: a press on it scrubs. */}
              <span
                ref={(element) => onCleanup(motion.attach(element))}
                class={styles.playheadHandle}
                data-studio-playhead="cap"
                data-studio-playhead-handle=""
                aria-hidden="true"
                style={playheadStyle()}
              >
                <span class={styles.playheadCap} />
              </span>
            </div>
            <StudioRulerRange
              tools={range}
              range={props.range ?? null}
              scale={scale()}
              endFrame={endFrame()}
              onChange={(next) => props.onRange?.(next)}
            />
          </div>
          <For each={trackIds()}>
            {(id, index) => (
              <StudioTimelineLane
                id={id}
                index={index()}
                track={tracks().get(id)!}
                clips={laneClips().get(id) ?? []}
                timeline={props}
                view={lane}
              />
            )}
          </For>
          <Show when={props.record?.trackId === null && props.record}>
            {(record) => (
              <StudioRecordLane
                {...record()}
                scale={scale()}
                scroll={scroll()}
                contentWidth={contentWidth()}
              />
            )}
          </Show>
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
          <StudioRangeShade tools={range} range={props.range} scale={scale()} />
          <Show when={props.project.tracks.length > 0}>
            <div
              ref={(element) => onCleanup(motion.attach(element))}
              class={styles.playhead}
              data-studio-playhead="line"
              aria-hidden="true"
              style={playheadStyle()}
            />
          </Show>
        </div>
        <Show
          when={
            props.project.tracks.length === 0 &&
            props.drawerOpen !== true &&
            !props.record
          }
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
              <StudioZoomControls
                zoom={zoom}
                empty={props.project.clips.length === 0}
                style={{
                  right: `${gutter() + 12}px`,
                  bottom: `${floor() + 12}px`,
                }}
              />
            </Show>
            {clipBar(false)}
            {lineBar(false)}
          </>
        }
      >
        <div
          class={styles.dock}
          classList={{ [styles.dockPaired]: dockColumns() > 1 }}
          data-studio-dock=""
          style={{ '--studio-dock-columns': dockColumns() }}
        >
          <StudioZoomControls
            zoom={zoom}
            empty={props.project.clips.length === 0}
            docked
          />
          {clipBar(true)}
          {lineBar(true)}
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
          <StudioPhoneClipNote
            name={name()}
            clip={selectedClip() ?? null}
            onRange={props.onRange}
          />
        )}
      </Show>
    </div>
  )
}
