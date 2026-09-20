// ============================================================
// The header's share chip: who cannot hear the song
// ============================================================
//
// Owner report, 2026-09-20: a room of ONE wore "Only you can hear this" in
// its header. True of every song ever loaded alone, so it read as a default
// the room always showed -- and its sentence was what pushed the header onto
// a second row. The sentence now waits for somebody to be about; alone there
// is a mark, and the explanation for whoever asks for it.
//
// And when there IS something to say, it says it only while the words fit:
// the chip drops to its icon before the strip it sits in takes a second line.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rowHoldsOneLine } from '@/lib/jam/row-fit'

interface Peer {
  id: string
  displayName: string
}

const room = vi.hoisted(() => ({
  getHost: null as unknown as () => boolean,
  getPeers: null as unknown as () => { id: string; displayName: string }[],
  getMissing: null as unknown as () => { id: string; displayName: string }[],
  getSong: null as unknown as () => { origin: string } | null,
  getSent: null as unknown as () => boolean,
  getPhase: null as unknown as () => string,
  share: null as unknown as (again: boolean) => Promise<void>,
}))

vi.mock('@/stores/jam-store', () => ({
  jamIsHost: () => room.getHost(),
  jamConnectedPeers: () => room.getPeers(),
  jamPeersMissingSong: () => room.getMissing(),
  jamSong: () => room.getSong(),
  jamSongSentOnce: () => room.getSent(),
  jamShareState: () => ({ phase: room.getPhase() }),
  shareJamSongWithRoom: (again: boolean) => room.share(again),
}))

const { JamSongShare } = await import('@/components/jam/JamSongShare')

const ANA: Peer = { id: 'p1', displayName: 'Ana' }
const BEN: Peer = { id: 'p2', displayName: 'Ben' }

const [host, setHost] = createSignal(true)
const [peers, setPeers] = createSignal<Peer[]>([])
const [missing, setMissing] = createSignal<Peer[]>([])
const [song, setSong] = createSignal<{ origin: string } | null>(null)
const [sent, setSent] = createSignal(false)
const [phase, setPhase] = createSignal('idle')
const share = vi.fn<(again: boolean) => Promise<void>>()

/** Every ResizeObserver the chip made, so a test can play the browser. */
let resizeCallbacks: (() => void)[] = []

beforeEach(() => {
  setHost(true)
  setPeers([])
  setMissing([])
  setSong({ origin: 'local' })
  setSent(false)
  setPhase('idle')
  share.mockReset()
  share.mockResolvedValue(undefined)
  room.getHost = host
  room.getPeers = peers
  room.getMissing = missing
  room.getSong = song
  room.getSent = sent
  room.getPhase = phase
  room.share = share

  resizeCallbacks = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const withOthers = (...who: Peer[]): void => {
  setPeers(who)
  setMissing(who)
}

describe('alone in the room', () => {
  it('says nothing in the header about who can hear the song', () => {
    const { container, queryByTestId } = render(() => <JamSongShare />)

    expect(queryByTestId('jam-song-share')).toBeNull()
    // A mark and no sentence: the row keeps its width.
    expect(queryByTestId('jam-song-solo')).not.toBeNull()
    expect(container.textContent).toBe('')
  })

  it('explains itself to whoever asks', () => {
    const { getByRole } = render(() => <JamSongShare />)
    const mark = getByRole('button', { name: 'Only you can hear this song' })

    fireEvent.click(mark)

    const panel = document.querySelector('[role="tooltip"]')
    expect(panel?.textContent).toContain('You are the only one here')
    expect(panel?.textContent).toContain('Invite someone')
  })

  it('draws nothing at all for a song everybody could already hear', () => {
    setSong({ origin: 'url' })
    const { container } = render(() => <JamSongShare />)

    expect(container.innerHTML).toBe('')
  })
})

describe('with somebody else in the room', () => {
  it('offers to send a song nobody has been sent', () => {
    withOthers(ANA)
    const { getByTestId, queryByTestId } = render(() => <JamSongShare />)
    const chip = getByTestId('jam-song-share')

    expect(chip.textContent).toBe('Send the song')
    expect(queryByTestId('jam-song-solo')).toBeNull()

    fireEvent.click(chip)
    expect(share).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('names the one person who lost it after it was sent', () => {
    withOthers(ANA, BEN)
    setSent(true)
    setMissing([ANA])
    const { getByTestId } = render(() => <JamSongShare />)
    const chip = getByTestId('jam-song-share')

    expect(chip.textContent).toBe('Ana can’t hear it')
    expect(chip.getAttribute('title')).toContain('Send it again')
  })

  it('counts them when there are several', () => {
    withOthers(ANA, BEN)
    setSent(true)
    const { getByTestId } = render(() => <JamSongShare />)

    expect(getByTestId('jam-song-share').textContent).toBe(
      '2 people can’t hear it',
    )
  })

  it('is the host’s to press, and nobody else’s', () => {
    withOthers(ANA)
    setHost(false)
    const { container } = render(() => <JamSongShare />)

    expect(container.innerHTML).toBe('')
  })

  it('steps aside while a transfer is running', () => {
    withOthers(ANA)
    setPhase('sending')
    const { container } = render(() => <JamSongShare />)

    expect(container.innerHTML).toBe('')
  })

  it('goes quiet once everybody has the song', () => {
    withOthers(ANA)
    setSent(true)
    setMissing([])
    const { container } = render(() => <JamSongShare />)

    expect(container.innerHTML).toBe('')
  })
})

// ── Words only while they fit ─────────────────────────────────────────
// jsdom lays nothing out, so the row's measurements are handed to it. What
// is pinned here is the decision; that the numbers mean what they say is
// the browser spec's job.

const sizeRow = (
  row: HTMLElement,
  size: { clientHeight: number; clientWidth: number; scrollWidth: number },
): void => {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(row, key, { configurable: true, value })
  }
}

describe('rowHoldsOneLine', () => {
  const row = (
    clientHeight: number,
    clientWidth: number,
    scrollWidth: number,
  ): HTMLElement => {
    const element = document.createElement('div')
    sizeRow(element, { clientHeight, clientWidth, scrollWidth })
    return element
  }

  it('accepts a row as tall as its tallest pill', () => {
    // A 30px name badge beside a 24px chip is still one line.
    expect(rowHoldsOneLine(row(30, 600, 600), 24)).toBe(true)
  })

  it('refuses a row that has wrapped', () => {
    // Two 24px lines and the 6px between them.
    expect(rowHoldsOneLine(row(54, 600, 600), 24)).toBe(false)
  })

  it('refuses a row that scrolls with something off its end', () => {
    expect(rowHoldsOneLine(row(24, 360, 520), 24)).toBe(false)
  })

  it('has no opinion before anything is laid out', () => {
    expect(rowHoldsOneLine(row(0, 0, 0), 0)).toBe(true)
  })
})

describe('when the header has no room for the words', () => {
  const mount = () => {
    withOthers(ANA)
    const view = render(() => (
      <div data-testid="strip">
        <JamSongShare />
      </div>
    ))
    const strip = view.getByTestId('strip')
    const chip = view.getByTestId('jam-song-share')
    Object.defineProperty(chip, 'offsetHeight', {
      configurable: true,
      value: 24,
    })
    return { strip, chip }
  }
  const browserResizes = (): void => {
    for (const callback of resizeCallbacks) callback()
  }

  it('keeps its words while the strip is one line', () => {
    const { strip, chip } = mount()
    sizeRow(strip, { clientHeight: 28, clientWidth: 600, scrollWidth: 600 })
    browserResizes()

    expect(chip).not.toHaveAttribute('data-compact')
  })

  it('drops to its icon rather than send the strip to a second line', () => {
    const { strip, chip } = mount()
    sizeRow(strip, { clientHeight: 58, clientWidth: 420, scrollWidth: 420 })
    browserResizes()

    expect(chip).toHaveAttribute('data-compact')
    // Still the same button, and still says what it does to a screen reader.
    expect(chip.getAttribute('aria-label')).toContain('Send the song')
    fireEvent.click(chip)
    expect(share).toHaveBeenCalledOnce()
  })

  it('watches its row when it arrives after the room has opened', async () => {
    // Nobody here yet: no chip, and nothing to watch.
    const view = render(() => (
      <div data-testid="strip">
        <JamSongShare />
      </div>
    ))
    expect(view.queryByTestId('jam-song-share')).toBeNull()

    withOthers(ANA)
    await Promise.resolve()

    const strip = view.getByTestId('strip')
    const chip = view.getByTestId('jam-song-share')
    Object.defineProperty(chip, 'offsetHeight', {
      configurable: true,
      value: 24,
    })
    sizeRow(strip, { clientHeight: 58, clientWidth: 420, scrollWidth: 420 })
    expect(resizeCallbacks.length).toBeGreaterThan(0)
    browserResizes()

    expect(chip).toHaveAttribute('data-compact')
  })

  it('takes its words back when there is room again', () => {
    const { strip, chip } = mount()
    sizeRow(strip, { clientHeight: 58, clientWidth: 420, scrollWidth: 420 })
    browserResizes()
    expect(chip).toHaveAttribute('data-compact')

    sizeRow(strip, { clientHeight: 28, clientWidth: 900, scrollWidth: 900 })
    browserResizes()

    expect(chip).not.toHaveAttribute('data-compact')
  })
})
