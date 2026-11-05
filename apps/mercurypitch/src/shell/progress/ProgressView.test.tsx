// ============================================================
// The native Progress page, drawn from the web page's own fixture snapshot
// ============================================================
//
// The snapshot is the one ProgressPage.test.tsx draws (progress-snapshot.
// fixture.ts), so the two pages are held to the same record: every section
// it carries is on the native page, and nothing the page shows is anything
// but the snapshot's.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { snapshot } from '@/features/progress/progress-snapshot.fixture'
import type { ProgressPageSnapshot } from '@/features/progress/ProgressPage'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import type { ProgressViewProps } from './ProgressView'
import { ProgressView } from './ProgressView'

let view: RenderedShell | null = null

afterEach(() => {
  view?.unmount()
  view = null
  document.body.innerHTML = ''
})

/**
 * The page with the fixture's record, or with none: Solid's props skip an
 * `undefined` a later spread passes, so "no snapshot" is its own call.
 */
function open(props: Partial<ProgressViewProps> = {}): HTMLElement {
  view = renderShell(() => (
    <ProgressView status="ready" snapshot={snapshot()} {...props} />
  ))
  return view.container
}

function openBare(
  props: Partial<ProgressViewProps> & Pick<ProgressViewProps, 'status'>,
): HTMLElement {
  view = renderShell(() => <ProgressView {...props} />)
  return view.container
}

const text = (root: ParentNode, selector: string): string =>
  root.querySelector(selector)?.textContent?.replace(/\s+/gu, ' ').trim() ?? ''

/** The button that opens a week's sheet, by its place in the rhythm. */
function weekBar(root: ParentNode, index: number): HTMLButtonElement {
  const bars = root.querySelectorAll<HTMLButtonElement>('.mp-prog-week')
  const bar = bars[index]
  if (bar === undefined) throw new Error(`no week ${index}`)
  return bar
}

describe('the native Progress page, from the fixture snapshot', () => {
  it('draws the moment, its kind, its period, its evidence and its next step', () => {
    const page = open()
    const moment = page.querySelector('[data-moment="moment-returned"]')
    expect(moment?.querySelector('h2')?.textContent).toBe(
      'You returned four weeks in a row.',
    )
    expect(text(moment as Element, '.mp-prog-chip')).toBe('Consistency')
    expect(text(moment as Element, '.mp-prog-moment__top .mp-prog-meta')).toBe(
      'Last 13 weeks',
    )
    expect(text(moment as Element, '.mp-prog-moment__reason')).toBe(
      'A fourth active week made this the clearest recent pattern.',
    )
    const tiles = [...(moment as Element).querySelectorAll('.mp-prog-tile')]
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'Active weeks4',
      'Active days8',
    ])
    const go = moment?.querySelector<HTMLAnchorElement>('.mp-prog-moment__go')
    expect(go?.getAttribute('href')).toBe('#exercises/long-note')
    expect(go?.textContent).toBe('Repeat Long Note')
  })

  it('draws the rhythm, a bar a week, with its title and facts', () => {
    const page = open()
    const rhythm = page.querySelector('[data-testid="progress-rhythm"]')
    expect(text(rhythm as Element, '.mp-prog-card__lead')).toBe(
      'Four active weeks, held together.',
    )
    expect(rhythm?.querySelectorAll('.mp-prog-week')).toHaveLength(2)
    expect(
      [...(rhythm as Element).querySelectorAll('.mp-prog-tile')].map(
        (tile) => tile.textContent,
      ),
    ).toEqual(['Current streak4 weeks', 'Longest6 weeks'])
    // The record's week is the one marked, and the one the keyboard enters.
    expect(weekBar(page, 0).dataset.selected).toBe('on')
    expect(weekBar(page, 0).tabIndex).toBe(0)
    expect(weekBar(page, 1).tabIndex).toBe(-1)
  })

  it('draws the skill thread, the voice, the paths, the milestones and the league', () => {
    const page = open()
    expect(text(page, '.mp-prog-thread h3')).toBe('Long Note')
    expect(text(page, '.mp-prog-thread__latest b')).toBe('78%')
    expect(
      [...page.querySelectorAll('.mp-prog-thread__labels span')].map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(['Earlier 72%', 'Middle 75%', 'Latest 78%'])
    expect(
      text(page, '[data-testid="progress-voice"] .mp-prog-card__lead'),
    ).toBe('Your voice, in its latest measured shape.')
    // The range it states, on the keyboard.
    expect(
      page.querySelector('.mp-prog-keys svg')?.getAttribute('aria-label'),
    ).toBe('Measured range C3 to A4, on a keyboard from C2 to C6.')
    expect(
      text(page, '[data-testid="progress-paths"] .mp-prog-card__lead'),
    ).toBe('Exercises and challenges form the strongest recent route.')
    expect(
      page.querySelector('.mp-prog-route__stop[data-status="current"]')
        ?.textContent,
    ).toContain('Most recent.')
    expect(text(page, '.mp-prog-shelf__name')).toBe('Steady Return')
    expect(
      text(page, '[data-testid="progress-cabinet"] .mp-prog-row__line'),
    ).toBe('1 of 2 badges and 1 of 2 achievements earned, 1 under way.')
    expect(text(page, '.mp-prog-league__name')).toBe('Silver League')
    expect(text(page, '.mp-prog-league .mp-prog-meta')).toBe(
      'Rank 7 · Holding zone · This week',
    )
  })

  it('draws the history under its dates, and where the record is kept', () => {
    const page = open()
    expect(text(page, '.mp-prog-day__label')).toBe('August 8')
    const row = page.querySelector<HTMLAnchorElement>(
      '[data-history="history-one"]',
    )
    expect(row?.getAttribute('href')).toBe('#analysis')
    expect(text(row as Element, '.mp-prog-item__title')).toBe(
      'Long Note completed',
    )
    expect(
      [...page.querySelectorAll('.mp-prog-filter')].map((chip) => [
        chip.textContent,
        chip.getAttribute('aria-pressed'),
      ]),
    ).toEqual([
      ['All', 'true'],
      ['Exercises', 'false'],
    ])
    const coverage = page.querySelector('[data-testid="progress-coverage"]')
    expect(coverage?.textContent).toContain(
      'Detailed timing is available for recent recorded practice.',
    )
    expect(coverage?.textContent).toContain(
      'Detailed timing available from August 1.',
    )
  })

  it('offers the period switch only where the record has more than one period', () => {
    const page = open()
    expect(
      [...page.querySelectorAll('.mp-prog-switch button')].map((button) => [
        button.textContent,
        button.getAttribute('aria-pressed'),
      ]),
    ).toEqual([
      ['7 days', 'false'],
      ['13 weeks', 'true'],
    ])
    view?.unmount()
    const one: ProgressPageSnapshot = {
      ...snapshot(),
      periodOptions: [{ id: '13-weeks', label: '13 weeks' }],
    }
    view = renderShell(() => <ProgressView status="ready" snapshot={one} />)
    expect(view.container.querySelector('.mp-prog-switch')).toBeNull()
  })

  it('leaves out a step to a page the app does not carry', () => {
    const page = open({
      snapshot: {
        ...snapshot(),
        voice: {
          ...snapshot().voice!,
          actions: [
            { id: 'voice-map', label: 'Map my voice again', href: '/mirror' },
            {
              id: 'voice-analysis',
              label: 'Open Analysis',
              href: '#/analysis',
            },
          ],
        },
      },
    })
    const voice = page.querySelector('[data-testid="progress-voice"]')
    expect(
      [...(voice as Element).querySelectorAll('.mp-prog-row__name')].map(
        (name) => name.textContent,
      ),
    ).toEqual(['Open Analysis'])
  })
})

describe("a week's sheet", () => {
  it('opens on the week whose bar was tapped, with what the snapshot says of it', () => {
    const page = open()
    weekBar(page, 1).click()
    const sheet = document.querySelector('[data-testid="progress-week-sheet"]')
    expect(sheet?.getAttribute('data-week')).toBe('week-two')
    expect(text(sheet as Element, '.mp-prog-sheet__title')).toBe('May 25–31')
    expect(text(sheet as Element, '.mp-prog-sheet__titles .mp-prog-meta')).toBe(
      'Week 2 of 2',
    )
    expect(text(sheet as Element, '.mp-prog-sheet__lead')).toBe(
      'Three active days including a Weekly Legend.',
    )
    expect(
      [...(sheet as Element).querySelectorAll('.mp-prog-tile')].map(
        (tile) => tile.textContent,
      ),
    ).toEqual(['3active days', '5attempts'])
    expect(
      [...(sheet as Element).querySelectorAll('.mp-prog-kind__name')].map(
        (kind) => kind.textContent,
      ),
    ).toEqual(['Weekly Legend', 'Practice'])
    expect(text(sheet as Element, '.mp-prog-week-sheet__mark')).toBe(
      'Milestone: Four active weeks',
    )
    // The tapped week is now the marked one.
    expect(weekBar(page, 1).dataset.selected).toBe('on')
  })

  it('closes from its own Close, and the next tap opens that week', () => {
    const page = open()
    weekBar(page, 1).click()
    document
      .querySelector<HTMLButtonElement>('[data-testid="progress-sheet-close"]')
      ?.click()
    expect(
      document.querySelector('[data-testid="progress-week-sheet"]'),
    ).toBeNull()
    weekBar(page, 0).click()
    expect(
      document
        .querySelector('[data-testid="progress-week-sheet"]')
        ?.getAttribute('data-week'),
    ).toBe('week-one')
  })

  it('moves along the weeks with the arrow keys', () => {
    const page = open()
    weekBar(page, 0).focus()
    weekBar(page, 0).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    expect(document.activeElement).toBe(weekBar(page, 1))
    expect(weekBar(page, 1).tabIndex).toBe(0)
    expect(weekBar(page, 0).tabIndex).toBe(-1)
  })
})

describe('the moments', () => {
  it('pages the chosen moment and the others, the dots saying which is in view', () => {
    const page = open()
    const pages = page.querySelectorAll('.mp-prog-moment')
    expect(
      [...pages].map((entry) => entry.getAttribute('data-moment')),
    ).toEqual(['moment-returned', 'moment-challenge'])
    // Only the page in view takes a tap or a screen reader's attention.
    expect((pages[0] as HTMLElement).inert).toBe(false)
    expect((pages[1] as HTMLElement).inert).toBe(true)
    expect(pages[1].querySelector('h2')?.textContent).toBe(
      'You finished this week’s Legend.',
    )
    const dots = page.querySelectorAll('.mp-prog-dot')
    expect([...dots].map((dot) => dot.getAttribute('aria-current'))).toEqual([
      'true',
      null,
    ])
    expect(dots[1].getAttribute('aria-label')).toBe(
      'Moment 2 of 2: You finished this week’s Legend.',
    )
  })

  it('chooses the moment a dot brings into view', () => {
    const onMomentSelect = vi.fn()
    const page = open({ onMomentSelect })
    page.querySelectorAll<HTMLButtonElement>('.mp-prog-dot')[1].click()
    expect(onMomentSelect).toHaveBeenCalledWith('moment-challenge')
    const pages = page.querySelectorAll('.mp-prog-moment')
    expect((pages[0] as HTMLElement).inert).toBe(true)
    expect((pages[1] as HTMLElement).inert).toBe(false)
  })

  it('shares the moment in view from the header and from its own page', () => {
    const onShareMoment = vi.fn()
    const page = open({ onShareMoment })
    page
      .querySelector<HTMLButtonElement>('[data-testid="progress-share"]')
      ?.click()
    page
      .querySelector<HTMLButtonElement>(
        '[data-moment="moment-returned"] [aria-label="Share this moment"]',
      )
      ?.click()
    expect(onShareMoment.mock.calls).toEqual([
      ['moment-returned'],
      ['moment-returned'],
    ])
  })
})

describe('the league card', () => {
  it('opens the Leagues screen', () => {
    const onOpenLeague = vi.fn()
    const page = open({ onOpenLeague })
    page
      .querySelector<HTMLButtonElement>('[data-testid="progress-league"]')
      ?.click()
    expect(onOpenLeague).toHaveBeenCalledTimes(1)
  })
})

describe('before there is a record', () => {
  it('says the record is being opened, busy, with nothing to share', () => {
    const page = openBare({ status: 'loading' })
    const loading = page.querySelector('[data-testid="progress-loading"]')
    expect(loading?.getAttribute('aria-busy')).toBe('true')
    expect(text(loading as Element, '[role="status"]')).toBe(
      'Opening your progress record.',
    )
    expect(page.querySelector('[data-testid="progress-share"]')).toBeNull()
  })

  it('shows a first visit the way to its first run, and what counts', () => {
    const onAction = vi.fn()
    const action = {
      id: 'start-exercise',
      label: 'Start an exercise',
      href: '#/exercises',
    }
    const page = openBare({ status: 'empty', emptyAction: action, onAction })
    const empty = page.querySelector('[data-testid="progress-empty"]')
    expect(text(empty as Element, 'h2')).toBe(
      'Your progress starts with one run.',
    )
    const start = page.querySelector<HTMLAnchorElement>(
      '[data-testid="progress-empty-action"]',
    )
    expect(start?.getAttribute('href')).toBe('#/exercises')
    expect(start?.textContent).toBe('Start an exercise')
    start?.addEventListener('click', (event) => event.preventDefault())
    start?.click()
    expect(onAction).toHaveBeenCalledWith(action)
    expect(page.querySelector('[data-testid="progress-share"]')).toBeNull()
    ;[...(empty as Element).querySelectorAll('button')]
      .find((button) => button.textContent === 'What counts as progress')
      ?.click()
    expect(
      document.querySelector('[data-testid="progress-what-counts-sheet"] h2')
        ?.textContent,
    ).toBe('What counts where')
  })

  it('says a failed read left the record untouched, and Try again reads it again', () => {
    const onRetry = vi.fn()
    const page = openBare({
      status: 'error',
      errorMessage: 'The network is down.',
      onRetry,
    })
    const failure = page.querySelector('[data-testid="progress-failure"]')
    expect(failure?.getAttribute('role')).toBe('alert')
    expect(text(failure as Element, 'h2')).toBe(
      'Your saved record is still where you left it.',
    )
    expect(text(failure as Element, 'p')).toBe('The network is down.')
    page
      .querySelector<HTMLButtonElement>('[data-testid="progress-retry"]')
      ?.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps the record on screen when only part of it failed, with Retry', () => {
    const onRetry = vi.fn()
    const page = open({
      status: 'error',
      errorMessage:
        'Sessions could not load. The available record is still shown.',
      onRetry,
    })
    const note = page.querySelector('.mp-prog-note[role="alert"]')
    expect(note?.textContent).toContain('Some updates could not be loaded.')
    expect(note?.textContent).toContain(
      'Sessions could not load. The available record is still shown.',
    )
    expect(page.querySelector('[data-moment="moment-returned"]')).not.toBeNull()
    note?.querySelector('button')?.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
