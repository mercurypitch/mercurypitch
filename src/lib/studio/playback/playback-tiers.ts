// ============================================================
// Studio playback tiers — the three levels live playback renders at, Best to Light
// ============================================================
//
// Their own module so the song cost model (song-load.ts) can name a tier
// without importing Auto (playback-quality.ts), which imports the model.

export const PLAYBACK_TIERS = ['best', 'balanced', 'light'] as const
export type StudioPlaybackTier = (typeof PLAYBACK_TIERS)[number]
