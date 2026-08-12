// The phone's half of signing a TV in. The property worth defending is
// the one at the top: following the link ASKS, it does not approve. A
// link that signs a device in by being opened is a link somebody can be
// sent, and the device it signs in need not be in the same building.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchDeviceLinkPending: vi.fn(),
  approveDeviceLink: vi.fn(),
  // Replaced below with the real signal reader. Read through an indirection
  // because vi.hoisted runs before solid-js is imported.
  stamp: (): number => 0,
}))

vi.mock('@/db/services/auth-service', () => ({
  fetchDeviceLinkPending: mocks.fetchDeviceLinkPending,
  approveDeviceLink: mocks.approveDeviceLink,
  authStamp: (): number => mocks.stamp(),
}))

const [authStamp, setAuthStamp] = createSignal(0)
mocks.stamp = authStamp

import { closeDeviceLink, setDeviceLinkCode } from '@/stores/ui-store'
import { DeviceLinkModal } from '../account/DeviceLinkModal'

beforeEach(() => {
  vi.clearAllMocks()
  closeDeviceLink()
  mocks.fetchDeviceLinkPending.mockResolvedValue({
    status: 'pending',
    deviceLabel: 'Living room TV',
  })
  mocks.approveDeviceLink.mockResolvedValue({ ok: true })
})

afterEach(cleanup)

describe('DeviceLinkModal', () => {
  it('stays out of the way until a code arrives', () => {
    render(() => <DeviceLinkModal />)
    expect(screen.queryByTestId('device-link-modal')).not.toBeInTheDocument()
  })

  it('asks rather than approving, and names the device', async () => {
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')

    expect(await screen.findByTestId('device-link-ask')).toHaveTextContent(
      'Living room TV',
    )
    // Opening the link must never be the approval. Nothing has been
    // granted at this point and the dialog is still waiting for a tap.
    expect(mocks.approveDeviceLink).not.toHaveBeenCalled()
    expect(screen.getByTestId('device-link-approve')).toBeInTheDocument()
  })

  it('approves only when told to', async () => {
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')
    ;(await screen.findByTestId('device-link-approve')).click()

    await waitFor(() =>
      expect(mocks.approveDeviceLink).toHaveBeenCalledWith('ABCD2345'),
    )
    expect(
      await screen.findByTestId('device-link-approved'),
    ).toBeInTheDocument()
  })

  it('warns about what approving hands over', async () => {
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')
    await screen.findByTestId('device-link-ask')
    // Somebody who scanned a code off a screen that is not theirs should
    // be told what they are about to do before the tap, not after.
    expect(
      screen.getByText(/Only approve this if it is your device/),
    ).toBeInTheDocument()
  })

  it('sends a signed-out phone to sign in, and re-checks afterwards', async () => {
    mocks.fetchDeviceLinkPending.mockResolvedValue({ status: 'signed-out' })
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')

    expect(await screen.findByTestId('device-link-sign-in')).toBeInTheDocument()

    // Signing in must not cost a second trip to the television to re-scan
    // the code — the request is still on screen and re-checks itself.
    mocks.fetchDeviceLinkPending.mockResolvedValue({
      status: 'pending',
      deviceLabel: 'Living room TV',
    })
    setAuthStamp((n) => n + 1)
    expect(await screen.findByTestId('device-link-ask')).toBeInTheDocument()
  })

  it('says a used code is used, not merely broken', async () => {
    mocks.fetchDeviceLinkPending.mockResolvedValue({ status: 'used' })
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')
    expect(await screen.findByTestId('device-link-stale')).toHaveTextContent(
      'already been used',
    )
  })

  it('handles a code that expired between the scan and the tap', async () => {
    mocks.approveDeviceLink.mockResolvedValue({ ok: false, reason: 'expired' })
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ABCD2345')
    ;(await screen.findByTestId('device-link-approve')).click()
    expect(await screen.findByTestId('device-link-stale')).toHaveTextContent(
      'expired',
    )
  })

  it('does not describe an unknown code as a device', async () => {
    mocks.fetchDeviceLinkPending.mockResolvedValue({ status: 'expired' })
    render(() => <DeviceLinkModal />)
    setDeviceLinkCode('ZZZZ9999')
    await screen.findByTestId('device-link-stale')
    expect(screen.queryByTestId('device-link-approve')).not.toBeInTheDocument()
  })
})
