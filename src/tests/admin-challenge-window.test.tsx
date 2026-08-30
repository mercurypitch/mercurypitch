// ============================================================
// Setting when a challenge runs, without doing sums in your head
// ============================================================
//
// The admin form asked for `startsAt` and `endsAt` as raw ISO strings. Making
// a challenge run for four weeks meant working out the date; moving the live
// one meant hand-editing every challenge behind it, in order, without leaving
// a gap or an overlap.
//
// Nothing in the model changed for this — there is no period field anywhere,
// only two dates, which is exactly why a week can become four without a
// migration. The arithmetic is pinned in `challenge-window.test.ts`; this is
// the half that needs the form.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
let rows: unknown[] = []

vi.mock('@/features/challenges/weekly-service', () => ({
  getAdminKey: () => 'test-key',
  setAdminKey: () => {},
  listAllWeekly: () => Promise.resolve(rows),
  createWeekly: () => Promise.resolve(true),
  deleteWeekly: () => Promise.resolve(true),
  updateWeekly: (id: string, patch: Record<string, unknown>) => {
    updates.push({ id, patch })
    return Promise.resolve(true)
  },
  melodyItemsToNotes: () => '[]',
  parseTargetNotes: () => ({ items: [], rejected: [] }),
  plusOneWeekIso: (iso: string) =>
    new Date(Date.parse(iso) + 7 * 86_400_000).toISOString(),
  thisMondayUtcIso: () => '2026-08-17T00:00:00.000Z',
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: () => {},
}))

const { AdminWeeklyPage } =
  await import('@/features/challenges/AdminWeeklyPage')

function row(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'x',
    slug: 'x',
    title: 'X',
    description: '',
    featType: 'sustain',
    difficulty: 'medium',
    targetItems: '[]',
    targetScore: 80,
    hearItUrl: null,
    startsAt: '2026-08-17T00:00:00.000Z',
    endsAt: '2026-08-24T00:00:00.000Z',
    rewardBadgeId: null,
    founderScore: null,
    evergreen: 0,
    status: 'draft',
    ...over,
  }
}

// One live challenge closing in week 38, and three queued behind it in a
// deliberately awkward order — the middle one is dated last.
const LIVE = row({
  id: 'live',
  title: 'The live one',
  status: 'active',
  startsAt: '2026-08-17T00:00:00.000Z',
  endsAt: '2026-09-14T00:00:00.000Z',
})
const QUEUED = [
  row({
    id: 'q1',
    title: 'First up',
    startsAt: '2026-10-05T00:00:00.000Z',
    endsAt: '2026-10-12T00:00:00.000Z',
  }),
  row({
    id: 'q2',
    title: 'Then this',
    startsAt: '2026-11-02T00:00:00.000Z',
    endsAt: '2026-11-09T00:00:00.000Z',
  }),
  row({
    id: 'q3',
    title: 'Last',
    startsAt: '2026-12-07T00:00:00.000Z',
    endsAt: '2026-12-14T00:00:00.000Z',
  }),
]

beforeEach(() => {
  updates.length = 0
  rows = [LIVE, ...QUEUED]
  vi.setSystemTime(new Date('2026-08-20T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

async function openForm(): Promise<void> {
  render(() => <AdminWeeklyPage />)
  const edit = await screen.findAllByText('Edit')
  fireEvent.click(edit[0])
  await waitFor(() => screen.getByTestId('window-start-week'))
}

describe('the week stepper', () => {
  it('shows the window in ISO week numbers', async () => {
    await openForm()
    // 2026-08-17 is the Monday of ISO week 34.
    expect(screen.getByTestId('window-start-week').textContent).toBe(
      'W34 · 2026',
    )
    expect(screen.getByTestId('window-end-week').textContent).toBe('W38 · 2026')
    expect(screen.getByTestId('window-length').textContent).toContain('4 weeks')
  })

  it('moves the whole window when the opening week steps', async () => {
    await openForm()
    fireEvent.click(screen.getByTestId('window-start-forward'))
    // Both ends move: stepping the start is "run this a week later", not
    // "make it a week shorter".
    expect(screen.getByTestId('window-start-week').textContent).toBe(
      'W35 · 2026',
    )
    expect(screen.getByTestId('window-end-week').textContent).toBe('W39 · 2026')
    expect(screen.getByTestId('window-length').textContent).toContain('4 weeks')
  })

  it('steps backwards too', async () => {
    await openForm()
    fireEvent.click(screen.getByTestId('window-start-back'))
    expect(screen.getByTestId('window-start-week').textContent).toBe(
      'W33 · 2026',
    )
  })

  it('changes the length when the closing week steps', async () => {
    await openForm()
    fireEvent.click(screen.getByTestId('window-end-forward'))
    expect(screen.getByTestId('window-start-week').textContent).toBe(
      'W34 · 2026',
    )
    expect(screen.getByTestId('window-length').textContent).toContain('5 weeks')
  })

  it('will not let the window close before it opens', async () => {
    await openForm()
    for (let i = 0; i < 8; i += 1) {
      fireEvent.click(screen.getByTestId('window-end-back'))
    }
    // A window that closes before it opens passes `now < endsAt` the wrong
    // way and is live forever.
    expect(screen.getByTestId('window-length').textContent).toContain('1 week')
    expect(screen.getByTestId('window-end-week').textContent).toBe('W35 · 2026')
  })

  it('sets a month as four weeks in one press', async () => {
    await openForm()
    fireEvent.click(screen.getByTestId('window-period-1'))
    expect(screen.getByTestId('window-length').textContent).toContain('1 week')
    fireEvent.click(screen.getByTestId('window-period-4'))
    expect(screen.getByTestId('window-length').textContent).toContain('4 weeks')
    expect(screen.getByTestId('window-end-week').textContent).toBe('W38 · 2026')
  })

  it('draws an arrow in all four stepper buttons', async () => {
    // Same shared-node trap: `arrowLeft` and `arrowRight` appear twice each
    // — the opening row and the closing row — so only the second row's
    // buttons kept their glyph.
    await openForm()
    for (const id of [
      'window-start-back',
      'window-start-forward',
      'window-end-back',
      'window-end-forward',
    ]) {
      expect(
        screen.getByTestId(id).querySelector('svg'),
        `${id} has no glyph`,
      ).toBeTruthy()
    }
  })

  it('keeps the raw ISO fields for anything the stepper cannot say', async () => {
    await openForm()
    expect(screen.getByText('Opens (ISO)')).toBeTruthy()
    expect(screen.getByText('Closes (ISO)')).toBeTruthy()
  })
})

describe('the queue', () => {
  it('lists what is behind the live one, soonest first', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    const titles = [
      ...screen.getByTestId('challenge-queue').querySelectorAll('li'),
    ].map((li) => li.textContent ?? '')
    expect(titles[0]).toContain('First up')
    expect(titles[1]).toContain('Then this')
    expect(titles[2]).toContain('Last')
    // The live one is not in the queue — it is what the queue runs after.
    expect(titles.join(' ')).not.toContain('The live one')
  })

  it('draws the move arrows on every row, not just the last', async () => {
    // Reported: "only one of the next items has this circles for up/down,
    // but they are missing the arrows inside circles".
    //
    // The glyphs were module-level JSX VALUES — `const arrowUp = (<svg/>)`.
    // That is one DOM node, and rendering it twice does not copy it, it MOVES
    // it. Inside a `<For>` the last row won and every earlier row rendered an
    // empty button. Nothing about it is visible in a diff.
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))

    for (const id of ['q1', 'q2', 'q3']) {
      expect(
        screen.getByTestId(`queue-up-${id}`).querySelector('svg'),
        `queue-up-${id} has no glyph`,
      ).toBeTruthy()
      expect(
        screen.getByTestId(`queue-down-${id}`).querySelector('svg'),
        `queue-down-${id} has no glyph`,
      ).toBeTruthy()
    }
  })

  it('writes nothing when the order is merely changed', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    fireEvent.click(screen.getByTestId('queue-down-q1'))
    // An automatic reflow would move a live challenge out from under whoever
    // is attempting it, and would make a mis-drag destructive.
    expect(updates).toEqual([])
    expect(screen.getByTestId('queue-dirty')).toBeTruthy()
  })

  it('writes nothing when dragged, either', async () => {
    // The keyboard buttons and the drag are two paths to the same state, and
    // only one of them was covered — a reflow wired into the drop handler
    // slipped straight past the test above.
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))

    fireEvent.dragStart(screen.getByTestId('queue-item-q1'))
    fireEvent.dragOver(screen.getByTestId('queue-item-q3'))
    fireEvent.drop(screen.getByTestId('queue-item-q3'))

    expect(updates).toEqual([])
    expect(screen.getByTestId('queue-dirty')).toBeTruthy()
  })

  it('reorders on a drop, in the direction dragged', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))

    fireEvent.dragStart(screen.getByTestId('queue-item-q1'))
    fireEvent.drop(screen.getByTestId('queue-item-q3'))
    fireEvent.click(screen.getByTestId('queue-recompute'))

    await waitFor(() => expect(updates.length).toBe(3))
    expect(updates.map((u) => u.id)).toEqual(['q2', 'q3', 'q1'])
  })

  it('ignores a drop onto the row being dragged', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))

    fireEvent.dragStart(screen.getByTestId('queue-item-q2'))
    fireEvent.drop(screen.getByTestId('queue-item-q2'))

    // Not a reorder, so not dirty — otherwise every stray click-drag would
    // arm a destructive button.
    expect(screen.queryByTestId('queue-dirty')).toBeNull()
  })

  it('re-dates back to back from the live one when asked', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    fireEvent.click(screen.getByTestId('queue-recompute'))

    await waitFor(() => expect(updates.length).toBe(3))
    // The live one closes 2026-09-14; four weeks each, no gap, no overlap.
    expect(updates.map((u) => u.id)).toEqual(['q1', 'q2', 'q3'])
    expect(updates[0].patch).toEqual({
      startsAt: '2026-09-14T00:00:00.000Z',
      endsAt: '2026-10-12T00:00:00.000Z',
    })
    expect(updates[1].patch).toEqual({
      startsAt: '2026-10-12T00:00:00.000Z',
      endsAt: '2026-11-09T00:00:00.000Z',
    })
    expect(updates[2].patch).toEqual({
      startsAt: '2026-11-09T00:00:00.000Z',
      endsAt: '2026-12-07T00:00:00.000Z',
    })
  })

  it('follows the order it was dragged into', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    // Send the first one to the back, then recompute.
    fireEvent.click(screen.getByTestId('queue-down-q1'))
    fireEvent.click(screen.getByTestId('queue-down-q1'))
    fireEvent.click(screen.getByTestId('queue-recompute'))

    await waitFor(() => expect(updates.length).toBe(3))
    expect(updates.map((u) => u.id)).toEqual(['q2', 'q3', 'q1'])
    // q2 now opens first, right as the live one closes.
    expect(updates[0].patch.startsAt).toBe('2026-09-14T00:00:00.000Z')
  })

  it('honours the period chosen for the queue', async () => {
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    fireEvent.click(screen.getByTestId('queue-period-1'))
    fireEvent.click(screen.getByTestId('queue-recompute'))

    await waitFor(() => expect(updates.length).toBe(3))
    expect(updates[0].patch.endsAt).toBe('2026-09-21T00:00:00.000Z')
    expect(updates[1].patch.startsAt).toBe('2026-09-21T00:00:00.000Z')
  })

  it('cannot recompute with nothing live to date from', async () => {
    rows = QUEUED
    render(() => <AdminWeeklyPage />)
    await waitFor(() => screen.getByTestId('challenge-queue'))
    const button = screen.getByTestId('queue-recompute') as HTMLButtonElement
    // Dated from nothing, the queue would land wherever "now" happened to be.
    expect(button.disabled).toBe(true)
  })
})
