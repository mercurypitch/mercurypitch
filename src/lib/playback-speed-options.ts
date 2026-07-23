export const STEM_MIXER_PLAYBACK_SPEEDS = [
  0.5, 0.75, 0.85, 1, 1.2, 1.5, 1.75, 2,
] as const

export function formatPlaybackSpeed(speed: number): string {
  return speed === 1 ? '1x natural' : `${speed}x`
}
