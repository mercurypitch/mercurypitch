import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TwoFactorSettings } from '@/components/account/TwoFactorSettings'

const fetchTwofaStatus = vi.fn()
const startTwofaSetup = vi.fn()
const enableTwofa = vi.fn()
const disableTwofa = vi.fn()

vi.mock('@/db/services/auth-mfa-service', () => ({
  fetchTwofaStatus: (...a: unknown[]) => fetchTwofaStatus(...a),
  startTwofaSetup: (...a: unknown[]) => startTwofaSetup(...a),
  enableTwofa: (...a: unknown[]) => enableTwofa(...a),
  disableTwofa: (...a: unknown[]) => disableTwofa(...a),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const SETUP = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  otpauthUri:
    'otpauth://totp/Mercury:singer%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Mercury',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TwoFactorSettings', () => {
  it('renders nothing where the environment has no key for it', async () => {
    // A control that answers 503 reads as a broken account rather than a
    // feature this deployment does not carry.
    fetchTwofaStatus.mockResolvedValue({
      enabled: false,
      recoveryCodesLeft: 0,
      available: false,
    })
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(fetchTwofaStatus).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('twofa-settings')).toBeNull()
  })

  it('stays silent when the status read fails', async () => {
    // Claiming "off" would send someone looking for a setting they already
    // turned on, which is worse than showing nothing.
    fetchTwofaStatus.mockRejectedValue(new Error('offline'))
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(fetchTwofaStatus).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('twofa-settings')).toBeNull()
  })

  it('walks setup through to the recovery codes', async () => {
    fetchTwofaStatus.mockResolvedValue({
      enabled: false,
      recoveryCodesLeft: 0,
      available: true,
    })
    startTwofaSetup.mockResolvedValue(SETUP)
    enableTwofa.mockResolvedValue(['aaaa-bbbb', 'cccc-dddd'])
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('twofa-setup-start')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('twofa-setup-start'))

    // The secret is offered in typeable groups for anyone without a camera.
    await waitFor(() => {
      expect(screen.getByTestId('twofa-secret').textContent).toBe(
        'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
      )
    })
    expect(
      screen.getByLabelText('Authenticator setup code').tagName.toLowerCase(),
    ).toBe('svg')

    const field = screen.getByTestId('twofa-code') as HTMLInputElement
    fireEvent.input(field, { target: { value: '123456' } })
    fireEvent.click(screen.getByTestId('twofa-enable'))

    await waitFor(() => {
      expect(enableTwofa).toHaveBeenCalledWith('123456')
    })
    const sheet = await screen.findByTestId('twofa-recovery-codes')
    expect(sheet.textContent).toContain('aaaa-bbbb')
    expect(sheet.textContent).toContain('cccc-dddd')
  })

  it('will not submit a code that is too short to be one', async () => {
    fetchTwofaStatus.mockResolvedValue({
      enabled: false,
      recoveryCodesLeft: 0,
      available: true,
    })
    startTwofaSetup.mockResolvedValue(SETUP)
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('twofa-setup-start')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('twofa-setup-start'))

    const button = await screen.findByTestId('twofa-enable')
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.input(screen.getByTestId('twofa-code'), {
      target: { value: '12345' },
    })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the server sentence when the code does not match', async () => {
    fetchTwofaStatus.mockResolvedValue({
      enabled: false,
      recoveryCodesLeft: 0,
      available: true,
    })
    startTwofaSetup.mockResolvedValue(SETUP)
    enableTwofa.mockRejectedValue(new Error('That code did not match'))
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('twofa-setup-start')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('twofa-setup-start'))
    fireEvent.input(await screen.findByTestId('twofa-code'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByTestId('twofa-enable'))

    await waitFor(() => {
      expect(screen.getByTestId('twofa-error').textContent).toBe(
        'That code did not match',
      )
    })
    // And it stays on the enrolment screen, holding the same secret, so a
    // mistyped digit does not cost a fresh pairing.
    expect(screen.getByTestId('twofa-secret')).toBeTruthy()
  })

  it('reports how many recovery codes are left once it is on', async () => {
    fetchTwofaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesLeft: 7,
      available: true,
    })
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('twofa-codes-left').textContent).toContain(
        '7 recovery codes left',
      )
    })
    expect(screen.getByTestId('twofa-on-pill')).toBeTruthy()
  })

  it('asks for a code before turning it off, and takes a recovery code', async () => {
    // The field takes both shapes: the server decides which by its shape, so
    // the UI never has to ask which one somebody is holding.
    fetchTwofaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesLeft: 3,
      available: true,
    })
    disableTwofa.mockResolvedValue(undefined)
    render(() => <TwoFactorSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('twofa-disable-start')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('twofa-disable-start'))

    const confirm = (await screen.findByTestId(
      'twofa-disable-confirm',
    )) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.input(screen.getByTestId('twofa-disable-code'), {
      target: { value: 'aaaa-bbbb' },
    })
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(disableTwofa).toHaveBeenCalledWith('aaaa-bbbb')
    })
  })
})
