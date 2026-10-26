// Studio pointer ownership — captured drafts commit once and cancel when their editing context changes.
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioGestureDraft, StudioGestureKind } from './gesture-draft'
import { draftStudioGesture, STUDIO_NEW_LANE, studioGestureCommand, } from './gesture-draft'
import type { StudioTimelineProps } from './types'

interface PointerGeometry {
  viewport(): HTMLDivElement
  scale(): number
  width(): number
  headerWidth(): number
  snap(): boolean
}
interface GestureSession {
  project: StudioProject
  clip: StudioClip
  kind: StudioGestureKind
  pointerId: number
  owner: HTMLElement
  clientX: number
  clientY: number
  x: number
  y: number
  alt: boolean
  scrollLeft: number
  scale: number
  width: number
  active: boolean
  laneTop: number
  cleanup(): void
}

export function useStudioPointer(
  props: StudioTimelineProps,
  geometry: PointerGeometry,
) {
  const [draft, setDraft] = createSignal<StudioGestureDraft | null>(null)
  const [offsetY, setOffsetY] = createSignal(0)
  const [active, setActive] = createSignal(false)
  const [message, setMessage] = createSignal('')
  let session: GestureSession | null = null
  let animation: number | null = null
  let suppressUntil = 0

  function clear(): void {
    const previous = session
    session = null
    if (animation !== null) cancelAnimationFrame(animation)
    animation = null
    previous?.cleanup()
    if (previous?.owner.hasPointerCapture(previous.pointerId) === true)
      previous.owner.releasePointerCapture(previous.pointerId)
    setDraft(null)
    setOffsetY(0)
    setActive(false)
  }

  function cancel(): void {
    if (session?.active === true) {
      suppressUntil = performance.now() + 500
      setMessage('Edit cancelled. The clip is unchanged.')
    }
    clear()
  }

  function targetLane(y: number): { id: string; top: number } | null {
    const viewport = geometry.viewport()
    const bounds = viewport.getBoundingClientRect()
    if (y < bounds.top + 48 || y > bounds.bottom) return null
    for (const row of viewport.querySelectorAll<HTMLElement>(
      '[data-studio-track], [data-studio-new-lane]',
    )) {
      const rect = row.getBoundingClientRect()
      if (y >= rect.top && y < rect.bottom)
        return { id: row.dataset.studioTrack ?? STUDIO_NEW_LANE, top: rect.top }
    }
    return null
  }

  function update(): void {
    const current = session
    if (current?.active !== true) return
    const delta =
      current.x -
      current.clientX +
      geometry.viewport().scrollLeft -
      current.scrollLeft
    const lane =
      current.kind === 'move'
        ? targetLane(current.y)
        : { id: current.clip.trackId, top: current.laneTop }
    const next = draftStudioGesture({
      project: current.project,
      clip: current.clip,
      asset: props.assets.find((asset) => asset.id === current.clip.assetId),
      kind: current.kind,
      deltaFrames: Math.round((delta / current.scale) * STUDIO_SAMPLE_RATE),
      targetTrackId: lane?.id ?? current.clip.trackId,
      pixelsPerSecond: current.scale,
      playheadFrame: props.playheadFrame,
      snap: geometry.snap() && !current.alt,
    })
    if (lane === null) {
      next.valid = false
      next.message = 'Drop the clip in a lane or on New lane.'
    }
    setDraft(next)
    const originalRow = geometry
      .viewport()
      .querySelector<HTMLElement>(
        `[data-studio-track="${CSS.escape(current.clip.trackId)}"]`,
      )
    setOffsetY(
      current.kind === 'move' && lane !== null
        ? lane.top -
            (originalRow?.getBoundingClientRect().top ?? current.laneTop)
        : 0,
    )
  }

  function autoScroll(): void {
    const current = session
    if (current?.active !== true) return
    const viewport = geometry.viewport()
    const rect = viewport.getBoundingClientRect()
    const left = rect.left + geometry.headerWidth() + 30
    const right = rect.right - 30
    const dx =
      current.x < left
        ? Math.max(-20, (current.x - left) / 3)
        : current.x > right
          ? Math.min(20, (current.x - right) / 3)
          : 0
    const dy =
      current.y < rect.top + 78 ? -10 : current.y > rect.bottom - 30 ? 10 : 0
    if (dx !== 0 || dy !== 0) {
      viewport.scrollBy(dx, dy)
      update()
    }
    animation = requestAnimationFrame(autoScroll)
  }

  function move(event: PointerEvent): void {
    const current = session
    if (!current || event.pointerId !== current.pointerId) return
    current.x = event.clientX
    current.y = event.clientY
    current.alt = event.altKey
    if (
      !current.active &&
      Math.hypot(current.x - current.clientX, current.y - current.clientY) >= 3
    ) {
      current.active = true
      animation = requestAnimationFrame(autoScroll)
    }
    if (current.active) {
      event.preventDefault()
      update()
    }
  }

  function finish(event: PointerEvent): void {
    const current = session
    if (!current || event.pointerId !== current.pointerId) return
    if (!current.active) {
      clear()
      return
    }
    event.preventDefault()
    current.x = event.clientX
    current.y = event.clientY
    current.alt = event.altKey
    update()
    const result = draft()
    suppressUntil = performance.now() + 500
    clear()
    if (!result) return
    if (!result.valid) {
      setMessage(result.message)
      return
    }
    const command = studioGestureCommand(result, current.clip)
    if (command && !props.onCommand(command)) {
      setMessage('This edit could not be applied. The clip is unchanged.')
      return
    }
    if (command) queueMicrotask(() => {
      // Cross-lane moves replace the button; extreme edits can hide a handle.
      // Restore only lost focus, never steal it from another intentional control.
      if (props.project.id !== current.project.id || props.selectedClipId !== current.clip.id || current.owner.isConnected || document.activeElement !== document.body) return
      geometry.viewport().querySelector<HTMLElement>(`[data-studio-clip="${CSS.escape(current.clip.id)}"]`)?.focus({ preventScroll: true })
    })
    setMessage(
      command
        ? result.targetTrackId === STUDIO_NEW_LANE
          ? 'Moved to a new lane.'
          : 'Clip updated.'
        : '',
    )
  }

  function start(
    event: PointerEvent,
    clip: StudioClip,
    kind: StudioGestureKind,
  ): void {
    if (
      props.phone ||
      !props.writable ||
      event.button !== 0 ||
      !event.isPrimary
    )
      return
    if (event.pointerType === 'touch' && props.selectedClipId !== clip.id)
      return
    if (!(event.currentTarget instanceof HTMLElement)) return
    props.onPointerEditStart?.()
    cancel()
    suppressUntil = 0
    setMessage('')
    const owner = event.currentTarget
    const row = owner.closest<HTMLElement>('[data-studio-track]')
    if (!row) return
    props.onSelectClip(clip.id)
    owner.focus({ preventScroll: true })
    event.preventDefault()
    const escape = (key: KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.preventDefault()
        key.stopImmediatePropagation()
        cancel()
      }
    }
    const secondPointer = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) cancel()
    }
    const interrupted = (next: PointerEvent) => {
      if (next.pointerId === event.pointerId) cancel()
    }
    const visibility = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener('pointermove', move, {
      capture: true,
      passive: false,
    })
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', interrupted, true)
    window.addEventListener('pointerdown', secondPointer, true)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('resize', cancel)
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    owner.addEventListener('lostpointercapture', interrupted)
    session = {
      project: props.project,
      clip,
      kind,
      pointerId: event.pointerId,
      owner,
      clientX: event.clientX,
      clientY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      alt: event.altKey,
      scrollLeft: geometry.viewport().scrollLeft,
      scale: geometry.scale(),
      width: geometry.width(),
      active: false,
      laneTop: row.getBoundingClientRect().top,
      cleanup: () => {
        window.removeEventListener('pointermove', move, true)
        window.removeEventListener('pointerup', finish, true)
        window.removeEventListener('pointercancel', interrupted, true)
        window.removeEventListener('pointerdown', secondPointer, true)
        window.removeEventListener('keydown', escape, true)
        window.removeEventListener('resize', cancel)
        window.removeEventListener('blur', cancel)
        document.removeEventListener('visibilitychange', visibility)
        owner.removeEventListener('lostpointercapture', interrupted)
      },
    }
    owner.setPointerCapture(event.pointerId)
    setActive(true)
  }
  createEffect(() => {
    if (!active()) return
    if (
      session &&
      (props.project.id !== session.project.id ||
        props.project.revision !== session.project.revision ||
        !props.writable ||
        props.phone ||
        geometry.scale() !== session.scale ||
        geometry.width() !== session.width)
    )
      cancel()
  })
  onCleanup(clear)
  return {
    start,
    draft,
    offsetY,
    active,
    message,
    cancel,
    suppressClick: (event: MouseEvent) =>
      event.detail > 0 && performance.now() < suppressUntil,
  }
}

export type StudioPointerEditor = ReturnType<typeof useStudioPointer>
