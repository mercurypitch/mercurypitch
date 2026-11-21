// Studio songs rail tests — each song with its length, lanes and last edit; the open one marked; a row switches, and New song makes a song, through the page's loan.
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
    canCreate: () => true,
    create: vi.fn(async () => {}),
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

  it('says why it cannot switch in a live region that stays mounted, and holds every other row until it can', () => {
    const [hold, setHold] = createSignal<string | null>(null)
    const loan = lend({ hold })
    render(() => <StudioSongsPanel />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('')

    setHold('Stop the take to switch songs.')
    // The same element, now with the reason: a live region that appears
    // with its text is often not read out.
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Stop the take to switch songs.')
    const row = screen.getByRole('button', { name: /^Harbour lights,/ })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(row)
    expect(loan.open).not.toHaveBeenCalled()
    // The open song only comes forward, which nothing holds.
    const open = screen.getByRole('button', { name: /^Window seat,/ })
    expect(open).not.toHaveAttribute('aria-disabled')
    fireEvent.click(open)
    expect(loan.open).toHaveBeenCalledWith('one')

    setHold(null)
    expect(status).toHaveTextContent('')
    expect(row).not.toHaveAttribute('aria-disabled')
  })

  it('keeps the focus on a row pressed while a hold arrives, and stays held', () => {
    const [opening, setOpening] = createSignal(false)
    // The page's switch is still waiting: the open song has not changed.
    const loan = lend({ opening, open: vi.fn(async () => {}) })
    render(() => <StudioSongsPanel />)
    const row = screen.getByRole('button', { name: /^Sketch,/ })
    row.focus()

    fireEvent.click(row)
    setOpening(true)

    expect(row).not.toBeDisabled()
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(document.activeElement).toBe(row)
    expect(screen.getByRole('status')).toHaveTextContent('')
    fireEvent.click(row)
    expect(loan.open).toHaveBeenCalledOnce()
  })

  it('keeps each row, and its focus, when a save hands over a fresh list', () => {
    const fresh = () => [
      song('one', 'Window seat', 222, 1),
      song('two', 'Harbour lights', 96, 4),
    ]
    const [songs, setSongs] = createSignal(fresh())
    lend({ songs })
    render(() => <StudioSongsPanel />)
    const row = screen.getByRole('button', { name: /^Harbour lights,/ })
    row.focus()

    // A save of the open song: the same order, every summary a new object.
    setSongs([fresh()[0], song('two', 'Harbour lights', 97, 5)])

    const after = screen.getByRole('button', { name: /^Harbour lights,/ })
    expect(after).toBe(row)
    expect(document.activeElement).toBe(row)
    expect(row).toHaveTextContent('5 lanes')
  })

  it('keeps the tour target in the page while the section is collapsed', () => {
    localStorage.setItem('sidebar-studio-songs-open', 'false')
    lend()
    const { container } = render(() => <StudioSongsPanel />)

    expect(
      container.querySelector('[data-tour="studio.rail-songs"]'),
    ).not.toBeNull()
    expect(
      screen.queryByRole('navigation', { name: 'Studio songs' }),
    ).toBeNull()
    expect(
      container.querySelector(
        '[data-tour="studio.rail-songs"] [data-collapsible="sidebar-studio-songs-open"]',
      ),
    ).not.toBeNull()
  })

  it('puts New song above the rows, and makes a song through the page with a click', () => {
    const loan = lend()
    render(() => <StudioSongsPanel />)

    const create = screen.getByRole('button', { name: 'New song' })
    const list = screen.getByRole('navigation', { name: 'Studio songs' })
    expect(
      create.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Outside the list: however many songs it scrolls, the button stays put.
    expect(list.contains(create)).toBe(false)

    fireEvent.click(create)

    expect(loan.create).toHaveBeenCalledOnce()
    expect(loan.open).not.toHaveBeenCalled()
  })

  it('holds New song with the rows, saying why in the same live region', () => {
    const [hold, setHold] = createSignal<string | null>(null)
    const loan = lend({ hold })
    render(() => <StudioSongsPanel />)
    const status = screen.getByRole('status')
    const create = screen.getByRole('button', { name: 'New song' })
    create.focus()

    setHold('Stop the take to switch songs.')

    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Stop the take to switch songs.')
    // aria-disabled, so the focus stays on a button pressed as the hold arrives.
    expect(create).not.toBeDisabled()
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(document.activeElement).toBe(create)
    fireEvent.click(create)
    expect(loan.create).not.toHaveBeenCalled()

    setHold(null)
    expect(status).toHaveTextContent('')
    expect(create).not.toHaveAttribute('aria-disabled')
    fireEvent.click(create)
    expect(loan.create).toHaveBeenCalledOnce()
  })

  it('holds New song without a reason while a song opens, or while the page cannot make one', () => {
    const [opening, setOpening] = createSignal(false)
    const [canCreate, setCanCreate] = createSignal(true)
    const loan = lend({ opening, canCreate })
    render(() => <StudioSongsPanel />)
    const create = screen.getByRole('button', { name: 'New song' })

    setOpening(true)
    expect(create).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(create)

    setOpening(false)
    // A save in flight: the page's own New song waits for it, and so does this one.
    setCanCreate(false)
    expect(create).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(create)

    expect(loan.create).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('')
    setCanCreate(true)
    expect(create).not.toHaveAttribute('aria-disabled')
  })

  it('reads out no hold while a song opens: the page making the new song is not one', () => {
    const [opening, setOpening] = createSignal(true)
    lend({
      opening,
      hold: () => 'Studio is busy with this song. Switch once it finishes.',
    })
    render(() => <StudioSongsPanel />)
    const status = screen.getByRole('status')

    expect(status).toHaveTextContent('')
    setOpening(false)
    expect(status).toHaveTextContent(
      'Studio is busy with this song. Switch once it finishes.',
    )
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

  it('keeps New song out of a closed phone drawer, and folds the drawer away after a press', () => {
    viewport.phone = true
    const loan = lend()
    render(() => <StudioSongsPanel />)
    expect(screen.queryByRole('button', { name: 'New song' })).toBeNull()

    setSidebarOpen(true)
    fireEvent.click(screen.getByRole('button', { name: 'New song' }))

    expect(loan.create).toHaveBeenCalledOnce()
    expect(sidebarOpen()).toBe(false)
  })
})
