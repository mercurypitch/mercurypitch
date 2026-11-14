// ============================================================
// Studio note editing — the open note editor's engine: its state, the context each input happens in, and the effects carried out: commits to the song, sounds, the roll's view, closing and words
// ============================================================
//
// One a clip's editor: the engine's state starts with the editor and goes
// with it, but for its clipboard, which the editor's state keeps across
// opens so notes copied in one clip paste in another. Each input reads the
// roll's view as it is now (the roll attaches itself), the clip's window
// and the song's bars over the sequence. A commit is one
// `set-sequence-notes` (edit-host.ts), so one undo step, and undo and redo
// stay the Studio's. While the song cannot be edited (a mixdown running,
// say) the editor shows its notes and edits nothing: a gesture under way
// is let go.
//
// Frames: while the engine wants them (a drag held at an edge), one runs
// each display frame, and none otherwise. A lost focus or a hidden page
// lets go of everything, undone; the notes or the window changing under a
// gesture undo it too (stepNoteEditor's check).
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, untrack, } from 'solid-js'
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteClipboard } from '@/lib/studio/midi/notes'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import { studioClipTickWindow, studioSongBeats, studioSongFrameToTick, } from '@/lib/studio/midi/time'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip, StudioSequence } from '@/lib/studio/model/types'
import { createNoteEditState, noteEditWantsFrames, stepNoteEditor, } from './edit-engine'
import { noteCommitCommand, noteEditKeyInput } from './edit-host'
import type { NoteSnap } from './edit-snap'
import type { NoteEditCommand, NoteEditContext, NoteEditEffect, NoteEditInput, NoteEditState, NoteEditTool, } from './edit-types'
import type { NoteEditView } from './edit-view'
import { noteEditView } from './edit-view'
import type { StudioNoteAudition } from './note-audition'

/** What the roll lends the engine: its view, and the velocity lane's height. */
export interface StudioNoteRollView {
  viewport(): RollViewport | null
  setViewport(viewport: RollViewport): void
  velocityHeight(): number
}

/** The engine as the roll reaches it. */
export interface StudioNoteRollEditing {
  /** The roll's view, for the engine; returns the detach. */
  attach(roll: StudioNoteRollView): () => void
  /** One input from the roll; true when the browser's own action should stop. */
  send(input: NoteEditInput): boolean
  /** What the engine draws over the roll; null before the roll has a view. */
  view(): NoteEditView | null
  /** The fingers the engine holds, by pointer id. */
  fingers(): readonly number[]
}

export interface StudioNoteEditingOptions {
  clip(): StudioClip
  sequence(): StudioSequence | undefined
  songTempoBpm(): number
  writable(): boolean
  /** The playhead, as the transport has it now. */
  playheadFrame(): number
  dispatch(command: StudioCommand): boolean
  close(): void
  /** The clipboard kept across opens. */
  clipboard(): StudioNoteClipboard | null
  setClipboard(clipboard: StudioNoteClipboard | null): void
  audition?: StudioNoteAudition
  /** Words for the editor's live region. */
  announce(words: string): void
  createId?(): string
}

const sameWindow = (a: StudioTickWindow, b: StudioTickWindow) =>
  a.startTick === b.startTick && a.endTick === b.endTick

export function useStudioNoteEditing(options: StudioNoteEditingOptions) {
  const [state, setState] = createSignal<NoteEditState>(
    createNoteEditState({ clipboard: untrack(options.clipboard) }),
  )
  const [roll, setRoll] = createSignal<StudioNoteRollView | null>(null)
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID())
  let frame = 0

  const clipWindow = createMemo(
    () => {
      const sequence = options.sequence()
      return sequence === undefined
        ? { startTick: 0, endTick: 0 }
        : studioClipTickWindow(options.clip(), sequence)
    },
    undefined,
    { equals: sameWindow },
  )
  const gridOffset = createMemo(() => {
    const sequence = options.sequence()
    return sequence === undefined
      ? 0
      : studioSongBeats(options.clip(), sequence, options.songTempoBpm())
          .originTick
  })

  /** The context an input happens in now; null before the roll has a view. */
  function context(): NoteEditContext | null {
    const sequence = options.sequence()
    const lent = roll()
    const viewport = lent?.viewport() ?? null
    if (sequence === undefined || lent === null || viewport === null)
      return null
    return {
      sequence,
      window: clipWindow(),
      viewport,
      velocityHeight: lent.velocityHeight(),
      playheadTick: studioSongFrameToTick(
        options.clip(),
        sequence,
        options.playheadFrame(),
      ),
      gridOffsetTick: gridOffset(),
    }
  }

  function carryOut(effect: NoteEditEffect): void {
    switch (effect.type) {
      case 'commit':
        if (
          !options.dispatch(
            noteCommitCommand(options.clip().id, effect.commit, createId),
          )
        )
          options.announce(
            'This edit could not be applied. The notes are unchanged.',
          )
        break
      case 'audition':
        options.audition?.play(effect.pitch, effect.velocity)
        break
      case 'viewport':
        roll()?.setViewport(effect.viewport)
        break
      case 'close':
        options.close()
        break
      case 'notice':
        options.announce(effect.message)
    }
  }

  function send(input: NoteEditInput): boolean {
    const ctx = untrack(context)
    if (ctx === null) return false
    if (input.type === 'down') options.audition?.prime()
    const before = untrack(state)
    const step = stepNoteEditor(before, ctx, input)
    setState(step.state)
    if (step.state.clipboard !== before.clipboard)
      options.setClipboard(step.state.clipboard)
    for (const effect of step.effects) carryOut(effect)
    queueFrame()
    return step.handled
  }

  /** One frame now while a drag held at an edge wants them, and none otherwise. */
  function queueFrame(): void {
    if (frame !== 0 || !noteEditWantsFrames(untrack(state))) return
    frame = requestAnimationFrame((time) => {
      frame = 0
      send({ type: 'frame', time })
    })
  }

  const view = createMemo<NoteEditView | null>(() => {
    const ctx = context()
    return ctx === null ? null : noteEditView(state(), ctx)
  })

  // The notes or the window changed (a commit carried out, an undo): the
  // selection keeps the notes that still exist.
  createEffect(
    on(
      () => [options.sequence(), clipWindow()] as const,
      () => send({ type: 'sync' }),
      { defer: true },
    ),
  )
  createEffect(
    on(options.writable, (writable) => {
      if (!writable) send({ type: 'abort' })
    }),
  )
  const letGo = () => send({ type: 'abort' })
  const hidden = () => {
    if (document.hidden) letGo()
  }
  globalThis.addEventListener('blur', letGo)
  document.addEventListener('visibilitychange', hidden)
  onCleanup(() => {
    cancelAnimationFrame(frame)
    globalThis.removeEventListener('blur', letGo)
    document.removeEventListener('visibilitychange', hidden)
  })

  const editing: StudioNoteRollEditing = {
    attach(lent) {
      setRoll(lent)
      return () => {
        if (untrack(roll) === lent) setRoll(null)
      }
    },
    send: (input) => (untrack(options.writable) ? send(input) : false),
    view,
    fingers: () => untrack(state).touches.map((touch) => touch.pointerId),
  }

  return {
    editing,
    state: state as Accessor<NoteEditState>,
    tool: () => state().tool,
    snap: () => state().snap,
    /** A toolbar's or a key's command. */
    command(command: NoteEditCommand): boolean {
      return untrack(options.writable)
        ? send({ type: 'command', command })
        : false
    },
    setTool: (tool: NoteEditTool) =>
      send({ type: 'command', command: { type: 'tool', tool } }),
    setSnap: (snap: NoteSnap) =>
      send({ type: 'command', command: { type: 'snap', snap } }),
    /** A key in the editor; true when the editor took it. */
    keyDown(event: KeyboardEvent): boolean {
      if (!untrack(options.writable)) return false
      return send({ type: 'key', ...noteEditKeyInput(event) })
    },
    keyUp(event: KeyboardEvent): void {
      send({ type: 'keyup', key: event.key })
    },
  }
}

export type StudioNoteEditing = ReturnType<typeof useStudioNoteEditing>
