// ============================================================
// Studio note roll ruler — the note editor's ruler moves the song's position as the lanes' does: a click or a tap seeks, the playhead's head scrubs, and a drag along it scrubs too, there being no range to draw
// ============================================================
//
// The owner asked for the roll's top timeline to move the playhead as the
// lanes' ruler does (docs/plans/studio-midi.md, 10), so the roll takes the
// lanes' own gesture (timeline/ruler-gesture.ts). A press that comes up
// within the slop seeks where it went down, playing or stopped. A press on
// the playhead's head scrubs it from where it was taken: a stopped song
// follows, a playing one moves once, when let go. The lanes draw their
// loop range on a drag elsewhere; the roll has no range, so its drag
// scrubs from the pointer by the same rules (`dragScrubs`).
//
// A point on the ruler is a tick of the clip's sequence, and a tick is a
// song frame through the clip (time.ts, studioTickToSongFrame): a press on
// a bar line seeks to that bar of the song, and a press in the dimmed room
// past the clip's end to the song's time there. The clip's End handle
// keeps its own target: it stands over the canvas (StudioNoteEnd.tsx), so
// a press on it never reaches the ruler, and the routing here yields to
// it all the same (`rollRulerTarget`).
import type { RollViewport } from '@/lib/roll-geometry'
import { timeToX, xToTime } from '@/lib/roll-geometry'
import { studioSongFrameToTick, studioTickToSongFrame, } from '@/lib/studio/midi/time'
import type { StudioClip, StudioSequence } from '@/lib/studio/model/types'
import type { StudioRulerPointer } from '../timeline/ruler-gesture'
import { createStudioRulerGesture } from '../timeline/ruler-gesture'
import { ROLL_END_TARGET } from './roll-end'

/** How wide the playhead's head takes a press, as the lanes' handle does: 24 px for a mouse or a pen, 44 for a finger (StudioTimeline.module.css, .playheadHandle). */
export const ROLL_PLAYHEAD_TARGET = { fine: 24, touch: 44 } as const

type ClipTime = Pick<StudioClip, 'startFrame' | 'sourceInFrame'>
type SequenceTime = Pick<StudioSequence, 'tempoBpm'>

/** The song frame a point `x` px across the roll's grid stands for: the view's tick there, through the clip's sequence, whole and never before the song's start. */
export function rollRulerFrame(
  x: number,
  viewport: RollViewport,
  clip: ClipTime,
  sequence: SequenceTime,
): number {
  const frame = studioTickToSongFrame(clip, sequence, xToTime(x, viewport))
  return Number.isFinite(frame) ? Math.max(0, Math.round(frame)) : 0
}

/** Where song frame `frame` stands across the roll's grid. */
export function rollRulerX(
  frame: number,
  viewport: RollViewport,
  clip: ClipTime,
  sequence: SequenceTime,
): number {
  return timeToX(studioSongFrameToTick(clip, sequence, frame), viewport)
}

/** What a press `x` px across the ruler takes: the End handle's target, which it leaves to the handle; the playhead's head; or a seek. */
export type RollRulerTarget = 'end' | 'playhead' | 'seek'

/**
 * What a press on the ruler takes, with the End handle's line and the
 * playhead's head across the grid (null where there is none): the End
 * handle within its 44 px first, then the playhead's head within its
 * target, then a seek.
 */
export function rollRulerTarget(
  x: number,
  marks: {
    readonly endX: number | null
    readonly playheadX: number | null
    readonly touch: boolean
  },
): RollRulerTarget {
  if (marks.endX !== null && Math.abs(x - marks.endX) <= ROLL_END_TARGET / 2)
    return 'end'
  const head = ROLL_PLAYHEAD_TARGET[marks.touch ? 'touch' : 'fine'] / 2
  if (marks.playheadX !== null && Math.abs(x - marks.playheadX) <= head)
    return 'playhead'
  return 'seek'
}

/** The roll's ruler: the lanes' gesture on the clip's song time, with a drag that scrubs. */
export function createNoteRollRuler(options: {
  /** Whether the song plays, and where its playhead is: the frame heard while it plays. */
  playing(): boolean
  playheadFrame(): number
  seek(frame: number): void
  /** The song frame under a pointer on the page. */
  frameAt(event: StudioRulerPointer): number
}) {
  const gesture = createStudioRulerGesture({
    frameAt: options.frameAt,
    playheadFrame: options.playheadFrame,
    playing: options.playing,
    seek: options.seek,
    draw: null,
    dragScrubs: true,
  })
  return {
    /** Where a scrub holds the playhead, or null while none does. */
    scrubFrame: gesture.scrubFrame,
    active: gesture.active,
    /** A press on the ruler that `target` says is the playhead's or a seek's. */
    press(event: StudioRulerPointer, target: Exclude<RollRulerTarget, 'end'>) {
      gesture.press(event, target === 'playhead')
    },
    move: gesture.move,
    release: gesture.release,
    cancel: gesture.cancel,
  }
}

export type NoteRollRuler = ReturnType<typeof createNoteRollRuler>
