// ============================================================
// Quiet check words — its length and its two lines
// ============================================================
//
// What a page times and says around the quiet check before the
// microphone's modules load (Lesson 24 WEB-SPEC, Toys 6, state 6; FACTS
// 52). The check itself (kit/quiet-check.ts) reads its frames through Voice
// Mirror's preprocessing, which brings the pitch code with it, so a page
// loads it with the listener, on Start, and takes its length and its lines
// from here, which bring nothing, at first paint. Lesson 28, whose learner
// without headphones sings alone, ends the heard line by offering that.

/** Seconds of the drone, or of the part, the check listens over. */
export const QUIET_SEC = 2

/** The check's line before it runs, naming what plays ("the drone", "Merc's part"): the learner's cue to stay quiet. */
export const quietLine = (what: string): string =>
  `First, stay quiet for two seconds while ${what} plays: the page checks that the microphone can't hear it.`

/** What the learner does after the check heard a note: try it again (Lessons 24 and 26). */
export const AGAIN_NEXT = 'then press Start again and stay quiet'

/** Or, where the page lets a learner without headphones sing alone (Lesson 28): choose that. */
export const ALONE_NEXT = 'or choose No headphones to sing alone'

/** The check's line when it heard a note: what it heard over, and what to do. */
export const heardLine = (what: string, next: string = AGAIN_NEXT): string =>
  `The microphone heard a note during ${what}. Check your headphones, ${next}.`

/** Lesson 24's lines, over its drone. */
export const QUIET_LINE = quietLine('the drone')
export const HEARD_LINE = heardLine('the drone')
