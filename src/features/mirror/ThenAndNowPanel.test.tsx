// ============================================================
// The weekly Check-up's then and now on the Voice Mirror's results
// ============================================================
//
// The panel draws what the model reads (src/lib/check-up/then-and-now.ts has
// the rules' own cases): both sides with their dates, each change in its
// words, the practice in between, whose readings these are, and the account
// line for a browser that has never met an account. The reader puts the take
// just saved into the history before it compares.
//
// Faked at the boundaries only: the session records (a database read), and the
// share card's module, which needs a 2D canvas jsdom does not have; its own
// cases are src/features/progress/then-and-now-card.test.ts's. The account is
// a real stored token, as the Mirror's account-ask tests use.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthToken } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { thenAndNow } from '@/lib/check-up/then-and-now'
import { forgetSignInMethod } from '@/lib/last-sign-in'
import type { MirrorSummary } from '@/lib/mirror/metrics'
import { hostWanted, resetAccountAskForTests } from './account-ask'
import type { ThenAndNowView } from './ThenAndNowPanel'
import { readThenAndNow, ThenAndNowPanel } from './ThenAndNowPanel'

const fakes = vi.hoisted(() => ({
  sessions: [] as Array<{ id: string; endedAt: string }>,
  render: vi.fn(async () => document.createElement('canvas')),
  share: vi.fn(async () => ({ outcome: 'shared' })),
}))

vi.mock('@/db/services/progress-session-records', () => ({
  loadProgressSessionRecords: async () => ({
    records: fakes.sessions,
    available: true,
    complete: true,
    totalAvailable: fakes.sessions.length,
  }),
}))

vi.mock('@/features/progress/then-and-now-card', () => ({
  renderThenAndNowCard: fakes.render,
  shareThenAndNowCard: fakes.share,
}))

const DAY = 24 * 60 * 60 * 1000
const START = Date.parse('2026-10-05T12:00:00.000Z')
const at = (day: number): string => new Date(START + day * DAY).toISOString()

function take(
  day: number,
  summary: Partial<MirrorSummary> = {},
): VoiceprintRecord {
  return {
    id: `take-${day}`,
    takenAt: at(day),
    twin: null,
    source: 'mirror',
    madeBy: 'anonymous',
    summary: {
      lowMidi: 43,
      highMidi: 60,
      semitones: 17,
      accuracy: 60,
      steadiness: 70,
      ...summary,
    },
  }
}

/** Then: G2 to C4 on 5 and 9 Oct. Now: F2 to C#4, 69 and 72, on 19 Oct. */
function view(practice = 0): ThenAndNowView {
  const comparison = thenAndNow([
    take(0),
    take(4, { accuracy: 55 }),
    take(14, { lowMidi: 41, highMidi: 61, accuracy: 69, steadiness: 72 }),
  ])
  if (comparison === null) throw new Error('no comparison')
  return { comparison, practice }
}

function accountToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

function renderPanel(
  options: { practice?: number; format?: 'square' | 'story' } = {},
) {
  const onSingAgain = vi.fn()
  render(() => (
    <ThenAndNowPanel
      view={view(options.practice)}
      format={options.format ?? 'square'}
      onSingAgain={onSingAgain}
      now={() => START + 14 * DAY}
    />
  ))
  return { panel: screen.getByTestId('mirror-then-and-now'), onSingAgain }
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  forgetSignInMethod()
  fakes.sessions = []
  fakes.render.mockClear()
  fakes.share.mockClear()
})

afterEach(() => {
  cleanup()
  resetAccountAskForTests()
})

describe('the panel', () => {
  it('sets Then and Now side by side, each with its dates and readings', () => {
    const { panel } = renderPanel()

    const then = panel.querySelector('[data-side="then"]')
    const now = panel.querySelector('[data-side="now"]')
    expect(then).toHaveTextContent('5 Oct and 9 Oct')
    expect(then).toHaveTextContent('G2 to C4')
    expect(then).toHaveTextContent('60')
    expect(now).toHaveTextContent('19 Oct')
    expect(now).toHaveTextContent('F2 to C#4')
    expect(now).toHaveTextContent('69')
  })

  it('names the changes past their thresholds and keeps the rest neutral', () => {
    const { panel } = renderPanel()

    expect(panel.querySelector('[data-metric="range"]')).toHaveTextContent(
      '3 semitones wider',
    )
    expect(panel.querySelector('[data-metric="accuracy"]')).toHaveTextContent(
      'Up 9',
    )
    expect(panel.querySelector('[data-metric="steadiness"]')).toHaveTextContent(
      'About the same, 70 and 72',
    )
  })

  it.each([
    [1, '1 practice session in between'],
    [9, '9 practice sessions in between'],
  ])(
    'says the practice in between from one session up: %s',
    (practice, line) => {
      const { panel } = renderPanel({ practice })

      expect(panel).toHaveTextContent(line)
    },
  )

  it('says nothing about practice when there was none', () => {
    const { panel } = renderPanel({ practice: 0 })

    expect(panel).not.toHaveTextContent(/practice session/)
  })

  it('restarts the run from "Sing it once more", saying what the Check-up keeps', () => {
    const { panel, onSingAgain } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Sing it once more' }))

    expect(onSingAgain).toHaveBeenCalledTimes(1)
    expect(panel).toHaveTextContent(
      'Your Check-up keeps the better of your last two takes this week.',
    )
  })
})

describe('whose readings, and the account line', () => {
  it('says signed out that the readings are this browser’s, and ends with the account line', () => {
    const { panel } = renderPanel()

    expect(panel).toHaveTextContent(/this browser's/)
    expect(panel.lastElementChild).toHaveAttribute(
      'data-testid',
      'mirror-then-and-now-account',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Create a free account' }),
    )
    expect(hostWanted()).toBe(true)
  })

  it('says neither to somebody signed in', () => {
    setAuthToken(accountToken())
    const { panel } = renderPanel()

    expect(panel).not.toHaveTextContent(/this browser's/)
    expect(screen.queryByTestId('mirror-then-and-now-account')).toBeNull()
  })
})

describe('sharing then and now', () => {
  it('draws the card in the chosen shape before the tap, and shares it', async () => {
    renderPanel({ practice: 2, format: 'story' })
    await vi.waitFor(() => expect(fakes.render).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Share then and now' }))

    expect(await screen.findByText('Shared.')).toBeInTheDocument()
    expect(fakes.render).toHaveBeenCalledWith(view(2).comparison, 2, 'story')
    expect(fakes.render).toHaveBeenCalledTimes(1)
  })
})

describe('reading the comparison', () => {
  it('compares with the take just saved, before the history has it', async () => {
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([take(0)]),
    )
    fakes.sessions = [
      { id: 's1', endedAt: at(3) },
      { id: 's2', endedAt: at(8) },
    ]

    const read = await readThenAndNow(take(9))

    expect(read?.comparison.now.takes.map((t) => t.id)).toEqual(['take-9'])
    expect(read?.practice).toBe(2)
  })

  it('reads no comparison while the history holds less than a week', async () => {
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([take(0)]),
    )

    expect(await readThenAndNow(take(6))).toBeNull()
  })
})
