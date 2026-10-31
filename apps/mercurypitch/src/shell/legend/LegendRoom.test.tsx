// ============================================================
// The Legend room's door: the running Legend, its board, the past ones,
// and the ask before a first ranked take
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveWeeklyRead, ArchivedWeeklyChallenge, WeeklyBoard, WeeklyChallenge, } from '@/features/challenges/weekly-service'
import type { MelodyItem, NoteName } from '@/types'

const auth = vi.hoisted(() => ({
  signedIn: true,
  set: (_on: boolean): void => {},
}))

const fakeTake = vi.hoisted(() => ({
  start: vi.fn(),
  playLine: vi.fn(),
  /** Set the fake take's phase, kind, Legend and save state. */
  set: (_next: {
    phase: string
    kind?: string
    challenge?: unknown
    saveState?: string | null
  }): void => {},
}))

const session = vi.hoisted(() => ({ needsSignIn: false }))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  needsSignIn: () => session.needsSignIn,
}))

vi.mock('../settings/account-state', async () => {
  const { createSignal } = await import('solid-js')
  const [signedIn, setSignedIn] = createSignal(true)
  auth.set = (on) => setSignedIn(on)
  return {
    accountSignedIn: signedIn,
    refreshAccount: vi.fn(async () => undefined),
  }
})

vi.mock('../settings/sign-in-state', () => ({ openSignIn: vi.fn() }))

vi.mock('./legend-store', () => ({
  refreshLegend: vi.fn(async () => undefined),
}))

vi.mock('./legend-take', async () => {
  const { createSignal } = await import('solid-js')
  return {
    createLegendTake: () => {
      const [linePlaying] = createSignal(false)
      const [now, setNow] = createSignal<{
        phase: string
        kind?: string
        challenge?: unknown
        saveState?: string | null
      }>({ phase: 'idle' })
      fakeTake.set = setNow
      return {
        state: () => ({ phase: now().phase, run: 0 }),
        kind: () => now().kind ?? 'practice',
        challenge: () => now().challenge ?? null,
        block: () => null,
        session: () => null,
        outcome: () =>
          now().phase === 'result'
            ? { points: [], summary: { score: 74 } }
            : null,
        saveState: () => now().saveState ?? null,
        linePlaying,
        start: fakeTake.start,
        stop: vi.fn(),
        done: vi.fn(),
        playLine: fakeTake.playLine,
      }
    },
  }
})

vi.mock('@/features/challenges/weekly-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readActiveWeekly: vi.fn(),
  getWeeklyBoard: vi.fn(),
  getWeeklyArchive: vi.fn(),
}))

vi.mock('@/features/challenges/board-consent', () => ({
  hasBoardConsent: vi.fn(async () => false),
  grantBoardConsent: vi.fn(async () => true),
}))

vi.mock('@/stores/settings-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  vocalRangePreset: () => 'baritone',
}))

import { grantBoardConsent, hasBoardConsent, } from '@/features/challenges/board-consent'
import { whileFinalizing } from '@/features/challenges/challenge-result-store'
import { getWeeklyArchive, getWeeklyBoard, readActiveWeekly, } from '@/features/challenges/weekly-service'
import { midiToFrequency, midiToNoteName } from '@/lib/frequency-to-note'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { openSignIn } from '../settings/sign-in-state'
import { LegendRoom } from './LegendRoom'

const active = vi.mocked(readActiveWeekly)
const boardOf = vi.mocked(getWeeklyBoard)
const archiveOf = vi.mocked(getWeeklyArchive)

function note(midi: number, startBeat: number): MelodyItem {
  return {
    id: startBeat + 1,
    note: {
      midi,
      name: midiToNoteName(midi).replace(/-?\d+$/u, '') as NoteName,
      octave: Math.floor(midi / 12) - 1,
      freq: midiToFrequency(midi),
    },
    duration: 1,
    startBeat,
  }
}

function legend(over: Partial<WeeklyChallenge> = {}): WeeklyChallenge {
  return {
    id: 'legend-1',
    slug: 'vincero',
    title: 'Vincero',
    description: 'The last line of the aria, held.',
    featType: 'range',
    voiceTypeSplit: null,
    difficulty: 'hard',
    targetItems: [note(57, 0), note(59, 1), note(60, 2)],
    targetScore: 70,
    hearItUrl: 'https://example.test/vincero',
    startsAt: '2026-10-26T00:00:00Z',
    endsAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(),
    rewardBadgeId: null,
    founderScore: 88,
    founderTrace: null,
    status: 'active',
    ...over,
  }
}

const BOARD: WeeklyBoard = {
  top: [
    { rank: 1, displayName: 'The Founder', best: 88, isFounder: true },
    { rank: 2, displayName: 'Ana', best: 86, isFounder: false },
    { rank: 3, displayName: 'Luka', best: 80, isFounder: false },
  ],
  attemptedCount: 23,
  rankedCount: 18,
  completedCount: 8,
  targetScore: 70,
  founderScore: 88,
  frozen: false,
  you: {
    best: 74,
    rank: 5,
    percentile: 28,
    beatFounder: false,
    completed: true,
    ranked: true,
  },
}

const PAST: ArchivedWeeklyChallenge = {
  ...legend({ id: 'legend-0', title: 'Nessun dorma' }),
  results: {
    version: 2,
    top3: [
      { rank: 1, displayName: 'Iva', best: 91 },
      { rank: 2, displayName: null, best: 84, redacted: true },
    ],
    attemptedCount: 40,
    completedCount: 12,
    closedAt: '2026-10-21T08:00:00Z',
  },
}

const ok = (challenge: WeeklyChallenge | null): ActiveWeeklyRead => ({
  status: 'ok',
  challenge,
})

let view: RenderedShell | null = null

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

async function open(): Promise<void> {
  view = renderShell(() => <LegendRoom />)
  await settle()
  await settle()
}

const q = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector)
const text = (selector: string): string => q(selector)?.textContent ?? ''

beforeEach(() => {
  auth.set(true)
  active.mockReset().mockResolvedValue(ok(legend()))
  boardOf.mockReset().mockResolvedValue(BOARD)
  archiveOf.mockReset().mockResolvedValue([PAST])
  vi.mocked(hasBoardConsent).mockReset().mockResolvedValue(false)
  vi.mocked(grantBoardConsent).mockReset().mockResolvedValue(true)
  vi.mocked(openSignIn).mockClear()
  fakeTake.start.mockClear()
  fakeTake.playLine.mockClear()
  session.needsSignIn = false
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the door', () => {
  it('shows the running Legend: its title, its close, and its line', async () => {
    await open()
    expect(text('.mp-legend-hero__title')).toBe('Vincero')
    expect(text('.mp-legend-hero__eyebrow')).toBe('Ends in 3 days')
    expect(q('[data-testid="legend-sing"]')?.textContent).toBe('Sing it')
    expect(q('.mp-legend__link')?.getAttribute('href')).toBe(
      'https://example.test/vincero',
    )
  })

  it('plays the line from its own button', async () => {
    await open()
    q('[data-testid="legend-hear"]')?.click()
    expect(fakeTake.playLine).toHaveBeenCalledTimes(1)
    expect(fakeTake.playLine.mock.calls[0][0].id).toBe('legend-1')
  })

  it('shows the top three, and the singer’s standing in words', async () => {
    await open()
    const rows = [...document.querySelectorAll('.mp-legend-podium__row')]
    expect(rows.map((row) => row.textContent)).toEqual([
      '1The Founder88%',
      '2Ana86%',
      '3Luka80%',
    ])
    expect(text('[data-testid="legend-you"]')).toBe(
      'Your best 74%, in the top 28% of 18',
    )
  })

  it('lists the past Legends, each to practise', async () => {
    await open()
    const past = q('[data-legend-past="legend-0"]')
    expect(past?.textContent).toContain('Nessun dorma')
    expect(past?.textContent).toContain('1 Iva, 2 Name withheld')
    past?.querySelector<HTMLButtonElement>('button')?.click()
    expect(fakeTake.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legend-0' }),
      'practice',
    )
  })

  it('says when nothing is running, and still lists the past', async () => {
    active.mockResolvedValue(ok(null))
    await open()
    expect(q('[data-testid="legend-none"]')).not.toBeNull()
    expect(q('[data-testid="legend-past"]')).not.toBeNull()
  })

  it('says a read got no answer, and tries again', async () => {
    active.mockResolvedValueOnce({ status: 'unreachable' })
    await open()
    expect(q('[data-testid="legend-retry"]')).not.toBeNull()
    q('[data-testid="legend-retry"]')?.click()
    await settle()
    await settle()
    expect(text('.mp-legend-hero__title')).toBe('Vincero')
  })

  it('says when the line sits outside the singer’s range, and moves nothing', async () => {
    active.mockResolvedValue(
      ok(legend({ targetItems: [note(72, 0), note(76, 1)] })),
    )
    await open()
    expect(text('[data-testid="legend-range"]')).toBe(
      'This Legend is written above your baritone range, a feat for another voice. Sing it anyway if you like: it is scored as written.',
    )
  })
})

describe('singing it for the board', () => {
  it('asks a phone with no account to sign in, and starts nothing', async () => {
    auth.set(false)
    await open()
    const sing = q('[data-testid="legend-sing"]')
    expect(sing?.textContent).toBe('Sign in to sing it')
    sing?.click()
    expect(openSignIn).toHaveBeenCalledTimes(1)
    expect(fakeTake.start).not.toHaveBeenCalled()
  })

  it('asks before a first ranked take, and starts nothing yet', async () => {
    await open()
    q('[data-testid="legend-sing"]')?.click()
    expect(q('[data-testid="legend-consent"]')).not.toBeNull()
    expect(fakeTake.start).not.toHaveBeenCalled()
  })

  it('keeps the consent, then waits for the tap that opens the mic', async () => {
    await open()
    q('[data-testid="legend-sing"]')?.click()
    q('[data-testid="legend-consent-yes"]')?.click()
    await settle()
    expect(grantBoardConsent).toHaveBeenCalledTimes(1)
    expect(fakeTake.start).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(
      'You are on the board now. Tap Sing it to start.',
    )
    q('[data-testid="legend-sing"]')?.click()
    expect(fakeTake.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legend-1' }),
      'ranked',
    )
  })

  it('offers practice instead, which starts in the same tap', async () => {
    await open()
    q('[data-testid="legend-sing"]')?.click()
    q('[data-testid="legend-consent-practice"]')?.click()
    expect(fakeTake.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legend-1' }),
      'practice',
    )
  })

  it('starts a ranked take at once for a singer who already said yes', async () => {
    vi.mocked(hasBoardConsent).mockResolvedValue(true)
    await open()
    q('[data-testid="legend-sing"]')?.click()
    expect(q('[data-testid="legend-consent"]')).toBeNull()
    expect(fakeTake.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legend-1' }),
      'ranked',
    )
  })

  it('says a consent that could not be saved, and starts nothing', async () => {
    vi.mocked(grantBoardConsent).mockResolvedValue(false)
    await open()
    q('[data-testid="legend-sing"]')?.click()
    q('[data-testid="legend-consent-yes"]')?.click()
    await settle()
    expect(document.body.textContent).toContain(
      'Could not save that. Try again.',
    )
    expect(fakeTake.start).not.toHaveBeenCalled()
  })
})

describe('while a take saves', () => {
  it('holds the door until the last take is saved', async () => {
    await open()
    let finish: () => void = () => undefined
    const saving = whileFinalizing(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      'native-room',
    )
    await settle()
    expect(q('[data-testid="legend-saving"]')?.textContent).toBe(
      'Saving your last take',
    )
    expect(
      q('[data-testid="legend-sing"]')?.getAttribute('aria-disabled'),
    ).toBe('true')
    finish()
    await saving
    await settle()
    expect(q('[data-testid="legend-saving"]')).toBeNull()
    expect(
      q('[data-testid="legend-sing"]')?.getAttribute('aria-disabled'),
    ).toBeNull()
  })
})

describe('the result', () => {
  it('sends a ranked Again through what Sing it asks', async () => {
    vi.mocked(hasBoardConsent).mockResolvedValue(true)
    await open()
    fakeTake.set({
      phase: 'result',
      kind: 'ranked',
      challenge: legend(),
      saveState: 'failed',
    })
    await settle()
    // Signed out since: Again asks for the account, and starts nothing.
    auth.set(false)
    q('[data-testid="legend-again"]')?.click()
    expect(openSignIn).toHaveBeenCalled()
    expect(fakeTake.start).not.toHaveBeenCalled()
  })

  it('offers the phone’s own sign-in when that is why a take was not posted', async () => {
    session.needsSignIn = true
    await open()
    fakeTake.set({
      phase: 'result',
      kind: 'ranked',
      challenge: legend(),
      saveState: 'failed',
    })
    await settle()
    expect(document.body.textContent).toContain(
      'Sign in to post Legend scores: this take was not recorded.',
    )
    q('[data-testid="legend-result-sign-in"]')?.click()
    expect(openSignIn).toHaveBeenCalledTimes(1)
  })
})

describe('signing in from the room', () => {
  it('reads the board again, for the standing on it', async () => {
    auth.set(false)
    await open()
    expect(boardOf).toHaveBeenCalledTimes(1)
    auth.set(true)
    await settle()
    expect(boardOf).toHaveBeenCalledTimes(2)
  })
})

// Practice is anyone's, signed in or not.
describe('practice', () => {
  it('starts the running Legend as practice', async () => {
    auth.set(false)
    await open()
    q('[data-testid="legend-practice"]')?.click()
    expect(fakeTake.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legend-1' }),
      'practice',
    )
  })
})
