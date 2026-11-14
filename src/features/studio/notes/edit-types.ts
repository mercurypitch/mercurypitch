// ============================================================
// Studio note editing types — what the note editor's engine reads, keeps and hands back
// ============================================================
//
// The engine is pure. Each input (a pointer, the wheel, a key, a toolbar
// command) goes in with the context it happened in, and a new state comes
// out with the effects the host carries out: an edit to commit as one undo
// step, a note to sound, a viewport to show, the editor to close, or a
// sentence to say. It keeps no reference to the host's objects past the
// gesture that read them, and changes nothing it is given
// (docs/plans/studio-midi.md, decisions 8 and 9).
//
// Coordinates are CSS pixels. x counts from the left edge of the roll's
// grid, which the velocity lane under it shares; y from the top of the
// surface the pointer went down on. A captured pointer keeps reporting
// against that surface wherever it goes.
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteClipboard, StudioNoteDraft, StudioNoteSet, } from '@/lib/studio/midi/notes'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { NoteSnap } from './edit-snap'

export type NoteEditTool = 'select' | 'draw'
export type NotePointerType = 'mouse' | 'pen' | 'touch'
/** The roll's grid, or the velocity lane under it. */
export type NoteSurface = 'roll' | 'velocity'

/** What the editor reads from its host with every input; the engine never changes it. */
export interface NoteEditContext {
  /** The clip's notes as stored: the same object until they change. */
  readonly sequence: StudioNoteSet
  /** The ticks the clip plays: only a note starting inside is picked or edited. */
  readonly window: StudioTickWindow
  /** What the roll shows. */
  readonly viewport: RollViewport
  /** The velocity lane's height. */
  readonly velocityHeight: number
  /** The playhead in the sequence's ticks, or null when the song has none to give. */
  readonly playheadTick: number | null
  /** A tick a bar line falls on: the grid's lines run through it. */
  readonly gridOffsetTick?: number
}

/** A pointer event as the engine reads it. */
export interface NoteEditPointer {
  readonly pointerId: number
  readonly pointerType: NotePointerType
  readonly surface: NoteSurface
  readonly x: number
  readonly y: number
  /** The event's time stamp, in milliseconds. */
  readonly time: number
  /** The button that went down; only the primary (0, the default) starts anything. */
  readonly button?: number
  readonly shift?: boolean
  /** Ctrl, or Cmd on a Mac. */
  readonly mod?: boolean
  readonly alt?: boolean
}

/** A wheel event over the roll, its deltas as WheelEvent gives them. */
export interface NoteEditWheel {
  readonly x: number
  readonly y: number
  readonly deltaX: number
  readonly deltaY: number
  /** WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages. */
  readonly deltaMode?: number
  readonly shift?: boolean
  readonly mod?: boolean
}

/** A key going down while the editor has the focus. */
export interface NoteEditKey {
  /** KeyboardEvent.key. */
  readonly key: string
  readonly shift?: boolean
  readonly mod?: boolean
  readonly alt?: boolean
  /** The browser's repeat of a held key. */
  readonly repeat?: boolean
}

/** What a toolbar button, or a key, asks of the editor. */
export type NoteEditCommand =
  | { readonly type: 'tool'; readonly tool: NoteEditTool }
  | { readonly type: 'snap'; readonly snap: NoteSnap }
  | { readonly type: 'select-all' }
  | { readonly type: 'clear-selection' }
  | { readonly type: 'delete' }
  | { readonly type: 'duplicate' }
  | { readonly type: 'copy' }
  | { readonly type: 'cut' }
  | { readonly type: 'paste' }
  | { readonly type: 'quantize' }
  | { readonly type: 'transpose'; readonly semitones: number }
  | {
      readonly type: 'nudge'
      readonly direction: -1 | 1
      /** A grid step, a bar, or a pixel's worth of ticks. */
      readonly step: 'grid' | 'bar' | 'fine'
    }
  | {
      /** Each selected note's velocity this many of 127 steps louder. */
      readonly type: 'velocity'
      readonly steps: number
    }

export type NoteEditInput =
  | ({ readonly type: 'down' | 'move' | 'up' | 'cancel' } & NoteEditPointer)
  /** The mouse left the editor: nothing is under it. */
  | { readonly type: 'leave' }
  /** The window lost the focus or the page was hidden: every gesture lets go, undone. */
  | { readonly type: 'abort' }
  /** The context changed: the selection keeps the notes that still exist. */
  | { readonly type: 'sync' }
  /** An animation frame while noteEditWantsFrames: a drag held at an edge scrolls. */
  | { readonly type: 'frame'; readonly time: number }
  | ({ readonly type: 'wheel' } & NoteEditWheel)
  | ({ readonly type: 'key' } & NoteEditKey)
  | { readonly type: 'command'; readonly command: NoteEditCommand }

/** One finished edit: the sequence's notes after it, for one `set-sequence-notes`. */
export interface NoteEditCommit {
  readonly notes: StudioNoteSet['notes']
  readonly nextNoteId: number
  readonly selection: readonly number[]
}

export type NoteEditEffect =
  | { readonly type: 'commit'; readonly commit: NoteEditCommit }
  /** Sound this note through the lane's instrument. */
  | {
      readonly type: 'audition'
      readonly pitch: number
      readonly velocity: number
    }
  | { readonly type: 'viewport'; readonly viewport: RollViewport }
  /** Escape with nothing selected: the host closes the editor. */
  | { readonly type: 'close' }
  /** Why an edit did less than asked, for the host to say. */
  | { readonly type: 'notice'; readonly message: string }

/** Where a pointer went down. */
export interface NoteAnchor {
  readonly pointerId: number
  readonly pointerType: NotePointerType
  readonly surface: NoteSurface
  readonly x: number
  readonly y: number
  /** The tick under it then, unrounded. */
  readonly tick: number
  /** Its height in semitones then, unrounded (edit-pick.ts, rollPitchAt). */
  readonly pitch: number
}

/** What a press does once it travels past the slop. */
export type NoteDragIntent =
  | {
      readonly kind: 'move' | 'resize' | 'velocity'
      /** The note pressed. */
      readonly noteId: number
      /** The notes the drag changes: the selection with it, or it alone. */
      readonly ids: readonly number[]
    }
  | { readonly kind: 'draw'; readonly note: StudioNoteDraft }
  | { readonly kind: 'marquee'; readonly add: boolean }
  | { readonly kind: 'pan' | 'none' }

/** What a press does when it comes up where it went down. */
export type NoteTapIntent =
  | { readonly kind: 'select'; readonly selection: readonly number[] }
  /** Keep the note drawn at the press, a grid step long. */
  | { readonly kind: 'draw' }

/** A marquee from where it was pressed to the pointer, in ticks and unrounded pitch. */
export interface NoteMarquee {
  readonly fromTick: number
  readonly toTick: number
  readonly fromPitch: number
  readonly toPitch: number
}

/** The velocity of the note being dragged in the lane, as a musician reads it: 1 to 127. */
export interface NoteVelocityReadout {
  readonly id: number
  readonly value: number
}

/** What a gesture would leave if it ended now. */
export interface NoteDraft {
  /** The notes as they would be kept; null while the gesture changes none. */
  readonly sequence: StudioNoteSet | null
  readonly selection: readonly number[]
  readonly marquee: NoteMarquee | null
  readonly readout: NoteVelocityReadout | null
}

/** One pointer's gesture, from its press to its release. */
export interface NoteSingleGesture {
  readonly kind: 'single'
  readonly anchor: NoteAnchor
  /** The notes when it was pressed: every draft starts from these. */
  readonly base: StudioNoteSet
  /** The selection before the press, which an undone gesture puts back. */
  readonly before: readonly number[]
  readonly intent: NoteDragIntent
  readonly tap: NoteTapIntent
  /** Past the slop: the press is a drag. */
  readonly dragging: boolean
  /** Where the pointer was last, and whether Alt was held: a pan steps from it, an edge scroll drafts at it. */
  readonly last: {
    readonly x: number
    readonly y: number
    readonly alt: boolean
  }
  /** When the pointer last moved or a frame last scrolled, in milliseconds. */
  readonly frameTime: number
  readonly draft: NoteDraft
}

/** Two fingers panning and zooming, by their pointer ids. */
export interface NotePinchGesture {
  readonly kind: 'pinch'
  readonly pointerIds: readonly [number, number]
}

export type NoteGesture = NoteSingleGesture | NotePinchGesture

/** A finger on the editor, where it is now. */
export interface NoteTouch {
  readonly pointerId: number
  readonly surface: NoteSurface
  readonly x: number
  readonly y: number
}

/** What is under a mouse or a pen that is not pressed. */
export interface NoteEditHover {
  readonly id: number
  /** A note's body, its resize zone, or its velocity lollipop. */
  readonly zone: 'body' | 'end' | 'velocity'
}

export interface NoteEditState {
  readonly tool: NoteEditTool
  readonly snap: NoteSnap
  /** The notes selected, by id: an edit or an undo keeps those that still exist. */
  readonly selection: readonly number[]
  readonly clipboard: StudioNoteClipboard | null
  readonly gesture: NoteGesture | null
  /** Every finger on the editor. */
  readonly touches: readonly NoteTouch[]
  readonly hover: NoteEditHover | null
  /** The velocity a drawn note takes: the last pressed note's. */
  readonly drawVelocity: number
  /** The last note sounded and when, so a fast drag does not sound every row. */
  readonly sounded: { readonly time: number; readonly pitch: number } | null
  /** The notes and window the selection was last checked against. */
  readonly checked: {
    readonly sequence: StudioNoteSet
    readonly startTick: number
    readonly endTick: number
  } | null
}

/** What one input left: the new state, the effects to carry out, and whether the input was the editor's. */
export interface NoteEditStep {
  readonly state: NoteEditState
  readonly effects: readonly NoteEditEffect[]
  /** For a key or the wheel: true when the host should stop the browser's own action. */
  readonly handled: boolean
}
