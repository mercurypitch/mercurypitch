// When the mixer's Open in Karaoke Night waits, and why, in one place.
// ============================================================
//
// Karaoke Night is another page in the same tab, so leaving for it ends
// whatever this page is in the middle of. The button stays drawn while
// something would be lost, waiting (aria-disabled), and says what in words.
// Where Karaoke Night has nothing to add, the button is not drawn at all:
// the native app has no Karaoke Night page, and the Karaoke room and
// Karaoke Night itself are already a stage (StemMixer decides that).

/** A playlist run: `?session=` would lose the entry's own key and the place. */
export const KN_PLAYLIST_RUNNING =
  'A playlist is running. Open it in Karaoke Night from Songs.'
/** A separation or an upload in this tab: leaving would stop it. */
export const KN_SEPARATING =
  'A song is still separating here. Leaving now would stop it.'
/** A take being kept: leaving would lose it. */
export const KN_TAKE_SAVING =
  'A take is still saving. Leaving now would lose it.'

export interface KaraokeNightState {
  playlistRunning: boolean
  separating: boolean
  takeSaving: boolean
}

/** Why Open in Karaoke Night waits right now, or null when it can go. */
export function karaokeNightReason(state: KaraokeNightState): string | null {
  // Work that would be lost outranks a song that would open differently.
  if (state.takeSaving) return KN_TAKE_SAVING
  if (state.separating) return KN_SEPARATING
  if (state.playlistRunning) return KN_PLAYLIST_RUNNING
  return null
}
