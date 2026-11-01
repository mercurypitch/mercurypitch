// ============================================================
// useExerciseCapture: the microphone and the audio clock for a premium room
// ============================================================
//
// The premium rooms live on the native shell's stack, which sits outside
// the app's engine provider, so a room takes the phone's one AudioContext
// the way the Karaoke room does: a lease from
// `nativeDeviceApi().acquireAudio`, under the room's own owner name, given
// back with the screen. A browser (a dev build) has no lease; the room makes
// its own context then and closes it after.
//
// `acquire` must run inside the singer's tap: iOS unlocks audio and the mic
// only from a gesture. Each acquisition is numbered, so a release during the
// permission prompt hands the stream straight back instead of holding it
// for a room that is gone (the Ear Lab's rule, use-sing-capture.ts). A tap
// after that release starts an acquisition of its own, once the old one has
// handed back what it got. Once the screen is gone, `acquire` opens nothing
// at all.
//
// The lease outlives the screen by the room's tail (ROOM_TAIL_MS). A room
// stops its sound on the way out, and the sound fades over the house
// release. Let go at once, the last lease out parked the clock 120 ms
// later, in the middle of the fade, and the clock kept the rest of it for
// the next time it ran: the next room's first tap, which opened on the end
// of this room's note. A park while the room is open (the page hiding, the
// app leaving the foreground) waits out the same tail (`prepareToSuspend`).
//
// The room's sound goes through a stage of its own (room-output.ts), opened
// with its clock. The app can leave the foreground with no page event at
// all (Control Center, the notification shade): its note is parked
// mid-sound, and it would play on, and then release, the next time the
// clock starts. So once the room is gone its stage is cut, after the tail,
// or at once if the clock is not running. A tap that starts a parked clock
// again cuts the old stage as well, and the room goes on with a new one:
// what the clock parked belongs to before the park.
//
// The park is the only word a room gets of that leaving, and the lease
// passes it on (app-leave.ts): the room and its demo end as they do when
// the page hides. Except while the mic opens. The first Start asks iOS for
// the microphone, and its alert takes the app out of the foreground with
// the singer still in the room, which the shell cannot tell from Control
// Center. So the clock is held through every opening (`holdAudioInBackground`):
// a park asked for meanwhile is not made, and the take goes on once the
// singer answers.

import { onCleanup, untrack } from 'solid-js'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import type { ReferenceTone } from '@/lib/reference-tone'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { announceAppLeave } from './app-leave'
import type { RoomStage } from './room-output'
import { openRoomStage } from './room-output'
import { startRoomTone } from './room-tones'

/**
 * How long a room's sound plays on once it is stopped, ms. Every sound a
 * room makes closes on the house release: 180 ms of decay, and 60 ms more
 * before its source stops (reference-tone.ts, demo-voice.ts,
 * merc-sampler.ts). The last 10 ms are the audio clock's margin, up to the
 * 250 ms the shared clock grants a park.
 */
export const ROOM_TAIL_MS = 250

export type CaptureFailure = 'denied' | 'unavailable'

/** Why the microphone could not be opened, in the room named `room`. */
export class CaptureError extends Error {
  constructor(
    readonly failure: CaptureFailure,
    room = 'Exercise',
  ) {
    super(`${room} capture: ${failure}`)
  }
}

export interface ExerciseCapture {
  /** Unlock audio and open the mic. Rejects with a CaptureError. */
  acquire: () => Promise<void>
  /**
   * Hand the mic back, and stop a note of `playTone` still sounding (it
   * closes on its release). Safe when nothing is held.
   */
  release: () => void
  held: () => boolean
  /** Start a take: clears the frames and zeroes their clock. */
  startWindow: () => void
  /** The take's frames so far, raw, oldest first (a copy). */
  peekFrames: () => PitchFrame[]
  /** The take's frames, ending it. */
  takeFrames: () => PitchFrame[]
  /** Play the target note; resolves after its release tail. */
  playTone: (midi: number, seconds?: number) => Promise<void>
  /**
   * The audio clock, running, for sound of the room's own (the demo); null
   * when it will not start. On iOS, call it inside a tap.
   */
  audio: () => Promise<AudioContext | null>
  /**
   * The clock if something already has it running (the tap that opened the
   * room, a run), with the room's stage open on it; null if it is parked or
   * not made. It never starts the clock: a parked clock waits for the
   * singer's tap. For sound the room makes unasked (Merc's spoken lines,
   * merc-speech.ts).
   */
  runningAudio: () => AudioContext | null
}

function isMicError(value: unknown): value is MicError {
  return typeof value === 'object' && value !== null && 'kind' in value
}

/**
 * The mic and the clock for one room: `owner` names it to the mic manager
 * and the audio lease, `room` names it in a CaptureError.
 */
export function useExerciseCapture(
  owner: string,
  room: string,
): ExerciseCapture {
  /** The room's own notes still sounding (`playTone`). */
  const tones = new Set<ReferenceTone>()
  let disposed = false
  /** Once the screen is gone: when its tail is over, wall clock ms. */
  let tailEnds = 0

  const stopTones = (): void => {
    for (const tone of tones) tone.stop()
    tones.clear()
  }

  /** The room's stage in front of the room output, and the clock it is on. */
  let stage: RoomStage | null = null
  let staged: AudioContext | null = null
  /** Stops watching the clock for a park during the tail. */
  let unwatch = (): void => undefined

  /** Everything of the room off the speakers: the stage is cut. */
  const cutStage = (): void => {
    unwatch()
    unwatch = () => undefined
    stage?.cut()
    stage = null
    staged = null
  }

  /**
   * The screen is gone. Its stage stays for the tail, unless the clock is
   * not running, or stops before the tail is over: a parked clock plays
   * the rest later, at another room's first tap.
   */
  const cutStageAfterTail = (): void => {
    const ctx = staged
    if (ctx === null || ctx.state !== 'running') {
      cutStage()
      return
    }
    const parked = (): void => {
      if (ctx.state !== 'running') cutStage()
    }
    ctx.addEventListener('statechange', parked)
    unwatch = () => ctx.removeEventListener('statechange', parked)
  }

  const device = untrack(nativeDeviceApi)
  const lease = device?.acquireAudio(owner, {
    // The clock is about to park: the room ends what it plays, as when the
    // page hides, and the clock waits out the release. Once the screen is
    // gone, what is left of its tail.
    prepareToSuspend: () => {
      if (disposed) return Math.max(0, tailEnds - Date.now())
      announceAppLeave()
      return ROOM_TAIL_MS
    },
  })
  /** Lets go of the clock held through the mic's opening, if it is held. */
  let letGoOfTheClock = (): void => undefined
  let ownContext: AudioContext | null = null
  let f0: F0Stream | null = null
  /** The acquisition in flight, and the release count it began under. */
  let acquiring: { generation: number; done: Promise<void> } | null = null
  let generation = 0

  const context = (): AudioContext | null => {
    if (lease !== undefined) return lease.ensure()
    if (ownContext === null && typeof AudioContext !== 'undefined') {
      ownContext = new AudioContext()
    }
    return ownContext
  }

  /** The clock, running; null when there is none or it would not start. */
  const unlock = async (): Promise<AudioContext | null> => {
    // A lease kept for the tail starts nothing: unlocking would resume a
    // clock the app asked to park.
    if (disposed) return null
    const ctx = context()
    if (ctx === null) return null
    // The room's first clock opens its stage. A clock that is not running
    // holds whatever it parked, and would play it on: this tap starts the
    // room on a new stage instead.
    if (ctx.state !== 'running' || staged !== ctx) {
      cutStage()
      stage = openRoomStage(ctx)
      staged = ctx
    }
    if (lease !== undefined) return (await lease.unlock()) ? ctx : null
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
    return ctx.state === 'running' ? ctx : null
  }

  const release = (): void => {
    generation += 1
    letGoOfTheClock()
    f0?.dispose()
    f0 = null
    micManager.release(owner)
    // A start given up takes its note with it: Long note's plays before
    // the mic opens.
    stopTones()
  }

  /**
   * Open the mic for acquisition `mine`, after `before` has settled: the
   * mic manager keeps one hold per owner, so an older acquisition handing
   * its stream back later would end this one's.
   */
  const open = async (mine: number, before: Promise<void>): Promise<void> => {
    // Called inside the tap, so the clock is unlocked inside it.
    const ctx = await unlock()
    await before
    if (mine !== generation) return
    if (ctx === null) throw new CaptureError('unavailable', room)
    let stream: MediaStream
    // The permission alert may come up now: no park while it does.
    const letGo =
      lease === undefined ? null : device?.holdAudioInBackground(owner)
    letGoOfTheClock = () => {
      letGoOfTheClock = () => undefined
      letGo?.()
    }
    try {
      stream = await micManager.acquire(owner)
    } catch (error) {
      throw new CaptureError(
        isMicError(error) && error.kind === 'permission-denied'
          ? 'denied'
          : 'unavailable',
        room,
      )
    } finally {
      if (mine === generation) letGoOfTheClock()
    }
    if (mine !== generation) {
      micManager.release(owner)
      return
    }
    try {
      f0 = createF0Stream(ctx, stream)
    } catch {
      // No pitch stream, no reason to keep the mic.
      micManager.release(owner)
      throw new CaptureError('unavailable', room)
    }
  }

  onCleanup(() => {
    disposed = true
    release()
    // The room's own clean-ups ran first and stopped its sound; its tail
    // plays now. Keep the clock until it has.
    if (lease !== undefined) {
      tailEnds = Date.now() + ROOM_TAIL_MS
      cutStageAfterTail()
      setTimeout(() => {
        cutStage()
        lease.release()
      }, ROOM_TAIL_MS)
    }
    if (ownContext !== null) {
      cutStage()
      void ownContext.close().catch(() => undefined)
      ownContext = null
    }
  })

  return {
    acquire: () => {
      if (disposed || f0 !== null) return Promise.resolve()
      // A second tap shares the opening under way, unless a release gave
      // that one up: it will open nothing, so this tap needs its own.
      if (acquiring?.generation === generation) return acquiring.done
      const before = acquiring?.done.catch(() => undefined) ?? Promise.resolve()
      const entry = { generation, done: open(generation, before) }
      acquiring = entry
      const settled = (): void => {
        if (acquiring === entry) acquiring = null
      }
      entry.done.then(settled, settled)
      return entry.done
    },
    release,
    held: () => f0 !== null,
    startWindow: () => f0?.startTask(),
    peekFrames: () => f0?.peekFrames() ?? [],
    takeFrames: () => f0?.takeFrames() ?? [],
    playTone: async (midi, seconds = 1.1) => {
      const mine = generation
      const ctx = await unlock()
      // Released while the clock unlocked (a start given up, or the room
      // left): no note.
      if (ctx === null || mine !== generation) return
      const tone = startRoomTone(ctx, midi, seconds)
      if (tone === null) return
      tones.add(tone)
      await tone.done
      tones.delete(tone)
    },
    audio: () => (disposed ? Promise.resolve(null) : unlock()),
    runningAudio: () => {
      if (disposed) return null
      const ctx = lease !== undefined ? lease.ensure() : ownContext
      if (ctx === null || ctx.state !== 'running') return null
      // The room's first sound on this clock opens its stage, as unlock
      // does; a running clock has nothing parked to cut.
      if (staged !== ctx) {
        cutStage()
        stage = openRoomStage(ctx)
        staged = ctx
      }
      return ctx
    },
  }
}
