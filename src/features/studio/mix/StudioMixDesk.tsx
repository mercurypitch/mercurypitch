// ============================================================
// Studio mixing desk — a drawer under the arrangement: a strip per lane, then the song's master
// ============================================================
//
// The desk owns no mix state. Each strip is the lane header's own
// StudioTrackControls in its strip layout, so a fader, knob, Mute or Solo
// sends the same `update-track` command and glides into a playing song the
// same way. The master side is the Sound panel's: the same flavour buttons,
// the same macro drafts drawn as dials, and the transport's output meter.
// The engine meters only the master, so the strips carry no level meters.
//
// The desk takes its height from the arrangement above it: as tall as its
// strips like, but never so tall that fewer than two lanes stay in view. A
// short desk draws compact strips. Its top edge drags to another height,
// which this device remembers; a double-click there returns to automatic.
import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { X } from '@/components/icons'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import { StudioOutputMeter } from '../audio/StudioOutputMeter'
import { StudioFlavourChoices, studioSoundAdjusted, } from '../sound/StudioFlavourChoices'
import { StudioMacroDial } from '../sound/StudioMacroDial'
import common from '../StudioPage.module.css'
import { StudioTrackControls } from '../timeline/StudioTrackControls'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'
import styles from './StudioMixDesk.module.css'

/** What the desk reads from the transport: the master output meter. */
export interface StudioMixMeterSource {
  meter(): StudioMeterSnapshot | null
  meterReady(): boolean
  peakL(): number
  peakR(): number
  resetPeakHold(): void
}

interface StudioMixDeskProps {
  project: StudioProject
  writable: boolean
  /** Finger-sized strips and dials. */
  tablet?: boolean
  meter: StudioMixMeterSource
  /** The selected lane: its strip is marked, and a strip's name selects its lane. */
  selectedTrackId?: string | null
  onSelectTrack?(trackId: string): void
  onCommand(command: StudioCommand): boolean
  onClose(): void
}

export const STUDIO_DESK_HEIGHT_KEY = 'mercurypitch.studio.mix-desk-height.v1'
export const STUDIO_DESK_MIN_HEIGHT = 196
const RESIZE_STEP = 16

function storedDeskHeight(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STUDIO_DESK_HEIGHT_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeDeskHeight(value: number | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STUDIO_DESK_HEIGHT_KEY)
    else
      window.localStorage.setItem(
        STUDIO_DESK_HEIGHT_KEY,
        String(Math.round(value)),
      )
  } catch {
    // Storage may be off (a private window): the height lasts for this visit.
  }
}

/** The arrangement's height, and the ruler, lane and scrollbar sizes the desk must leave room for. */
interface ArrangementRoom {
  readonly height: number
  readonly ruler: number
  readonly row: number
  /** A classic sideways scrollbar under the lanes; overlay scrollbars take none. */
  readonly scrollbar: number
}

export function StudioMixDesk(props: StudioMixDeskProps) {
  let desk: HTMLElement | undefined
  let strips: HTMLDivElement | undefined
  const flavourLabel = createUniqueId()
  const adjustLabel = createUniqueId()
  // Rows follow lane ids, so a commit mid-gesture never rebuilds a strip.
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  const anySolo = () => props.project.tracks.some((track) => track.solo)
  // Which edges of the strip row hide more strips, so a fade can say so.
  const [more, setMore] = createSignal({ before: false, after: false })
  const [room, setRoom] = createSignal<ArrangementRoom | null>(null)
  const [chosen, setChosen] = createSignal(storedDeskHeight())
  const [resizing, setResizing] = createSignal(false)
  let resize: { pointer: number; y: number; from: number } | null = null

  const timelineViewport = () =>
    desk?.parentElement?.querySelector<HTMLElement>(
      '[data-studio-timeline-viewport]',
    ) ?? null

  function measureRoom(): void {
    const host = desk?.parentElement
    const viewport = timelineViewport()
    const timeline = viewport?.parentElement
    if (!host || !viewport || !timeline) return
    const style = window.getComputedStyle(timeline)
    const px = (name: string, fallback: number) =>
      Number.parseFloat(style.getPropertyValue(name)) || fallback
    const next: ArrangementRoom = {
      height: host.clientHeight,
      ruler: px('--studio-ruler-height', 36),
      row: px('--studio-row-height', 96),
      scrollbar: Math.max(0, viewport.offsetHeight - viewport.clientHeight),
    }
    const last = room()
    if (
      last?.height !== next.height ||
      last.ruler !== next.ruler ||
      last.row !== next.row ||
      last.scrollbar !== next.scrollbar
    )
      setRoom(next)
  }
  // Room for the ruler and `lanes` full lanes above the desk.
  const roomFor = (lanes: number) => {
    const current = room()
    return current === null
      ? null
      : current.height - current.ruler - lanes * current.row - current.scrollbar
  }
  const tallest = () =>
    Math.max(STUDIO_DESK_MIN_HEIGHT, roomFor(1) ?? STUDIO_DESK_MIN_HEIGHT)
  /** A height chosen on the top edge, held between the floor and one lane in view. */
  const chosenHeight = () => {
    const value = chosen()
    if (value === null || room() === null) return null
    return Math.round(
      Math.max(STUDIO_DESK_MIN_HEIGHT, Math.min(tallest(), value)),
    )
  }

  /** Keep a height, held to the bounds it can have right now. */
  function choose(value: number | null): void {
    setChosen(value)
    if (value !== null && room() === null) return
    const held = chosenHeight()
    setChosen(held)
    storeDeskHeight(held)
  }

  function resizeDown(event: PointerEvent): void {
    if (event.button !== 0 || !desk) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    resize = {
      pointer: event.pointerId,
      y: event.clientY,
      from: desk.getBoundingClientRect().height,
    }
    setResizing(true)
  }

  function resizeMove(event: PointerEvent): void {
    if (resize?.pointer !== event.pointerId) return
    setChosen(resize.from + resize.y - event.clientY)
  }

  function resizeEnd(event: PointerEvent): void {
    if (resize?.pointer !== event.pointerId) return
    resize = null
    setResizing(false)
    choose(chosen())
  }

  function resizeKey(event: KeyboardEvent): void {
    const height = desk?.getBoundingClientRect().height ?? 0
    const next = {
      ArrowUp: height + RESIZE_STEP,
      ArrowDown: height - RESIZE_STEP,
      Home: STUDIO_DESK_MIN_HEIGHT,
      End: tallest(),
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    choose(next)
  }

  // A vertical wheel over the strips scrolls them sideways.
  function wheel(event: WheelEvent): void {
    if (!strips || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    if (strips.scrollWidth <= strips.clientWidth + 1) return
    const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
    event.preventDefault()
    strips.scrollLeft += event.deltaY * lines
  }

  function measure(): void {
    if (!strips) return
    const { scrollLeft, scrollWidth, clientWidth } = strips
    const before = scrollLeft > 1
    const after = scrollLeft + clientWidth < scrollWidth - 1
    const last = more()
    if (last.before !== before || last.after !== after)
      setMore({ before, after })
  }
  createEffect(on(trackIds, () => queueMicrotask(measure)))

  onMount(() => {
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            measure()
            measureRoom()
          })
    if (strips) observer?.observe(strips)
    if (desk?.parentElement) observer?.observe(desk.parentElement)
    // A sideways scrollbar appearing shrinks the viewport's content box.
    const viewport = timelineViewport()
    if (viewport) observer?.observe(viewport)
    measureRoom()
    onCleanup(() => observer?.disconnect())
    const opener = document.activeElement
    queueMicrotask(() => {
      if (desk?.isConnected === true) desk.focus({ preventScroll: true })
    })
    onCleanup(() => {
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        desk?.contains(document.activeElement) === true
      )
        opener.focus({ preventScroll: true })
    })
  })

  // Delegated, not native: a strip control cancelling its own edit on Escape
  // is lower in the tree, so it answers first and keeps the desk open.
  function keyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    event.stopPropagation()
    props.onClose()
  }

  return (
    <section
      ref={desk}
      class={styles.desk}
      classList={{
        [styles.touch]: props.tablet === true,
        [styles.resizing]: resizing(),
      }}
      style={{
        '--studio-desk-room':
          roomFor(2) === null ? undefined : `${roomFor(2)}px`,
        height: chosenHeight() === null ? undefined : `${chosenHeight()}px`,
      }}
      aria-label="Mix"
      tabindex="-1"
      data-studio-panel
      data-studio-mix-desk
      onKeyDown={keyDown}
    >
      <div
        class={styles.resize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Mix height"
        aria-valuemin={STUDIO_DESK_MIN_HEIGHT}
        aria-valuemax={tallest()}
        aria-valuenow={chosenHeight() ?? undefined}
        tabIndex={0}
        title="Drag to resize. Double-click for the automatic height."
        onPointerDown={resizeDown}
        onPointerMove={resizeMove}
        onPointerUp={resizeEnd}
        onLostPointerCapture={resizeEnd}
        onPointerCancel={resizeEnd}
        onKeyDown={resizeKey}
        onDblClick={() => choose(null)}
      />
      <div class={styles.heading}>
        <h2>Mix</h2>
        <button
          type="button"
          class={common.iconButton}
          aria-label="Close Mix"
          title="Close Mix (Esc)"
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>
      <div class={styles.body}>
        <div
          ref={strips}
          class={styles.strips}
          role="group"
          aria-label="Lanes"
          data-more-before={more().before ? '' : undefined}
          data-more-after={more().after ? '' : undefined}
          onScroll={measure}
          onWheel={wheel}
        >
          <For
            each={trackIds()}
            fallback={
              <p class={styles.empty}>Add a take to give it a channel here.</p>
            }
          >
            {(id, index) => {
              const track = () =>
                props.project.tracks.find((item) => item.id === id)!
              const selected = () => props.selectedTrackId === id
              return (
                <div
                  class={styles.strip}
                  data-studio-mix-strip={id}
                  data-selected={selected() ? '' : undefined}
                  data-silent={
                    track().mute || (anySolo() && !track().solo)
                      ? ''
                      : undefined
                  }
                  style={{
                    '--studio-track': studioTrackColor(
                      studioTrackHue(track(), index()),
                    ),
                  }}
                >
                  <StudioTrackControls
                    strip
                    track={track()}
                    writable={props.writable}
                    tablet={props.tablet === true}
                    soloedOut={anySolo() && !track().solo}
                    onCommand={props.onCommand}
                    identity={
                      <button
                        type="button"
                        class={styles.stripName}
                        title={track().name}
                        aria-current={selected() ? 'true' : undefined}
                        onClick={() => props.onSelectTrack?.(id)}
                      >
                        {track().name}
                      </button>
                    }
                  />
                </div>
              )
            }}
          </For>
        </div>
        <div
          class={styles.master}
          role="group"
          aria-label="Master"
          data-studio-mix-master
        >
          <div class={styles.masterControls}>
            <div class={styles.masterHeading}>
              <h3>Master</h3>
              <Show when={studioSoundAdjusted(props.project)}>
                <span class={styles.adjusted}>Adjusted</span>
              </Show>
              <button
                type="button"
                class={common.textButton}
                disabled={!props.writable}
                onClick={() =>
                  props.onCommand({
                    type: 'set-sound-flavour',
                    flavourId: 'natural',
                  })
                }
              >
                Reset sound
              </button>
              {/* A short tablet desk drops its title row; Close moves here. */}
              <button
                type="button"
                class={`${common.iconButton} ${styles.masterClose}`}
                aria-label="Close Mix"
                title="Close Mix (Esc)"
                onClick={() => props.onClose()}
              >
                <X />
              </button>
            </div>
            <div class={styles.group}>
              <span class={styles.groupLabel} id={flavourLabel}>
                Flavour
              </span>
              <div
                class={styles.flavours}
                role="group"
                aria-labelledby={flavourLabel}
              >
                <StudioFlavourChoices
                  project={props.project}
                  enabled={props.writable}
                  onCommand={props.onCommand}
                />
              </div>
            </div>
            <div class={styles.group}>
              <span class={styles.groupLabel} id={adjustLabel}>
                Adjust
              </span>
              <div
                class={styles.dials}
                role="group"
                aria-labelledby={adjustLabel}
              >
                <For each={MACRO_KEYS}>
                  {(name) => (
                    <StudioMacroDial
                      name={name}
                      project={props.project}
                      writable={props.writable}
                      onCommand={props.onCommand}
                    />
                  )}
                </For>
              </div>
            </div>
          </div>
          <div class={styles.meter}>
            <StudioOutputMeter
              vertical
              snapshot={props.meter.meter()}
              ready={props.meter.meterReady()}
              peakL={props.meter.peakL()}
              peakR={props.meter.peakR()}
              onReset={() => props.meter.resetPeakHold()}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
