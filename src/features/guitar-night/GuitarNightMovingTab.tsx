// Guitar Night moving Tab renders a dense score with its own calm, persisted reading scale.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Maximize2, Minimize2 } from '@/components/icons'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { createPersistedSignal } from '@/lib/storage'
import styles from './GuitarNightApp.module.css'
import { adaptiveTabWindowBeats, buildStageTabWindowIndex, clampTabZoomMultiplier, TAB_DEFAULT_ZOOM_MULTIPLIER, TAB_MAX_ZOOM_MULTIPLIER, TAB_MIN_ZOOM_MULTIPLIER, TAB_PLAYHEAD_RATIO, tabLoopWindow, tabNoteScale, tabWindowNotes, zoomedTabWindowBeats, } from './tab-window'

export const GUITAR_NIGHT_TAB_ZOOM_KEY = 'guitar-night-tab-zoom-v1'
export const GUITAR_NIGHT_TAB_SIZE_KEY = 'guitar-night-tab-size-v1'

const WHEEL_ZOOM_PERSIST_IDLE_MS = 180

type GuitarNightTabSize = 'compact' | 'large'

interface GuitarNightMovingTabProps {
  notes: Accessor<readonly GuitarNote[]>
  tuning: Accessor<InstrumentTuning>
  tempoBpm: Accessor<number | null>
  playheadBeat: Accessor<number | null>
  summary: Accessor<string>
  hasGuide: Accessor<boolean>
  loopStart: Accessor<number | null>
  loopEnd: Accessor<number | null>
  loopActive: Accessor<boolean>
}

interface PointerPosition {
  x: number
  y: number
}

function formatBeatSpan(beats: number): string {
  return Number.isInteger(beats)
    ? String(beats)
    : beats.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function GuitarNightMovingTab(props: GuitarNightMovingTabProps) {
  let gestureSurface: HTMLDivElement | undefined
  const [tabSize, setTabSize] = createPersistedSignal<GuitarNightTabSize>(
    GUITAR_NIGHT_TAB_SIZE_KEY,
    'compact',
    {
      validator: (value): value is GuitarNightTabSize =>
        value === 'compact' || value === 'large',
    },
  )
  const [persistedZoomMultiplier, setPersistedZoomMultiplier] =
    createPersistedSignal<number>(
      GUITAR_NIGHT_TAB_ZOOM_KEY,
      TAB_DEFAULT_ZOOM_MULTIPLIER,
      {
        validator: (value): value is number =>
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= TAB_MIN_ZOOM_MULTIPLIER &&
          value <= TAB_MAX_ZOOM_MULTIPLIER,
      },
    )
  const [zoomMultiplier, setZoomMultiplier] = createSignal(
    persistedZoomMultiplier(),
  )
  let zoomDirty = false
  let wheelPersistTimer: ReturnType<typeof setTimeout> | undefined
  const index = createMemo(() => buildStageTabWindowIndex(props.notes()))
  const timelineOriginBeat = createMemo(() => index().notes[0]?.startBeat ?? 0)
  const adaptiveWindow = createMemo(() =>
    adaptiveTabWindowBeats(props.notes(), props.tempoBpm()),
  )
  const windowBeats = createMemo(() =>
    zoomedTabWindowBeats(adaptiveWindow(), zoomMultiplier()),
  )
  const zoomPercent = createMemo(() => Math.round(zoomMultiplier() * 100))
  const beatSpanLabel = createMemo(() => formatBeatSpan(windowBeats()))
  const noteScale = createMemo(() => tabNoteScale(windowBeats()))
  const zoomValueText = createMemo(
    () => `${zoomPercent()}% zoom, ${beatSpanLabel()} beats visible`,
  )
  const visibleNotes = createMemo(() =>
    tabWindowNotes(index(), props.playheadBeat(), windowBeats()),
  )
  const visibleNotesByString = createMemo(() => {
    const rows = Array.from(
      { length: props.tuning().stringCount },
      () => [] as GuitarNote[],
    )
    for (const note of visibleNotes()) rows[note.stringIndex]?.push(note)
    return rows
  })
  const loop = createMemo(() =>
    tabLoopWindow(
      props.loopStart(),
      props.loopEnd(),
      props.playheadBeat(),
      windowBeats(),
    ),
  )

  const tabTrackWidthPercent = createMemo(() => 100 / windowBeats())
  const tabTrackShiftPercent = createMemo(
    () =>
      (timelineOriginBeat() +
        windowBeats() * TAB_PLAYHEAD_RATIO -
        (props.playheadBeat() ?? 0)) *
      100,
  )

  createEffect(() => {
    const persisted = persistedZoomMultiplier()
    if (!zoomDirty) setZoomMultiplier(persisted)
  })

  const clearWheelPersistTimer = (): void => {
    if (wheelPersistTimer === undefined) return
    clearTimeout(wheelPersistTimer)
    wheelPersistTimer = undefined
  }

  const persistZoom = (): void => {
    clearWheelPersistTimer()
    if (!zoomDirty) return
    const next = zoomMultiplier()
    zoomDirty = false
    setPersistedZoomMultiplier(next)
  }

  const scheduleWheelZoomPersist = (): void => {
    clearWheelPersistTimer()
    wheelPersistTimer = setTimeout(persistZoom, WHEEL_ZOOM_PERSIST_IDLE_MS)
  }

  const updateZoom = (value: number): boolean => {
    const next = clampTabZoomMultiplier(value)
    if (next === zoomMultiplier()) return false
    setZoomMultiplier(next)
    zoomDirty = true
    return true
  }

  const pointers = new Map<number, PointerPosition>()
  let pinchStartDistance = 0
  let pinchStartZoom = TAB_DEFAULT_ZOOM_MULTIPLIER

  const beginPinch = (): void => {
    const [first, second] = [...pointers.values()]
    if (first === undefined || second === undefined) return
    pinchStartDistance = Math.hypot(first.x - second.x, first.y - second.y)
    pinchStartZoom = zoomMultiplier()
  }
  const handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return
    try {
      gestureSurface?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events do not always enter the browser's active set.
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size !== 2) return
    beginPinch()
    event.preventDefault()
  }
  const handlePointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size < 2 || pinchStartDistance <= 0) return
    const [first, second] = [...pointers.values()]
    if (first === undefined || second === undefined) return
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    if (distance <= 0) return
    event.preventDefault()
    updateZoom(pinchStartZoom * (distance / pinchStartDistance))
  }
  const handlePointerEnd = (event: PointerEvent): void => {
    const wasPinching = pointers.size >= 2 && pinchStartDistance > 0
    if (!pointers.delete(event.pointerId)) return
    if (gestureSurface?.hasPointerCapture?.(event.pointerId) === true) {
      gestureSurface.releasePointerCapture?.(event.pointerId)
    }
    if (pointers.size === 2) beginPinch()
    else pinchStartDistance = 0
    if (wasPinching && pointers.size < 2) persistZoom()
  }
  const handleWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0 || event.ctrlKey || event.metaKey) return
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? (gestureSurface?.clientHeight ?? 640)
          : 1
    const next = zoomMultiplier() * Math.exp((-event.deltaY * unit) / 600)
    if (!updateZoom(next)) return
    event.preventDefault()
    scheduleWheelZoomPersist()
  }

  onMount(() => {
    const surface = gestureSurface
    if (surface === undefined) return
    surface.addEventListener('pointerdown', handlePointerDown)
    surface.addEventListener('pointermove', handlePointerMove)
    surface.addEventListener('pointerup', handlePointerEnd)
    surface.addEventListener('pointercancel', handlePointerEnd)
    surface.addEventListener('wheel', handleWheel, { passive: false })
    onCleanup(() => {
      persistZoom()
      pointers.clear()
      surface.removeEventListener('pointerdown', handlePointerDown)
      surface.removeEventListener('pointermove', handlePointerMove)
      surface.removeEventListener('pointerup', handlePointerEnd)
      surface.removeEventListener('pointercancel', handlePointerEnd)
      surface.removeEventListener('wheel', handleWheel)
    })
  })

  return (
    <div
      class={styles.stageTab}
      data-tab-size={tabSize()}
      data-string-count={props.tuning().stringCount}
      data-window-beats={windowBeats().toFixed(2)}
      style={{
        '--stage-tab-note-base-size': `${(1.6 * noteScale()).toFixed(3)}rem`,
        '--stage-tab-note-base-font-size': `${(0.68 * noteScale()).toFixed(3)}rem`,
      }}
    >
      <div
        ref={gestureSurface}
        class={styles.stageTabLanes}
        role="img"
        aria-label={props.summary()}
        data-testid="guitar-night-moving-tab"
        style={{
          '--stage-tab-track-width': `${tabTrackWidthPercent()}%`,
          '--stage-tab-track-shift': `${tabTrackShiftPercent()}%`,
        }}
      >
        <div class={styles.stageTabGuideLayer} aria-hidden="true">
          <Show when={loop().range}>
            {(range) => (
              <div
                class={styles.stageTabLoopRange}
                data-active={props.loopActive() ? 'true' : undefined}
                data-testid="guitar-night-tab-loop-range"
                style={{
                  left: `${range().leftPercent}%`,
                  width: `${range().widthPercent}%`,
                }}
              />
            )}
          </Show>
          <For each={loop().markers}>
            {(marker) => (
              <div
                class={styles.stageTabLoopMarker}
                data-mark={marker.mark}
                data-active={props.loopActive() ? 'true' : undefined}
                data-testid={`guitar-night-tab-loop-marker-${marker.mark.toLowerCase()}`}
                style={{ left: `${marker.offsetPercent}%` }}
              >
                <span>{marker.mark}</span>
              </div>
            )}
          </For>
          <div
            class={styles.stageTabPlayhead}
            style={{ left: `${TAB_PLAYHEAD_RATIO * 100}%` }}
          />
        </div>
        <For each={props.tuning().labels}>
          {(label, stringIndex) => (
            <div class={styles.stageTabString}>
              <span>{label}</span>
              <i aria-hidden="true" />
              <div aria-hidden="true" data-testid="guitar-night-tab-note-track">
                <div class={styles.stageTabNoteFlow}>
                  <For each={visibleNotesByString()[stringIndex()] ?? []}>
                    {(note) => (
                      <b
                        classList={{
                          [styles.stageTabNoteActive]:
                            props.playheadBeat() !== null &&
                            note.startBeat <= (props.playheadBeat() ?? 0) &&
                            note.startBeat + note.duration >
                              (props.playheadBeat() ?? 0),
                          [styles.stageTabNotePast]:
                            props.playheadBeat() !== null &&
                            note.startBeat + note.duration <=
                              (props.playheadBeat() ?? 0),
                          [styles.stageTabNoteBacking]: note.isBacking === true,
                        }}
                        data-note-id={note.id}
                        style={{
                          left: `${(note.startBeat - timelineOriginBeat()) * 100}%`,
                        }}
                      >
                        {note.fret}
                      </b>
                    )}
                  </For>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={props.hasGuide()}>
        <div
          class={styles.stageTabControls}
          data-guitar-night-secondary-protected
          role="group"
          aria-label="Tab reading controls"
        >
          <button
            type="button"
            class={styles.stageTabSizeToggle}
            aria-label="Large tab size"
            aria-pressed={tabSize() === 'large'}
            title={
              tabSize() === 'large'
                ? 'Return to compact strings and notes'
                : 'Make strings and notes larger for distance reading'
            }
            onClick={() =>
              setTabSize((current) =>
                current === 'compact' ? 'large' : 'compact',
              )
            }
          >
            <Show
              when={tabSize() === 'large'}
              fallback={<Maximize2 size={15} />}
            >
              <Minimize2 size={15} />
            </Show>
            <span>{tabSize() === 'large' ? 'Large' : 'Compact'}</span>
          </button>
          <label
            class={styles.stageTabZoom}
            title="Scroll over the tab, pinch with two fingers on touch, or drag this control."
          >
            <span>Tab zoom</span>
            <input
              type="range"
              min={TAB_MIN_ZOOM_MULTIPLIER * 100}
              max={TAB_MAX_ZOOM_MULTIPLIER * 100}
              step="1"
              value={zoomPercent()}
              aria-label="Tab zoom"
              aria-valuetext={zoomValueText()}
              onInput={(event) =>
                updateZoom(Number(event.currentTarget.value) / 100)
              }
              onChange={persistZoom}
              onPointerUp={persistZoom}
              onPointerCancel={persistZoom}
              onBlur={persistZoom}
            />
            <output aria-hidden="true">{zoomPercent()}%</output>
            <small>{beatSpanLabel()} beats</small>
          </label>
        </div>
      </Show>

      <Show when={!props.hasGuide()}>
        <p>
          No tab attached to this song. Load a tab later, or stay in free play.
        </p>
      </Show>
    </div>
  )
}
