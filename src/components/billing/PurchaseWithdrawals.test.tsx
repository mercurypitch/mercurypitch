import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CancellablePack, Withdrawals, WithdrawalStatement, } from '@/db/services/billing-service'

const mocks = vi.hoisted(() => ({
  held: true,
  fetchWithdrawals: vi.fn(),
  submitWithdrawal: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => mocks.held,
}))
vi.mock('@/db/services/billing-service', async (importOriginal) => {
  // formatPrice stays real; the two calls to the worker are stubbed.
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchWithdrawals: mocks.fetchWithdrawals,
    submitWithdrawal: mocks.submitWithdrawal,
  }
})

const { PurchaseWithdrawals } = await import('./PurchaseWithdrawals')
const { balanceVersion } = await import('@/stores/billing-store')

const PLUS: CancellablePack = {
  purchaseId: 'purchase-plus',
  packLabel: 'Plus',
  purchasedAt: '2026-10-20T10:00:00.000Z',
  deadline: '2026-11-03',
  basis: 'unused',
  paidCredits: 140,
  unusedCredits: 126,
  bonusCredits: 30,
  refund: { amountMinor: 1800, currency: 'eur' },
}

const STARTER: CancellablePack = {
  purchaseId: 'purchase-starter',
  packLabel: 'Starter',
  purchasedAt: '2026-10-21T10:00:00.000Z',
  deadline: '2026-11-04',
  basis: 'unused',
  paidCredits: 30,
  unusedCredits: 30,
  bonusCredits: 0,
  refund: { amountMinor: 500, currency: 'eur' },
}

function statement(
  overrides: Partial<WithdrawalStatement> = {},
): WithdrawalStatement {
  return {
    id: 'statement-1',
    purchaseId: PLUS.purchaseId,
    packLabel: 'Plus',
    submittedAt: '2026-10-22T14:32:09.000Z',
    email: 'sam@example.test',
    unusedCredits: 126,
    bonusCredits: 30,
    basis: 'unused',
    refundMinor: 1800,
    currency: 'eur',
    refundStatus: 'refunded',
    ...overrides,
  }
}

function answer(overrides: Partial<Withdrawals> = {}): Withdrawals {
  return {
    mode: 'refund_unused',
    email: 'sam@example.test',
    packs: [PLUS, STARTER],
    statements: [],
    ...overrides,
  }
}

beforeEach(() => {
  mocks.held = true
  mocks.fetchWithdrawals.mockReset()
  mocks.submitWithdrawal.mockReset()
})

describe('PurchaseWithdrawals', () => {
  it('lists each pack that can still be cancelled, with the link the law names', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer())
    render(() => <PurchaseWithdrawals />)

    const rows = await screen.findAllByTestId('cancellable-pack')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Plus pack, bought')
    expect(rows[0]?.textContent).toContain('126 of 140 credits unused.')
    expect(rows[0]?.textContent).toContain('€18.00')
    expect(
      screen.getAllByTestId('withdraw-link').map((link) => link.textContent),
    ).toEqual(['Withdraw from contract here', 'Withdraw from contract here'])
  })

  it('opens the form on the chosen purchase, with the account email to edit', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer())
    render(() => <PurchaseWithdrawals />)

    fireEvent.click(
      (await screen.findAllByTestId('withdraw-link'))[1] as HTMLElement,
    )

    const purchase = screen.getByTestId(
      'withdrawal-purchase',
    ) as HTMLSelectElement
    expect(purchase.value).toBe('purchase-starter')
    const email = screen.getByTestId('withdrawal-email') as HTMLInputElement
    expect(email.value).toBe('sam@example.test')
    expect(screen.getByTestId('withdrawal-form').textContent).toContain(
      "We'll take the 30 unused credits off your balance and refund €5.00 to the card or account you paid with.",
    )
    expect(screen.getByTestId('confirm-withdrawal').textContent).toBe(
      'Confirm withdrawal',
    )
  })

  it('says the bonus leaves with the pack', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer())
    render(() => <PurchaseWithdrawals />)

    fireEvent.click(
      (await screen.findAllByTestId('withdraw-link'))[0] as HTMLElement,
    )

    expect(screen.getByTestId('withdrawal-form').textContent).toContain(
      "We'll take the 126 unused credits and the 30 bonus credits that came with it off your balance and refund €18.00",
    )
  })

  it('sends the statement and says it arrived', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer())
    mocks.submitWithdrawal.mockResolvedValue({
      duplicate: false,
      statement: statement({ email: 'receipts@example.test' }),
    })
    render(() => <PurchaseWithdrawals />)
    fireEvent.click(
      (await screen.findAllByTestId('withdraw-link'))[0] as HTMLElement,
    )
    const before = balanceVersion()

    fireEvent.input(screen.getByTestId('withdrawal-name'), {
      target: { value: '  Sam Singer ' },
    })
    fireEvent.input(screen.getByTestId('withdrawal-email'), {
      target: { value: 'receipts@example.test' },
    })
    fireEvent.submit(screen.getByTestId('withdrawal-form'))

    const received = await screen.findByTestId('withdrawal-received')
    expect(mocks.submitWithdrawal).toHaveBeenCalledWith({
      purchaseId: 'purchase-plus',
      name: 'Sam Singer',
      email: 'receipts@example.test',
    })
    expect(received.textContent).toContain("We've received your cancellation")
    expect(received.textContent).toContain(
      "We've sent a confirmation to receipts@example.test.",
    )
    expect(received.textContent).toContain(
      '€18.00 refunded to the card or account you paid with.',
    )
    expect(screen.queryByTestId('withdrawal-form')).toBeNull()
    // The balance shown above refetches.
    expect(balanceVersion()).toBe(before + 1)
  })

  it('shows why a statement was refused', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer())
    mocks.submitWithdrawal.mockRejectedValue(
      new Error('The 14 days to cancel this purchase have ended.'),
    )
    render(() => <PurchaseWithdrawals />)
    fireEvent.click(
      (await screen.findAllByTestId('withdraw-link'))[0] as HTMLElement,
    )
    fireEvent.input(screen.getByTestId('withdrawal-name'), {
      target: { value: 'Sam Singer' },
    })

    fireEvent.submit(screen.getByTestId('withdrawal-form'))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The 14 days to cancel this purchase have ended.',
    )
    expect(screen.queryByTestId('withdrawal-received')).toBeNull()
  })

  it('lists cancelled purchases and where their refund stands', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(
      answer({
        packs: [],
        statements: [statement({ refundStatus: 'manual' })],
      }),
    )
    render(() => <PurchaseWithdrawals />)

    const list = await screen.findByRole('list', {
      name: 'Cancelled purchases',
    })
    expect(list.textContent).toContain('Plus pack cancelled on')
    expect(list.textContent).toContain("We'll refund €18.00 within 14 days.")
    expect(screen.queryByTestId('withdraw-link')).toBeNull()
  })

  it('shows nothing while there is nothing to cancel', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(answer({ packs: [] }))
    render(() => <PurchaseWithdrawals />)

    await waitFor(() => expect(mocks.fetchWithdrawals).toHaveBeenCalled())
    expect(screen.queryByTestId('withdrawals')).toBeNull()
  })

  it('never asks without an account', async () => {
    mocks.held = false
    render(() => <PurchaseWithdrawals />)

    await Promise.resolve()
    expect(mocks.fetchWithdrawals).not.toHaveBeenCalled()
    expect(screen.queryByTestId('withdrawals')).toBeNull()
  })

  describe('a pack with no consent on record', () => {
    // Bought before checkout asked for the box: cancellable with every
    // credit used, for the whole price.
    const OLD: CancellablePack = {
      ...STARTER,
      purchaseId: 'purchase-old',
      basis: 'full',
      unusedCredits: 0,
      refund: { amountMinor: 500, currency: 'eur' },
    }

    it('offers the whole price back, used credits and all', async () => {
      mocks.fetchWithdrawals.mockResolvedValue(answer({ packs: [OLD] }))
      render(() => <PurchaseWithdrawals />)

      const [row] = await screen.findAllByTestId('cancellable-pack')
      expect(row?.textContent).toContain('0 of 30 credits unused.')
      expect(row?.textContent).toContain('Refund €5.00, the whole price, until')
      expect(screen.getByTestId('withdrawals').textContent).toContain(
        'You can cancel a pack within 14 days of buying it.',
      )
      expect(screen.getByTestId('withdrawals').textContent).not.toContain(
        "haven't used",
      )

      fireEvent.click(screen.getByTestId('withdraw-link'))
      expect(screen.getByTestId('withdrawal-form').textContent).toContain(
        "We'll refund €5.00, the whole price, to the card or account you paid with.",
      )
    })

    it('says the whole price when its price is not on record', async () => {
      mocks.fetchWithdrawals.mockResolvedValue(
        answer({ packs: [{ ...OLD, unusedCredits: 10, refund: null }] }),
      )
      render(() => <PurchaseWithdrawals />)

      fireEvent.click(await screen.findByTestId('withdraw-link'))

      expect(screen.getByTestId('withdrawal-form').textContent).toContain(
        "We'll take the 10 unused credits off your balance and refund the whole price to the card or account you paid with.",
      )
    })
  })

  it('says what a refund by hand will be when the price is not on record', async () => {
    mocks.fetchWithdrawals.mockResolvedValue(
      answer({
        packs: [],
        statements: [
          statement({ refundStatus: 'manual', refundMinor: null }),
          statement({
            id: 'statement-2',
            refundStatus: 'manual',
            refundMinor: null,
            basis: 'full',
          }),
        ],
      }),
    )
    render(() => <PurchaseWithdrawals />)

    const list = await screen.findByRole('list', {
      name: 'Cancelled purchases',
    })
    expect(list.textContent).toContain(
      "We'll refund what you paid for those credits within 14 days.",
    )
    expect(list.textContent).toContain(
      "We'll refund what you paid within 14 days.",
    )
    expect(list.textContent).not.toContain('€0.00')
  })
})
