// Studio take lanes — Show takes: a clip's takes as rows under its lane, newest on top, each drawn over the clip's span; a click or a tap on one plays it, as a click on a take lane does in REAPER.
//
// The clip's menu opens them (clip-take-menu.ts, comp-editor.ts), for one
// clip at a time and never beside its comp rows: a click here never comps,
// and a drag there never chooses a take. They look like the comp rows
// (StudioCompLanes.tsx) and stand where those do, as the lane's last child,
// so the lane grows by their height and the lanes below move down. Up and
// Down go from take to take, Enter or Space plays the focused one, and
// Escape or Hide takes closes them, the focus back on the clip. The lane's
// header is left as it is: each row's name sits in the header column.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createUniqueId, For, Show } from 'solid-js'
import { studioClipActiveTake, studioClipTakeList, } from '@/lib/studio/model/clip-takes'
import type { StudioClip } from '@/lib/studio/model/types'
import { studioClipTakeName } from './clip-take-name'
import { closeStudioTakes, studioTakesClipId } from './comp-editor'
import { PassWave } from './StudioCompLanes'
import compStyles from './StudioCompLanes.module.css'
import styles from './StudioTakeLanes.module.css'
import { studioWaveSpan } from './StudioTimelineClip'
import { clipEndFrame, frameToPixel } from './timeline-geometry'
import type { StudioTimelineProps } from './types'
import type { StudioWaveformResource } from './waveform-resource'

/** What the rows read from the timeline around them. */
export interface StudioTakesView {
  readonly scale: Accessor<number>
  readonly scroll: Accessor<number>
  readonly contentWidth: Accessor<number>
  readonly resource: Accessor<StudioWaveformResource>
}

type TakesTimeline = Pick<
  StudioTimelineProps,
  'project' | 'assets' | 'writable' | 'phone' | 'tablet' | 'onCommand'
>

interface StudioTakeLanesProps {
  trackId: string
  timeline: TakesTimeline
  view: StudioTakesView
}

export function StudioTakeLanes(props: StudioTakeLanesProps) {
  const clip = createMemo(() => {
    const id = studioTakesClipId()
    return id === null
      ? null
      : (props.timeline.project.clips.find((item) => item.id === id) ?? null)
  })
  // A clip that leaves the song, or keeps one take only, closes them.
  createEffect(() => {
    if (studioTakesClipId() !== null && clip()?.takes === undefined)
      closeStudioTakes()
  })
  const shown = () => {
    const open = clip()
    return open?.trackId === props.trackId && open.takes !== undefined
      ? open
      : null
  }
  return (
    <Show when={shown()}>
      {(open) => (
        <TakeRows clip={open} timeline={props.timeline} view={props.view} />
      )}
    </Show>
  )
}

interface TakeRowsProps {
  clip: Accessor<StudioClip>
  timeline: TakesTimeline
  view: StudioTakesView
}

function TakeRows(props: TakeRowsProps) {
  const hint = createUniqueId()
  const clip = () => props.clip()
  const scale = () => props.view.scale()
  const takes = createMemo(() => studioClipTakeList(clip()))
  // Newest on top: each take's place in the order they were sung, the last
  // first. The same rows while the clip keeps as many takes: focus stays put.
  const order = createMemo(
    () => takes().map((_, index) => takes().length - 1 - index),
    [],
    { equals: (before, after) => before.length === after.length },
  )
  const playing = () => studioClipActiveTake(clip())
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
  const asset = (index: number) =>
    props.timeline.assets.find((item) => item.id === takes()[index]?.assetId)
  const name = (index: number) =>
    studioClipTakeName(asset(index), `Take ${index + 1}`)
  const rows = new Map<number, HTMLButtonElement>()

  function close(): void {
    const id = clip().id
    closeStudioTakes()
    // Back to the clip the takes belong to, not to the page.
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-studio-clip]',
    ))
      if (element.dataset.studioClip === id) element.focus()
  }

  function choose(index: number): void {
    if (index === playing() || !props.timeline.writable) return
    props.timeline.onCommand({
      type: 'choose-take',
      clipId: clip().id,
      take: index,
    })
  }

  function keyDown(event: KeyboardEvent, index: number): void {
    const at = order().indexOf(index)
    if (event.key === 'ArrowUp') rows.get(order()[at - 1])?.focus()
    else if (event.key === 'ArrowDown') rows.get(order()[at + 1])?.focus()
    else if (event.key === 'Escape') close()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const touch = () => props.timeline.phone || props.timeline.tablet === true
  return (
    <div
      class={compStyles.comp}
      role="group"
      aria-label={`Takes, ${takes().length}`}
      data-studio-takes={clip().id}
    >
      <div class={compStyles.bar}>
        <div class={compStyles.head}>
          <strong>Takes</strong>
        </div>
        <div class={compStyles.time}>
          <div class={styles.tools}>
            <button
              type="button"
              class={compStyles.done}
              aria-keyshortcuts="Escape"
              onClick={close}
            >
              Hide takes
            </button>
            <p class={styles.hint} id={hint}>
              {touch() ? 'Tap' : 'Click'} a take to play it.
            </p>
          </div>
        </div>
      </div>
      <For each={order()}>
        {(index) => (
          <div class={compStyles.row}>
            <div class={compStyles.head}>
              <span class={styles.name}>{name(index)}</span>
              <Show when={index === playing() && !props.timeline.phone}>
                <span class={compStyles.tag}>playing</span>
              </Show>
            </div>
            <div class={compStyles.time}>
              <button
                ref={(element) => rows.set(index, element)}
                type="button"
                class={`${compStyles.strip} ${styles.take}`}
                classList={{ [styles.playing]: index === playing() }}
                aria-pressed={index === playing()}
                aria-label={name(index)}
                aria-describedby={hint}
                disabled={!props.timeline.writable}
                data-studio-take-row={index}
                style={{ left: `${left()}px`, width: `${width()}px` }}
                onClick={() => choose(index)}
                onKeyDown={(event) => keyDown(event, index)}
              >
                <Show when={span()}>
                  {(drawn) => (
                    <PassWave
                      clip={takes()[index]}
                      from={drawn().from}
                      to={drawn().to}
                      scale={scale()}
                      asset={asset(index)}
                      resource={props.view.resource()}
                    />
                  )}
                </Show>
              </button>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
