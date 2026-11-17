// ============================================================
// Studio note roll bands — the part of the note roll a press lands on, so the roll gives it to the gesture that owns it: the ruler's seek, the keys' sound, or the editing engine's grid and velocity lane
// ============================================================
//
// One canvas takes every pointer over the roll (StudioNoteRoll.tsx), and a
// pointer belongs to the band it went down in until it is let go,
// wherever it goes while captured. The ruler moves the song's position
// (note-roll-ruler.ts), the keys' column sounds its keys
// (note-roll-keys.ts), and the grid and the velocity lane edit
// (note-roll-pointers.ts). The corner over the keys and the velocity
// lane's label take no press. A second finger lets the ruler go, as over
// the lanes. A mouse or a pen that is not pressed is told what band it is
// over, and whether it is on the playhead's head, for its cursor.
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { StudioRollRect, StudioRollRegions } from './note-roll-geometry'
import type { NoteRollKeys } from './note-roll-keys'
import type { NoteRollRuler, RollRulerTarget } from './note-roll-ruler'

export type NoteRollBand = 'ruler' | 'keys' | 'grid' | 'velocity'

/** What a mouse or a pen that is not pressed is over: a band of the roll, and whether it is the playhead's head on the ruler. */
export interface NoteRollOver {
  readonly band: NoteRollBand | null
  readonly head: boolean
}

function inside(rect: StudioRollRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  )
}

/** The band a point at canvas `x`, `y` falls in; null over the corner and the velocity lane's label. */
export function noteRollBandAt(
  regions: Pick<StudioRollRegions, 'ruler' | 'keys' | 'grid' | 'velocity'>,
  x: number,
  y: number,
): NoteRollBand | null {
  if (inside(regions.ruler, x, y)) return 'ruler'
  if (inside(regions.keys, x, y)) return 'keys'
  if (inside(regions.grid, x, y)) return 'grid'
  if (inside(regions.velocity, x, y)) return 'velocity'
  return null
}

/** The roll's other pointers: the engine's on the grid and the velocity lane, else the roll's own navigation. */
export interface NoteRollRest {
  down(event: PointerEvent): void
  move(event: PointerEvent): void
  end(event: PointerEvent, kind: 'up' | 'cancel'): void
}

export function createNoteRollBands(options: {
  canvas(): HTMLCanvasElement | null
  regions(): StudioRollRegions
  ruler: NoteRollRuler
  keys: NoteRollKeys
  /** Whether a press on the ruler seeks; when not, the ruler only shows. */
  seeks(): boolean
  /** What a press `x` px across the ruler takes: the End handle's, the playhead's head, or a seek. */
  rulerTarget(x: number, touch: boolean): RollRulerTarget
  rest: NoteRollRest
}) {
  // The pointers the ruler and the keys own, from their press to their release.
  const owners = new Map<number, 'ruler' | 'keys'>()
  const [over, setOver] = createSignal<NoteRollOver | null>(null)

  /** Where a pointer is: the band it is over, its x across the grid and its y down the rows. */
  function placeOf(event: { clientX: number; clientY: number }) {
    const box = options.canvas()?.getBoundingClientRect()
    const x = event.clientX - (box?.left ?? 0)
    const y = event.clientY - (box?.top ?? 0)
    const at = options.regions()
    return {
      band: noteRollBandAt(at, x, y),
      x: x - at.grid.x,
      y: y - at.grid.y,
    }
  }

  /** A pointer the ruler or the keys take, captured until it is let go. */
  function own(event: PointerEvent, band: 'ruler' | 'keys'): void {
    event.preventDefault()
    owners.set(event.pointerId, band)
    options.canvas()?.setPointerCapture(event.pointerId)
  }

  /** A press on the ruler: the End handle's stays its own, the playhead's head scrubs, and any other seeks. */
  function rulerPress(event: PointerEvent, x: number): boolean {
    if (!options.seeks() || event.button !== 0) return false
    const target = options.rulerTarget(x, event.pointerType === 'touch')
    if (target === 'end') return false
    options.ruler.press(event, target)
    own(event, 'ruler')
    return true
  }

  /** A press on the keys' column: the key or drum under it sounds. */
  function keysPress(event: PointerEvent, y: number): boolean {
    if (event.button !== 0) return false
    const pressed = options.keys.down({
      pointerId: event.pointerId,
      pointerType: event.pointerType === 'touch' ? 'touch' : 'mouse',
      y,
    })
    if (pressed) own(event, 'keys')
    return pressed
  }

  /** A move of a pointer the ruler or the keys own, while the roll holds it. */
  function ownedMove(event: PointerEvent, band: 'ruler' | 'keys'): void {
    if (options.canvas()?.hasPointerCapture(event.pointerId) !== true) return
    if (band === 'ruler') options.ruler.move(event)
    else options.keys.move({ pointerId: event.pointerId, y: placeOf(event).y })
  }

  return {
    /** The band under a mouse or a pen that is not pressed, for its cursor. */
    over: over as Accessor<NoteRollOver | null>,
    press(event: PointerEvent): void {
      if (event.pointerType === 'touch' && options.ruler.active())
        options.ruler.cancel()
      const at = placeOf(event)
      if (at.band === 'ruler' && rulerPress(event, at.x)) return
      if (at.band === 'keys' && keysPress(event, at.y)) return
      options.rest.down(event)
    },
    move(event: PointerEvent): void {
      const owner = owners.get(event.pointerId)
      if (owner !== undefined) {
        ownedMove(event, owner)
        return
      }
      if (event.pointerType !== 'touch' && event.buttons === 0) {
        const at = placeOf(event)
        const head =
          at.band === 'ruler' && options.rulerTarget(at.x, false) === 'playhead'
        setOver({ band: at.band, head })
      }
      options.rest.move(event)
    },
    lift(event: PointerEvent, kind: 'up' | 'cancel'): void {
      const owner = owners.get(event.pointerId)
      owners.delete(event.pointerId)
      if (owner === 'keys') options.keys.end(event.pointerId)
      else if (owner === 'ruler' && kind === 'up') options.ruler.release(event)
      else if (owner === 'ruler') options.ruler.cancel()
      else options.rest.end(event, kind)
    },
    /** The mouse left the roll. */
    leave(): void {
      setOver(null)
    },
  }
}
