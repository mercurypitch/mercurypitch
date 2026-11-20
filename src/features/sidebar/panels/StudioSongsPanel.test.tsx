// Studio songs rail tests — each song with its length, lanes and last edit; the open one marked; a row switches through the page's loan.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import type * as Viewport from '@/lib/use-viewport'
import type { StudioSongsLoan } from '@/stores/studio-songs-store'
import { lendStudioSongs } from '@/stores/studio-songs-store'
import { setSidebarOpen, sidebarOpen } from '@/stores/ui-store'
import StudioSongsPanel from './StudioSongsPanel'

const viewport = vi.hoisted(() => ({ phone: false }))
vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof Viewport>()),
  isPhoneStage: () => viewport.phone,
}))

const RATE = 48_000

function song(
  id: string,
  title: string,
  seconds: number,
  lanes: number,
  updatedAt = new Date().toISOString(),
): StudioProjectSummary {
  return {
    id,
    title,
    revision: 3,
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt,
    trackCount: lanes,
    clipCount: seconds > 0 ? lanes : 0,
    durationFrames: seconds * RATE,
  }
}

let giveBack: (() => void) | null = null

function lend(overrides: Partial<StudioSongsLoan> = {}) {
  const [openId, setOpenId] = createSignal<string | null>('one')
  const loan: StudioSongsLoan = {
    songs: () => [
      song('one', 'Window seat', 222, 1),
      song('two', 'Harbour lights', 95, 4),
      song('three', 'Sketch', 0, 1, '2025-12-30T10:00:00.000Z'),
    ],
    openId,
    hold: () => null,
    opening: () => false,
    open: vi.fn(async (id: string) => {
      setOpenId(id)
    }),
    ...overrides,
  }
  giveBack = lendStudioSongs(loan)
  return loan
}

beforeEach(() => {
  viewport.phone = false
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  giveBack?.()
  giveBack = null
  setSidebarOpen(false)
})

describe('Studio songs rail', () => {
  it('lists every song with its length, lanes and last edit, and marks the open one', () => {
    lend()
    render(() => <StudioSongsPanel />)

    const list = screen.getByRole('navigation', { name: 'Studio songs' })
    const rows = list.querySelectorAll('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Window seat')
    expect(rows[0]).toHaveTextContent('3:42')
    expect(rows[0]).toHaveTextContent('1 lane')
    expect(rows[0]).toHaveTextContent('Today')
    expect(rows[1]).toHaveTextContent('1:35')
    expect(rows[1]).toHaveTextContent('4 lanes')
    // An empty song says so rather than 0:00, and an old one its year.
    expect(rows[2]).toHaveTextContent('Empty')
    expect(rows[2]).toHaveTextContent('2025')

    const open = screen.getByRole('button', {
      name: 'Window seat, 3:42, 1 lane, edited today',
    })
    expect(open).toHaveAttribute('aria-current', 'true')
    expect(open).toHaveTextContent('Open')
    expect(
      screen.getByRole('button', { name: /^Harbour lights,/ }),
    ).not.toHaveAttribute('aria-current')
  })

  it('switches songs through the page with a click, and moves the mark', async () => {
    const loan = lend()
    render(() => <StudioSongsPanel />)

    fireEvent.click(screen.getByRole('button', { name: /^Harbour lights,/ }))

    expect(loan.open).toHaveBeenCalledWith('two')
    await vi.waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Harbour lights,/ }),
      ).toHaveAttribute('aria-current', 'true'),
    )
    expect(
      screen.getByRole('button', { name: /^Window seat,/ }),
    ).not.toHaveAttribute('aria-current')
  })

  it('says why it cannot switch, and holds every row until it can', () => {
    const [hold, setHold] = createSignal<string | null>(
      'Stop the take to switch songs.',
    )
    const loan = lend({ hold })
    render(() => <StudioSongsPanel />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Stop the take to switch songs.',
    )
    const row = screen.getByRole('button', { name: /^Harbour lights,/ })
    expect(row).toBeDisabled()
    fireEvent.click(row)
    expect(loan.open).not.toHaveBeenCalled()

    setHold(null)
    expect(screen.queryByRole('status')).toBeNull()
    expect(row).toBeEnabled()
  })

  it('holds the rows without a reason while a song opens', () => {
    lend({ opening: () => true })
    render(() => <StudioSongsPanel />)

    expect(screen.getByRole('button', { name: /^Sketch,/ })).toBeDisabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders nothing without a Studio page, or without songs', () => {
    const { container } = render(() => <StudioSongsPanel />)
    expect(container).toBeEmptyDOMElement()

    lend({ songs: () => [] })
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps a closed phone drawer free of rows, and folds the drawer away after a pick', () => {
    viewport.phone = true
    const loan = lend()
    render(() => <StudioSongsPanel />)
    expect(
      screen.queryByRole('navigation', { name: 'Studio songs' }),
    ).toBeNull()

    setSidebarOpen(true)
    fireEvent.click(screen.getByRole('button', { name: /^Sketch,/ }))

    expect(loan.open).toHaveBeenCalledWith('three')
    expect(sidebarOpen()).toBe(false)
  })
})
