// ============================================================
// Lesson 9 cold open — Merc's leap, and the note between do and so
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the ladder chart's compact state, then the
// predict (WEB-SPEC, Toys 1 and 2). Play Merc's leap works from the start,
// so the sound comes first: do up to so, the arc drawing as so starts. It
// answers nothing, since how a middle note splits the leap is the question.
// Once a choice locks, each of the three plays sounds its path, do, the
// middle note, so, and the chart draws it as it sounds: the middle note's
// band between do's and so's, and Merc's two smaller moves as arcs. The
// reveal waits until all three have been heard to their end with sound on;
// a path cut short, by another sound or a stop, does not count, and with
// sound off a play still draws its path and the hint says why nothing was
// heard. Until a path plays, the chart shows do and so alone, and nothing
// on the page names a middle note.
//
// Each play is the page's one sound (kit/now-playing.ts): a newer sound
// anywhere stops it, its drawing goes back to rest and the Merc falls
// quiet. The Merc of the stored voice sings (Merc for the lower, Tavi for
// the higher; the chart follows the same voice), and hops to land on each
// leap's second note (kit/merc-hop.ts), but never under reduced motion or
// Pause animations. Tavi celebrates once, at the reveal. The drawing is
// hidden from a screen reader, and a polite live region speaks each play.

import { q } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { HOP_MS, mercHop } from '@/features/lessons/kit/merc-hop'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { stillSky } from '@/features/lessons/kit/still-sky'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { LadderChart, Phrase, PhraseDrawing } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import { mercLeapLine, pathLine } from './lines'
import type { PathId } from './sounds'
import { leapNotes, MERC_LEAP, PATH_IDS, pathNotes } from './sounds'

/** The predict's hints (WEB-SPEC, Toys 2), the sound-off one LESSON.md's. */
export const HINTS = {
  chosen: 'Locked in. Play all three: do to so, through re, mi and fa.',
  next: "Now play the others, so you've heard all three.",
  silent:
    'Sound is off, so nothing played. Turn sound on to hear them, then play all three.',
  again: "Play them again, or play Merc's leap.",
} as const

/** The reveal's first line, by the choice: never "right" or "wrong". */
export const GUESS: Readonly<Record<PathId, string>> = {
  re: 'You said: re',
  mi: 'You said: mi',
  fa: 'You said: fa',
}

const isPath = (what: string): what is PathId =>
  (PATH_IDS as readonly string[]).includes(what)

/** A play as the chart draws it and the live region says it: Merc's leap, or a path. */
function phraseOf(
  what: string,
  doMidi: number,
): Phrase & { readonly said: string } {
  if (isPath(what))
    return {
      notes: pathNotes(doMidi, what),
      leaps: [
        [0, 1],
        [1, 2],
      ],
      said: pathLine(doMidi, what),
    }
  return {
    notes: leapNotes(doMidi, MERC_LEAP),
    leaps: [[0, 1]],
    said: mercLeapLine(doMidi),
  }
}

export function initColdOpen(): LadderChart {
  stillSky(q('#heroStage'))
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const fig = q('#heroLadder')
  const said = q('[data-hero-said]', fig)
  const ladder = mountLadderChart(fig, { state: 'compact' })

  // the stops so far: a play whose run ends after a stop finds them changed
  let stops = 0
  let run: Run | null = null
  let drawing: PhraseDrawing | null = null
  let hops: number[] = []
  let sung: { readonly which: Which; readonly midi: number } | null = null

  /** The Merc falls quiet, and no hop is left to start. */
  function quiet(): void {
    hops.forEach((id) => window.clearTimeout(id))
    hops = []
    if (sung !== null) mercSing(sung.which, sung.midi, false)
    sung = null
  }

  /** Stops the hero's play where it stands: its sound, its drawing, its Merc. */
  function stop(): void {
    stops += 1
    run?.stop()
    run = null
    quiet()
    drawing?.cancel()
    drawing = null
    NowPlaying.release(stop)
  }

  /** A hop for each leap, started so that it lands as the leap's second note starts. */
  function hopEach(p: Phrase, which: Which): void {
    for (const [, to] of p.leaps ?? [])
      hops.push(
        window.setTimeout(
          () => mercHop(which),
          Math.max(0, p.notes[to].t * 1000 - HOP_MS),
        ),
      )
  }

  /** Plays Merc's leap or a path; resolves false if another sound, or its own stop, cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = stops
    const which = mercOf(ladder.voice)
    const p = phraseOf(what, ladder.doMidi)
    if (said.textContent !== p.said) said.textContent = p.said
    const d = ladder.play(p)
    drawing = d
    hopEach(p, which)
    const r = playNotes(p.notes, {
      audible,
      onNote: (n, i) => {
        d.note(i)
        sung = { which, midi: n.midi }
        mercSing(which, n.midi, true)
      },
    })
    run = r
    const heard = await r.done
    if (mine !== stops) return false
    run = null
    // heard to its end, the path stays drawn; cut short, the chart rests
    if (heard) d.end()
    else d.cancel()
    drawing = null
    quiet()
    NowPlaying.release(stop)
    return heard
  }

  // a voice chosen in Sing it moves do: the chart lays itself out again,
  // and a play on the old do stops
  let voice: Voice = ladder.voice
  VoiceChoice.subscribe((v) => {
    const next = v ?? 'lower'
    if (next === voice) return
    voice = next
    stop()
  })

  mountPredict(q('#predict'), {
    play,
    revealOn: PATH_IDS,
    revealAfter: 'all',
    hints: HINTS,
    guess: (choice) => (isPath(choice) ? GUESS[choice] : 'You said'),
    onReveal: () => mercCelebrate('orange', 1600),
  })
  return ladder
}
