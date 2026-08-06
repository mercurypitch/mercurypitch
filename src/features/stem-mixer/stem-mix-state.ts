// ============================================================
// Stem mix state — one audibility rule for mute, solo, and fader changes
// ============================================================

/** The mixer state needed to decide whether a stem reaches the master bus. */
export interface StemMixTrackState {
  label: string
  muted: boolean
  soloed: boolean
  volume: number
}

export const stemMixHasSolo = (tracks: readonly StemMixTrackState[]): boolean =>
  tracks.some((track) => track.soloed)

/** Mute always wins; otherwise a solo set admits only its selected stems. */
export const stemTrackIsAudible = (
  track: StemMixTrackState,
  hasSolo: boolean,
): boolean => !track.muted && (!hasSolo || track.soloed)

export const stemTrackOutputLevel = (
  track: StemMixTrackState,
  hasSolo: boolean,
): number => (stemTrackIsAudible(track, hasSolo) ? track.volume : 0)

const updateTrack = <Track extends StemMixTrackState>(
  tracks: readonly Track[],
  label: string,
  update: (track: Track) => Track,
): Track[] =>
  tracks.map((track) => (track.label === label ? update(track) : track))

export const setStemVolume = <Track extends StemMixTrackState>(
  tracks: readonly Track[],
  label: string,
  volume: number,
): Track[] => {
  const safeVolume = Number.isFinite(volume)
    ? Math.min(1, Math.max(0, volume))
    : 0
  return updateTrack(tracks, label, (track) => ({
    ...track,
    volume: safeVolume,
  }))
}

export const toggleStemMute = <Track extends StemMixTrackState>(
  tracks: readonly Track[],
  label: string,
): Track[] =>
  updateTrack(tracks, label, (track) => ({
    ...track,
    muted: !track.muted,
  }))

export const toggleStemSolo = <Track extends StemMixTrackState>(
  tracks: readonly Track[],
  label: string,
): Track[] =>
  updateTrack(tracks, label, (track) => ({
    ...track,
    soloed: !track.soloed,
  }))
