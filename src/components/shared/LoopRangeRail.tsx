// LoopRangeRail is a zero-safe seek rail with canonical A/B editing on a separate display axis.
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { Maximize2, Minimize2 } from '@/components/icons'
import type { DragGestureEndReason, DragGestureOptions } from './drag-gesture'
import { dragGesture } from './drag-gesture'
import type { LoopRangeDomain } from './loop-range-rail'
import { focusedLoopRangeViewport, loopRangeNeedsFocus, loopRangePercent, loopRangeValueAtRatio, normalizeLoopRangeDomain, normalizeLoopRangeSpan, } from './loop-range-rail'
import styles from './LoopRangeRail.module.css'

export interface LoopRangeRailProps {
  /** The displayed/seeking axis. Guitar Night uses exact elapsed seconds. */
  axisDomain: Accessor<LoopRangeDomain>
  axisValue: Accessor<number>
  /** The loop's canonical musical axis. Guitar Night uses authored beats. */
  markDomain: Accessor<LoopRangeDomain>
  markA: Accessor<number | null>
  markB: Accessor<number | null>
  toAxis(markValue: number): number
  fromAxis(axisValue: number): number
  active?: Accessor<boolean>
  /** Disable seeking while the host is in a non-interruptible transition. */
  disabled?: Accessor<boolean>
  /** Keep seeking available while a scored take makes only A/B immutable. */
  marksDisabled?: Accessor<boolean>
  axisStep?: Accessor<number>
  markStep?: Accessor<number>
  minimumMarkGap?: Accessor<number>
  formatAxisValue(value: number): string
  formatMarkValue(value: number): string
  seekLabel?: string
  onSeek(value: number): void
  onMoveMarkA?: (value: number) => void
  onMoveMarkB?: (value: number) => void
  /** Pointer previews stay local; the host relaunches its scheduler once here. */
  onCommitMark?: (mark: 'A' | 'B') => void
  onScrubStart?: () => void
  onScrubEnd?: () => void
  /** Host snapping in canonical units, for example authored whole beats. */
  snapMarkValue?: (value: number, mark: 'A' | 'B') => number
  testIdPrefix: string
}

const SEEK_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export const LoopRangeRail: Component<LoopRangeRailProps> = (props) => {
  let rail: HTMLDivElement | undefined
  let precisionRail: HTMLDivElement | undefined
  const [railWidth, setRailWidth] = createSignal(0)
  const [focused, setFocused] = createSignal(false)
  const [dragTarget, setDragTarget] = createSignal<'A' | 'B' | null>(null)
  const [previewA, setPreviewA] = createSignal<number | null>(null)
  const [previewB, setPreviewB] = createSignal<number | null>(null)
  let keyboardDirtyA = false
  let keyboardDirtyB = false
  let seekKeyboardScrubbing = false

  const axisDomain = createMemo(() =>
    normalizeLoopRangeDomain(props.axisDomain()),
  )
  const markDomain = createMemo(() =>
    normalizeLoopRangeDomain(props.markDomain()),
  )
  const markSpan = createMemo(() =>
    normalizeLoopRangeSpan(props.markA(), props.markB(), markDomain()),
  )
  const mapSpanToAxis = (current: LoopRangeDomain | null) => {
    if (current === null) return null
    return normalizeLoopRangeSpan(
      props.toAxis(current.start),
      props.toAxis(current.end),
      axisDomain(),
    )
  }
  const axisSpan = createMemo(() => mapSpanToAxis(markSpan()))
  const focusOffered = createMemo(() =>
    loopRangeNeedsFocus(axisDomain(), axisSpan(), railWidth()),
  )
  const precisionViewport = createMemo(() =>
    focusedLoopRangeViewport(axisDomain(), axisSpan(), railWidth()),
  )
  const shownMark = (mark: 'A' | 'B'): number | null => {
    if (dragTarget() === mark) {
      return mark === 'A' ? previewA() : previewB()
    }
    return mark === 'A' ? props.markA() : props.markB()
  }
  const shownAxisSpan = createMemo(() =>
    mapSpanToAxis(
      normalizeLoopRangeSpan(shownMark('A'), shownMark('B'), markDomain()),
    ),
  )
  const markPercent = (mark: 'A' | 'B', viewport: LoopRangeDomain): number => {
    const value = shownMark(mark)
    return loopRangePercent(
      value === null ? viewport.start : props.toAxis(value),
      viewport,
    )
  }
  const axisSpanStyle = (viewport: LoopRangeDomain) => {
    const current = shownAxisSpan()
    if (current === null) return { left: '0%', width: '0%' }
    const left = loopRangePercent(current.start, viewport)
    return {
      left: `${left}%`,
      width: `${loopRangePercent(current.end, viewport) - left}%`,
    }
  }
  const markerBounds = (mark: 'A' | 'B'): LoopRangeDomain => {
    const domain = markDomain()
    const gap = Math.max(0, props.minimumMarkGap?.() ?? 0)
    if (mark === 'A') {
      return {
        start: domain.start,
        end: Math.max(domain.start, (props.markB() ?? domain.end) - gap),
      }
    }
    return {
      start: Math.min(domain.end, (props.markA() ?? domain.start) + gap),
      end: domain.end,
    }
  }
  const legalMarkValue = (value: number, mark: 'A' | 'B'): number => {
    const bounds = markerBounds(mark)
    const snapped = props.snapMarkValue?.(value, mark) ?? value
    return clamp(snapped, bounds.start, bounds.end)
  }
  const valueFromPointer = (
    event: PointerEvent,
    bounds: Pick<DOMRect, 'left' | 'width'> | undefined,
    viewport: LoopRangeDomain,
    mark: 'A' | 'B',
  ): number => {
    if (bounds === undefined) return markerBounds(mark).start
    const ratio = (event.clientX - bounds.left) / Math.max(1, bounds.width)
    const axisValue = loopRangeValueAtRatio(ratio, viewport)
    return legalMarkValue(props.fromAxis(axisValue), mark)
  }
  const markerMissingHandler = (mark: 'A' | 'B'): boolean =>
    mark === 'A'
      ? props.onMoveMarkA === undefined
      : props.onMoveMarkB === undefined
  const markerDisabled = (mark: 'A' | 'B'): boolean =>
    (props.marksDisabled?.() ?? props.disabled?.() ?? false) ||
    markerMissingHandler(mark)
  const publishMark = (mark: 'A' | 'B', value: number): void => {
    const next = legalMarkValue(value, mark)
    if (mark === 'A') props.onMoveMarkA?.(next)
    else props.onMoveMarkB?.(next)
  }
  const previewMark = (mark: 'A' | 'B', value: number): void => {
    const next = legalMarkValue(value, mark)
    if (mark === 'A') setPreviewA(next)
    else setPreviewB(next)
  }
  const markKeyboardDirty = (mark: 'A' | 'B'): void => {
    if (mark === 'A') keyboardDirtyA = true
    else keyboardDirtyB = true
  }
  const commitKeyboardMark = (mark: 'A' | 'B'): void => {
    const dirty = mark === 'A' ? keyboardDirtyA : keyboardDirtyB
    if (!dirty) return
    if (mark === 'A') keyboardDirtyA = false
    else keyboardDirtyB = false
    props.onCommitMark?.(mark)
  }
  const finishMarker = (
    mark: 'A' | 'B',
    reason: DragGestureEndReason,
  ): void => {
    const preview = mark === 'A' ? previewA() : previewB()
    setDragTarget(null)
    setPreviewA(null)
    setPreviewB(null)
    if (reason !== 'pointerup' || preview === null) return
    publishMark(mark, preview)
    props.onCommitMark?.(mark)
  }
  const markerOptions = (
    mark: 'A' | 'B',
    element: () => HTMLDivElement | undefined,
    precision: boolean,
  ): DragGestureOptions => {
    let gestureBounds: Pick<DOMRect, 'left' | 'width'> | undefined
    return {
      canStart: () => !markerDisabled(mark),
      onStart: () => {
        gestureBounds = element()?.getBoundingClientRect()
        const current = mark === 'A' ? props.markA() : props.markB()
        setDragTarget(mark)
        if (mark === 'A') setPreviewA(current)
        else setPreviewB(current)
      },
      onEnd: (_event, reason) => {
        gestureBounds = undefined
        finishMarker(mark, reason)
      },
      stopPropagation: true,
      slider: {
        getAriaLabel: () =>
          mark === 'A' ? 'Loop start marker' : 'Loop end marker',
        getValue: () => shownMark(mark) ?? markerBounds(mark).start,
        getMin: () => markerBounds(mark).start,
        getMax: () => markerBounds(mark).end,
        getStep: () => Math.max(Number.EPSILON, props.markStep?.() ?? 0.25),
        getPageStep: () => Math.max(props.markStep?.() ?? 0.25, 1),
        getValueFromPointer: (event) =>
          valueFromPointer(
            event,
            gestureBounds,
            precision ? precisionViewport() : axisDomain(),
            mark,
          ),
        getValueText: () => {
          const value = shownMark(mark)
          return value === null ? undefined : props.formatMarkValue(value)
        },
        isDisabled: () => markerDisabled(mark),
        onChange: (value) => {
          publishMark(mark, value)
          markKeyboardDirty(mark)
        },
        onPointerValue: (value) => previewMark(mark, value),
      },
    }
  }
  const markerAOptions = markerOptions('A', () => rail, false)
  const markerBOptions = markerOptions('B', () => rail, false)
  const precisionMarkerAOptions = markerOptions('A', () => precisionRail, true)
  const precisionMarkerBOptions = markerOptions('B', () => precisionRail, true)

  createEffect(() => {
    if (markSpan() === null) setFocused(false)
  })

  onMount(() => {
    const element = rail
    if (element === undefined) return
    const measure = () => setRailWidth(element.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  })

  const seekValue = (event: InputEvent): void => {
    props.onSeek(Number((event.currentTarget as HTMLInputElement).value))
  }
  const beginKeyboardScrub = (): void => {
    if (seekKeyboardScrubbing) return
    seekKeyboardScrubbing = true
    props.onScrubStart?.()
  }
  const finishKeyboardScrub = (): void => {
    if (!seekKeyboardScrubbing) return
    seekKeyboardScrubbing = false
    props.onScrubEnd?.()
  }

  const Marker: Component<{
    mark: 'A' | 'B'
    viewport: LoopRangeDomain
    options: DragGestureOptions
    precision?: boolean
  }> = (markerProps) => {
    const options = untrack(() => markerProps.options)
    return (
      <div
        class={`${styles.marker} ${markerProps.mark === 'A' ? styles.markerA : styles.markerB}`}
        classList={{
          [styles.markerDragging]: dragTarget() === markerProps.mark,
        }}
        style={{
          left: `${markPercent(markerProps.mark, markerProps.viewport)}%`,
        }}
        data-testid={`${props.testIdPrefix}-${markerProps.precision === true ? 'precision-' : ''}loop-marker-${markerProps.mark.toLowerCase()}`}
        ref={(element) => dragGesture(element, () => options)}
        onDblClick={() => {
          if (markerProps.precision !== true && focusOffered()) setFocused(true)
        }}
        onKeyUp={(event) => {
          if (SEEK_KEYS.has(event.key)) commitKeyboardMark(markerProps.mark)
        }}
        onBlur={() => commitKeyboardMark(markerProps.mark)}
      >
        <span>{markerProps.mark}</span>
      </div>
    )
  }

  return (
    <div
      class={styles.frame}
      data-focused={focused() ? 'true' : undefined}
      data-testid={`${props.testIdPrefix}-loop-range`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !focused()) return
        event.preventDefault()
        setFocused(false)
      }}
    >
      <div ref={rail} class={styles.rail}>
        <div class={styles.track} aria-hidden="true" />
        <div
          class={styles.progress}
          aria-hidden="true"
          style={{
            width: `${loopRangePercent(props.axisValue(), axisDomain())}%`,
          }}
        />
        <Show when={axisSpan()}>
          <div
            class={styles.region}
            classList={{ [styles.regionActive]: props.active?.() ?? true }}
            aria-hidden="true"
            style={axisSpanStyle(axisDomain())}
          />
        </Show>
        <input
          class={styles.seek}
          type="range"
          min={axisDomain().start}
          max={axisDomain().end > axisDomain().start ? axisDomain().end : 1}
          step={Math.max(Number.EPSILON, props.axisStep?.() ?? 0.01)}
          value={clamp(props.axisValue(), axisDomain().start, axisDomain().end)}
          disabled={props.disabled?.() ?? false}
          aria-label={props.seekLabel ?? 'Timeline position'}
          aria-valuetext={props.formatAxisValue(props.axisValue())}
          onPointerDown={() => props.onScrubStart?.()}
          onPointerUp={() => props.onScrubEnd?.()}
          onPointerCancel={() => props.onScrubEnd?.()}
          onKeyDown={(event) => {
            if (SEEK_KEYS.has(event.key)) beginKeyboardScrub()
          }}
          onKeyUp={(event) => {
            if (SEEK_KEYS.has(event.key)) finishKeyboardScrub()
          }}
          onInput={seekValue}
          onBlur={() => {
            if (seekKeyboardScrubbing) finishKeyboardScrub()
            else props.onScrubEnd?.()
          }}
        />
        <Show when={props.markA() !== null}>
          <Marker mark="A" viewport={axisDomain()} options={markerAOptions} />
        </Show>
        <Show when={props.markB() !== null}>
          <Marker mark="B" viewport={axisDomain()} options={markerBOptions} />
        </Show>
      </div>

      <Show when={focused()}>
        <div
          class={styles.precisionLens}
          role="group"
          aria-label="Focused A B loop editor"
          data-testid={`${props.testIdPrefix}-loop-precision-lens`}
        >
          <span class={styles.precisionLabel}>A–B detail</span>
          <div ref={precisionRail} class={styles.precisionRail}>
            <div class={styles.track} aria-hidden="true" />
            <div
              class={`${styles.region} ${styles.regionActive}`}
              aria-hidden="true"
              style={axisSpanStyle(precisionViewport())}
            />
            <Show when={props.markA() !== null}>
              <Marker
                mark="A"
                viewport={precisionViewport()}
                options={precisionMarkerAOptions}
                precision
              />
            </Show>
            <Show when={props.markB() !== null}>
              <Marker
                mark="B"
                viewport={precisionViewport()}
                options={precisionMarkerBOptions}
                precision
              />
            </Show>
          </div>
        </div>
      </Show>

      <Show when={focused() || focusOffered()}>
        <button
          type="button"
          class={styles.focusAction}
          aria-pressed={focused()}
          aria-label={
            focused() ? 'Close the focused loop editor' : 'Focus the A B loop'
          }
          title={focused() ? 'Full score' : 'Focus A–B'}
          onClick={() => setFocused((current) => !current)}
        >
          <span aria-hidden="true">
            {focused() ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </span>
        </button>
      </Show>
    </div>
  )
}
