export const STEM_MIXER_PLAYBACK_SPEEDS = [
  0.5, 0.75, 0.85, 1, 1.2, 1.5, 1.75, 2,
] as const

/**
 * The multiplier alone. `1` used to read "1x natural", which spent a word
 * saying what "1x" already says and made the control wide enough to matter in
 * a toolbar — the meaning belongs on the label beside it, not inside every
 * option.
 */
export function formatPlaybackSpeed(speed: number): string {
  return `${speed}x`
}
