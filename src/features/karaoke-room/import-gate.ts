// ============================================================
// The import gate — what Import a song does, decided before the picker
// ============================================================
//
// S7b §0 point 6 and §4.3: Import asks before it opens Files. The answer has
// to be ready inside the tap, because the phone's picker only opens from the
// tap that asked for it (KaraokeImport.tsx), so it is read from what is
// already known: the songs /api/billing/me last said, and the token on the
// phone, which answers synchronously whether there is an account at all
// (MISTAKES.md, "Do not gate account UI on a fetch").
//
//   Who                                Import does
//   A subscriber with songs left       Files at once, the chip says how many
//   A subscriber with none left        a note: when the next songs come
//   Signed in, the free song unused    Files at once, chip "Your free song"
//   Signed in, the free song used      the offer, with the next free song's date
//   No account                         the offer, with the free account under it
//
// A phone with no token at all is the last row whatever the songs say: the
// server cannot name it, so it holds no songs (anonymous singers get no free
// song, owner S7 D5; a subscriber has a token). That is the fresh install
// that used to open Files and meet the paywall only after a pick.
//
// Anyone else the server has not answered for yet goes to Files, as before:
// the server's own admission is the last word, and a refusal there reaches
// the same gate through the queue (setImportGateHandler).

import type { KaraokeSongs } from './karaoke-songs'

/** The §4.3 row a singer is in, at the tap. */
export type ImportState =
  /** Songs left to separate: a subscriber's, or any the server counts. */
  | 'songs-left'
  /** A signed-in singer's free song of the month, and nothing else. */
  | 'free-song'
  /** A subscriber who has used every song this month. */
  | 'none-left'
  /** A signed-in singer, not subscribed, whose free song is used. */
  | 'free-used'
  /** No account: anonymous, or nothing on the phone at all. */
  | 'no-account'
  /** The server has not said yet: the pick decides, then the server. */
  | 'unknown'

/** What the phone knows of the singer, without asking anyone. */
export interface ImportWho {
  /** A session token is on the phone: anonymous or an account's. */
  readonly token: boolean
  /** That token is a real account's (hasUpgradedAccount). */
  readonly account: boolean
}

export function importState(songs: KaraokeSongs, who: ImportWho): ImportState {
  const left = songs.left
  if (songs.subscribed) {
    if (left === null) return 'unknown'
    return left === 0 ? 'none-left' : 'songs-left'
  }
  if (left !== null && left > 0) {
    return songs.free === 1 && left === 1 ? 'free-song' : 'songs-left'
  }
  if (!who.account) {
    return !who.token || left === 0 ? 'no-account' : 'unknown'
  }
  return left === 0 ? 'free-used' : 'unknown'
}

/** What the tap does for a state: the picker, the note, or the offer. */
export type ImportAction = 'files' | 'note' | 'offer'

export function importAction(state: ImportState): ImportAction {
  switch (state) {
    case 'songs-left':
    case 'free-song':
    case 'unknown':
      return 'files'
    case 'none-left':
      return 'note'
    case 'free-used':
    case 'no-account':
      return 'offer'
  }
}
