// ============================================================
// Studio lane menus — a right-click, a long press, or the menu key on the lanes opens the Studio's own menu in place of the browser's
// ============================================================
//
// On a lane's header (its name, chip and buttons) the lane's menu opens; on
// its empty space, or on a clip, the Studio's (lane-menu-items.ts). Only the
// lanes lose the browser's menu: the ruler, the transport and the rest of
// the page keep it. A finger held still on a header or on empty space opens
// the same menu (context-menu.ts `createStudioLongPress`), and its lift is
// not a tap; a press on a clip, a fader or the pan knob keeps its own
// gesture. Shift+F10 or the menu key opens it at the focused header.
import { createSignal, onCleanup, onMount } from 'solid-js'
import { studioLaneMakesMidiClips, studioNewClipPlace, } from '@/lib/studio/model/new-midi-clips'
import { createStudioLongPress } from '../menu/context-menu'
import type { StudioMenuItem, StudioMenuRequest, } from '../menu/StudioContextMenu'
import { StudioContextMenu } from '../menu/StudioContextMenu'
import { studioHearYourself, studioLaneMenuItems, studioSpaceMenuItems, } from './lane-menu-items'
import type { StudioLaneView } from './StudioTimelineLane'
import { pixelToFrame } from './timeline-geometry'
import type { StudioTimelineProps } from './types'
import type { StudioZoomControl } from './zoom-control'

const RUNNING_TAKE = new Set(['counting', 'recording', 'finishing'])

/** Where on a lane a press landed: its header, or its stretch of time. */
interface LaneHit {
  readonly trackId: string
  readonly lane: HTMLElement
  /** The lane's stretch of time, for a press there; null on the header. */
  readonly audio: HTMLElement | null
}

function laneHit(target: EventTarget | null): LaneHit | null {
  if (!(target instanceof Element)) return null
  const lane = target.closest<HTMLElement>('[data-studio-track]')
  const trackId = lane?.dataset.studioTrack
  if (lane === null || trackId === undefined) return null
  if (target.closest('[data-studio-lane-head]') !== null)
    return { trackId, lane, audio: null }
  const audio = target.closest<HTMLElement>('[data-studio-lane-audio]')
  return audio === null ? null : { trackId, lane, audio }
}

/** A press a control answers with a gesture of its own: a clip's drag, a fader's or the knob's. */
function ownGesture(target: Element, lane: HTMLElement): boolean {
  if (target.closest('[data-studio-clip], input') !== null) return true
  for (
    let at: Element | null = target;
    at && at !== lane;
    at = at.parentElement
  )
    if (window.getComputedStyle(at).touchAction === 'none') return true
  return false
}

export function StudioLaneMenus(props: {
  /** The timeline's scrolling viewport, which holds every lane. */
  scope(): HTMLElement | undefined
  timeline: StudioTimelineProps
  view: StudioLaneView
  zoom: StudioZoomControl
}) {
  const [request, setRequest] = createSignal<StudioMenuRequest | null>(null)

  function laneItems(trackId: string): StudioMenuItem[] {
    const timeline = props.timeline
    const track = timeline.project.tracks.find((each) => each.id === trackId)
    if (track === undefined) return []
    const lines = props.view.lines
    const arming = timeline.arming
    const armed = (arming?.laneState(trackId) ?? 'idle') !== 'idle'
    return studioLaneMenuItems({
      track,
      writable: timeline.writable,
      hearYourself:
        timeline.recordSettings === undefined
          ? undefined
          : studioHearYourself(timeline.recordSettings),
      arm:
        arming === undefined
          ? undefined
          : {
              armed,
              enabled:
                !RUNNING_TAKE.has(arming.phase()) && (armed || arming.canArm()),
              toggle: () => arming.toggle(trackId),
            },
      lines: {
        open: lines.view()?.trackId === trackId,
        held: lines.held(),
        toggle: () => {
          if (lines.view()?.trackId === trackId) return lines.close()
          timeline.onSelectClip(null)
          timeline.onSelectTrack?.(trackId)
          lines.open(track)
        },
      },
      onCommand: (command) => timeline.onCommand(command),
      onRemove: () =>
        timeline.onRemoveTrack !== undefined
          ? timeline.onRemoveTrack(trackId)
          : timeline.onCommand({ type: 'remove-track', trackId }),
      onDetails: () => timeline.onTrackDetails(trackId),
    })
  }

  function spaceItems(hit: LaneHit, x: number): StudioMenuItem[] {
    const timeline = props.timeline
    const project = timeline.project
    const track = project.tracks.find((each) => each.id === hit.trackId)
    const make = timeline.onNewMidiClip
    const clips = project.clips.filter((clip) => clip.trackId === hit.trackId)
    const left = hit.audio?.getBoundingClientRect().left ?? x
    const frame = pixelToFrame(
      x - left,
      props.view.scale(),
      Number.MAX_SAFE_INTEGER,
    )
    const newClip =
      timeline.writable &&
      make !== undefined &&
      track !== undefined &&
      studioLaneMakesMidiClips(track, clips)
        ? () => {
            const place = studioNewClipPlace(project, hit.trackId, frame)
            if ('refusal' in place) props.view.status(place.refusal)
            else make(hit.trackId, place)
          }
        : undefined
    return studioSpaceMenuItems({
      newClip,
      onAddTakes: timeline.onAddTakes,
      onNewLane: timeline.onNewLane,
      zoom: {
        canStep: (direction) => props.zoom.canStep(direction),
        step: (direction) => props.zoom.step(direction),
        fit: () => props.zoom.fit(),
        empty: project.clips.length === 0,
      },
    })
  }

  function open(hit: LaneHit, x: number, y: number, origin: Element): void {
    const track = props.timeline.project.tracks.find(
      (each) => each.id === hit.trackId,
    )
    if (track === undefined) return
    // The control it was asked from, if it is the lane's own; else the
    // lane's name. Unbounded, the lookup climbs to the focusable workspace.
    const own = origin.closest<HTMLElement>('button, [tabindex]')
    const header =
      hit.audio === null
        ? own !== null && hit.lane.contains(own)
          ? own
          : hit.lane.querySelector<HTMLElement>('[data-studio-track-header]')
        : null
    const active = document.activeElement
    const back =
      header ??
      (active instanceof HTMLElement && props.scope()?.contains(active) === true
        ? active
        : null)
    setRequest({
      x,
      y,
      label: hit.audio === null ? track.name : 'Studio',
      items: hit.audio === null ? laneItems(hit.trackId) : spaceItems(hit, x),
      returnFocus: back,
      anchor: hit.lane,
    })
  }

  const longPress = createStudioLongPress({
    onPress: (point) => {
      const hit = laneHit(point.target)
      if (hit !== null && point.target instanceof Element)
        open(hit, point.clientX, point.clientY, point.target)
    },
  })

  onMount(() => {
    const scope = props.scope()
    if (scope === undefined) return
    const contextMenu = (event: MouseEvent) => {
      const hit = laneHit(event.target)
      if (hit === null || !(event.target instanceof Element)) return
      event.preventDefault()
      // The finger's long press opened it already: Chrome on Android sends its own too.
      if (longPress.swallow()) return
      open(hit, event.clientX, event.clientY, event.target)
    }
    // Shift+F10 and the menu key: at the focused header, or the focused lane space.
    const keyDown = (event: KeyboardEvent) => {
      const menuKey =
        event.key === 'ContextMenu' ||
        (event.key === 'F10' && event.shiftKey && !event.ctrlKey)
      if (!menuKey) return
      const hit = laneHit(event.target)
      if (hit === null || !(event.target instanceof Element)) return
      event.preventDefault()
      const box = event.target.getBoundingClientRect()
      open(hit, box.left, box.bottom, event.target)
    }
    const pointerDown = (event: PointerEvent) => {
      const hit = laneHit(event.target)
      if (
        hit === null ||
        !(event.target instanceof Element) ||
        ownGesture(event.target, hit.lane)
      ) {
        longPress.end()
        longPress.reset()
        return
      }
      longPress.down(event)
    }
    const pointerMove = (event: PointerEvent) => longPress.move(event)
    const pointerUp = () => longPress.lift()
    const pointerCancel = () => longPress.end()
    // A key is a new gesture: a long press's lift may have sent no click.
    const anyKey = () => longPress.reset()
    // The lift after a long press is not a tap on what it lifted from.
    const click = (event: MouseEvent) => {
      if (!longPress.swallow()) return
      longPress.reset()
      event.preventDefault()
      event.stopPropagation()
    }
    scope.addEventListener('contextmenu', contextMenu)
    scope.addEventListener('keydown', keyDown)
    scope.addEventListener('pointerdown', pointerDown)
    scope.addEventListener('pointermove', pointerMove)
    scope.addEventListener('pointerup', pointerUp)
    scope.addEventListener('pointercancel', pointerCancel)
    scope.addEventListener('keydown', anyKey, true)
    scope.addEventListener('click', click, true)
    onCleanup(() => {
      longPress.end()
      longPress.reset()
      scope.removeEventListener('contextmenu', contextMenu)
      scope.removeEventListener('keydown', keyDown)
      scope.removeEventListener('pointerdown', pointerDown)
      scope.removeEventListener('pointermove', pointerMove)
      scope.removeEventListener('pointerup', pointerUp)
      scope.removeEventListener('pointercancel', pointerCancel)
      scope.removeEventListener('keydown', anyKey, true)
      scope.removeEventListener('click', click, true)
    })
  })

  return (
    <StudioContextMenu request={request()} onClose={() => setRequest(null)} />
  )
}
