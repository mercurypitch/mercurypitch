// ============================================================
// Lesson 8 cold open — "Twinkle" with claps on 1 and 3, then on 2 and 4
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// the bubbles over the two Mercs either side of the beat machine's compact
// state, the two plays under the stage, then the predict card. "Play with
// claps on 1 and 3" works from the start: it sets the question up and
// answers nothing. "Play with claps on 2 and 4" waits for a guess, slides
// the claps one beat along (0.4 s, at once under reduced motion or Pause
// animations), announced "Claps moved to 2 and 4", then blue Merc sings
// both lines over the plain click, loudest on beat 1 and softest on 2 and
// 4, and both Mercs hop on every clap (FACTS 30, 72). The reveal follows
// once it has been heard to its end; with sound off the hint says so and
// the reveal waits. Each play is the page's one sound (kit/now-playing.ts)
// from its press, the slide included: a newer sound anywhere stops it,
// Merc falls quiet, and a play cut short reveals nothing.
//
// Until the reveal nothing on screen or in the clicks says which beats are
// strong: every click plain, the beat numbers one size, the claps plain
// dots (Look). As it shows, beat 1's number grows, the 2s and 4s and their
// claps turn gold and glow once, a dashed ghost of the claps on 1 and 3
// stays beside them, and orange celebrates. The strip takes no taps (the
// buttons carry every action), so its drawing is hidden from a screen
// reader and a polite live region speaks for it.

import type { Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { CLICK } from '@/features/lessons/kit/beat-patterns'
import { mountBeatStrip } from '@/features/lessons/kit/beat-strip'
import { q, wait } from '@/features/lessons/kit/dom'
import { mercCelebrate, mercListen, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { HOP_MS, mercHop } from '@/features/lessons/kit/merc-hop'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { COLOR, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { ColdHit, Version } from './patterns'
import { BEAT_SEC, BPM, CLAP_LEVEL, CLAPS, coldOpenBars, HERO_ROWS, mercLevel, } from './patterns'

/** The reveal's first line, by the choice: never "right" or "wrong". */
export const GUESS: Readonly<Record<string, string>> = {
  strong: 'You said: strong beats',
  weak: 'You said: weak beats',
}

/** What the live region says as each version starts. */
export const VERSION_SAID: Readonly<Record<Version, string>> = {
  13: 'Claps on 1 and 3',
  24: 'Claps moved to 2 and 4',
}

/** The predict's hints (Toys 2), the sound-off one LESSON.md's. */
export const HINTS = {
  chosen: 'Locked in. Play with claps on 2 and 4.',
  silent:
    'Sound is off, so nothing played. Turn sound on to hear it, then press Play with claps on 2 and 4.',
  again: 'Play either version again.',
} as const

/** The claps' slide to their new beats, seconds. */
const SLIDE_SEC = 0.4
/** How long a beat's lamp stays lit, seconds. */
const LAMP_SEC = 0.12
/** A sung syllable's length against its beats: room for a repeated note to be heard as two. */
const HELD = 0.85

/** Books a cold-open hit: the plain click, a clap, or a syllable at its beat's level. */
function book(hit: ColdHit, when: number, bus: Bus): void {
  if (hit.kind === 'click')
    Sound.tick(CLICK.plain.hz, CLICK.plain.gain, { when, to: bus.node })
  else if (hit.kind === 'clap')
    triggerDrumVoice('clap', bus.context, when, CLAP_LEVEL, bus.node)
  else if (hit.kind === 'sing')
    bookNote(hz(hit.syllable.midi), {
      when,
      dur: hit.syllable.beats * BEAT_SEC * HELD,
      kind: 'merc',
      gain: mercLevel(hit.syllable.beat),
      to: bus.node,
    })
}

export function initColdOpen(): void {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const fig = q('#heroFig')
  const said = q('[data-hero-said]', fig)
  const strip = mountBeatStrip(q('#heroStrip', fig), {
    rows: HERO_ROWS,
    beatsPerBar: 4,
    metronome: 'mt-hero',
  })
  let claps: Version = 13
  let revealed = false
  strip.claps(CLAPS[13])
  strip.marks({ accent: false, backbeat: false })

  // the stops so far: a play stopped while its claps still slide finds them changed
  let stops = 0
  let run: Run | null = null

  /** Every clap, with its ghost after the reveal: the ghost stays on 1 and 3 beside claps on 2 and 4. */
  function drawClaps(version: Version, seconds: number): void {
    claps = version
    strip.claps(CLAPS[version], seconds)
    strip.ghost(revealed && version === 24 ? CLAPS[13] : null)
  }

  /** Stops the hero's play where it stands; Merc falls quiet and nothing stays lit. */
  function stop(): void {
    stops += 1
    run?.stop()
    run = null
    mercSing('blue', 60, false)
    mercListen('orange', false)
    strip.light(null)
    strip.swing(null, false)
    NowPlaying.release(stop)
  }

  function onHit(hit: ColdHit): void {
    if (hit.kind === 'hop') {
      mercHop('blue')
      mercHop('orange')
    } else if (hit.kind === 'sing') {
      mercSing('blue', hit.syllable.midi, true)
      strip.light(hit.syllable.beat, COLOR.blue)
    }
  }

  function onFrame(spot: Spot): void {
    const into = (spot.beats % 1) * BEAT_SEC
    strip.swing(spot.beats, into < LAMP_SEC)
  }

  /** Plays a version; resolves false if another sound, or its own stop, cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = stops
    const version: Version = what === '24' ? 24 : 13
    if (claps !== version) {
      const slide = Motion.paused ? 0 : SLIDE_SEC
      drawClaps(version, slide)
      if (slide > 0) await wait(slide)
      if (mine !== stops) return false
    }
    if (said.textContent !== VERSION_SAID[version])
      said.textContent = VERSION_SAID[version]
    mercListen('orange', true)
    const r = BeatClock.start<ColdHit>({
      bar: bars(coldOpenBars(version, HOP_MS / 1000 / BEAT_SEC)),
      bpm: () => BPM,
      audible,
      // room before the first clap for its hop to start
      lead: 0.6,
      early: HOP_MS / 1000,
      book,
      onHit,
      onFrame,
    })
    run = r
    const finished = await r.done
    if (mine !== stops) return false
    run = null
    stop()
    return finished
  }

  mountPredict(q('#predict'), {
    play,
    // both plays sit under the stage, so the first is on a phone's first screen
    plays: [
      q<HTMLButtonElement>('#heroPlay'),
      q<HTMLButtonElement>('#heroPlay24'),
    ],
    revealOn: ['24'],
    hints: HINTS,
    guess: (choice) => GUESS[choice] ?? 'You said',
    onReveal: () => {
      revealed = true
      strip.marks({ accent: true, backbeat: true, glow: true })
      drawClaps(claps, 0)
      mercCelebrate('orange', 1600)
    },
  })
}
