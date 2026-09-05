// ============================================================
// Pro controls — store-specific redemption, honest beta labels and copyable ID
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { ProSection } from './ProSection'

function props() {
  return {
    name: 'BeSideCue Pro',
    available: true,
    status: 'ready' as const,
    isPro: false,
    busy: false,
    locale: 'en',
    onUpgrade: vi.fn(),
    onManage: vi.fn(),
    onRestore: vi.fn(),
    onRedeemCode: vi.fn(),
    onCheckAccess: vi.fn(),
    onExternalRedemption: vi.fn(),
  }
}

describe('premium settings', () => {
  it('opens Apple code redemption without offering the Google link on iOS', () => {
    const callbacks = props()
    render(() => <ProSection {...callbacks} platform="ios" />)

    fireEvent.click(
      screen.getByRole('button', { name: /Redeem App Store code/ }),
    )

    expect(callbacks.onRedeemCode).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('link', { name: 'Redeem on Google Play' }),
    ).not.toBeInTheDocument()
  })

  it('routes Android codes to Google Play and marks the return for synchronization', () => {
    const callbacks = props()
    render(() => <ProSection {...callbacks} platform="android" />)
    const link = screen.getByRole('link', { name: 'Redeem on Google Play' })
    expect(link).toHaveAttribute('href', 'https://play.google.com/redeem')
    // Keep the test inside jsdom; the assertion concerns the real link contract.
    link.addEventListener('click', (event) => event.preventDefault())

    fireEvent.click(link)

    expect(callbacks.onExternalRedemption).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', { name: /Redeem App Store code/ }),
    ).not.toBeInTheDocument()
  })

  it('labels beta actions as tests and hides real code entry and support identity', () => {
    render(() => (
      <ProSection
        {...props()}
        platform="ios"
        mock
        supportId="$RCAnonymousID:mock"
      />
    ))

    expect(screen.getByText(/Beta purchase testing/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Test an offer/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Redeem App Store code/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Purchase support ID'),
    ).not.toBeInTheDocument()
  })

  it('keeps the real support ID explicitly selectable without making it editable', () => {
    render(() => (
      <ProSection
        {...props()}
        platform="ios"
        supportId="$RCAnonymousID:example"
      />
    ))

    const field = screen.getByLabelText('Purchase support ID')
    expect(field).toHaveAttribute('readonly')
    expect(field).toHaveAttribute('data-selection', 'text')
    expect(field).toHaveValue('$RCAnonymousID:example')
  })

  it('disables concurrent purchase actions while a store request is pending', () => {
    render(() => <ProSection {...props()} platform="ios" busy />)

    for (const button of screen.getAllByRole('button'))
      expect(button).toBeDisabled()
  })
})
