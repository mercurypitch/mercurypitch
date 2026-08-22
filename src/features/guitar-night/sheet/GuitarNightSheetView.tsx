// The sheet: bars a few to a row, rows down the page, every part shown against
// the same bar lines. What moves per frame is one line; the music itself is
// painted once per system and left alone until the page resizes or the reading
// changes. That is the whole performance story.

import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import styles from './GuitarNightSheetView.module.css'
import type { SheetLane, SheetLoopFragment, SheetLoopMarker, SheetPlacement, SheetSystem, } from './sheet-model'
import { barsPerSystemForWidth, buildSheetPlacement, locateBeat, sheetLoopFragments, sheetLoopMarkers, } from './sheet-model'
import type { SheetMetrics, SheetRenderer, SheetSystemLayout, SheetTheme, } from './sheet-render'
import { DEFAULT_SHEET_METRICS, layoutSystemLanes, readSheetTheme, visibleSystemRange, } from './sheet-render'
import { tabSheetRenderer } from './sheet-tab-renderer'

/** Backing store beyond two device pixels buys nothing a reader can see. */
const MAX_CANVAS_SCALE = 2

export interface GuitarNightSheetViewProps {
  lanes: Accessor<readonly SheetLane[]>
  playheadBeat: Accessor<number>
  /** Authored-beat rehearsal loop, painted without becoming an editor here. */
  loopStart?: Accessor<number | null>
  loopEnd?: Accessor<number | null>
  loopActive?: Accessor<boolean>
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

  const [width, setWidth] = createSignal(0)
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)
  const [theme, setTheme] = createSignal<SheetTheme>(readSheetTheme(null))

  const renderer = createMemo(() => props.renderer?.() ?? tabSheetRenderer)
  const metrics = createMemo<SheetMetrics>(() => ({
    ...DEFAULT_SHEET_METRICS,
    width: Math.max(1, width()),
  }))
  const placement = createMemo(() =>
    buildSheetPlacement({
      lanes: props.lanes(),
      ...(props.timeSignatures?.() === undefined
        ? {}
        : { timeSignatures: props.timeSignatures() }),
      barsPerSystem: barsPerSystemForWidth(metrics().width),
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

  const measure = (): void => {
    const element = scroller
    if (element === undefined) return
    setWidth(element.clientWidth)
    setViewportHeight(element.clientHeight)
    setScrollTop(element.scrollTop)
  }

  onMount(() => {
    setTheme(readSheetTheme(host ?? null))
    measure()
    const observer = new ResizeObserver(() => {
      measure()
    })
    if (scroller !== undefined) observer.observe(scroller)
    onCleanup(() => {
      observer.disconnect()
    })
  })

  // Follow the music only once it has left the page. A reader who scrolled back
  // to study a bar keeps their place; a reader who did nothing is not left
  // staring at a system the song finished with two rows ago.
  createEffect(() => {
    const position = playhead()
    const element = scroller
    if (position === null || element === undefined) return
    const height = systemHeight()
    const top = position.systemIndex * height
    const visibleTop = scrollTop()
    const visibleBottom = visibleTop + viewportHeight()
    if (top >= visibleTop && top + height <= visibleBottom) return
    element.scrollTop = Math.max(0, top - height / 2)
  })

  return (
    <div
      class={styles.sheet}
      ref={host}
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
        onScroll={() => {
          measure()
        }}
      >
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
            style={{ height: `${systemHeight() * systemCount()}px` }}
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
                  loopFragment={loopVisuals().fragments.get(system.index)}
                  loopMarkers={loopVisuals().markers.get(system.index) ?? []}
                  loopActive={props.loopActive?.() ?? false}
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
  loopFragment: SheetLoopFragment | undefined
  loopMarkers: readonly SheetLoopMarker[]
  loopActive: boolean
  onSelectTrack?: (trackId: string) => void
}

/** One horizontal row of bars: the music on a canvas, the names above it. */
const SheetSystemRow: Component<SheetSystemRowProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined
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
      <For each={props.loopMarkers}>
        {(marker) => (
          <div
            class={styles.loopMarker}
            data-mark={marker.mark}
            data-active={props.loopActive ? 'true' : undefined}
            data-testid={`guitar-night-sheet-loop-marker-${marker.mark.toLowerCase()}`}
            aria-hidden="true"
            style={{ left: `${loopX(marker.fraction)}px` }}
          >
            <span>{marker.mark}</span>
          </div>
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
