// ============================================================
// More lines — the one line of state under each row of the More sheet
// ============================================================
//
// Pure: each function takes what the stores hold and returns the words, so
// the sheet reads its stores and the wording is tested here. The sheet reads
// those stores synchronously, as it opens. Nothing here may need the network:
// a line that waited on a fetch would be a line that is wrong, or empty, on
// the first frame of every open (MISTAKES.md, "Do not gate account UI on a
// fetch").
//
// A line says what is true now, or failing that what the room is for. It
// never carries a count that asks nothing of the reader, and it never says
// a percentage.

import type { LeagueMe } from '@/db/services/league-service'
import { ordinal } from '@/lib/league-board'
import { durationInWords } from './duration-words'
import { MORE_ACCOUNT_SIGNED_OUT } from './settings/account-copy'

/** "1 song", "3 songs". */
function songs(count: number): string {
  return count === 1 ? '1 song' : `${count} songs`
}

export interface KaraokeFacts {
  /** Songs in the room's library: the examples and the singer's own. */
  ready: number
  /** The singer's own songs still being separated (test builds). */
  separating: number
  /** The singer's own songs ready and not yet sung (test builds). */
  unsung: number
}

/**
 * Karaoke: what is on its way, then what is new, then what is ready. No
 * library yet (the bundled examples are read at boot) is said without a
 * number rather than as "0 songs ready".
 */
export function karaokeLine(facts: KaraokeFacts): string {
  if (facts.separating > 0) {
    return facts.separating === 1
      ? '1 song on its way'
      : `${facts.separating} songs on their way`
  }
  if (facts.unsung > 0) {
    return facts.unsung === 1
      ? '1 new song to sing'
      : `${facts.unsung} new songs to sing`
  }
  if (facts.ready > 0) return `${songs(facts.ready)} ready`
  return 'Sing along with the words'
}

/**
 * Piano: the song left paused, which the room picks up again; otherwise
 * what the room is. A loaded song that is not paused is not named: the room
 * loads its first scale on a first visit, which nobody chose.
 */
export function pianoLine(paused: boolean, song: string): string {
  const name = song.trim()
  return paused && name !== ''
    ? `Paused: ${name}`
    : 'Play along with falling notes'
}

/** Guitar: the songs the singer brought, else what the room is. */
export function guitarLine(ownSongs: number): string {
  return ownSongs > 0
    ? `${songs(ownSongs)} of yours`
    : 'Tuner, chords and songs'
}

export interface AccountFacts {
  signedIn: boolean
  /** The kept card's display name, '' when there is none (yet). */
  name: string
  /** "Signed in with Apple": the line when the card has no name. */
  provider: string
}

/** Account: who is signed in, or why to sign in. */
export function accountLine(facts: AccountFacts): string {
  if (!facts.signedIn) return MORE_ACCOUNT_SIGNED_OUT
  const name = facts.name.trim()
  return name !== '' ? `Signed in as ${name}` : facts.provider
}

export interface LeagueFacts {
  signedIn: boolean
  /** The league the phone kept for this account (league-store.ts). */
  me: LeagueMe | null
  /** Whether that league is this week's: the cut moves people each Monday. */
  thisWeek: boolean
}

/**
 * Leagues: the rung and the place this week, from the league the phone
 * kept. A league kept from an earlier week is not named: the Monday cut may
 * have moved the singer since, and the next read says where to.
 */
export function leaguesLine(facts: LeagueFacts): string {
  if (!facts.signedIn) return 'Sign in to climb'
  const me = facts.me
  if (
    me === null ||
    !me.eligible ||
    me.league === undefined ||
    !facts.thisWeek
  ) {
    return 'A rung higher every week'
  }
  const rung = me.league.name
  if (
    me.rank === null ||
    me.rank === undefined ||
    me.cohortSize === undefined
  ) {
    return `${rung}, no points yet this week`
  }
  return `${rung}, ${ordinal(me.rank)} of ${me.cohortSize}`
}

export interface LegendRowFacts {
  /**
   * The running Legend as the phone kept it (legend-store.ts): undefined
   * before any read, null when nothing is running.
   */
  challenge: { endsAt: string } | null | undefined
  /** The account's own best on it, or null with no take yet. */
  best: number | null
  /** Now, on this phone's clock. */
  nowMs: number
}

/**
 * Legend: the singer's best once they have sung it, else when it closes, in
 * words. Never a period ("this week", "weekly"): a Legend runs one to eight
 * weeks (challenge-period-neutral.test.ts), and the countdown is the honest
 * answer whatever the period is.
 */
export function legendLine(facts: LegendRowFacts): string {
  const challenge = facts.challenge
  if (challenge === undefined) return 'The line everyone sings'
  if (challenge === null) return 'The next Legend opens soon'
  if (facts.best !== null) return `Sung, best ${facts.best}%`
  const left = Date.parse(challenge.endsAt) - facts.nowMs
  if (!Number.isFinite(left)) return 'The line everyone sings'
  // Takes still count for two days past the close.
  if (left <= 0) return 'Closing'
  return `Ends in ${durationInWords(left)}`
}

/** Settings: a microphone the phone refused is the one thing to say. */
export function settingsLine(microphoneRefused: boolean): string {
  return microphoneRefused
    ? 'The microphone is off'
    : 'Microphone, storage, appearance'
}

const SERVERS: Readonly<Record<string, string>> = {
  'api-dev.mercurypitch.com': 'dev server',
  'api.mercurypitch.com': 'production server',
}

/** Developer (test builds): which build this is, and which worker it asks. */
export function developerLine(
  sha: string,
  apiBase: string | undefined,
): string {
  let host = ''
  try {
    host = apiBase === undefined || apiBase === '' ? '' : new URL(apiBase).host
  } catch {
    host = apiBase ?? ''
  }
  const server = SERVERS[host] ?? (host === '' ? 'no server' : host)
  return `Build ${sha}, ${server}`
}
