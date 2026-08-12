// The TV's half of signing in by scanning. What matters here is what a
// person watching a television sees: a code they can read, a QR a phone
// can find, and a screen that keeps waiting rather than giving up on the
// first hiccup of a living-room Wi-Fi.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startDeviceLink: vi.fn(),
  pollDeviceLink: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => mocks)

import { PhoneSignIn } from '../account/PhoneSignIn'

const REQUEST = {
  code: 'ABCD2345',
  pollToken: 'the-secret-only-this-device-has',
  expiresInSeconds: 300,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.startDeviceLink.mockResolvedValue(REQUEST)
  mocks.pollDeviceLink.mockResolvedValue({ status: 'pending' })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Mount and let the initial start request settle. */
async function mountPane(onLinked = vi.fn()): Promise<typeof onLinked> {
  render(() => <PhoneSignIn onLinked={onLinked} />)
  await vi.advanceTimersByTimeAsync(0)
  return onLinked
}

describe('PhoneSignIn', () => {
  it('shows a code that can be read across a room, and a QR', async () => {
    await mountPane()
    // Grouped four-and-four: eight unbroken characters is hard to read
    // aloud and harder to copy onto a phone.
    expect(screen.getByTestId('phone-sign-in-code')).toHaveTextContent(
      'ABCD 2345',
    )
    const svg = screen.getByTestId('phone-sign-in').querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-label')).toBe('Scan to sign this device in')
  })

  it('never puts the poll token on screen', async () => {
    await mountPane()
    // The code is public the moment it is on a television. The token is
    // what buys the session, so it must not be rendered, encoded into the
    // QR, or reachable from the DOM.
    const pane = screen.getByTestId('phone-sign-in')
    expect(pane.innerHTML).not.toContain(REQUEST.pollToken)
  })

  it('encodes a link the phone can follow, not a bare code', async () => {
    await mountPane()
    const path = screen
      .getByTestId('phone-sign-in')
      .querySelector('svg path')
      ?.getAttribute('d')
    expect(path).toBeTruthy()
    // A QR of "ABCD2345" opens nothing. The value has to be a URL, which
    // is checked here by re-encoding the URL we expect and comparing.
    const { encode } = await import('uqr')
    const expected = encode(
      `${window.location.origin}${window.location.pathname}#/link:ABCD2345`,
      { ecc: 'M', border: 4 },
    )
    let d = ''
    for (let y = 0; y < expected.size; y += 1) {
      for (let x = 0; x < expected.size; x += 1) {
        if (expected.data[y]?.[x] === true) d += `M${x} ${y}h1v1h-1z`
      }
    }
    expect(path).toBe(d)
  })

  it('adopts the session the moment the phone approves', async () => {
    const onLinked = await mountPane()
    expect(onLinked).not.toHaveBeenCalled()

    mocks.pollDeviceLink.mockResolvedValue({ status: 'linked' })
    await vi.advanceTimersByTimeAsync(2500)
    expect(onLinked).toHaveBeenCalledTimes(1)

    // And stops asking — a claimed code polled again reads as expired,
    // which would otherwise wipe the screen the person just signed in on.
    const callsAtLink = mocks.pollDeviceLink.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.pollDeviceLink).toHaveBeenCalledTimes(callsAtLink)
  })

  it('keeps waiting through a dropped connection', async () => {
    mocks.pollDeviceLink.mockResolvedValue({ status: 'offline' })
    await mountPane()
    await vi.advanceTimersByTimeAsync(7500)

    // A TV that loses Wi-Fi for a few seconds is ordinary. Showing an
    // error for it sends somebody to the router for nothing.
    expect(screen.getByTestId('phone-sign-in-waiting')).toBeInTheDocument()
    expect(
      screen.queryByTestId('phone-sign-in-expired'),
    ).not.toBeInTheDocument()
    expect(mocks.pollDeviceLink.mock.calls.length).toBeGreaterThan(1)
  })

  it('offers a fresh code once the old one runs out', async () => {
    await mountPane()
    // Its own countdown, not the worker's answer: the code is dead at a
    // known moment and there is no reason to ask about it.
    await vi.advanceTimersByTimeAsync(300_000)
    expect(screen.getByTestId('phone-sign-in-expired')).toBeInTheDocument()

    mocks.startDeviceLink.mockResolvedValue({ ...REQUEST, code: 'EFGH6789' })
    screen.getByTestId('phone-sign-in-retry').click()
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByTestId('phone-sign-in-code')).toHaveTextContent(
      'EFGH 6789',
    )
  })

  it('stops polling once it expires', async () => {
    await mountPane()
    await vi.advanceTimersByTimeAsync(300_000)
    const callsAtExpiry = mocks.pollDeviceLink.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.pollDeviceLink).toHaveBeenCalledTimes(callsAtExpiry)
  })

  it('says so plainly when it cannot reach the server at all', async () => {
    mocks.startDeviceLink.mockResolvedValue(null)
    await mountPane()
    expect(screen.getByText(/Could not reach MercuryPitch/)).toBeInTheDocument()
    expect(mocks.pollDeviceLink).not.toHaveBeenCalled()
  })

  it('stops polling when it goes away', async () => {
    await mountPane()
    cleanup()
    const callsAtUnmount = mocks.pollDeviceLink.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.pollDeviceLink).toHaveBeenCalledTimes(callsAtUnmount)
  })
})
