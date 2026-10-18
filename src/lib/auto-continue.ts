// ============================================================
// Auto-continue: how long a routine waits before it takes the next step
// ============================================================
//
// One number for every routine that moves on by itself: the web's daily
// routine (src/features/routines/auto-continue.ts, which explains the
// countdown and the guards that keep it from being the kind of auto-advance
// people hate) and the native Warm-up's path, which counts down to its next
// stop the same way (owner, pw-next "auto", 18 Oct 2026). Here, below both
// features, so neither reaches into the other for it.

/** Long enough to stop, short enough not to feel like waiting. */
export const AUTO_CONTINUE_SECONDS = 5
