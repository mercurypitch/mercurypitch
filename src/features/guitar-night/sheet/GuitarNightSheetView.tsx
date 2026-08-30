// The sheet: bars a few to a row, rows down the page, every part shown against
// the same bar lines. What moves per frame is one line; the music itself is
// painted once per system and left alone until the page resizes or the reading
// changes. That is the whole performance story.

import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { DragGestureEndReason, DragGestureOptions, } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { createPersistedSignal } from '@/lib/storage'
import styles from './GuitarNightSheetView.module.css'
import type { SheetLane, SheetLoopFragment, SheetLoopMarker, SheetPlacement, SheetSystem, } from './sheet-model'
import { barsPerSystemForWidth, buildSheetPlacement, locateBeat, sheetLoopFragments, sheetLoopMarkers, } from './sheet-model'
import type { SheetMetrics, SheetRenderer, SheetSystemLayout, SheetTheme, } from './sheet-render'
import { DEFAULT_SHEET_METRICS, layoutSystemLanes, readSheetTheme, visibleSystemRange, } from './sheet-render'
import { tabSheetRenderer } from './sheet-tab-renderer'

/** Backing store beyond two device pixels buys nothing a reader can see. */
const MAX_CANVAS_SCALE = 2

/** Magnification survives leaving the sheet: it is a reading preference. */
const SHEET_ZOOM_KEY = 'guitar-night-sheet-zoom-v1'
const MIN_SHEET_ZOOM = 0.6
const MAX_SHEET_ZOOM = 3
/** Wheel delta to magnification. Exponential, so each notch feels equal. */
const WHEEL_ZOOM_RATE = 0.0015

const clampSheetZoom = (value: number): number =>
  Math.min(MAX_SHEET_ZOOM, Math.max(MIN_SHEET_ZOOM, value))

/** Distance between the first two touches, for a pinch. */
const touchSpread = (touches: TouchList): number => {
  const first = touches[0]
  const second = touches[1]
  if (first === undefined || second === undefined) return 0
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  )
}

export interface GuitarNightSheetViewProps {
  lanes: Accessor<readonly SheetLane[]>
  playheadBeat: Accessor<number>
  /** Authored-beat rehearsal loop, with host-owned direct manipulation. */
  loopStart?: Accessor<number | null>
  loopEnd?: Accessor<number | null>
  loopActive?: Accessor<boolean>
  loopEditingDisabled?: Accessor<boolean>
  onMoveLoopMark?: (mark: 'A' | 'B', beat: number) => void
  onCommitLoopMark?: (mark: 'A' | 'B') => void
  /** Clicking or keyboard-adjusting a notation row moves the room playhead. */
  onSeekBeat?: (beat: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
  seekDisabled?: Accessor<boolean>
  /** The part being graded, drawn in full ink. */
  scoredTrackId?: Accessor<string | undefined>
  timeSignatures?: Accessor<readonly MidiTimeSignature[] | undefined>
  /** Swap in another way of drawing a part — staff notation, later. */
  renderer?: Accessor<SheetRenderer>
  /** Tapping a part's name asks to score it. */
  onSelectTrack?: (trackId: string) => void
  emptyNote?: string
}

export const GuitarNightSheetView: Component<GuitarNightSheetViewProps> = (
  props,
) => {
  let host: HTMLDivElement | undefined
  let scroller: HTMLDivElement | undefined
  // Measures the viewport, not the score. The page grows past the scroller
  // once magnified, so it can no longer report how wide the reader's view is.
  let gauge: HTMLDivElement | undefined

  const [width, setWidth] = createSignal(0)
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)
  const [theme, setTheme] = createSignal<SheetTheme>(readSheetTheme(null))
  const [zoom, setZoom] = createPersistedSignal<number>(SHEET_ZOOM_KEY, 1, {
    validator: (value): value is number =>
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= MIN_SHEET_ZOOM &&
      value <= MAX_SHEET_ZOOM,
  })

  const renderer = createMemo(() => props.renderer?.() ?? tabSheetRenderer)
  // Magnification scales the measure set rather than transforming the result.
  // Every painter derives its fonts and stave gaps from these numbers, so the
  // canvas is drawn at the size it is displayed and stays sharp at any zoom --
  // a CSS scale on a finished canvas would just enlarge its pixels.
  const metrics = createMemo<SheetMetrics>(() => {
    const scale = zoom()
    return {
      rowHeight: DEFAULT_SHEET_METRICS.rowHeight * scale,
      labelHeight: DEFAULT_SHEET_METRICS.labelHeight * scale,
      laneGap: DEFAULT_SHEET_METRICS.laneGap * scale,
      systemPaddingTop: DEFAULT_SHEET_METRICS.systemPaddingTop * scale,
      systemPaddingBottom: DEFAULT_SHEET_METRICS.systemPaddingBottom * scale,
      gutterWidth: DEFAULT_SHEET_METRICS.gutterWidth * scale,
      // The one measure that does NOT scale. Widening the page magnifies the
      // score into a side-scroll, and a reader who has to pan across a row to
      // finish it has gained nothing.
      width: Math.max(1, width()),
    }
  })
  const placement = createMemo(() =>
    buildSheetPlacement({
      lanes: props.lanes(),
      ...(props.timeSignatures?.() === undefined
        ? {}
        : { timeSignatures: props.timeSignatures() }),
      // Magnification spends the row's fixed width on fewer bars, so each one
      // gets more room and its fret numbers more space to be read in. That is
      // what makes zoom readable rather than merely large: the same viewport,
      // less music inside it.
      barsPerSystem: barsPerSystemForWidth(width() / zoom()),
    }),
  )
  const layout = createMemo<SheetSystemLayout>(() =>
    layoutSystemLanes(
      props.lanes(),
      metrics(),
      renderer(),
      props.scoredTrackId?.(),
    ),
  )
  const systemHeight = createMemo(() => Math.max(1, layout().height))
  const systemCount = createMemo(() => placement().systems.length)
  const range = createMemo(() =>
    visibleSystemRange({
      scrollTop: scrollTop(),
      viewportHeight: viewportHeight(),
      systemHeight: systemHeight(),
      systemCount: systemCount(),
    }),
  )
  const visibleSystems = createMemo(() =>
    placement().systems.slice(range().start, range().end),
  )
  const loopVisuals = createMemo(() => {
    const currentPlacement = placement()
    const loopStart = props.loopStart?.() ?? null
    const loopEnd = props.loopEnd?.() ?? null
    const fragments = new Map(
      sheetLoopFragments(currentPlacement, loopStart, loopEnd).map(
        (fragment) => [fragment.systemIndex, fragment] as const,
      ),
    )
    const markers = new Map<number, SheetLoopMarker[]>()
    for (const marker of sheetLoopMarkers(
      currentPlacement,
      loopStart,
      loopEnd,
    )) {
      const systemMarkers = markers.get(marker.systemIndex) ?? []
      systemMarkers.push(marker)
      markers.set(marker.systemIndex, systemMarkers)
    }
    return { fragments, markers }
  })
  const loopDescription = createMemo(() => {
    const start = props.loopStart?.() ?? null
    const end = props.loopEnd?.() ?? null
    const formatBeat = (beat: number) => {
      const counted = Math.max(0, beat) + 1
      const label = Number.isInteger(counted)
        ? String(counted)
        : counted.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
      return `beat ${label}`
    }
    if (
      start !== null &&
      end !== null &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start
    ) {
      return `Loop from ${formatBeat(start)} to ${formatBeat(end)}, ${props.loopActive?.() === true ? 'repeating' : 'ready'}`
    }
    if (start !== null && Number.isFinite(start)) {
      return `Loop start at ${formatBeat(start)}; end not set`
    }
    if (end !== null && Number.isFinite(end)) {
      return `Loop end at ${formatBeat(end)}; start not set`
    }
    return ''
  })

  const playhead = createMemo(() => {
    const position = locateBeat(placement(), props.playheadBeat())
    if (position === null) return null
    const current = metrics()
    const contentWidth = Math.max(1, current.width - current.gutterWidth)
    return {
      systemIndex: position.systemIndex,
      x: current.gutterWidth + position.fraction * contentWidth,
      y: position.systemIndex * systemHeight(),
    }
  })
  const playheadSystemIndex = createMemo(() => playhead()?.systemIndex ?? null)

  const measure = (): void => {
    const element = scroller
    if (element === undefined) return
    // The scroller owns horizontal padding while the gauge spans the width
    // actually paintable. Measuring the padded box projected a row-end B
    // marker beyond the page and created a hidden horizontal scroll range.
    setWidth(gauge?.clientWidth ?? element.clientWidth)
    setViewportHeight(element.clientHeight)
    setScrollTop(element.scrollTop)
  }

  const pageHeight = (): number => systemHeight() * systemCount()

  /**
   * Change magnification while holding a place in the music.
   *
   * The bar under the pointer -- or the middle of the view, when the slider
   * drove it -- should still be about there afterwards. Zoom re-breaks the
   * rows, so the page does not simply scale and a multiple of the old offset
   * would land nowhere. The anchor is kept as a fraction of the whole score
   * instead, which survives the reflow.
   */
  const zoomAbout = (next: number, clientY?: number): void => {
    const element = scroller
    const to = clampSheetZoom(next)
    if (element === undefined || to === zoom()) return
    const rect = element.getBoundingClientRect()
    const anchorY = (clientY ?? rect.top + rect.height / 2) - rect.top
    const before = pageHeight()
    const held = before <= 0 ? 0 : (element.scrollTop + anchorY) / before
    setZoom(to)
    // The rows only re-break once the new metrics have reached the DOM, and a
    // scroll offset past the current extent is silently clamped to it.
    queueMicrotask(() => {
      // A one-shot read after the flush, deliberately untracked: this runs in
      // a microtask that belongs to no owner.
      element.scrollTop = Math.max(0, untrack(pageHeight) * held - anchorY)
      measure()
    })
  }

  onMount(() => {
    setTheme(readSheetTheme(host ?? null))
    measure()
    const observer = new ResizeObserver(() => {
      measure()
    })
    if (scroller !== undefined) observer.observe(scroller)
    if (gauge !== undefined) observer.observe(gauge)

    const element = scroller
    if (element !== undefined) {
      // Both of these must be able to preventDefault -- the wheel to stop the
      // browser zooming the whole app, the pinch to stop it panning the page
      // out from under us -- so neither can be a passive listener.
      const onWheel = (event: WheelEvent): void => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        zoomAbout(
          zoom() * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
          event.clientY,
        )
      }
      // One finger keeps native scrolling; two are ours.
      let pinchSpread = 0
      let pinchFrom = 1
      const onTouchStart = (event: TouchEvent): void => {
        if (event.touches.length !== 2) return
        pinchSpread = touchSpread(event.touches)
        pinchFrom = zoom()
      }
      const onTouchMove = (event: TouchEvent): void => {
        if (event.touches.length !== 2 || pinchSpread <= 0) return
        const spread = touchSpread(event.touches)
        if (spread <= 0) return
        event.preventDefault()
        const first = event.touches[0]
        const second = event.touches[1]
        if (first === undefined || second === undefined) return
        zoomAbout(
          pinchFrom * (spread / pinchSpread),
          (first.clientY + second.clientY) / 2,
        )
      }
      const endPinch = (event: TouchEvent): void => {
        if (event.touches.length < 2) pinchSpread = 0
      }
      element.addEventListener('wheel', onWheel, { passive: false })
      element.addEventListener('touchstart', onTouchStart, { passive: true })
      element.addEventListener('touchmove', onTouchMove, { passive: false })
      element.addEventListener('touchend', endPinch, { passive: true })
      element.addEventListener('touchcancel', endPinch, { passive: true })
      onCleanup(() => {
        element.removeEventListener('wheel', onWheel)
        element.removeEventListener('touchstart', onTouchStart)
        element.removeEventListener('touchmove', onTouchMove)
        element.removeEventListener('touchend', endPinch)
        element.removeEventListener('touchcancel', endPinch)
      })
    }

    onCleanup(() => {
      observer.disconnect()
    })
  })

  // Follow the music only once it has left the page. A reader who scrolled back
  // to study a bar keeps their place; a reader who did nothing is not left
  // staring at a system the song finished with two rows ago.
  createEffect(() => {
    const systemIndex = playheadSystemIndex()
    const element = scroller
    if (systemIndex === null || element === undefined) return

    // Scroll position and viewport geometry are observations, not follow
    // triggers. Tracking either would pull the reader back on every manual
    // scroll or every playhead frame within the same notation row.
    untrack(() => {
      const height = systemHeight()
      const top = systemIndex * height
      const visibleTop = scrollTop()
      const visibleBottom = visibleTop + viewportHeight()
      if (top >= visibleTop && top + height <= visibleBottom) return
      element.scrollTop = Math.max(0, top - height / 2)
    })
  })

  return (
    <div
      class={styles.sheet}
      ref={host}
      // Lane names are DOM, not paint, so they scale from here.
      style={{ '--sheet-zoom': String(zoom()) }}
      role="group"
      aria-label={
        loopDescription() === ''
          ? 'Score sheet'
          : `Score sheet. ${loopDescription()}.`
      }
      data-testid="guitar-night-sheet"
    >
      <div
        class={styles.scroll}
        ref={scroller}
        data-testid="guitar-night-sheet-scroll"
        onScroll={() => {
          measure()
        }}
      >
        <div class={styles.gauge} ref={gauge} aria-hidden="true" />
        <Show
          when={props.lanes().length > 0}
          fallback={
            <p class={styles.empty}>
              {props.emptyNote ?? 'Attach a tab to read it here.'}
            </p>
          }
        >
          <div
            class={styles.page}
            data-testid="guitar-night-sheet-page"
            style={{ height: `${pageHeight()}px` }}
          >
            <For each={visibleSystems()}>
              {(system) => (
                <SheetSystemRow
                  system={system}
                  placement={placement()}
                  layout={layout()}
                  metrics={metrics()}
                  theme={theme()}
                  renderer={renderer()}
                  top={system.index * systemHeight()}
                  playheadBeat={props.playheadBeat()}
                  loopFragment={loopVisuals().fragments.get(system.index)}
                  loopMarkers={loopVisuals().markers.get(system.index) ?? []}
                  loopActive={props.loopActive?.() ?? false}
                  loopStart={props.loopStart?.() ?? null}
                  loopEnd={props.loopEnd?.() ?? null}
                  loopEditingDisabled={props.loopEditingDisabled?.() ?? false}
                  {...(props.onMoveLoopMark === undefined
                    ? {}
                    : { onMoveLoopMark: props.onMoveLoopMark })}
                  {...(props.onCommitLoopMark === undefined
                    ? {}
                    : { onCommitLoopMark: props.onCommitLoopMark })}
                  {...(props.onSeekBeat === undefined
                    ? {}
                    : { onSeekBeat: props.onSeekBeat })}
                  {...(props.onSeekStart === undefined
                    ? {}
                    : { onSeekStart: props.onSeekStart })}
                  {...(props.onSeekEnd === undefined
                    ? {}
                    : { onSeekEnd: props.onSeekEnd })}
                  seekDisabled={props.seekDisabled?.() ?? false}
                  {...(props.onSelectTrack === undefined
                    ? {}
                    : { onSelectTrack: props.onSelectTrack })}
                />
              )}
            </For>
            <Show when={playhead()}>
              {(position) => (
                <div
                  class={styles.playhead}
                  aria-hidden="true"
                  data-testid="guitar-night-sheet-playhead"
                  style={{
                    height: `${systemHeight()}px`,
                    transform: `translate3d(${position().x}px, ${position().y}px, 0)`,
                  }}
                />
              )}
            </Show>
          </div>
        </Show>
      </div>
      <Show when={props.lanes().length > 0}>
        <div class={styles.zoomBar}>
          <input
            class={styles.zoomSlider}
            type="range"
            min={MIN_SHEET_ZOOM}
            max={MAX_SHEET_ZOOM}
            step={0.05}
            value={zoom()}
            data-testid="guitar-night-sheet-zoom"
            aria-label="Sheet zoom"
            aria-valuetext={`${Math.round(zoom() * 100)} percent`}
            onInput={(event) => {
              zoomAbout(Number(event.currentTarget.value))
            }}
          />
          <button
            class={styles.zoomReset}
            type="button"
            data-testid="guitar-night-sheet-zoom-reset"
            aria-label="Reset sheet zoom to 100 percent"
            onClick={() => {
              zoomAbout(1)
            }}
          >
            {Math.round(zoom() * 100)}%
          </button>
        </div>
      </Show>
    </div>
  )
}

interface SheetSystemRowProps {
  system: SheetSystem
  placement: SheetPlacement
  layout: SheetSystemLayout
  metrics: SheetMetrics
  theme: SheetTheme
  renderer: SheetRenderer
  top: number
  playheadBeat: number
  loopFragment: SheetLoopFragment | undefined
  loopMarkers: readonly SheetLoopMarker[]
  loopActive: boolean
  loopStart: number | null
  loopEnd: number | null
  loopEditingDisabled: boolean
  onMoveLoopMark?: (mark: 'A' | 'B', beat: number) => void
  onCommitLoopMark?: (mark: 'A' | 'B') => void
  onSeekBeat?: (beat: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
  seekDisabled: boolean
  onSelectTrack?: (trackId: string) => void
}

/** One horizontal row of bars: the music on a canvas, the names above it. */
const SheetSystemRow: Component<SheetSystemRowProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let seekActive = false
  const startSeek = (): void => {
    if (seekActive) return
    seekActive = true
    props.onSeekStart?.()
  }
  const endSeek = (): void => {
    if (!seekActive) return
    seekActive = false
    props.onSeekEnd?.()
  }

  // Virtualization may remove a row while it owns pointer capture or a held
  // keyboard adjustment. Always release the host's seek lifetime exactly once.
  onCleanup(endSeek)

  const loopX = (fraction: number) => {
    const contentWidth = Math.max(
      1,
      props.metrics.width - props.metrics.gutterWidth,
    )
    return props.metrics.gutterWidth + fraction * contentWidth
  }

  createEffect(() => {
    const element = canvas
    const metrics = props.metrics
    const layout = props.layout
    const theme = props.theme
    const renderer = props.renderer
    const system = props.system
    const placement = props.placement
    if (element === undefined) return

    const scale = Math.min(
      MAX_CANVAS_SCALE,
      Math.max(1, window.devicePixelRatio || 1),
    )
    const cssWidth = Math.max(1, Math.round(metrics.width))
    const cssHeight = Math.max(1, Math.round(layout.height))
    const backingWidth = Math.round(cssWidth * scale)
    const backingHeight = Math.round(cssHeight * scale)
    if (element.width !== backingWidth) element.width = backingWidth
    if (element.height !== backingHeight) element.height = backingHeight

    const context = element.getContext('2d')
    if (context === null) return
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, cssWidth, cssHeight)
    renderer.paintSystem({
      ctx: context,
      system,
      placement,
      layout,
      metrics,
      theme,
    })
  })

  return (
    <div
      class={styles.system}
      data-system={props.system.index}
      // Where the row starts in the score's own beats. The bar lines
      // themselves are paint, so this is the one place a reader — or a test —
      // can see that a 2/4 bar shortened the music ahead of it.
      data-start-beat={props.system.startBeat}
      style={{
        transform: `translate3d(0, ${props.top}px, 0)`,
        height: `${props.layout.height}px`,
      }}
    >
      <Show when={props.loopFragment}>
        {(fragment) => (
          <div
            class={styles.loopRegion}
            data-active={props.loopActive ? 'true' : undefined}
            data-testid={`guitar-night-sheet-loop-region-${props.system.index}`}
            aria-hidden="true"
            style={{
              left: `${loopX(fragment().startFraction)}px`,
              width: `${Math.max(0, loopX(fragment().endFraction) - loopX(fragment().startFraction))}px`,
            }}
          />
        )}
      </Show>
      <canvas class={styles.canvas} ref={canvas} aria-hidden="true" />
      <Show when={props.onSeekBeat !== undefined}>
        <input
          class={styles.systemSeek}
          type="range"
          min={props.system.startBeat}
          max={props.system.startBeat + props.system.beats}
          step={0.25}
          disabled={props.seekDisabled}
          value={Math.min(
            props.system.startBeat + props.system.beats,
            Math.max(props.system.startBeat, props.playheadBeat),
          )}
          style={{ left: `${props.metrics.gutterWidth}px` }}
          aria-label={`Playback position in score row ${props.system.index + 1}`}
          aria-valuetext={formatSheetBeat(
            Math.min(
              props.system.startBeat + props.system.beats,
              Math.max(props.system.startBeat, props.playheadBeat),
            ),
          )}
          onPointerDown={startSeek}
          onPointerUp={endSeek}
          onPointerCancel={endSeek}
          onKeyDown={(event) => {
            if (!LOOP_MARK_KEYS.has(event.key)) return
            startSeek()
          }}
          onKeyUp={(event) => {
            if (!LOOP_MARK_KEYS.has(event.key)) return
            endSeek()
          }}
          onInput={(event) => {
            props.onSeekBeat?.(Number(event.currentTarget.value))
          }}
          onBlur={endSeek}
        />
      </Show>
      <For each={props.loopMarkers}>
        {(marker) => (
          <SheetLoopBoundary
            marker={marker}
            system={props.system}
            metrics={props.metrics}
            active={props.loopActive}
            loopStart={props.loopStart}
            loopEnd={props.loopEnd}
            disabled={props.loopEditingDisabled}
            {...(props.onMoveLoopMark === undefined
              ? {}
              : { onMove: props.onMoveLoopMark })}
            {...(props.onCommitLoopMark === undefined
              ? {}
              : { onCommit: props.onCommitLoopMark })}
          />
        )}
      </For>
      <For each={props.layout.lanes}>
        {(laneLayout) => (
          <LaneName
            lane={laneLayout.lane}
            scored={laneLayout.scored}
            top={laneLayout.top}
            height={props.metrics.labelHeight}
            {...(props.onSelectTrack === undefined
              ? {}
              : { onSelectTrack: props.onSelectTrack })}
          />
        )}
      </For>
    </div>
  )
}

const LOOP_MARK_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

const formatSheetBeat = (beat: number): string => {
  const counted = Math.max(0, beat) + 1
  const label = Number.isInteger(counted)
    ? String(counted)
    : counted.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `Beat ${label}`
}

interface SheetLoopBoundaryProps {
  marker: SheetLoopMarker
  system: SheetSystem
  metrics: SheetMetrics
  active: boolean
  loopStart: number | null
  loopEnd: number | null
  disabled: boolean
  onMove?: (mark: 'A' | 'B', beat: number) => void
  onCommit?: (mark: 'A' | 'B') => void
}

/** One exact A/B boundary, draggable inside the row whose bar map owns it. */
const SheetLoopBoundary: Component<SheetLoopBoundaryProps> = (props) => {
  let handle: HTMLDivElement | undefined
  const [previewBeat, setPreviewBeat] = createSignal<number | null>(null)
  let keyboardDirty = false

  const markerBeat = () =>
    props.system.startBeat + props.marker.fraction * props.system.beats
  const shownBeat = () => previewBeat() ?? markerBeat()
  const rowMinimum = () => props.system.startBeat
  const rowMaximum = () => props.system.startBeat + props.system.beats
  const minimum = () =>
    props.marker.mark === 'B' && props.loopStart !== null
      ? Math.max(rowMinimum(), props.loopStart + 1)
      : rowMinimum()
  const maximum = () =>
    props.marker.mark === 'A' && props.loopEnd !== null
      ? Math.min(rowMaximum(), props.loopEnd - 1)
      : rowMaximum()
  const legalBeat = (value: number) =>
    Math.min(maximum(), Math.max(minimum(), Math.round(value)))
  const contentX = (beat: number) => {
    const contentWidth = Math.max(
      1,
      props.metrics.width - props.metrics.gutterWidth,
    )
    const fraction =
      props.system.beats <= 0
        ? 0
        : Math.min(
            1,
            Math.max(0, (beat - props.system.startBeat) / props.system.beats),
          )
    return Math.min(
      Math.max(0, props.metrics.width - 1),
      props.metrics.gutterWidth + fraction * contentWidth,
    )
  }
  const editable = () => props.onMove !== undefined
  const interactive = () => editable() && !props.disabled
  const publish = (): void => {
    const value = previewBeat()
    keyboardDirty = false
    setPreviewBeat(null)
    if (value === null || props.onMove === undefined) return
    props.onMove(props.marker.mark, legalBeat(value))
    props.onCommit?.(props.marker.mark)
  }

  // dragGesture releases pointer capture and listeners with this owner. If
  // virtualization removes an actively edited row, preserve the last visible
  // marker position instead of silently discarding the player's edit.
  onCleanup(() => {
    if (previewBeat() !== null) publish()
    else keyboardDirty = false
  })

  const finish = (reason: DragGestureEndReason): void => {
    if (reason === 'pointerup') publish()
    else {
      keyboardDirty = false
      setPreviewBeat(null)
    }
  }
  const options: DragGestureOptions = {
    canStart: () => interactive(),
    onStart: () => setPreviewBeat(markerBeat()),
    onEnd: (_event, reason) => finish(reason),
    stopPropagation: true,
    slider: {
      getAriaLabel: () =>
        props.marker.mark === 'A'
          ? 'Loop start marker on sheet'
          : 'Loop end marker on sheet',
      getValue: shownBeat,
      getMin: minimum,
      getMax: maximum,
      getStep: () => 1,
      getPageStep: () => 4,
      getValueText: () => formatSheetBeat(shownBeat()),
      isDisabled: () => !interactive(),
      getValueFromPointer: (event) => {
        const row = handle?.parentElement
        if (row === null || row === undefined) return markerBeat()
        const bounds = row.getBoundingClientRect()
        const contentLeft = bounds.left + props.metrics.gutterWidth
        const contentWidth = Math.max(
          1,
          bounds.width - props.metrics.gutterWidth,
        )
        const ratio = Math.min(
          1,
          Math.max(0, (event.clientX - contentLeft) / contentWidth),
        )
        return legalBeat(props.system.startBeat + ratio * props.system.beats)
      },
      onChange: (value) => {
        setPreviewBeat(legalBeat(value))
        keyboardDirty = true
      },
      onPointerValue: (value) => setPreviewBeat(legalBeat(value)),
    },
  }

  return (
    <div
      class={styles.loopMarker}
      data-mark={props.marker.mark}
      data-active={props.active ? 'true' : undefined}
      data-testid={`guitar-night-sheet-loop-marker-${props.marker.mark.toLowerCase()}`}
      aria-hidden={editable() ? undefined : 'true'}
      style={{ left: `${contentX(shownBeat())}px` }}
      ref={(element) => {
        handle = element
        if (editable()) dragGesture(element, () => options)
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyUp={(event) => {
        if (LOOP_MARK_KEYS.has(event.key) && keyboardDirty) publish()
      }}
      onBlur={() => {
        if (keyboardDirty) publish()
      }}
    >
      <span>{props.marker.mark}</span>
    </div>
  )
}

interface LaneNameProps {
  lane: SheetLane
  scored: boolean
  top: number
  height: number
  onSelectTrack?: (trackId: string) => void
}

const LaneName: Component<LaneNameProps> = (props) => {
  const missing = createMemo(() => props.lane.outOfRangeNotes)
  const label = createMemo(() =>
    missing() > 0
      ? `${props.lane.trackName} — ${missing()} note${missing() === 1 ? '' : 's'} off this neck`
      : props.lane.trackName,
  )

  return (
    <Show
      when={props.onSelectTrack !== undefined}
      fallback={
        <span
          class={styles.laneName}
          classList={{ [styles.laneNameScored ?? '']: props.scored }}
          style={{ top: `${props.top}px`, height: `${props.height}px` }}
        >
          {label()}
        </span>
      }
    >
      <button
        type="button"
        class={`${styles.laneName} ${styles.laneNameButton}`}
        classList={{ [styles.laneNameScored ?? '']: props.scored }}
        style={{ top: `${props.top}px`, height: `${props.height}px` }}
        aria-pressed={props.scored}
        title={
          props.scored
            ? `${props.lane.trackName} is the part being scored`
            : `Score ${props.lane.trackName} instead`
        }
        onClick={() => {
          props.onSelectTrack?.(props.lane.trackId)
        }}
      >
        {label()}
      </button>
    </Show>
  )
}
