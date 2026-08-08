// ============================================================
// Karaoke launch intent — one-shot autoplay handoff to the mixer
// ============================================================
//
// Voice control (and any future launcher) can ask that the NEXT StemMixer
// to finish loading starts playback by itself — "play a random song"
// should sing, not sit at a loaded mixer waiting for another command.
// The request is consumed exactly once and expires quickly, so a stale
// intent can never surprise-play a session the user opened by hand later.

const AUTOPLAY_INTENT_TTL_MS = 30_000

let autoplayRequestedAt = 0

export function requestKaraokeAutoplay(): void {
  autoplayRequestedAt = Date.now()
}

/** True exactly once per fresh request; always clears. */
export function consumeKaraokeAutoplayIntent(): boolean {
  const fresh =
    autoplayRequestedAt > 0 &&
    Date.now() - autoplayRequestedAt < AUTOPLAY_INTENT_TTL_MS
  autoplayRequestedAt = 0
  return fresh
}
