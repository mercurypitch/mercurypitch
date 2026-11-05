// ============================================================
// Lesson 14 steps — five steps, one song line
// ============================================================
//
// Every step shows the one song line (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): the whole song with a button for each phrase;
// Merc's two takes of the first phrase with their breath marks; the swell
// beside Lesson 5's push, each over its level strip; phrases 2 and 3 over
// their chords; and both takes back to back, with a scrub through take 2.
// The song is in the chosen voice, `fyp-voice`, else the lower, and the
// line follows a change made in Sing it (song-line.ts).
//
// Each step's own controls are in the one toy, marked with the step they
// show on (`data-part`; kit/step-parts.ts), so no two controls on the stage
// share a name. Leaving a step stops its sound and opens the next step's
// state; the step showing shown again, as a layout switch shows it, stops
// nothing. Every play is a Stop while it sounds, and one sound plays at a
// time (plays.ts). With sound off a play still draws, silently.

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import type { LevelPoint } from '@/features/lessons/kit/band-chart-hold'
import { q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { takeCents, takeLevel } from '@/features/lessons/kit/push-take'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine, playLines, playNotes, } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { showParts } from '@/features/lessons/kit/step-parts'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { BREATH_LINE, CADENCE_LINE, phraseCaption, phraseEndLine, scrubText, } from './lines'
import type { PlayButton } from './plays'
import { bindPlay, singAlong, singNotes } from './plays'
import type { SongNote } from './song'
import { lineChords, lineNotes, PUSH_AT, pushContour, sungLines, SWELL_LEVEL, SWELL_SEC, swellCents, swellContour, TAKE_BREATH, VERSE_BREATHS, verseNotes, } from './song'
import type { Drawing, Play, SongLine, SongState } from './song-line'
import { mountSongLine, takePlay } from './song-line'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The whole song, in six phrases',
  2: '<span class="fig">Fig. 2</span> Merc\'s two takes of phrase 1',
  3: '<span class="fig">Fig. 3</span> A swell, and Lesson 5\'s push',
  4: '<span class="fig">Fig. 4</span> Two phrase endings, with their chords',
  5: '<span class="fig">Fig. 5</span> Merc\'s two takes, back to back',
}

/** Each step's state of the song line. */
export const STATE: Readonly<Record<number, SongState>> = {
  1: 'song',
  2: 'takes',
  3: 'swell',
  4: 'endings',
  5: 'listen',
}

/** Seconds between Step 5's two takes (WEB-SPEC, Toys 1, Listen back). */
export const BOTH_GAP = 1
/** A phrase of the song, seconds. */
const PHRASE_SEC = 6

/** Phrase `k` of the whole song, its notes from its own start, its last note shortened by its breath. */
export function songPhrase(k: number, doMidi: number): SongNote[] {
  return verseNotes(doMidi)
    .slice(k * 7, k * 7 + 7)
    .map((n) => ({
      ...n,
      from: n.from - k * PHRASE_SEC,
      to: n.to - k * PHRASE_SEC,
      light: n.light.map((p) => ({ t: p.t - k * PHRASE_SEC, level: p.level })),
    }))
}

/** So's cents from do, where Step 3's two lines sit. */
const SO = MAJOR_DEGREES[4] * 100

/** Step 3's line `t` seconds into the swell or the push, every 50 ms up to `t`, placed in its window. */
export function stepThreeLine(
  which: 'swell' | 'push',
  upTo: number,
): TracePoint[] {
  const at = which === 'swell' ? 0 : PUSH_AT
  const cents = (t: number): number =>
    which === 'swell' ? swellCents(t) : takeCents('pushed', t)
  const out: TracePoint[] = []
  const end = Math.min(SWELL_SEC, upTo)
  for (let t = 0; t < end; t += 0.05) out.push({ t: at + t, c: SO + cents(t) })
  if (end > 0) out.push({ t: at + end, c: SO + cents(end) })
  return out
}

/** Step 3's level, as height in the strip, up to `t` seconds into its window. */
export function stepThreeLevel(
  which: 'swell' | 'push',
  upTo: number,
): LevelPoint[] {
  const at = which === 'swell' ? 0 : PUSH_AT
  const end = Math.min(SWELL_SEC, upTo)
  if (end <= 0) return []
  if (which === 'swell') {
    const level = (t: number): number => {
      for (let i = 1; i < SWELL_LEVEL.length; i++) {
        const a = SWELL_LEVEL[i - 1]
        const b = SWELL_LEVEL[i]
        if (t <= b.t)
          return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t)
      }
      return SWELL_LEVEL[SWELL_LEVEL.length - 1].level
    }
    const out = SWELL_LEVEL.filter((p) => p.t < end).map((p) => ({ ...p }))
    out.push({ t: end, level: level(end) })
    return out
  }
  const out: LevelPoint[] = []
  for (let t = 0; t < end; t += 0.1)
    out.push({ t: at + t, level: takeLevel('pushed', t) })
  out.push({ t: at + end, level: takeLevel('pushed', end) })
  return out
}

/** Both of Step 3's levels in one strip, pinched to nothing between the windows. */
export function joinLevels(
  swell: readonly LevelPoint[],
  push: readonly LevelPoint[],
): LevelPoint[] {
  if (swell.length === 0 || push.length === 0) return [...swell, ...push]
  const a = swell[swell.length - 1]
  const b = push[0]
  return [
    ...swell,
    { t: a.t + 0.01, level: 0 },
    { t: b.t - 0.01, level: 0 },
    ...push,
  ]
}

/**
 * Mounts the stage's song line and follows the deck: registered before
 * `deck.start()`, so an address that names a step opens it.
 */
export function initSteps(deck: StepDeck): SongLine {
  const root = q('#toySong')
  const label = q('[data-fig-label]', root)
  const caption = q('[data-song-caption]', root)
  const status = q('[data-song-status]', root)
  const scrub = q<HTMLInputElement>('[data-song-scrub]', root)
  const phrases = qa<HTMLButtonElement>('[data-phrase]', root)
  const line = mountSongLine(q('[data-song-viz]', root), {
    state: 'song',
    active: deck.toyActive(1),
  })
  const plays: PlayButton[] = []
  let step = 1

  const which = () => mercOf(VoiceChoice.voice ?? 'lower')
  const say = (text: string): void => {
    status.textContent = text
  }

  /**
   * A play of Merc's notes: its sound, its drawing, Merc singing it, and its
   * cues, each `[seconds, what]`, all ended with it.
   */
  function sung(
    p: Play,
    run: Run,
    audible: boolean,
    cues: readonly (readonly [number, () => void])[] = [],
  ): Run {
    const drawing = line.play(p)
    const quiet = singAlong(p.notes, which(), audible)
    const timers = cues.map(([t, fn]) => window.setTimeout(fn, t * 1000))
    void run.done.then((heard) => {
      timers.forEach((id) => window.clearTimeout(id))
      quiet()
      if (heard) drawing.end()
      else drawing.cancel()
    })
    return run
  }

  // Step 1: the whole song, and each phrase alone
  const markPhrase = (k: number | null): void => {
    phrases.forEach((b, i) => {
      if (i === k) b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    })
  }
  const phraseCues = (k: number, at: number): [number, () => void][] => [
    [
      at,
      () => {
        caption.textContent = phraseCaption(k)
        markPhrase(k)
      },
    ],
    [at + 4.5, () => say(phraseEndLine(k))],
  ]
  plays.push(
    bindPlay(q<HTMLButtonElement>('[data-song-play="song"]', root), () => {
      const audible = Sound.canPlay()
      const notes = verseNotes(line.doMidi)
      say('')
      return sung(
        {
          notes,
          breaths: VERSE_BREATHS.map((t) => ({ t, word: false })),
          name: null,
        },
        singNotes(notes, audible),
        audible,
        [0, 1, 2, 3, 4, 5].flatMap((k) => phraseCues(k, k * PHRASE_SEC)),
      )
    }),
  )
  phrases.forEach((b, k) =>
    plays.push(
      bindPlay(b, () => {
        const audible = Sound.canPlay()
        const notes = songPhrase(k, line.doMidi)
        say('')
        return sung(
          {
            notes,
            breaths: k < 5 ? [{ t: PHRASE_SEC - 0.3, word: false }] : [],
            at: k * PHRASE_SEC,
            name: null,
          },
          singNotes(notes, audible),
          audible,
          phraseCues(k, 0),
        )
      }),
    ),
  )

  // Step 2: Merc's two takes, each breath named as it lights
  for (const id of [1, 2] as const)
    plays.push(
      bindPlay(
        q<HTMLButtonElement>(`[data-song-play="take${String(id)}"]`, root),
        () => {
          const audible = Sound.canPlay()
          const p = takePlay(id, line.doMidi)
          say('')
          return sung(p, singNotes(p.notes, audible), audible, [
            [TAKE_BREATH[id], () => say(BREATH_LINE[id])],
          ])
        },
      ),
    )

  // Step 3: the swell and Lesson 5's push, each line drawn as it sounds and kept
  const drawn = { swell: 0, push: 0 }
  let drawing: { which: 'swell' | 'push'; start: number } | null = null
  const paintThree = (): void => {
    line.drawLines(
      [
        ...stepThreeLine('swell', drawn.swell),
        { t: SWELL_SEC + 0.3, c: null },
        ...stepThreeLine('push', drawn.push),
      ],
      joinLevels(
        stepThreeLevel('swell', drawn.swell),
        stepThreeLevel('push', drawn.push),
      ),
    )
  }
  addDrawer({
    active: deck.toyActive(1),
    wants: () => drawing !== null,
    draw() {
      if (drawing === null) return
      drawn[drawing.which] = Math.min(
        SWELL_SEC,
        performance.now() / 1000 - drawing.start,
      )
      paintThree()
    },
  })
  for (const w of ['swell', 'push'] as const)
    plays.push(
      bindPlay(q<HTMLButtonElement>(`[data-song-play="${w}"]`, root), () => {
        const audible = Sound.canPlay()
        const points =
          w === 'swell' ? swellContour(line.doMidi) : pushContour(line.doMidi)
        const run = playLine(points, { audible })
        drawn[w] = reducedMotion() ? SWELL_SEC : 0
        const mine = { which: w, start: performance.now() / 1000 }
        drawing = reducedMotion() ? null : mine
        paintThree()
        wake()
        void run.done.then(() => {
          if (drawing === mine) drawing = null
          paintThree()
        })
        return run
      }),
    )

  // Step 4: phrases 2 and 3 over their chords, each ending named as it comes
  let ending: 1 | 2 = 1
  for (const [key, k] of [
    ['are', 1],
    ['high', 2],
  ] as const)
    plays.push(
      bindPlay(q<HTMLButtonElement>(`[data-song-play="${key}"]`, root), () => {
        const audible = Sound.canPlay()
        if (ending !== k) {
          ending = k
          line.show('endings', { line: k })
        }
        const notes = lineNotes(k, line.doMidi)
        say('')
        const run = allOf([
          singNotes(notes, audible),
          playNotes(lineChords(k, line.doMidi), { audible }),
        ])
        void run.done.then((heard) => {
          if (heard) say(CADENCE_LINE[k])
        })
        return sung({ notes, name: null }, run, audible)
      }),
    )

  // Step 5: both takes back to back, and a scrub through take 2
  plays.push(
    bindPlay(q<HTMLButtonElement>('[data-song-play="both"]', root), () => {
      const audible = Sound.canPlay()
      const one = takePlay(1, line.doMidi)
      const two = takePlay(2, line.doMidi)
      const second = PHRASE_SEC + BOTH_GAP
      const run = playLines(
        [
          ...sungLines(one.notes),
          ...sungLines(two.notes).map((l) => ({ ...l, t: l.t + second })),
        ],
        { audible, length: second + PHRASE_SEC },
      )
      let now: Drawing = line.play(one)
      let quiet = singAlong(one.notes, which(), audible)
      const later = window.setTimeout(() => {
        now.end()
        now = line.play(two)
        quiet = singAlong(two.notes, which(), audible)
      }, second * 1000)
      void run.done.then((heard) => {
        window.clearTimeout(later)
        quiet()
        if (heard) now.end()
        else now.cancel()
      })
      return run
    }),
  )
  const scrubTo = (t: number): void => {
    scrub.setAttribute('aria-valuetext', scrubText(t))
    line.scrub(takePlay(2, line.doMidi), t)
  }
  scrub.addEventListener('input', () => {
    // a scrub plays nothing: whatever sounds stops first
    plays.forEach((p) => p.stop())
    scrubTo(Number(scrub.value))
  })

  /** Opens step `n`'s state: its sound stopped, its words cleared. */
  function openStep(n: number): void {
    plays.forEach((p) => p.stop())
    drawing = null
    drawn.swell = 0
    drawn.push = 0
    ending = 1
    caption.textContent = ''
    markPhrase(null)
    say('')
    scrub.value = '0'
    scrub.setAttribute('aria-valuetext', scrubText(0))
    line.show(STATE[n] ?? 'song')
    if (n === 3) paintThree()
  }

  label.innerHTML = FIG[1]
  openStep(1)
  registerToy({
    onStep(n, previous) {
      if (n === previous) return
      step = n
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      openStep(n)
    },
  })
  // the line follows the voice: a phrase view's drawings go with the old do
  VoiceChoice.subscribe(() => {
    if (step === 3) paintThree()
  })
  return line
}
