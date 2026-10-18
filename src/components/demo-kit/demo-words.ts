// ============================================================
// The demo's words: the same in every room
// ============================================================
//
// What the demo kit says around Merc's takes (its pill, its live region,
// its play card and its end card), word for word in Echo, Long note and
// the glide rooms. A room's tooltips are its own (each room's
// demo-cues.ts), and so is anything a room says differently: Long note's
// fast-forward pill, and its mic hint.

/** The demo's words. No em dashes; "practice", never "practise". */
export const DEMO_WORDS = {
  watch: 'Watch me first.',
  off: 'Not like this',
  on: 'Like this',
  skip: 'Skip',
  ask: 'How it works',
  cardTitle: 'See how it works',
  cardLine: 'Merc sings it first. Turn your sound on.',
  watchButton: 'Watch',
  notNow: 'Not now',
  endTitle: 'Your turn',
  tryIt: 'Try it',
  again: 'Watch again',
  micHint: 'Tap the mic to start.',
} as const
