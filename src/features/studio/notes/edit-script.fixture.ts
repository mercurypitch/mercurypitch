// Studio note editing script fixture — a host for gesture scripts: a context like the editor's, pointer and finger inputs by name, and a player that applies each commit and viewport as the host does and keeps every effect.
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteClipboard } from '@/lib/studio/midi/notes'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { StudioNote } from '@/lib/studio/model/types'
import type { NoteEditInit } from './edit-engine'
import { createNoteEditState, stepNoteEditor } from './edit-engine'
import type { NoteEditCommit, NoteEditContext, NoteEditEffect, NoteEditInput, NoteEditKey, NoteEditPointer, NoteEditState, } from './edit-types'

/** A computer: one bar across 960 px, 4 ticks a pixel, so a sixteenth is 60 px; rows of 20 px from 48 to 71. */
export const DESKTOP: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}

/** A phone: two bars across 320 px, 24 ticks a pixel, so a sixteenth is 10 px and a thirty-second 5 px; rows of 20 px from 52 to 72. */
export const PHONE: RollViewport = {
  start: 0,
  end: 7680,
  minMidi: 52,
  maxMidi: 72,
  width: 320,
  height: 420,
}

/** The velocity lane's height: 64 px from 0 to 1. */
const LANE_HEIGHT = 80

export function note(
  id: number,
  pitch: number,
  startTick: number,
  lengthTicks: number,
  velocity = 0.7874,
): StudioNote {
  return { id, pitch, startTick, lengthTicks, velocity }
}

export interface NoteHostSetup {
  readonly notes: readonly StudioNote[]
  readonly nextNoteId?: number
  readonly window?: StudioTickWindow
  readonly viewport?: RollViewport
  readonly playheadTick?: number | null
  readonly gridOffsetTick?: number
  readonly init?: NoteEditInit
}

/** The editor and its host, as a script plays them. */
export interface NoteHost {
  state: NoteEditState
  ctx: NoteEditContext
  readonly effects: NoteEditEffect[]
  readonly handled: boolean[]
  clock: number
}

export function noteHost(setup: NoteHostSetup): NoteHost {
  const viewport = setup.viewport ?? DESKTOP
  return {
    state: createNoteEditState(setup.init),
    ctx: {
      sequence: {
        notes: setup.notes,
        nextNoteId:
          setup.nextNoteId ??
          Math.max(0, ...setup.notes.map((each) => each.id)) + 1,
      },
      window: setup.window ?? { startTick: 0, endTick: viewport.end },
      viewport,
      velocityHeight: LANE_HEIGHT,
      playheadTick: setup.playheadTick ?? null,
      gridOffsetTick: setup.gridOffsetTick,
    },
    effects: [],
    handled: [],
    clock: 1000,
  }
}

/** A pointer input; its time is the host's clock, 16 ms on from the last, unless given. */
type PointerInput = Extract<NoteEditInput, { pointerId: number }>

function stamped(host: NoteHost, input: NoteEditInput): NoteEditInput {
  if (!('pointerId' in input) || input.time >= 0) return input
  host.clock += 16
  return { ...input, time: host.clock }
}

/** Feed inputs to the editor, applying each commit and viewport as the host does. */
export function play(host: NoteHost, ...inputs: NoteEditInput[]): NoteHost {
  for (const input of inputs) {
    const step = stepNoteEditor(host.state, host.ctx, stamped(host, input))
    host.state = step.state
    host.handled.push(step.handled)
    for (const effect of step.effects) {
      host.effects.push(effect)
      if (effect.type === 'commit')
        host.ctx = {
          ...host.ctx,
          sequence: {
            notes: effect.commit.notes,
            nextNoteId: effect.commit.nextNoteId,
          },
        }
      if (effect.type === 'viewport')
        host.ctx = { ...host.ctx, viewport: effect.viewport }
    }
  }
  return host
}

type PointerExtra = Partial<Omit<NoteEditPointer, 'x' | 'y'>>

/** A mouse event over the roll, by default. */
export function mouse(
  type: PointerInput['type'],
  x: number,
  y: number,
  extra: PointerExtra = {},
): NoteEditInput {
  return {
    type,
    pointerId: 1,
    pointerType: 'mouse',
    surface: 'roll',
    x,
    y,
    time: -1,
    ...extra,
  }
}

/** A finger's event over the roll, by default. */
export function finger(
  pointerId: number,
  type: PointerInput['type'],
  x: number,
  y: number,
  extra: PointerExtra = {},
): NoteEditInput {
  return mouse(type, x, y, { pointerId, pointerType: 'touch', ...extra })
}

/** A press, a few moves along the way, and a release. */
export function drag(
  from: readonly [number, number],
  to: readonly [number, number],
  extra: PointerExtra = {},
): NoteEditInput[] {
  const at = (share: number): [number, number] => [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
  ]
  const input = (type: PointerInput['type'], [x, y]: [number, number]) =>
    extra.pointerType === 'touch'
      ? finger(extra.pointerId ?? 1, type, x, y, extra)
      : mouse(type, x, y, extra)
  return [
    input('down', at(0)),
    input('move', at(0.25)),
    input('move', at(0.5)),
    input('move', at(1)),
    input('up', at(1)),
  ]
}

export const touchDrag = (
  from: readonly [number, number],
  to: readonly [number, number],
  pointerId = 1,
) => drag(from, to, { pointerType: 'touch', pointerId })

export function key(
  name: string,
  extra: Partial<NoteEditKey> = {},
): NoteEditInput {
  return { type: 'key', key: name, ...extra }
}

export function commitsOf(host: NoteHost): NoteEditCommit[] {
  return host.effects.flatMap((effect) =>
    effect.type === 'commit' ? [effect.commit] : [],
  )
}

export function auditionsOf(
  host: NoteHost,
): { pitch: number; velocity: number }[] {
  return host.effects.flatMap((effect) =>
    effect.type === 'audition'
      ? [{ pitch: effect.pitch, velocity: effect.velocity }]
      : [],
  )
}

export function noticesOf(host: NoteHost): string[] {
  return host.effects.flatMap((effect) =>
    effect.type === 'notice' ? [effect.message] : [],
  )
}

export function viewportsOf(host: NoteHost): RollViewport[] {
  return host.effects.flatMap((effect) =>
    effect.type === 'viewport' ? [effect.viewport] : [],
  )
}

/** The host's note with `id` now. */
export function noteOf(host: NoteHost, id: number): StudioNote | undefined {
  return host.ctx.sequence.notes.find((each) => each.id === id)
}

/** A clipboard holding one sixteenth on middle C. */
export const ONE_NOTE_CLIPBOARD: StudioNoteClipboard = {
  notes: [{ pitch: 60, startTick: 0, lengthTicks: 240, velocity: 0.7874 }],
}
