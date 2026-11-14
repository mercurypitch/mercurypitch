// ============================================================
// Studio note roll pointers — a piano roll's pointers and wheel, sent to the editing engine: a press on the grid or the velocity lane captured and counted from where it went down, a mouse's hover, a lost capture as a cancel
// ============================================================
//
// The roll's overlay canvas takes every pointer over it. A press captures
// its pointer, so a drag that leaves the canvas keeps reporting, counted
// from the surface it went down on (edit-host.ts). A pointer whose capture
// is lost without its release ends as a cancel, which undoes its gesture.
// A browser does not always send the cancel it owes a finger (a system
// gesture taking it), so before a finger presses, any finger the engine
// still holds that the canvas no longer captures is cancelled: a forgotten
// finger must not make the next one a pinch (MISTAKES.md, "A drag binding
// must not trust its own 'a pointer is down'").
//
// Without an engine (a kit's roll, or a song that cannot be edited now)
// every handler answers false and the roll navigates on its own.
import type { NoteRollOrigin } from './edit-host'
import { noteRollPointerInput, noteRollSurfaceAt, noteRollWheelInput, } from './edit-host'
import type { NoteSurface } from './edit-types'
import type { StudioRollRegions } from './note-roll-geometry'
import type { StudioNoteRollEditing } from './useStudioNoteEditing'

export function createNoteRollPointers(options: {
  editing(): StudioNoteRollEditing | null
  canvas(): HTMLCanvasElement | null
  regions(): StudioRollRegions
}) {
  // The surface each pointer went down on, while it is down.
  const surfaces = new Map<number, NoteSurface>()

  function origin(canvas: HTMLCanvasElement): NoteRollOrigin {
    const box = canvas.getBoundingClientRect()
    return { left: box.left, top: box.top }
  }

  /** Fingers the engine holds that the canvas no longer captures: their cancel never came. */
  function dropLost(
    editing: StudioNoteRollEditing,
    canvas: HTMLCanvasElement,
    time: number,
  ): void {
    for (const pointerId of editing.fingers()) {
      if (canvas.hasPointerCapture(pointerId)) continue
      surfaces.delete(pointerId)
      editing.send({
        type: 'cancel',
        pointerId,
        pointerType: 'touch',
        surface: 'roll',
        x: 0,
        y: 0,
        time,
      })
    }
  }

  /** The engine and the canvas, when the roll edits. */
  function target() {
    const editing = options.editing()
    const canvas = options.canvas()
    return editing === null || canvas === null ? null : { editing, canvas }
  }

  return {
    /** A press: the engine's when the roll edits, captured; false leaves it to the roll. */
    down(event: PointerEvent): boolean {
      const found = target()
      if (found === null) return false
      event.preventDefault()
      const at = origin(found.canvas)
      const regions = options.regions()
      const surface = noteRollSurfaceAt(
        regions,
        event.clientX - at.left,
        event.clientY - at.top,
      )
      if (surface === null) return true
      if (event.pointerType === 'touch')
        dropLost(found.editing, found.canvas, event.timeStamp)
      surfaces.set(event.pointerId, surface)
      found.canvas.setPointerCapture(event.pointerId)
      found.editing.send(
        noteRollPointerInput('down', event, at, regions, surface),
      )
      return true
    },
    /** A move: a pressed pointer's drag, or a mouse's hover. */
    move(event: PointerEvent): boolean {
      const found = target()
      if (found === null) return false
      const at = origin(found.canvas)
      const regions = options.regions()
      const surface =
        surfaces.get(event.pointerId) ??
        (event.pointerType === 'touch'
          ? null
          : noteRollSurfaceAt(
              regions,
              event.clientX - at.left,
              event.clientY - at.top,
            ))
      if (surface === null) {
        if (event.pointerType !== 'touch') found.editing.send({ type: 'leave' })
        return true
      }
      found.editing.send(
        noteRollPointerInput('move', event, at, regions, surface),
      )
      return true
    },
    /** A release or a cancel; a lost capture after a release is nothing. */
    end(event: PointerEvent, kind: 'up' | 'cancel'): boolean {
      const found = target()
      if (found === null) return false
      const surface = surfaces.get(event.pointerId)
      if (surface === undefined) return true
      surfaces.delete(event.pointerId)
      found.editing.send(
        noteRollPointerInput(
          kind,
          event,
          origin(found.canvas),
          options.regions(),
          surface,
        ),
      )
      return true
    },
    wheel(event: WheelEvent): boolean {
      const found = target()
      if (found === null) return false
      const input = noteRollWheelInput(
        event,
        origin(found.canvas),
        options.regions().grid,
      )
      if (found.editing.send(input)) event.preventDefault()
      return true
    },
    /** The mouse left the roll: nothing is under it. */
    leave(event: PointerEvent): void {
      const found = target()
      if (found === null || event.pointerType === 'touch') return
      if (!surfaces.has(event.pointerId)) found.editing.send({ type: 'leave' })
    },
    /** Whether a pointer is down on the roll for the engine. */
    active: () => surfaces.size > 0,
  }
}
