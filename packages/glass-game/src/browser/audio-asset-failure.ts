// Packaged audio diagnostics — bounded local detail for optional soundtrack and narration failures.

export type AudioAssetChannel =
  | 'museum-soundtrack'
  | 'merc-narration'
  | 'songbook'

export function reportAudioAssetFailure(
  channel: AudioAssetChannel,
  cause: unknown,
): void {
  const original = cause instanceof Error ? cause : undefined
  console.warn('[Glassworks audio]', {
    channel,
    errorName: original?.name.slice(0, 80) ?? 'UnknownError',
    errorMessage: original?.message.slice(0, 240) ?? 'No error detail supplied',
  })
}
