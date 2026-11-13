// ============================================================
// Quiet check words — its length and its two lines
// ============================================================
//
// What a page times and says around the quiet check before the
// microphone's modules load (Lesson 24 WEB-SPEC, Toys 6, state 6; FACTS
// 52). The check itself (kit/quiet-check.ts) reads its frames through Voice
// Mirror's preprocessing, which brings the pitch code with it, so a page
// loads it with the listener, on Start, and takes its length and its lines
// from here, which bring nothing, at first paint.

/** Seconds of the drone, or of the part, the check listens over. */
export const QUIET_SEC = 2

/** The check's line before it runs, naming what plays ("the drone", "Merc's part"): the learner's cue to stay quiet. */
export const quietLine = (what: string): string =>
  `First, stay quiet for two seconds while ${what} plays: the page checks that the microphone can't hear it.`

/** The check's line when it heard a note: what it heard over, and what to do. */
export const heardLine = (what: string): string =>
  `The microphone heard a note during ${what}. Check your headphones, then press Start again and stay quiet.`

/** Lesson 24's lines, over its drone. */
export const QUIET_LINE = quietLine('the drone')
export const HEARD_LINE = heardLine('the drone')
