// ============================================================
// Merc's lines for Long note — one table, easy to swap
// ============================================================
//
// Owner, 9 Oct 2026: Merc's lines live in one place and change in one file.
// Every moment has a few variants, and the selector never says the same
// line twice in a row for a moment. `{note}` becomes the target ("A3").
//
// Owner, 11 Oct 2026: plain words, one register. Each line says what the
// voice is doing (on the note, a little sharp, flat, steady, off the note)
// and what to do about it (come down a touch, lift a little). Merc stays
// warm but never decorates: no glass, glow or pouring light. No "wrong",
// "failed" or "bad" either; the lines are about the sound, never the singer.

export type LongNoteMoment =
  | 'intro'
  | 'introAny'
  | 'listen'
  | 'found'
  | 'lock'
  | 'steady'
  | 'driftSharp'
  | 'driftFlat'
  | 'break'
  | 'full'
  | 'topSteady'
  | 'topShaky'
  | 'brim'
  | 'newBest'
  | 'result'
  | 'resultFull'
  | 'resultBrim'
  | 'missed'
  | 'again'
  | 'sleep'
  | 'sleepAny'
  | 'rest'

export interface MercLine {
  /** Stable id, for a recorded voice line later. */
  readonly id: string
  readonly text: string
}

export const MERC_LINES: Readonly<Record<LongNoteMoment, readonly MercLine[]>> =
  {
    intro: [
      { id: 'intro-breathe', text: 'Breathe in, then hold {note}.' },
      { id: 'intro-easy', text: 'Hold {note} for as long as it feels easy.' },
      {
        id: 'intro-fills',
        text: 'Hold {note}. The light fills while you stay on it.',
      },
    ],
    // No note yet: the singer picks one by singing it.
    introAny: [
      { id: 'any-easy', text: "Sing any note that sits easy. I'll find it." },
      {
        id: 'any-follow',
        text: "Start on a note that feels easy. I'll follow.",
      },
    ],
    listen: [
      { id: 'listen-ready', text: "Whenever you're ready. I'm listening." },
      { id: 'listen-breathe', text: 'Take a breath, then sing {note}.' },
    ],
    // On the note: the first lock, and every lock after a break.
    lock: [
      { id: 'lock-hold', text: 'On {note}. Hold it there.' },
      { id: 'lock-right', text: 'Right on {note}.' },
    ],
    // The singer's own note, named as Merc catches it.
    found: [
      { id: 'found-hold', text: 'Got it: {note}. Now hold it.' },
      { id: 'found-there', text: '{note} it is. Hold it there.' },
    ],
    steady: [
      { id: 'steady-keep', text: 'Steady. Keep it there.' },
      { id: 'steady-nice', text: 'Nice and steady.' },
    ],
    driftSharp: [
      { id: 'sharp-touch', text: 'A little sharp. Come down a touch.' },
      { id: 'sharp-ease', text: 'Sharp. Ease down.' },
    ],
    driftFlat: [
      { id: 'flat-touch', text: 'A little flat. Come up a touch.' },
      { id: 'flat-lift', text: 'Flat. Lift a little.' },
    ],
    // A semitone or more away, or back from a gap off the note.
    break: [{ id: 'break-off', text: 'Off the note. Find {note} again.' }],
    // The goal: 12 seconds on the note fill the lantern halfway. Past it
    // steady singing fills the top (the hold engine's stretch; a voice
    // under the level's bar fills part of it).
    full: [
      {
        id: 'full-twelve',
        text: '12 seconds, half full. Steady singing fills the top.',
      },
      {
        id: 'full-half',
        text: 'Halfway. Hold it steady to fill the top.',
      },
    ],
    // Past the goal, on the note: whether the top is filling.
    topSteady: [
      { id: 'top-steady', text: 'Steady. The top is filling.' },
      { id: 'top-rising', text: 'Nice and steady. The light is rising.' },
    ],
    topShaky: [
      {
        id: 'top-wobbly',
        text: 'A little wobbly. Hold it still to fill the top.',
      },
      { id: 'top-still', text: 'On the note. Hold it stiller for the top.' },
    ],
    // The top is full too.
    brim: [
      { id: 'brim-top', text: 'Full to the top. That was steady.' },
      { id: 'brim-go', text: 'Full to the brim. Let go when you like.' },
    ],
    newBest: [
      { id: 'best-note', text: 'New best on {note}!' },
      { id: 'best-longest', text: "That's your longest {note} yet." },
    ],
    result: [
      { id: 'result-again', text: 'Nice hold. Another?' },
      {
        id: 'result-twelve',
        text: 'Nice hold. 12 seconds on the note fill it halfway.',
      },
    ],
    // The lantern reached the goal, halfway, and not the brim.
    resultFull: [
      { id: 'result-full', text: '12 seconds on {note}: half full.' },
      {
        id: 'result-held',
        text: 'Halfway on {note}. The top takes steady singing.',
      },
    ],
    // Steady singing filled the top as well.
    resultBrim: [
      { id: 'result-brim', text: 'Full to the brim: a steady {note}.' },
      { id: 'result-top', text: 'You filled it to the top on {note}.' },
    ],
    // The take ended without ever finding the note; the mic is closed.
    missed: [
      { id: 'missed-hear', text: 'Tap {note} to hear it, then go again.' },
      {
        id: 'missed-never',
        text: 'Never quite on {note}. Hear it, then go again.',
      },
    ],
    again: [
      { id: 'again-fresh', text: 'Same note, fresh breath.' },
      { id: 'again-two', text: 'Round two. Breathe in first.' },
    ],
    sleep: [{ id: 'sleep-wake', text: 'Sing {note} to wake me.' }],
    sleepAny: [{ id: 'sleep-any', text: 'Sing any note to wake me.' }],
    // A minute with no voice: the mic closed, the room is back at rest.
    rest: [
      {
        id: 'rest-quiet',
        text: 'No voice for a minute, so the mic is off. Tap it to sing.',
      },
      {
        id: 'rest-again',
        text: 'Mic off after a quiet minute. Tap it to go again.',
      },
    ],
  }

/** A centre this far off the note is on another one: off, not sharp. */
const OFF_NOTE_CENTS = 95

/**
 * The line for a voice off the band, by the hold engine's smoothed centre
 * (the same one the trace turns amber on): which way it is off, or off the
 * note altogether when it sits a semitone or more away. The engine clamps
 * readings to 100 cents, so a centre near that is another note.
 */
export function offMoment(
  needleCents: number,
): 'driftSharp' | 'driftFlat' | 'break' {
  if (Math.abs(needleCents) >= OFF_NOTE_CENTS) return 'break'
  return needleCents > 0 ? 'driftSharp' : 'driftFlat'
}

export interface MercLineSelector {
  /** The next line for a moment, with `{note}` filled in. */
  next(moment: LongNoteMoment, note: string): string
}

export function fillNote(text: string, note: string): string {
  return text.replaceAll('{note}', note)
}

export function createMercLineSelector(
  random: () => number = Math.random,
  lines: Readonly<Record<LongNoteMoment, readonly MercLine[]>> = MERC_LINES,
): MercLineSelector {
  const last = new Map<LongNoteMoment, string>()
  return {
    next(moment, note) {
      const all = lines[moment]
      const previous = last.get(moment)
      const pool =
        all.length > 1 ? all.filter((line) => line.id !== previous) : all
      const sample = random()
      const index = Number.isFinite(sample)
        ? Math.min(
            pool.length - 1,
            Math.max(0, Math.floor(sample * pool.length)),
          )
        : 0
      const line = pool[index]
      last.set(moment, line.id)
      return fillNote(line.text, note)
    },
  }
}
