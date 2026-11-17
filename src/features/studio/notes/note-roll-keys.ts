// ============================================================
// Studio note roll keys — the roll's piano keys and a kit's drum names sound when pressed: the key or drum under a press plays through the lane's sound and lights while it sounds; a mouse held down and slid along them plays each key it reaches, and a finger that drags pans the rows, its key falling quiet
// ============================================================
//
// The owner asked to hear each key and each drum with a tap or a click,
// as a note is heard when it is placed (docs/plans/studio-midi.md, 10). A
// key sounds through the editor's own audition (note-audition.ts): the
// lane's piano or kit, on the Studio's clock, primed inside the press as
// a note's press primes it, and for as long as a pressed note sounds. It
// sounds at a moderate 100 of 127, whatever the notes about it were
// played at: a note's press keeps its own velocity rule. The key lights
// from the moment its sound starts on the clock until it ends, or the next
// key's sound starts.
//
// A mouse or a pen held down and slid along the column plays each key it
// reaches, a glissando, the one before stopping as the next starts. A
// finger is a press and no more until it travels past a finger's slop;
// then it pans the rows as one finger pans the grid, and the key it
// pressed falls quiet. (Before this, a drag on the column did nothing.)
import { createSignal, onCleanup } from 'solid-js'
import type { RollViewport } from '@/lib/roll-geometry'
import { studioNoteVelocity } from '@/lib/studio/midi/notes'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { studioRollPitchAt } from '@/lib/studio/midi/roll-rows'
import { editKeyAt } from './edit-kit'
import { NOTE_POINTER_PROFILES } from './edit-pick'
import type { NotePointerType } from './edit-types'
import type { StudioNoteAudition } from './note-audition'
import { NOTE_AUDITION_SECONDS } from './note-audition'

/** A key pressed on the column sounds at a moderate 100 of 127. */
export const NOTE_KEY_VELOCITY = studioNoteVelocity(100 / 127)

/** What the keys sound through: the editor's audition. */
export type NoteKeyAudition = Pick<
  StudioNoteAudition,
  'prime' | 'play' | 'stop'
>

/** The key at `y` px down the keys' column: a piano's pitch, a kit row's key; null above or below the rows. */
export function rollKeyAt(
  viewport: RollViewport,
  rows: StudioRollRows,
  y: number,
): number | null {
  if (!(y >= 0 && y < viewport.height)) return null
  return editKeyAt({ rows }, studioRollPitchAt(y, viewport))
}

/** A pointer on the keys' column: its y counts down from the rows' top. */
export interface NoteKeyPointer {
  readonly pointerId: number
  readonly pointerType: NotePointerType
  readonly y: number
}

interface KeyPress {
  readonly pointerId: number
  readonly pointerType: NotePointerType
  readonly startY: number
  key: number
  lastY: number
  panning: boolean
}

export function createNoteRollKeys(options: {
  audition(): NoteKeyAudition | null
  /** The key at `y` px down the column, or null. */
  keyAt(y: number): number | null
  /** The rows panned as a finger moved `dy` px down. */
  pan(dy: number): void
}) {
  const [lit, setLit] = createSignal<number | null>(null)
  let press: KeyPress | null = null
  // Each key asked to sound, counted, so a late start lights nothing.
  let asked = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Sound `key`, and light it once its sound starts, for as long as it sounds. */
  function sound(key: number): void {
    const audition = options.audition()
    if (audition === null) return
    const mine = ++asked
    void audition.play(key, NOTE_KEY_VELOCITY).then((started) => {
      if (!started || mine !== asked) return
      clearTimeout(timer)
      setLit(key)
      timer = setTimeout(
        () => setLit((now) => (now === key ? null : now)),
        NOTE_AUDITION_SECONDS * 1000,
      )
    })
  }

  /** The key sounding stops, and goes dark. */
  function quiet(): void {
    asked += 1
    clearTimeout(timer)
    setLit(null)
    options.audition()?.stop()
  }

  /** A finger's travel: nothing inside its slop; past it, a pan of the rows, its key quiet. */
  function pan(held: KeyPress, y: number): void {
    if (!held.panning) {
      if (Math.abs(y - held.startY) < NOTE_POINTER_PROFILES.touch.slop) return
      held.panning = true
      quiet()
    }
    options.pan(y - held.lastY)
    held.lastY = y
  }

  onCleanup(() => {
    asked += 1
    clearTimeout(timer)
  })

  return {
    /** The key lit while it sounds, or null. */
    lit,
    /** A press on the column: false where it lands on no key. */
    down(pointer: NoteKeyPointer): boolean {
      const key = options.keyAt(pointer.y)
      if (key === null) return false
      options.audition()?.prime()
      press = {
        pointerId: pointer.pointerId,
        pointerType: pointer.pointerType,
        startY: pointer.y,
        key,
        lastY: pointer.y,
        panning: false,
      }
      sound(key)
      return true
    },
    /** A pressed pointer's move: a finger pans past its slop, a mouse or a pen plays each new key it reaches. */
    move(pointer: Omit<NoteKeyPointer, 'pointerType'>): void {
      const held = press
      if (held?.pointerId !== pointer.pointerId) return
      if (held.pointerType === 'touch') {
        pan(held, pointer.y)
        return
      }
      const key = options.keyAt(pointer.y)
      if (key === null || key === held.key) return
      held.key = key
      sound(key)
    },
    /** The press let go, or cancelled: the key sounds out its moment. */
    end(pointerId: number): void {
      if (press?.pointerId === pointerId) press = null
    },
  }
}

export type NoteRollKeys = ReturnType<typeof createNoteRollKeys>
