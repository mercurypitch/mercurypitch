// Studio note roll for browser tests — where the open note editor's roll, a piano's or a kit's, draws a note, a tick or a note's velocity, worked out from the roll's view and its box; a finger pressed, drawn along and lifted through Chromium's own touch input; and the MIDI clip's notes as the song saved them.
import { expect, type Locator, type Page } from '@playwright/test'
import type { StudioNote } from '@/lib/studio/model/types'
import { readStudioProject } from './dedicatedstudio-fixture'
import { noteEditor } from './studio-notes'

/** The roll's bands (StudioNoteRoll.tsx): the ruler over the grid, the keys (or a kit's named rows) left of it and the velocity lane under it, a phone's narrower and shorter. */
const RULER_HEIGHT = 26
const BANDS = {
  piano: { phone: { keys: 46, lane: 60 }, other: { keys: 72, lane: 76 } },
  kit: { phone: { keys: 104, lane: 60 }, other: { keys: 136, lane: 76 } },
} as const
/** The velocity lane's room under its lowest head and over its highest, and how far right of its note a stick stands (velocity-lane.ts). */
const LANE_FOOT = 10
const LANE_HEAD = 8
const LANE_INSET = 4

export interface Point {
  readonly x: number
  readonly y: number
}

/** The roll as drawn now: its grid on the page, the ticks and rows the grid shows, and the velocity lane under it. */
export interface NoteRollView {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly start: number
  readonly end: number
  readonly minMidi: number
  readonly maxMidi: number
  readonly laneTop: number
  readonly laneHeight: number
}

type NotePlace = Pick<StudioNote, 'pitch' | 'startTick' | 'lengthTicks'>

/** The open editor's roll. */
export function noteRoll(page: Page): Locator {
  return noteEditor(page).locator('[data-studio-note-roll]')
}

/** The roll's view, once the editing engine draws it; a kit's rows count from the kick at the foot. */
export async function readNoteRoll(
  page: Page,
  phone = false,
  kit = false,
): Promise<NoteRollView> {
  const roll = noteRoll(page)
  await expect(roll).toHaveAttribute('data-studio-note-editing', '')
  const [start, end, minMidi, maxMidi] = (await roll.getAttribute(
    'data-studio-note-roll',
  ))!
    .split(':')
    .map(Number)
  const box = (await roll.boundingBox())!
  const bands = BANDS[kit ? 'kit' : 'piano'][phone ? 'phone' : 'other']
  const height = box.height - RULER_HEIGHT - bands.lane
  return {
    left: box.x + bands.keys,
    top: box.y + RULER_HEIGHT,
    width: box.width - bands.keys,
    height,
    start,
    end,
    minMidi,
    maxMidi,
    laneTop: box.y + RULER_HEIGHT + height,
    laneHeight: bands.lane,
  }
}

/** Where `tick` is across the grid, on the page. */
export function tickX(view: NoteRollView, tick: number): number {
  return (
    view.left + ((tick - view.start) / (view.end - view.start)) * view.width
  )
}

/** How tall a row of the grid is. */
export function rowHeight(view: NoteRollView): number {
  return view.height / (view.maxMidi - view.minMidi + 1)
}

/** How wide `ticks` are across the grid. */
export function tickWidth(view: NoteRollView, ticks: number): number {
  return (ticks / (view.end - view.start)) * view.width
}

/** The middle of `pitch`'s row, on the page. */
export function pitchY(view: NoteRollView, pitch: number): number {
  return view.top + (view.maxMidi - pitch + 0.5) * rowHeight(view)
}

/** The middle of a note's bar. */
export function noteCenter(view: NoteRollView, note: NotePlace): Point {
  return {
    x: tickX(view, note.startTick + note.lengthTicks / 2),
    y: pitchY(view, note.pitch),
  }
}

/** A point inside a note's bar, `inset` pixels short of its end. */
export function noteEnd(view: NoteRollView, note: NotePlace, inset: number) {
  return {
    x: tickX(view, note.startTick + note.lengthTicks) - inset,
    y: pitchY(view, note.pitch),
  }
}

/** The head of a note's velocity lollipop. */
export function lollipopHead(
  view: NoteRollView,
  note: Pick<StudioNote, 'startTick' | 'velocity'>,
): Point {
  const reach = view.laneHeight - LANE_FOOT - LANE_HEAD
  return {
    x: tickX(view, note.startTick) + LANE_INSET,
    y: view.laneTop + view.laneHeight - LANE_FOOT - note.velocity * reach,
  }
}

/** How far a lollipop's head travels for each of velocity's 127 steps. */
export function velocityStepHeight(view: NoteRollView): number {
  return (view.laneHeight - LANE_FOOT - LANE_HEAD) / 127
}

/** `point` moved by `x` and `y` pixels. */
export function moved(point: Point, x: number, y: number): Point {
  return { x: point.x + x, y: point.y + y }
}

/**
 * A finger pressed at `from`, drawn to `to` in `steps` moves and lifted at
 * once, still moving, through Chromium's native touch input. A lift like
 * that would start a fling, whose end swallows the next tap anywhere; the
 * roll keeps its touches from one (StudioNoteRoll.tsx), and a tap after
 * one of these drags shows it does.
 */
export async function touchDrag(
  page: Page,
  from: Point,
  to: Point,
  steps = 12,
): Promise<void> {
  const session = await page.context().newCDPSession(page)
  const touch = (x: number, y: number) => ({ touchPoints: [{ x, y, id: 1 }] })
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      ...touch(from.x, from.y),
    })
    for (let step = 1; step <= steps; step++) {
      const part = step / steps
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        ...touch(
          from.x + (to.x - from.x) * part,
          from.y + (to.y - from.y) * part,
        ),
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
}

/** The MIDI clip's notes as the song saved them, by id. */
export async function savedNotes(page: Page): Promise<StudioNote[]> {
  const song = await readStudioProject(page)
  const id = song.clips.find((clip) => clip.midi !== undefined)?.midi
    ?.sequenceId
  const sequence = song.sequences?.find((each) => each.id === id)
  return [...(sequence?.notes ?? [])].sort((a, b) => a.id - b.id)
}

/** A saved note by its id, or null once it is gone. */
export async function savedNote(
  page: Page,
  id: number,
): Promise<StudioNote | null> {
  return (await savedNotes(page)).find((note) => note.id === id) ?? null
}
