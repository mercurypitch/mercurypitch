// ============================================================
// Merc's lines for Long note — one table, easy to swap
// ============================================================
//
// Owner, 9 Oct 2026: Merc's lines live in one place and change in one file.
// Every moment has a few variants, and the selector never says the same
// line twice in a row for a moment. `{note}` becomes the target ("A3").
//
// The voice follows Merc's character profile: short, warm, about the sound
// and never about the singer. No "wrong", "failed" or "bad"; a drift is a
// direction to move in, and a break is the light waiting.

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
  | 'newBest'
  | 'result'
  | 'resultFull'
  | 'missed'
  | 'again'
  | 'sleep'
  | 'sleepAny'

export interface MercLine {
  /** Stable id, for a recorded voice line later. */
  readonly id: string
  readonly text: string
}

export const MERC_LINES: Readonly<Record<LongNoteMoment, readonly MercLine[]>> =
  {
    intro: [
      { id: 'intro-breathe', text: 'Breathe in, then hold {note}.' },
      {
        id: 'intro-easy',
        text: 'One easy {note}. Hold it as long as it feels good.',
      },
      {
        id: 'intro-fill',
        text: 'Fill the lantern for me? {note}, nice and long.',
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
      { id: 'listen-breath', text: 'Take a breath first. The note will wait.' },
    ],
    lock: [
      { id: 'lock-there', text: 'There it is. Right in the middle.' },
      { id: 'lock-pour', text: 'Locked on. Let it pour in.' },
      { id: 'lock-one', text: "That's the one. Keep it coming." },
    ],
    // The singer's own note, named as Merc catches it.
    found: [
      { id: 'found-hold', text: 'Got it: {note}. Now hold it.' },
      { id: 'found-yours', text: '{note} it is. Keep it coming.' },
    ],
    steady: [
      { id: 'steady-glass', text: 'Steady as glass.' },
      { id: 'steady-light', text: 'Smooth. The light loves that.' },
      { id: 'steady-just', text: 'Just like that.' },
    ],
    driftSharp: [
      { id: 'sharp-settle', text: 'A hair high. Let it settle.' },
      { id: 'sharp-ease', text: 'Ease down a little.' },
    ],
    driftFlat: [
      { id: 'flat-float', text: 'Float up a touch.' },
      { id: 'flat-lift', text: 'Just under it. Lift a little.' },
    ],
    break: [
      { id: 'break-waits', text: 'Find {note} again. The light waits.' },
      { id: 'break-slide', text: 'No rush. Slide back to {note}.' },
    ],
    full: [
      { id: 'full-more', text: "Full! Keep going if you've got more." },
      { id: 'full-glow', text: "The lantern's full. Look at that glow." },
    ],
    newBest: [
      { id: 'best-note', text: 'New best on {note}!' },
      { id: 'best-longest', text: "That's your longest {note} yet." },
    ],
    result: [
      { id: 'result-long', text: 'Lovely and long.' },
      { id: 'result-again', text: 'Nice hold. Another?' },
    ],
    // The lantern reached the goal.
    resultFull: [
      { id: 'result-lit', text: "That's a lantern well lit." },
      { id: 'result-top', text: 'Full to the top. Lovely.' },
    ],
    // The take ended without ever finding the note; the mic is closed.
    missed: [
      { id: 'missed-hear', text: 'Tap {note} to hear it, then go again.' },
      { id: 'missed-wait', text: 'The light is still waiting for {note}.' },
    ],
    again: [
      { id: 'again-fresh', text: 'Same note, fresh breath.' },
      { id: 'again-two', text: 'Round two. Breathe in first.' },
    ],
    sleep: [{ id: 'sleep-wake', text: 'Sing {note} to wake me.' }],
    sleepAny: [{ id: 'sleep-any', text: 'Sing any note to wake me.' }],
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
