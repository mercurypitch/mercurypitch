// ============================================================
// Guitar Night secondary part — a movable, resizable score preview
// ============================================================
//
// The preview shares the main stage's playhead, but owns only presentation.
// Its floating placement is persisted per stage layout and is always resolved
// around elements that opt into the stable protection contract below.

import type { Accessor, Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, } from '@/components/icons'
import { dragGesture } from '@/components/shared/drag-gesture'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { createPersistedSignal } from '@/lib/storage'
import styles from './GuitarNightSecondaryPart.module.css'
import type { SecondaryPartLayout, SecondaryPartRect, SecondaryPartSize, } from './secondary-part-layout'
import { resolveSecondaryPartLayout, SECONDARY_PART_LAYOUT_OPTIONS, secondaryPartWidthRange, } from './secondary-part-layout'
import type { SheetLane } from './sheet/sheet-model'
import { buildStageTabWindowIndex, tabNoteOffsetPercent, tabWindowNotes, } from './tab-window'

/** The stable opt-in used by stage chrome that the preview must never cover. */
export const GUITAR_NIGHT_SECONDARY_PROTECTED_SELECTOR =
  '[data-guitar-night-secondary-protected]'
export const GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY =
  'guitar-night-secondary-part-layout-v1'
export const GUITAR_NIGHT_SECONDARY_COLLAPSED_STORAGE_KEY =
  'guitar-night-secondary-part-collapsed-v1'

/** A glanceable preview shows direction without duplicating the full score. */
export const SECONDARY_PART_WINDOW_BEATS = 6

const DEFAULT_LAYOUT_KEY = 'default'
const DEFAULT_WIDTH = 300
const KEYBOARD_MOVE_STEP = 16
const KEYBOARD_RESIZE_STEP = 24
const NARROW_QUERY = '(max-width: 720px)'

interface StoredSecondaryPartPlacement {
  xRatio: number
  yRatio: number
  width: number
}

type StoredSecondaryPartPlacements = Record<
  string,
  StoredSecondaryPartPlacement
>
type StoredSecondaryPartCollapse = Record<string, boolean>

interface SecondaryPartMetrics {
  boundary: SecondaryPartSize
  panelHeight: number
  protectedRects: readonly SecondaryPartRect[]
}

function isStoredPlacement(
  value: unknown,
): value is StoredSecondaryPartPlacement {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<StoredSecondaryPartPlacement>
  return (
    typeof candidate.xRatio === 'number' &&
    Number.isFinite(candidate.xRatio) &&
    candidate.xRatio >= 0 &&
    candidate.xRatio <= 1 &&
    typeof candidate.yRatio === 'number' &&
    Number.isFinite(candidate.yRatio) &&
    candidate.yRatio >= 0 &&
    candidate.yRatio <= 1 &&
    typeof candidate.width === 'number' &&
    Number.isFinite(candidate.width) &&
    candidate.width > 0
  )
}

function isStoredPlacements(
  value: unknown,
): value is StoredSecondaryPartPlacements {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(isStoredPlacement)
}

function isStoredCollapse(
  value: unknown,
): value is StoredSecondaryPartCollapse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((entry) => typeof entry === 'boolean')
}

function mediaMatches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  )
}

function isHiddenByClosedDisclosure(element: Element): boolean {
  let ancestor = element.parentElement
  while (ancestor !== null) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const summary = Array.from(ancestor.children).find(
        (child) => child.tagName === 'SUMMARY',
      )
      if (summary === undefined || !summary.contains(element)) return true
    }
    ancestor = ancestor.parentElement
  }
  return false
}

function sameLayout(
  left: SecondaryPartLayout,
  right: SecondaryPartLayout,
): boolean {
  return (
    Math.abs(left.x - right.x) < 0.25 &&
    Math.abs(left.y - right.y) < 0.25 &&
    Math.abs(left.width - right.width) < 0.25
  )
}

export interface GuitarNightSecondaryPartProps {
  lane: Accessor<SheetLane>
  playheadBeat: Accessor<number>
  /** Tapping the strip reads this part instead. Absent leaves it a display. */
  onSwap?: (trackId: string) => void
  /** Persist independently for Highway, Grid and Neck when the host supplies it. */
  layoutKey?: Accessor<string>
  /** Defaults to the component's offset parent, normally the stage viewport. */
  boundaryElement?: Accessor<HTMLElement | undefined>
  /** Local boundary-space rectangles can supplement the DOM marker contract. */
  protectedRects?: Accessor<readonly SecondaryPartRect[]>
  /** Override only when embedding the component outside Guitar Night. */
  protectedSelector?: string
  /** Reuse the owning stage's responsive signal instead of adding a listener. */
  narrowViewport?: Accessor<boolean>
}

export const GuitarNightSecondaryPart: Component<
  GuitarNightSecondaryPartProps
> = (props) => {
  let rootElement: HTMLDivElement | undefined
  let moveHandle: HTMLButtonElement | undefined
  let resizeHandle: HTMLDivElement | undefined
  let activeLayoutKey = DEFAULT_LAYOUT_KEY
  let pendingPlacement: StoredSecondaryPartPlacement | null | undefined
  let lastBoundary: (SecondaryPartSize & { panelHeight: number }) | null = null
  let moveStart:
    | { clientX: number; clientY: number; layout: SecondaryPartLayout }
    | undefined
  let resizeStart: { clientX: number; layout: SecondaryPartLayout } | undefined
  let interactionMetrics: SecondaryPartMetrics | undefined
  let lastNarrowViewport: boolean | undefined

  const [storedPlacements, setStoredPlacements] =
    createPersistedSignal<StoredSecondaryPartPlacements>(
      GUITAR_NIGHT_SECONDARY_LAYOUT_STORAGE_KEY,
      {},
      { validator: isStoredPlacements },
    )
  const [storedCollapse, setStoredCollapse] =
    createPersistedSignal<StoredSecondaryPartCollapse>(
      GUITAR_NIGHT_SECONDARY_COLLAPSED_STORAGE_KEY,
      {},
      { validator: isStoredCollapse },
    )
  const [layout, setLayout] = createSignal<SecondaryPartLayout>({
    x: SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
    y: SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
    width: DEFAULT_WIDTH,
  })
  const [fallbackNarrowViewport, setFallbackNarrowViewport] = createSignal(
    untrack(() => props.narrowViewport === undefined)
      ? mediaMatches(NARROW_QUERY)
      : false,
  )
  const [positioned, setPositioned] = createSignal(false)
  const [interacting, setInteracting] = createSignal<'move' | 'resize' | null>(
    null,
  )
  const [announcement, setAnnouncement] = createSignal('')
  const [collapsed, setCollapsed] = createSignal(false)

  const windowIndex = createMemo(() =>
    buildStageTabWindowIndex(props.lane().notes as readonly GuitarNote[]),
  )
  const visibleNotes = createMemo(() =>
    tabWindowNotes(
      windowIndex(),
      props.playheadBeat(),
      SECONDARY_PART_WINDOW_BEATS,
    ),
  )
  const byString = createMemo(() => {
    const rows: GuitarNote[][] = props.lane().tuning.labels.map(() => [])
    for (const note of visibleNotes()) {
      const row = rows[note.stringIndex]
      if (row !== undefined) row.push(note)
    }
    return rows
  })

  const narrowViewport = (): boolean =>
    props.narrowViewport?.() ?? fallbackNarrowViewport()

  const noteActive = (note: GuitarNote): boolean =>
    note.startBeat <= props.playheadBeat() &&
    note.startBeat + note.duration > props.playheadBeat()

  const notePast = (note: GuitarNote): boolean =>
    note.startBeat + note.duration <= props.playheadBeat()

  const summary = createMemo(() => {
    const active = visibleNotes().filter(noteActive).length
    return active === 0
      ? `${props.lane().trackName}, resting`
      : `${props.lane().trackName}, ${active === 1 ? '1 note' : `${active} notes`} sounding`
  })

  const boundaryElement = (): HTMLElement | undefined =>
    props.boundaryElement?.() ??
    (rootElement?.offsetParent instanceof HTMLElement
      ? rootElement.offsetParent
      : (rootElement?.parentElement ?? undefined))

  const protectedSelector = (): string =>
    props.protectedSelector ?? GUITAR_NIGHT_SECONDARY_PROTECTED_SELECTOR

  const boundarySize = (): SecondaryPartSize => {
    const boundary = boundaryElement()
    if (boundary === undefined) return { width: 0, height: 0 }
    const rect = boundary.getBoundingClientRect()
    return {
      width: rect.width > 0 ? rect.width : boundary.clientWidth,
      height: rect.height > 0 ? rect.height : boundary.clientHeight,
    }
  }

  const panelHeight = (): number => {
    const rect = rootElement?.getBoundingClientRect()
    if (rect !== undefined && rect.height > 0) return rect.height
    const offsetHeight = rootElement?.offsetHeight ?? 0
    return offsetHeight > 0 ? offsetHeight : 140
  }

  const markedProtectedRects = (): SecondaryPartRect[] => {
    const boundary = boundaryElement()
    if (boundary === undefined) return []
    const boundaryRect = boundary.getBoundingClientRect()
    const protectionRoot = boundary.parentElement ?? boundary
    let elements: Element[] = []
    try {
      elements = Array.from(
        protectionRoot.querySelectorAll(protectedSelector()),
      )
    } catch {
      return []
    }
    return elements
      .filter((element) => {
        if (
          element === rootElement ||
          rootElement?.contains(element) === true
        ) {
          return false
        }
        // Absolutely positioned disclosure content can retain a measurable
        // rectangle while its <details> ancestor is closed. It is not painted
        // and must not become a ghost obstacle for the floating preview.
        if (isHiddenByClosedDisclosure(element)) return false
        if (typeof window === 'undefined') return true
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          x: rect.left - boundaryRect.left,
          y: rect.top - boundaryRect.top,
          width: rect.width,
          height: rect.height,
        }
      })
  }

  const protectedRects = (): readonly SecondaryPartRect[] => [
    ...markedProtectedRects(),
    ...(props.protectedRects?.() ?? []),
  ]

  const currentMetrics = (): SecondaryPartMetrics => {
    const boundary = boundarySize()
    return {
      boundary,
      panelHeight: panelHeight(),
      protectedRects: protectedRects(),
    }
  }

  const resolvedLayout = (
    desired: SecondaryPartLayout,
    metrics = currentMetrics(),
  ): SecondaryPartLayout => {
    return resolveSecondaryPartLayout(
      desired,
      metrics.panelHeight,
      metrics.boundary,
      metrics.protectedRects,
    )
  }

  const publishLayout = (next: SecondaryPartLayout): void => {
    if (!sameLayout(layout(), next)) setLayout(next)
  }

  const defaultLayout = (): SecondaryPartLayout => {
    const metrics = currentMetrics()
    return resolveSecondaryPartLayout(
      {
        x: SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
        y:
          metrics.boundary.height -
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
          metrics.panelHeight,
        width: DEFAULT_WIDTH,
      },
      metrics.panelHeight,
      metrics.boundary,
      metrics.protectedRects,
    )
  }

  const layoutFromStored = (
    placement: StoredSecondaryPartPlacement,
  ): SecondaryPartLayout => {
    const metrics = currentMetrics()
    const widthRange = secondaryPartWidthRange(metrics.boundary.width)
    const width = Math.max(
      widthRange.min,
      Math.min(widthRange.max, placement.width),
    )
    const maxX = Math.max(
      SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
      metrics.boundary.width - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap - width,
    )
    const maxY = Math.max(
      SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
      metrics.boundary.height -
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
        metrics.panelHeight,
    )
    return resolveSecondaryPartLayout(
      {
        x:
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap +
          (maxX - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) * placement.xRatio,
        y:
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap +
          (maxY - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) * placement.yRatio,
        width,
      },
      metrics.panelHeight,
      metrics.boundary,
      metrics.protectedRects,
    )
  }

  const synchronizeLayout = (): void => {
    if (rootElement === undefined) return
    if (narrowViewport()) {
      setPositioned(true)
      return
    }
    const metrics = currentMetrics()
    if (metrics.boundary.width <= 0 || metrics.boundary.height <= 0) {
      setPositioned(true)
      return
    }

    let next: SecondaryPartLayout
    if (pendingPlacement !== undefined) {
      next =
        pendingPlacement === null
          ? defaultLayout()
          : layoutFromStored(pendingPlacement)
      pendingPlacement = undefined
    } else if (lastBoundary !== null) {
      const current = untrack(layout)
      const oldMaxX = Math.max(
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
        lastBoundary.width -
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
          current.width,
      )
      const oldMaxY = Math.max(
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
        lastBoundary.height -
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
          lastBoundary.panelHeight,
      )
      const xRatio =
        oldMaxX === SECONDARY_PART_LAYOUT_OPTIONS.edgeGap
          ? 0
          : (current.x - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) /
            (oldMaxX - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap)
      const yRatio =
        oldMaxY === SECONDARY_PART_LAYOUT_OPTIONS.edgeGap
          ? 0
          : (current.y - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) /
            (oldMaxY - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap)
      const widthRange = secondaryPartWidthRange(metrics.boundary.width)
      const width = Math.max(
        widthRange.min,
        Math.min(widthRange.max, current.width),
      )
      const newMaxX = Math.max(
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
        metrics.boundary.width - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap - width,
      )
      const newMaxY = Math.max(
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
        metrics.boundary.height -
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
          metrics.panelHeight,
      )
      next = resolvedLayout({
        x:
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap +
          (newMaxX - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) * xRatio,
        y:
          SECONDARY_PART_LAYOUT_OPTIONS.edgeGap +
          (newMaxY - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) * yRatio,
        width,
      })
    } else {
      next = defaultLayout()
    }

    publishLayout(next)
    lastBoundary = { ...metrics.boundary, panelHeight: metrics.panelHeight }
    setPositioned(true)
  }

  const persistLayout = (current = layout()): void => {
    if (narrowViewport()) return
    const metrics = currentMetrics()
    const maxX = Math.max(
      SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
      metrics.boundary.width -
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
        current.width,
    )
    const maxY = Math.max(
      SECONDARY_PART_LAYOUT_OPTIONS.edgeGap,
      metrics.boundary.height -
        SECONDARY_PART_LAYOUT_OPTIONS.edgeGap -
        metrics.panelHeight,
    )
    const xRatio =
      maxX === SECONDARY_PART_LAYOUT_OPTIONS.edgeGap
        ? 0
        : (current.x - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) /
          (maxX - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap)
    const yRatio =
      maxY === SECONDARY_PART_LAYOUT_OPTIONS.edgeGap
        ? 0
        : (current.y - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap) /
          (maxY - SECONDARY_PART_LAYOUT_OPTIONS.edgeGap)
    const placement: StoredSecondaryPartPlacement = {
      xRatio: Math.max(0, Math.min(1, xRatio)),
      yRatio: Math.max(0, Math.min(1, yRatio)),
      width: current.width,
    }
    setStoredPlacements((previous) => ({
      ...previous,
      [activeLayoutKey]: placement,
    }))
  }

  const resetLayout = (): void => {
    pendingPlacement = null
    setStoredPlacements((previous) => {
      const next = { ...previous }
      delete next[activeLayoutKey]
      return next
    })
    publishLayout(defaultLayout())
    setAnnouncement('Score preview returned to its safe corner')
  }

  const applyMove = (
    next: SecondaryPartLayout,
    metrics?: SecondaryPartMetrics,
  ): void => {
    publishLayout(resolvedLayout(next, metrics))
  }

  const finishInteraction = (): void => {
    interactionMetrics = undefined
    const reconciled = resolvedLayout(layout())
    publishLayout(reconciled)
    persistLayout(reconciled)
    setInteracting(null)
  }

  const toggleCollapsed = (): void => {
    const next = !collapsed()
    setCollapsed(next)
    setStoredCollapse((previous) => ({
      ...previous,
      [activeLayoutKey]: next,
    }))
    setAnnouncement(next ? 'Score preview collapsed' : 'Score preview expanded')
  }

  const handleMoveKeyDown = (event: KeyboardEvent): void => {
    if (narrowViewport()) return
    const distance = event.shiftKey
      ? KEYBOARD_MOVE_STEP * 3
      : KEYBOARD_MOVE_STEP
    const current = layout()
    let next: SecondaryPartLayout | undefined
    switch (event.key) {
      case 'ArrowLeft':
        next = { ...current, x: current.x - distance }
        break
      case 'ArrowRight':
        next = { ...current, x: current.x + distance }
        break
      case 'ArrowUp':
        next = { ...current, y: current.y - distance }
        break
      case 'ArrowDown':
        next = { ...current, y: current.y + distance }
        break
      case 'Home':
        event.preventDefault()
        resetLayout()
        return
      default:
        return
    }
    event.preventDefault()
    applyMove(next)
    persistLayout()
    setAnnouncement(
      `Score preview moved ${event.key.replace('Arrow', '').toLowerCase()}`,
    )
  }

  const handleResizeKeyDown = (event: KeyboardEvent): void => {
    if (narrowViewport()) return
    const current = layout()
    const range = secondaryPartWidthRange(boundarySize().width)
    let width: number | undefined
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        width = current.width - KEYBOARD_RESIZE_STEP
        break
      case 'ArrowRight':
      case 'ArrowUp':
        width = current.width + KEYBOARD_RESIZE_STEP
        break
      case 'Home':
        width = Math.max(range.min, Math.min(range.max, DEFAULT_WIDTH))
        break
      case 'End':
        width = range.max
        break
      default:
        return
    }
    event.preventDefault()
    applyMove({ ...current, width })
    persistLayout()
    setAnnouncement(`Score preview width ${Math.round(layout().width)} pixels`)
  }

  createEffect(() => {
    const suppliedKey = props.layoutKey?.().trim()
    const nextKey =
      suppliedKey === undefined || suppliedKey === ''
        ? DEFAULT_LAYOUT_KEY
        : suppliedKey
    activeLayoutKey = nextKey
    pendingPlacement = untrack(storedPlacements)[nextKey] ?? null
    setCollapsed(untrack(storedCollapse)[nextKey] ?? false)
    lastBoundary = null
    queueMicrotask(synchronizeLayout)
  })

  createEffect(() => {
    const current = narrowViewport()
    if (lastNarrowViewport === undefined) {
      lastNarrowViewport = current
      return
    }
    if (current === lastNarrowViewport) return
    lastNarrowViewport = current
    pendingPlacement = untrack(storedPlacements)[activeLayoutKey] ?? null
    lastBoundary = null
    queueMicrotask(synchronizeLayout)
  })

  onMount(() => {
    const media =
      props.narrowViewport === undefined &&
      typeof window.matchMedia === 'function'
        ? window.matchMedia(NARROW_QUERY)
        : undefined
    const onMediaChange = (event: MediaQueryListEvent): void => {
      setFallbackNarrowViewport(event.matches)
    }
    media?.addEventListener('change', onMediaChange)

    if (moveHandle !== undefined) {
      dragGesture(moveHandle, () => ({
        canStart: (event) =>
          !narrowViewport() &&
          (event.pointerType === 'touch' || event.button === 0),
        stopPropagation: true,
        onStart: (event) => {
          interactionMetrics = currentMetrics()
          moveStart = {
            clientX: event.clientX,
            clientY: event.clientY,
            layout: layout(),
          }
          setInteracting('move')
        },
        onMove: (event) => {
          if (moveStart === undefined) return
          applyMove(
            {
              ...moveStart.layout,
              x: moveStart.layout.x + event.clientX - moveStart.clientX,
              y: moveStart.layout.y + event.clientY - moveStart.clientY,
            },
            interactionMetrics,
          )
        },
        onEnd: () => {
          if (moveStart !== undefined) finishInteraction()
          moveStart = undefined
        },
      }))
    }

    if (resizeHandle !== undefined) {
      dragGesture(resizeHandle, () => ({
        canStart: (event) =>
          !narrowViewport() &&
          (event.pointerType === 'touch' || event.button === 0),
        stopPropagation: true,
        onStart: (event) => {
          interactionMetrics = currentMetrics()
          resizeStart = { clientX: event.clientX, layout: layout() }
          setInteracting('resize')
        },
        onMove: (event) => {
          if (resizeStart === undefined) return
          applyMove(
            {
              ...resizeStart.layout,
              width:
                resizeStart.layout.width + event.clientX - resizeStart.clientX,
            },
            interactionMetrics,
          )
        },
        onEnd: () => {
          if (resizeStart !== undefined) finishInteraction()
          resizeStart = undefined
        },
      }))
    }

    const resize = (): void => {
      if (interacting() === null) synchronizeLayout()
    }
    window.addEventListener('resize', resize)
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            if (interacting() === null) synchronizeLayout()
          })
    const boundary = boundaryElement()
    if (boundary !== undefined) observer?.observe(boundary)
    if (rootElement !== undefined) observer?.observe(rootElement)
    const protectionRoot = boundary?.parentElement ?? boundary
    const observedProtectedElements = new Set<Element>()
    const observeProtectedElements = (): void => {
      if (observer === undefined || protectionRoot === undefined) return
      let elements: Element[] = []
      try {
        elements = Array.from(
          protectionRoot.querySelectorAll(protectedSelector()),
        )
      } catch {
        return
      }
      const nextElements = new Set(
        elements.filter(
          (element) =>
            element !== rootElement && rootElement?.contains(element) !== true,
        ),
      )
      for (const element of observedProtectedElements) {
        if (nextElements.has(element)) continue
        observer.unobserve(element)
        observedProtectedElements.delete(element)
      }
      for (const element of nextElements) {
        if (observedProtectedElements.has(element)) continue
        observer.observe(element)
        observedProtectedElements.add(element)
      }
    }
    observeProtectedElements()
    const mutationObserver =
      typeof MutationObserver === 'undefined' || protectionRoot === undefined
        ? undefined
        : new MutationObserver((records) => {
            const hasExternalMutation = records.some(
              (record) =>
                rootElement === undefined ||
                (record.target !== rootElement &&
                  !rootElement.contains(record.target)),
            )
            if (!hasExternalMutation) return
            observeProtectedElements()
            if (interacting() === null) synchronizeLayout()
          })
    if (mutationObserver !== undefined && protectionRoot !== undefined) {
      mutationObserver.observe(protectionRoot, {
        attributes: true,
        attributeFilter: ['data-guitar-night-secondary-protected', 'open'],
        childList: true,
        subtree: true,
      })
    }

    synchronizeLayout()
    onCleanup(() => {
      media?.removeEventListener('change', onMediaChange)
      window.removeEventListener('resize', resize)
      observer?.disconnect()
      mutationObserver?.disconnect()
    })
  })

  const floatingStyle = createMemo<JSX.CSSProperties>(() =>
    narrowViewport()
      ? {}
      : {
          transform: `translate3d(${layout().x}px, ${layout().y}px, 0)`,
          width: `${layout().width}px`,
        },
  )
  const widthRange = createMemo(() =>
    secondaryPartWidthRange(
      boundarySize().width > 0 ? boundarySize().width : 1_024,
    ),
  )

  const strip = (
    <div class={styles.strip} aria-hidden="true">
      <i class={styles.playhead} />
      <For each={props.lane().tuning.labels}>
        {(label, stringIndex) => (
          <div class={styles.string} data-secondary-part-string>
            <span>{label}</span>
            <i />
            <div>
              <For each={byString()[stringIndex()] ?? []}>
                {(note) => (
                  <b
                    classList={{
                      [styles.noteActive]: noteActive(note),
                      [styles.notePast]: notePast(note),
                    }}
                    data-note-id={note.id}
                    style={{
                      left: `${tabNoteOffsetPercent(
                        note.startBeat,
                        props.playheadBeat(),
                        SECONDARY_PART_WINDOW_BEATS,
                      )}%`,
                    }}
                  >
                    {note.fret}
                  </b>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  )

  return (
    <div
      ref={rootElement}
      class={styles.panel}
      classList={{ [styles.interacting]: interacting() !== null }}
      style={floatingStyle()}
      data-testid="guitar-night-secondary-part"
      data-placement-mode={narrowViewport() ? 'docked' : 'floating'}
      data-positioned={positioned() ? 'true' : 'false'}
      data-layout-key={activeLayoutKey}
      data-collapsed={narrowViewport() && collapsed() ? 'true' : 'false'}
    >
      <div class={styles.chrome}>
        <button
          ref={moveHandle}
          type="button"
          class={styles.moveHandle}
          disabled={narrowViewport()}
          aria-label={
            narrowViewport()
              ? `${props.lane().trackName} preview is docked on this screen`
              : `Move ${props.lane().trackName} preview`
          }
          aria-describedby="guitar-night-secondary-part-move-help"
          title={
            narrowViewport()
              ? 'Docked on smaller screens'
              : 'Drag to move · arrow keys move precisely'
          }
          onKeyDown={handleMoveKeyDown}
        >
          <GripVertical />
          <strong>{props.lane().trackName}</strong>
        </button>
        <Show when={narrowViewport()}>
          <button
            type="button"
            class={styles.collapse}
            aria-expanded={!collapsed()}
            aria-controls="guitar-night-secondary-part-body"
            aria-label={
              collapsed()
                ? `Expand ${props.lane().trackName} preview`
                : `Collapse ${props.lane().trackName} preview`
            }
            title={collapsed() ? 'Show the tab preview' : 'Make more room'}
            onClick={toggleCollapsed}
          >
            <Show when={collapsed()} fallback={<ChevronDown size={16} />}>
              <ChevronUp />
            </Show>
          </button>
        </Show>
        <button
          type="button"
          class={styles.reset}
          aria-label={`Reset ${props.lane().trackName} preview position`}
          title="Return to the safe corner"
          onClick={resetLayout}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <Show when={!narrowViewport() || !collapsed()}>
        <Show
          when={props.onSwap !== undefined}
          fallback={
            <div
              id="guitar-night-secondary-part-body"
              class={styles.body}
              role="img"
              aria-label={summary()}
            >
              {strip}
            </div>
          }
        >
          <button
            id="guitar-night-secondary-part-body"
            type="button"
            class={styles.body}
            aria-label={`Read ${props.lane().trackName} instead`}
            title={`Read ${props.lane().trackName} instead`}
            onClick={() => props.onSwap?.(props.lane().trackId)}
          >
            {strip}
          </button>
        </Show>
      </Show>

      <div
        ref={resizeHandle}
        class={styles.resizeHandle}
        role="slider"
        tabIndex={narrowViewport() ? -1 : 0}
        aria-hidden={narrowViewport()}
        aria-label={`Resize ${props.lane().trackName} preview horizontally`}
        aria-orientation="horizontal"
        aria-valuemin={Math.round(widthRange().min)}
        aria-valuemax={Math.round(widthRange().max)}
        aria-valuenow={Math.round(layout().width)}
        aria-valuetext={`${Math.round(layout().width)} pixels wide`}
        title="Drag the right edge to show more tab"
        onKeyDown={handleResizeKeyDown}
      />

      <span id="guitar-night-secondary-part-move-help" class={styles.hidden}>
        Use the arrow keys to move. Hold Shift for a larger step. Press Home to
        reset.
      </span>
      <span class={styles.hidden} role="status" aria-live="polite">
        {announcement()}
      </span>
    </div>
  )
}
