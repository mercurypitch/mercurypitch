// ============================================================
// Lesson 14 plays — each play a Stop while it sounds, and Merc singing it
// ============================================================
//
// Every play in the steps, the four words and Sing it has a Stop: its
// button reads "Stop" while its sound plays, its name "Stop" and what it
// plays, its icon the square, and a second press stops it where it stands
// (WEB-SPEC, Toys 1, No Slow). One sound at a time (kit/now-playing.ts):
// a play claims the page's owner, so the one before it stops with its own
// stop, its drawing and its button with it. With sound off a play still
// draws, silently, and the kit's toast says why (`Sound.canPlay`).
//
// While Merc's notes sound, the Merc of the chosen voice sings each in the
// hero, Merc for the lower voice and Tavi for the higher, and rests through
// a breath (WEB-SPEC, Merc and Tavi).

import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playLines } from '@/features/lessons/kit/run'
import type { SongNote } from './song'
import { sungLines } from './song'

/** A play's name while it sounds: "Play Merc's take 1" is "Stop Merc's take 1". */
export const stopName = (name: string): string =>
  name.replace(/^Play:? /, 'Stop ')

/** A play button bound to its sound. */
export interface PlayButton {
  /** Whether its sound plays now. */
  readonly playing: boolean
  /** Starts its sound as a press does, stopping whatever sounds first. */
  start(): void
  /** Stops its sound where it stands, if it plays. */
  stop(): void
}

/**
 * Binds `btn` to `start`, which begins the sound and hands back its run
 * (null when it starts nothing): a press plays it, a press while it plays
 * stops it, and its words, name and icon say which a press will do.
 */
export function bindPlay(
  btn: HTMLButtonElement,
  start: () => Run | null,
  owner: SoundOwner = NowPlaying,
): PlayButton {
  const word = btn.querySelector<HTMLElement>('[data-play-word]')
  const idleWord = word?.textContent ?? ''
  const named = btn.getAttribute('aria-label')
  const name = btn.dataset.name ?? named ?? idleWord
  const icon = btn.querySelector('use')
  let run: Run | null = null

  const show = (on: boolean): void => {
    btn.classList.toggle('is-on', on)
    if (word !== null) word.textContent = on ? 'Stop' : idleWord
    if (on) btn.setAttribute('aria-label', stopName(name))
    else if (named === null) btn.removeAttribute('aria-label')
    else btn.setAttribute('aria-label', named)
    icon?.setAttribute('href', on ? '#i-stop' : '#i-play')
  }

  const stop = (): void => {
    const r = run
    if (r === null) return
    run = null
    owner.release(stop)
    show(false)
    r.stop()
  }

  const play = (): void => {
    owner.claim(stop)
    const r = start()
    if (r === null) {
      owner.release(stop)
      return
    }
    run = r
    show(true)
    void r.done.then(() => {
      if (run !== r) return
      run = null
      owner.release(stop)
      show(false)
    })
  }

  btn.addEventListener('click', () => {
    if (run !== null) stop()
    else play()
  })
  return {
    get playing() {
      return run !== null
    },
    start: play,
    stop,
  }
}

/**
 * The Merc of the chosen voice singing `notes` as they sound, from now:
 * each note as it starts, and silent through a breath. Hands back what
 * stops it, which also leaves him silent.
 */
export function singAlong(
  notes: readonly SongNote[],
  which: Which,
  audible: boolean,
): () => void {
  if (!audible || notes.length === 0) return () => undefined
  const t0 = notes[0].from
  const timers: number[] = []
  let last = notes[0].midi
  notes.forEach((n, i) => {
    timers.push(
      window.setTimeout(
        () => {
          last = n.midi
          mercSing(which, n.midi, true)
        },
        (n.from - t0) * 1000,
      ),
    )
    const next = notes[i + 1]
    if (next === undefined || next.from - n.to > 1e-6)
      timers.push(
        window.setTimeout(
          () => mercSing(which, n.midi, false),
          (n.to - t0) * 1000,
        ),
      )
  })
  return () => {
    timers.forEach((id) => window.clearTimeout(id))
    mercSing(which, last, false)
  }
}

/** Merc singing `notes` in his "ooh", a voice from breath to breath, as long as their last note. */
export function singNotes(notes: readonly SongNote[], audible: boolean): Run {
  const end =
    notes.length === 0 ? 0 : notes[notes.length - 1].to - notes[0].from
  const t0 = notes[0]?.from ?? 0
  return playLines(
    sungLines(notes).map((l) => ({ ...l, t: l.t - t0 })),
    { audible, length: end },
  )
}
