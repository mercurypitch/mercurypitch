// Studio comp lanes — a loop take's passes as rows under its lane: drag along one to use that stretch of it, or pick the stretch with the keys.
//
// Comp opens a clip's passes here (comp-editor.ts), newest on top, each
// drawn over the clip's span and lit where it plays. A drag along a pass
// uses it there, snapped to the ruler's grid while Snap is on (Alt places
// it freely, as it does a clip): one drag, one edit, one undo, and the clip
// above sounds and draws the comp at once. A press without a drag picks
// the grid cell under it for the keys: Left and Right move the stretch a
// cell, Shift with them sizes it, Up and Down go to another pass, Enter
// uses the focused pass there, Escape closes. A phone has the lane sheet
// instead (StudioCompSheet.tsx).
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, on, Show, } from 'solid-js'
import { studioClipOnPass } from '@/lib/studio/model/clip-passes'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { closeStudioComp, studioCompClipId } from './comp-editor'
import type { StudioCompRow, StudioCompSpan } from './comp-rows'
import { studioCompCell, studioCompLit, studioCompRows, studioCompSnap, studioCompStartSpan, studioCompStep, studioCompSwipe, studioCompTimelineFrame, studioCompUnlit, } from './comp-rows'
import styles from './StudioCompLanes.module.css'
import { studioWaveSpan } from './StudioTimelineClip'
import { StudioWaveform } from './StudioWaveform'
import { clipEndFrame, formatStudioTime, frameToPixel, } from './timeline-geometry'
import { studioGridInterval } from './timeline-snap'
import type { StudioTimelineProps } from './types'
import type { StudioWaveformResource } from './waveform-resource'

/** How far a press moves before it becomes a drag, in pixels. */
const DRAG_SLOP_PX = 4

/** What the rows read from the timeline around them. */
export interface StudioCompView {
  readonly scale: Accessor<number>
  readonly scroll: Accessor<number>
  readonly contentWidth: Accessor<number>
  readonly snap: Accessor<boolean>
  readonly resource: Accessor<StudioWaveformResource>
}

type CompTimeline = Pick<
  StudioTimelineProps,
  'project' | 'assets' | 'writable' | 'phone' | 'playheadFrame' | 'onCommand'
>

interface StudioCompLanesProps {
  trackId: string
  timeline: CompTimeline
  view: StudioCompView
}

export function StudioCompLanes(props: StudioCompLanesProps) {
  const clip = createMemo(() => {
    const id = studioCompClipId()
    return id === null
      ? null
      : (props.timeline.project.clips.find((item) => item.id === id) ?? null)
  })
  // A clip that leaves the song, or a song left for another, closes them.
  createEffect(() => {
    if (studioCompClipId() !== null && clip() === null) closeStudioComp()
  })
  const shown = () => {
    const open = clip()
    return !props.timeline.phone &&
      open?.trackId === props.trackId &&
      open.passes !== undefined
      ? open
      : null
  }
  return (
    <Show when={shown()}>
      {(open) => (
        <CompRows clip={open} timeline={props.timeline} view={props.view} />
      )}
    </Show>
  )
}

interface CompRowsProps {
  clip: Accessor<StudioClip>
  timeline: CompTimeline
  view: StudioCompView
}

interface Drag {
  readonly pass: number
  readonly pointerId: number
  readonly x: number
  readonly anchor: number
  moved: boolean
}

function CompRows(props: CompRowsProps) {
  const hint = createUniqueId()
  const clip = () => props.clip()
  const scale = () => props.view.scale()
  // The same rows for as long as the clip has the same passes: focus stays put.
  const rows = createMemo(() => studioCompRows(clip()), [], {
    equals: (before, after) => before.length === after.length,
  })
  const left = createMemo(() => frameToPixel(clip().startFrame, scale()))
  const width = createMemo(() =>
    Math.max(1, frameToPixel(clipEndFrame(clip()), scale()) - left()),
  )
  const span = createMemo(
    () =>
      studioWaveSpan(
        width(),
        props.view.scroll() - left(),
        props.view.scroll() + props.view.contentWidth() - left(),
      ),
    null,
    {
      equals: (before, after) =>
        before?.from === after?.from && before?.to === after?.to,
    },
  )
  const asset = () =>
    props.timeline.assets.find((item) => item.id === clip().assetId)
  // The ruler's grid: beats on a bars ruler, round seconds on a time one.
  const grid = () =>
    studioGridInterval(
      scale(),
      props.timeline.project.ruler === 'bars'
        ? props.timeline.project.tempoBpm
        : undefined,
    )
  const snapping = (free: boolean) =>
    props.view.snap() && !free ? grid() : null
  /** A span of the clip's source frames, in pixels from the clip's left edge. */
  const place = (part: StudioCompSpan) => ({
    left: `${frameToPixel(part.from - clip().sourceInFrame, scale())}px`,
    width: `${frameToPixel(part.to - part.from, scale())}px`,
  })
  const [preview, setPreview] = createSignal<{
    pass: number
    span: StudioCompSpan
  } | null>(null)
  const [selection, setSelection] = createSignal<StudioCompSpan | null>(null)
  const [focused, setFocused] = createSignal<number | null>(null)
  // The keys' pick shows once the keys or a click make one: a swipe is done.
  const [keyed, setKeyed] = createSignal(false)
  const picking = (pass: number) => keyed() && focused() === pass
  let pointing = false
  const strips = new Map<number, HTMLElement>()
  let drag: Drag | null = null
  // Another clip's passes start their own pick.
  createEffect(
    on(
      () => clip().id,
      () => setSelection(null),
      { defer: true },
    ),
  )

  const current = () =>
    selection() ??
    studioCompStartSpan(clip(), props.timeline.playheadFrame, grid())
  const sourceAt = (event: MouseEvent, strip: HTMLElement) =>
    clip().sourceInFrame +
    Math.round(
      ((event.clientX - strip.getBoundingClientRect().left) / scale()) *
        STUDIO_SAMPLE_RATE,
    )
  const use = (pass: number, from: number, to: number) => {
    const edit = studioCompSwipe(clip(), pass, from, to)
    if (edit && props.timeline.writable) props.timeline.onCommand(edit)
  }

  function close(): void {
    const id = clip().id
    closeStudioComp()
    // Back to the clip the passes belong to, not to the page.
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-studio-clip]',
    ))
      if (element.dataset.studioClip === id) element.focus()
  }

  function label(row: StudioCompRow): string {
    const lit = studioCompLit(clip(), row.pass)
    const whole =
      lit.length === 1 &&
      lit[0].from === clip().sourceInFrame &&
      lit[0].to === clip().sourceOutFrame
    const plays =
      lit.length === 0
        ? 'unused'
        : whole
          ? 'plays the whole clip'
          : `plays ${lit.length} ${lit.length === 1 ? 'stretch' : 'stretches'}`
    const count = clip().passes?.count ?? 0
    const at = (frame: number) =>
      formatStudioTime(studioCompTimelineFrame(clip(), frame))
    const picked = picking(row.pass)
      ? `. Picked ${at(current().from)} to ${at(current().to)}`
      : ''
    return `Pass ${row.number} of ${count}${row.number === count ? ', newest' : ''}, ${plays}${picked}`
  }

  /** Focus the pass a row above (-1) or below (1), if there is one. */
  function moveRow(row: StudioCompRow, by: -1 | 1): void {
    const next = rows().findIndex((item) => item.pass === row.pass) + by
    if (next >= 0 && next < rows().length)
      strips.get(rows()[next].pass)?.focus()
  }

  /** Enter uses the pick; a pick nobody can see yet shows first and waits for the next Enter. */
  function enter(row: StudioCompRow): void {
    if (keyed()) use(row.pass, current().from, current().to)
    else setKeyed(true)
  }

  function keyDown(event: KeyboardEvent, row: StudioCompRow): void {
    const step =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step !== 0) {
      setSelection(
        studioCompStep(clip(), current(), grid(), step, event.shiftKey),
      )
      setKeyed(true)
    } else if (event.key === 'ArrowUp') moveRow(row, -1)
    else if (event.key === 'ArrowDown') moveRow(row, 1)
    else if (event.key === 'Enter') enter(row)
    else if (event.key === 'Escape') close()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  function pointerDown(event: PointerEvent, row: StudioCompRow): void {
    if (event.button !== 0 || !props.timeline.writable) return
    event.preventDefault()
    const strip = event.currentTarget as HTMLElement
    pointing = true
    strip.focus()
    pointing = false
    setKeyed(false)
    strip.setPointerCapture(event.pointerId)
    drag = {
      pass: row.pass,
      pointerId: event.pointerId,
      x: event.clientX,
      anchor: sourceAt(event, strip),
      moved: false,
    }
  }

  /** The stretch a drag covers so far, snapped as it will be used. */
  function dragged(event: PointerEvent, active: Drag): StudioCompSpan {
    const step = snapping(event.altKey)
    const from = studioCompSnap(clip(), active.anchor, step)
    const to = studioCompSnap(
      clip(),
      sourceAt(event, event.currentTarget as HTMLElement),
      step,
    )
    return { from: Math.min(from, to), to: Math.max(from, to) }
  }

  function pointerMove(event: PointerEvent): void {
    const active = drag
    if (!active || active.pointerId !== event.pointerId) return
    if (!active.moved && Math.abs(event.clientX - active.x) < DRAG_SLOP_PX)
      return
    active.moved = true
    setPreview({ pass: active.pass, span: dragged(event, active) })
  }

  function pointerUp(event: PointerEvent): void {
    const active = drag
    if (!active || active.pointerId !== event.pointerId) return
    drag = null
    setPreview(null)
    if (!active.moved) {
      setSelection(studioCompCell(clip(), active.anchor, grid()))
      setKeyed(true)
      return
    }
    const covered = dragged(event, active)
    use(active.pass, covered.from, covered.to)
  }

  return (
    <div
      class={styles.comp}
      role="group"
      aria-label={`Comp, ${rows().length} passes`}
      data-studio-comp={clip().id}
    >
      <div class={styles.bar}>
        <div class={styles.head}>
          <strong>Comp</strong>
          <button type="button" class={styles.done} onClick={close}>
            Done
          </button>
        </div>
        <div class={styles.time}>
          <p class={styles.hint} id={hint}>
            Drag along a pass to use that stretch of it. Arrow keys pick a
            stretch, Enter uses it.
          </p>
        </div>
      </div>
      <For each={rows()}>
        {(row) => (
          <div class={styles.row}>
            <div class={styles.head}>
              <span>Pass {row.number}</span>
              <Show when={row.number === rows().length}>
                <span class={styles.tag}>newest</span>
              </Show>
            </div>
            <div class={styles.time}>
              <div
                ref={(element) => strips.set(row.pass, element)}
                class={styles.strip}
                classList={{ [styles.writable]: props.timeline.writable }}
                role="group"
                tabIndex={0}
                aria-label={label(row)}
                aria-describedby={hint}
                data-studio-comp-pass={row.pass}
                style={{ left: `${left()}px`, width: `${width()}px` }}
                onFocus={() => {
                  setFocused(row.pass)
                  setKeyed(!pointing)
                }}
                onBlur={() =>
                  setFocused((now) => (now === row.pass ? null : now))
                }
                onKeyDown={(event) => keyDown(event, row)}
                onPointerDown={(event) => pointerDown(event, row)}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => {
                  drag = null
                  setPreview(null)
                }}
              >
                <For each={studioCompLit(clip(), row.pass)}>
                  {(part) => (
                    <span
                      class={styles.lit}
                      data-studio-comp-lit=""
                      style={place(part)}
                    />
                  )}
                </For>
                <Show when={span()}>
                  {(drawn) => (
                    <PassWave
                      clip={studioClipOnPass(clip(), row.pass)}
                      from={drawn().from}
                      to={drawn().to}
                      scale={scale()}
                      asset={asset()}
                      resource={props.view.resource()}
                    />
                  )}
                </Show>
                <For each={studioCompUnlit(clip(), row.pass)}>
                  {(part) => (
                    <span
                      class={styles.unlit}
                      data-studio-comp-unlit=""
                      style={place(part)}
                    />
                  )}
                </For>
                <Show when={preview()?.pass === row.pass && preview()}>
                  {(shown) => (
                    <span class={styles.preview} style={place(shown().span)} />
                  )}
                </Show>
                <Show when={picking(row.pass)}>
                  <span
                    class={styles.picked}
                    data-studio-comp-picked=""
                    style={place(current())}
                  />
                </Show>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}

/** One pass's audio over the drawn part of the clip's span. */
function PassWave(props: {
  clip: StudioClip
  from: number
  to: number
  scale: number
  asset: StudioAsset | undefined
  resource: StudioWaveformResource
}) {
  const source = (pixel: number) =>
    props.clip.sourceInFrame +
    Math.min(
      props.clip.sourceOutFrame - props.clip.sourceInFrame,
      Math.round((pixel / props.scale) * STUDIO_SAMPLE_RATE),
    )
  return (
    <span
      class={styles.wave}
      style={{ left: `${props.from}px`, width: `${props.to - props.from}px` }}
    >
      <StudioWaveform
        clip={props.clip}
        asset={props.asset}
        resource={props.resource}
        width={props.to - props.from}
        sourceInFrame={source(props.from)}
        sourceOutFrame={source(props.to)}
      />
    </span>
  )
}
