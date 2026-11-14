// ============================================================
// Lesson 28 Sing it's run — the quiet check, do, the count-in and the take
// ============================================================
//
// The sounds and the listening of one run (WEB-SPEC, Toys 6), for sing.ts,
// which keeps the card's panels, the visit's runs and each run's end. With
// headphones, the quiet check: the other part's first 2.0 s alone, its
// notes lit, while the listener reads the frames (kit/quiet-check.ts). Then
// do, sung by Merc for the lower voice or Tavi for the higher, 1.0 s; one
// bar of woodblock, its dots lit a click; and the take (kit/take-in-time.ts),
// opened half a beat before bar 1 and recorded from then (kit/record.ts),
// read in time from the singer's first note, with the other part booked on
// bar 1's first beat with headphones, the one sound the take keeps
// (kit/sound.ts `Sound.hush`). The cursor follows the take's frames. In the
// sing-along the same count-in, then the other part while the cursor moves
// at the beat, and nothing listens.

import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen, mercSing } from '@/features/lessons/kit/merc-duo'
import type { MicHold } from '@/features/lessons/kit/mic-hold'
import type * as QuietKit from '@/features/lessons/kit/quiet-check'
import { QUIET_SEC, quietLine } from '@/features/lessons/kit/quiet-words'
import type { TakeRecorder } from '@/features/lessons/kit/record'
import { recorderFor } from '@/features/lessons/kit/record'
import type { Voice as Tone } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type * as TakeKit from '@/features/lessons/kit/take-in-time'
import type { TakeEnd } from '@/features/lessons/kit/take-in-time'
import type * as OnsetKit from '@/features/lessons/kit/take-onset'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { mercOf } from '@/features/lessons/kit/voice-choice'
import { BOTH_STAFFS, COUNT_IN, DO, doStatus, mineOf, mineStaff, OPEN_BEATS, otherOf, otherStaff, ownerOf, PART_SEC, partName, STATUS, title, writtenOf, } from './sing-plan'
import { bookPart, CHECK_SEC, startCountIn, startDo } from './sing-sounds'
import type { SingView } from './sing-view'
import { BEAT_SEC, BPM } from './song'

/** What loads on Start: the take with its reader, the quiet check, and the recording's onset, which bring the pitch code. */
export interface Kits {
  readonly take: typeof TakeKit
  readonly quiet: typeof QuietKit
  readonly onset: typeof OnsetKit
}

/** A run in flight: cut when the viewer leaves, or by the page. */
export interface Flight {
  cancelled: boolean
  /** The viewer left or hid the page: the run counts. */
  left: boolean
}

/** What the count-in left: the take's end, 'along' for a sing-along played through, or null when cut short; and the take's recorder. */
export interface Sung {
  readonly end: TakeEnd | 'along' | null
  readonly tape: TakeRecorder | null
}

/** A sound the card plays: true once it has ended by itself. */
export interface Run {
  readonly done: Promise<boolean>
  stop(): void
}

/** What a run's steps use of the card. */
export interface RunCard {
  readonly view: SingView
  readonly mic: MicHold
  /** Plays `run` as the card's one sound; true once it has ended by itself. */
  readonly sound: (run: Run) => Promise<boolean>
  /** The voice the learner sings with. */
  readonly voice: () => Voice
  /** Whether the learner said they have headphones on. */
  readonly phones: () => boolean
}

/** One run's steps, in order: the quiet check with headphones, do, then the count-in and the take. */
export interface RunSteps {
  quietCheck(kits: Kits, me: Flight): Promise<'quiet' | 'heard' | 'cut'>
  /** Do; false if cut short. */
  sayDo(me: Flight): Promise<boolean>
  /** The count-in, then the take, or the sing-along's part with no kits. */
  countAndSing(me: Flight, kits: Kits | null): Promise<Sung>
}

export function createRunSteps(c: RunCard): RunSteps {
  const { view, mic } = c
  const fig = view.figure
  /** The one who sings do, and the one who sings the other part. */
  const singer = (): Which => mercOf(c.voice())
  const partner = (): Which => (singer() === 'blue' ? 'orange' : 'blue')

  /** The quiet check: the other part's first 2.0 s alone, its notes lit, while the listener reads the frames. */
  async function quietCheck(
    kits: Kits,
    me: Flight,
  ): Promise<'quiet' | 'heard' | 'cut'> {
    const v = c.voice()
    const l = mic.listener
    const mod = mic.mod
    if (l === null || mod === null) return 'cut'
    view.status(quietLine(partName(v)))
    const part = bookPart(otherOf(v), 0, CHECK_SEC)
    Sound.hush(true, part)
    let checking = true
    void fig.track(performance.now(), [otherStaff(v)], () => !checking)
    const frames = await mod.framesFor(l, QUIET_SEC, () => me.cancelled)
    checking = false
    part?.stop(0.1)
    Sound.hush(false)
    fig.at(null)
    if (frames === null || me.cancelled) return 'cut'
    return kits.quiet.heardNothing(frames) ? 'quiet' : 'heard'
  }

  /** Do, sung by Merc for the lower voice or Tavi for the higher; false if cut short. */
  async function sayDo(me: Flight): Promise<boolean> {
    const v = c.voice()
    view.status(doStatus(v))
    mercSing(singer(), DO[v], true)
    const heard = await c.sound(startDo(v, Sound.canPlay()))
    mercSing(singer(), DO[v], false)
    return heard && !me.cancelled
  }

  /**
   * The count-in, then bar 1 to bar 8: in a run the take opened, and its
   * recorder started, half a beat before bar 1, with the other part booked
   * on bar 1's first beat with headphones; in the sing-along the part
   * alone, and nothing listens.
   */
  async function countAndSing(me: Flight, kits: Kits | null): Promise<Sung> {
    const v = c.voice()
    const mine = mineOf(v)
    const other = otherOf(v)
    // the part sounds with headphones, and in the sing-along
    const withPart = kits === null || c.phones()
    const staffs = withPart ? BOTH_STAFFS : [mineStaff(v)]
    view.status(STATUS.counting)
    let part: Tone | null = null
    let take: Promise<TakeEnd> | null = null
    let tape: TakeRecorder | null = null
    let bar1: number | null = null
    const clock = startCountIn(
      Sound.canPlay(),
      (beat) => {
        fig.count(beat + 1)
      },
      (spot) => {
        if (bar1 !== null || me.cancelled) return
        if (spot.beats < COUNT_IN - OPEN_BEATS - 1e-6) return
        const first = clock.pageTimeOfBeat(0)
        const audio = clock.audioTimeOfBeat(0)
        const now = Sound.context()?.currentTime
        if (first === null) return
        bar1 = first + COUNT_IN * BEAT_SEC * 1000
        // built before the take opens, and booked on bar 1's first beat
        if (withPart && audio !== null && now !== undefined)
          part = bookPart(other, audio + COUNT_IN * BEAT_SEC - now)
        if (kits === null || mic.mod === null || mic.listener === null) return
        tape = recorderFor(mic.listener.media)
        tape?.start()
        take = kits.take.runTake({
          mod: mic.mod,
          listener: mic.listener,
          notes: writtenOf(mine),
          labels: mine.syllables.map(title),
          bpm: BPM,
          bar1,
          cancelled: () => me.cancelled,
          whose: "your part's note",
          ...(c.phones()
            ? {
                other: {
                  notes: writtenOf(other),
                  whose: ownerOf(v),
                  labels: other.syllables,
                },
              }
            : {}),
          onFrame: fig.follow(bar1, staffs),
        })
      },
    )
    const counted = await c.sound(clock)
    fig.count(0)
    const booked = part as Tone | null
    const opened = take as Promise<TakeEnd> | null
    const recorder = tape as TakeRecorder | null
    const from = bar1 as number | null
    if (
      !counted ||
      me.cancelled ||
      from === null ||
      (kits !== null && opened === null) ||
      (withPart && booked === null)
    ) {
      me.cancelled = true
      booked?.stop(0.1)
      if (opened !== null) await opened
      recorder?.discard()
      recorder?.dispose()
      return { end: null, tape: null }
    }
    view.status(STATUS.take)
    mercListen(singer(), true)
    if (withPart) mercSing(partner(), other.midis[0], true)
    let end: TakeEnd | 'along' | null
    if (opened !== null) {
      // the take keeps the part with headphones, and nothing alone
      Sound.hush(true, booked)
      end = await opened
      Sound.hush(false)
    } else {
      // the sing-along: the cursor and the notes lit as their beats come
      await fig.track(
        from,
        staffs,
        () => me.cancelled || performance.now() - from >= PART_SEC * 1000,
      )
      end = me.cancelled ? null : 'along'
    }
    booked?.stop(0.1)
    if (withPart) mercSing(partner(), other.midis[0], false)
    mercListen(singer(), false)
    fig.at(null)
    return { end, tape: recorder }
  }

  return { quietCheck, sayDo, countAndSing }
}
