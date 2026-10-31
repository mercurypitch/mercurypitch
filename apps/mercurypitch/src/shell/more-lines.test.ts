// ============================================================
// The More sheet's lines: what each row says, from what the stores hold
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LeagueMe } from '@/db/services/league-service'
import { accountLine, developerLine, guitarLine, karaokeLine, leaguesLine, legendLine, pianoLine, settingsLine, } from './more-lines'

describe('the Karaoke line', () => {
  it('counts the songs ready on a fresh install', () => {
    expect(karaokeLine({ ready: 3, separating: 0, unsung: 0 })).toBe(
      '3 songs ready',
    )
    expect(karaokeLine({ ready: 1, separating: 0, unsung: 0 })).toBe(
      '1 song ready',
    )
  })

  it('says what the room is, not "0 songs", before the library is read', () => {
    expect(karaokeLine({ ready: 0, separating: 0, unsung: 0 })).toBe(
      'Sing along with the words',
    )
  })

  it('puts songs on their way first, then new ones, then the count', () => {
    expect(karaokeLine({ ready: 5, separating: 2, unsung: 1 })).toBe(
      '2 songs on their way',
    )
    expect(karaokeLine({ ready: 5, separating: 1, unsung: 0 })).toBe(
      '1 song on its way',
    )
    expect(karaokeLine({ ready: 5, separating: 0, unsung: 2 })).toBe(
      '2 new songs to sing',
    )
    expect(karaokeLine({ ready: 5, separating: 0, unsung: 1 })).toBe(
      '1 new song to sing',
    )
  })
})

describe('the Piano line', () => {
  it('names a paused song, which the room picks up again', () => {
    expect(pianoLine(true, 'Clair de Lune')).toBe('Paused: Clair de Lune')
  })

  it('never names a song that is only loaded', () => {
    expect(pianoLine(false, 'C Major Scale (C4)')).toBe(
      'Play along with falling notes',
    )
    expect(pianoLine(true, '  ')).toBe('Play along with falling notes')
  })
})

describe('the Guitar line', () => {
  it('counts the songs the singer brought, else says what the room is', () => {
    expect(guitarLine(0)).toBe('Tuner, chords and songs')
    expect(guitarLine(1)).toBe('1 song of yours')
    expect(guitarLine(4)).toBe('4 songs of yours')
  })
})

describe('the Account line', () => {
  it('asks a phone with no account to sign in', () => {
    expect(accountLine({ signedIn: false, name: 'Maya', provider: 'x' })).toBe(
      'Sign in to keep your runs',
    )
  })

  it('names the account from the kept card', () => {
    expect(
      accountLine({
        signedIn: true,
        name: 'Maya',
        provider: 'Signed in with Apple',
      }),
    ).toBe('Signed in as Maya')
  })

  it('falls back to the provider, never to "Signed in as Your account"', () => {
    expect(
      accountLine({
        signedIn: true,
        name: ' ',
        provider: 'Signed in with Apple',
      }),
    ).toBe('Signed in with Apple')
  })
})

describe('the Settings line', () => {
  it('says the microphone is off only when the phone refused it', () => {
    expect(settingsLine(true)).toBe('The microphone is off')
    expect(settingsLine(false)).toBe('Microphone, storage, appearance')
  })
})

describe('the Developer line', () => {
  it('names the build and the worker by its role', () => {
    expect(developerLine('1a2b3c4', 'https://api-dev.mercurypitch.com')).toBe(
      'Build 1a2b3c4, dev server',
    )
    expect(developerLine('1a2b3c4', 'https://api.mercurypitch.com')).toBe(
      'Build 1a2b3c4, production server',
    )
  })

  it('names any other worker by its host, and none as none', () => {
    expect(developerLine('abc', 'http://127.0.0.1:8787')).toBe(
      'Build abc, 127.0.0.1:8787',
    )
    expect(developerLine('abc', undefined)).toBe('Build abc, no server')
  })
})

describe('the Leagues line', () => {
  const league: LeagueMe = {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: {
      id: 'l2',
      rank: 2,
      name: 'Sparkwing',
      trophyAsset: '/leagues/l2.webp',
      badgeAsset: null,
      isMystery: false,
      promoteCount: 10,
      relegateCount: 10,
    },
    points: 120,
    rank: 4,
    cohortSize: 23,
    standings: [],
  }

  it('asks a phone with no account to sign in', () => {
    expect(leaguesLine({ signedIn: false, me: league, thisWeek: true })).toBe(
      'Sign in to climb',
    )
  })

  it('names the rung and the place this week', () => {
    expect(leaguesLine({ signedIn: true, me: league, thisWeek: true })).toBe(
      'Sparkwing, 4th of 23',
    )
  })

  it('says when there are no points yet this week', () => {
    expect(
      leaguesLine({
        signedIn: true,
        me: { ...league, rank: null, points: 0 },
        thisWeek: true,
      }),
    ).toBe('Sparkwing, no points yet this week')
  })

  it('names no rung it has not read this week, or at all', () => {
    for (const facts of [
      { signedIn: true, me: league, thisWeek: false },
      { signedIn: true, me: null, thisWeek: false },
      {
        signedIn: true,
        me: { eligible: false, reason: 'unavailable' as const },
        thisWeek: true,
      },
    ]) {
      expect(leaguesLine(facts)).toBe('A rung higher every week')
    }
  })
})

describe('the Legend line', () => {
  const NOW = Date.parse('2026-10-31T12:00:00Z')
  const closing = (hours: number) => ({
    endsAt: new Date(NOW + hours * 3_600_000).toISOString(),
  })

  it('says something true before the phone has read anything', () => {
    expect(legendLine({ challenge: undefined, best: null, nowMs: NOW })).toBe(
      'The line everyone sings',
    )
  })

  it('says when nothing is running', () => {
    expect(legendLine({ challenge: null, best: null, nowMs: NOW })).toBe(
      'The next Legend opens soon',
    )
  })

  it('says when the running Legend closes, in words', () => {
    expect(legendLine({ challenge: closing(74), best: null, nowMs: NOW })).toBe(
      'Ends in 3 days',
    )
    expect(legendLine({ challenge: closing(5), best: null, nowMs: NOW })).toBe(
      'Ends in 5 hours',
    )
    expect(legendLine({ challenge: closing(-2), best: null, nowMs: NOW })).toBe(
      'Closing',
    )
  })

  it("says the singer's best once they have sung it", () => {
    expect(legendLine({ challenge: closing(74), best: 82, nowMs: NOW })).toBe(
      'Sung, best 82%',
    )
  })

  it('never names a period: a Legend runs one to eight weeks', () => {
    for (const challenge of [undefined, null, closing(74), closing(-2)]) {
      expect(legendLine({ challenge, best: null, nowMs: NOW })).not.toMatch(
        /\b(weekly|monthly|fortnightly|this week|this month)\b/iu,
      )
    }
  })
})
