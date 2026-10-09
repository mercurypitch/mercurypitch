// ============================================================
// PurchaseWithdrawals — "Withdraw from contract here" in Settings › Credits
// ============================================================
//
// The withdrawal function EU law asks of an online seller (CRD Art. 11a):
// each credit pack bought in the last 14 days that still holds unused paid
// credits, with a link to cancel it; the form names the buyer, the purchase
// and where the confirmation goes; "Confirm withdrawal" sends the statement
// (workers/db-worker/src/withdrawal.ts), and the panel says it arrived,
// whatever the refund then does. It shows only under WITHDRAWAL_MODE
// refund_unused and only while there is something to show, at the top of
// the Credits tab, where the purchase mail sends the buyer.
//
// The labels are the ones the law and the lawyer's draft use, from
// withdrawal-wording.ts.

import type { Component } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import type { CancellablePack, WithdrawalStatement, } from '@/db/services/billing-service'
import { fetchWithdrawals, formatPrice, submitWithdrawal, } from '@/db/services/billing-service'
import { balanceVersion, refreshBalance } from '@/stores/billing-store'
import type { WithdrawalMode } from '../../../workers/db-worker/src/withdrawal-wording'
import { CONFIRM_WITHDRAWAL_LABEL, WITHDRAW_LINK_LABEL, WITHDRAWAL_RECEIVED, } from '../../../workers/db-worker/src/withdrawal-wording'
import styles from './PurchaseWithdrawals.module.css'

export interface PurchaseWithdrawalsProps {
  /** The model the packs are sold under, from GET /api/billing/pricing. */
  mode: WithdrawalMode
}

/** "3 November 2026", for an ISO time or a YYYY-MM-DD day. */
function longDate(value: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`

function refundOf(pack: CancellablePack): string {
  return pack.refund === null
    ? 'the price of those credits'
    : formatPrice(pack.refund.amountMinor, pack.refund.currency)
}

/** What confirming does, said before the button. */
function consequence(pack: CancellablePack): string {
  const credits = plural(pack.unusedCredits, 'unused credit', 'unused credits')
  const bonus =
    pack.bonusCredits > 0
      ? ` and the ${plural(pack.bonusCredits, 'bonus credit', 'bonus credits')} that came with it`
      : ''
  return `We'll take the ${credits}${bonus} off your balance and refund ${refundOf(pack)} to the card or account you paid with.`
}

/** Where the refund of a statement stands. */
function refundState(statement: WithdrawalStatement): string {
  const money = formatPrice(statement.refundMinor, statement.currency)
  switch (statement.refundStatus) {
    case 'refunded':
      return `${money} refunded to the card or account you paid with.`
    case 'none':
      return 'There was nothing left to refund.'
    default:
      return `We'll refund ${money} within 14 days.`
  }
}

export const PurchaseWithdrawals: Component<PurchaseWithdrawalsProps> = (
  props,
) => {
  const [data, { refetch }] = createResource(
    () =>
      props.mode === 'refund_unused' && accountHeld()
        ? balanceVersion() + 1
        : false,
    () => fetchWithdrawals(),
  )
  const loaded = () =>
    !data.loading && data.error == null ? (data() ?? null) : null
  const packs = (): CancellablePack[] => loaded()?.packs ?? []
  const statements = (): WithdrawalStatement[] => loaded()?.statements ?? []

  const [chosen, setChosen] = createSignal<string | null>(null)
  const [name, setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [received, setReceived] = createSignal<WithdrawalStatement | null>(null)

  const chosenPack = createMemo(
    () => packs().find((pack) => pack.purchaseId === chosen()) ?? null,
  )

  function open(pack: CancellablePack): void {
    setChosen(pack.purchaseId)
    setEmail((current) => (current === '' ? (loaded()?.email ?? '') : current))
    setError(null)
    setReceived(null)
  }

  async function confirm(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const pack = chosenPack()
    if (pack === null || busy()) return
    setBusy(true)
    setError(null)
    try {
      const answer = await submitWithdrawal({
        purchaseId: pack.purchaseId,
        name: name().trim(),
        email: email().trim(),
      })
      setReceived(answer.statement)
      setChosen(null)
      refreshBalance()
      void refetch()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't send it. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  const visible = (): boolean =>
    packs().length > 0 || statements().length > 0 || received() !== null

  return (
    <Show when={visible()}>
      <section
        class={styles.card}
        aria-labelledby="withdrawals-title"
        data-testid="withdrawals"
      >
        <h4 id="withdrawals-title" class={styles.title}>
          Cancel a credit purchase
        </h4>

        <Show when={received()}>
          {(statement) => (
            <div
              class={styles.received}
              role="status"
              data-testid="withdrawal-received"
            >
              <p class={styles.receivedTitle}>{WITHDRAWAL_RECEIVED}</p>
              <p class={styles.text}>
                We've sent a confirmation to {statement().email}.{' '}
                {refundState(statement())}
              </p>
            </div>
          )}
        </Show>

        <Show when={packs().length > 0}>
          <p class={styles.text}>
            You can cancel a pack within 14 days of buying it and get back the
            price of the credits you haven't used.
          </p>
          <ul class={styles.list}>
            <For each={packs()}>
              {(pack) => (
                <li class={styles.row} data-testid="cancellable-pack">
                  <div class={styles.rowText}>
                    <span class={styles.rowTitle}>
                      {pack.packLabel} pack, bought {longDate(pack.purchasedAt)}
                    </span>
                    <span class={styles.rowSub}>
                      {pack.unusedCredits} of {pack.paidCredits} credits unused.
                      Refund {refundOf(pack)}, until {longDate(pack.deadline)}.
                    </span>
                  </div>
                  <button
                    type="button"
                    class={styles.link}
                    aria-expanded={chosen() === pack.purchaseId}
                    onClick={() => open(pack)}
                    data-testid="withdraw-link"
                  >
                    {WITHDRAW_LINK_LABEL}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={chosenPack()}>
          {(pack) => (
            <form
              class={styles.form}
              onSubmit={(event) => void confirm(event)}
              data-testid="withdrawal-form"
            >
              <label class={styles.field}>
                <span class={styles.label}>Your name</span>
                <input
                  class={styles.input}
                  type="text"
                  autocomplete="name"
                  required
                  maxLength={200}
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  data-testid="withdrawal-name"
                />
              </label>
              <label class={styles.field}>
                <span class={styles.label}>Purchase</span>
                <select
                  class={styles.input}
                  value={pack().purchaseId}
                  onChange={(e) => setChosen(e.currentTarget.value)}
                  data-testid="withdrawal-purchase"
                >
                  <For each={packs()}>
                    {(option) => (
                      <option value={option.purchaseId}>
                        {option.packLabel} pack,{' '}
                        {plural(option.paidCredits, 'credit', 'credits')},
                        bought {longDate(option.purchasedAt)}
                      </option>
                    )}
                  </For>
                </select>
              </label>
              <label class={styles.field}>
                <span class={styles.label}>Email for the confirmation</span>
                <input
                  class={styles.input}
                  type="email"
                  autocomplete="email"
                  required
                  maxLength={254}
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  data-testid="withdrawal-email"
                />
              </label>
              <p class={styles.text}>{consequence(pack())}</p>
              <Show when={error()}>
                {(message) => (
                  <p class={styles.error} role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <div class={styles.actions}>
                <button
                  type="submit"
                  class={styles.confirm}
                  disabled={busy()}
                  data-testid="confirm-withdrawal"
                >
                  {CONFIRM_WITHDRAWAL_LABEL}
                </button>
                <button
                  type="button"
                  class={styles.secondary}
                  onClick={() => setChosen(null)}
                >
                  Keep my purchase
                </button>
              </div>
            </form>
          )}
        </Show>

        <Show when={statements().length > 0}>
          <ul class={styles.history} aria-label="Cancelled purchases">
            <For each={statements()}>
              {(statement) => (
                <li class={styles.rowSub}>
                  {statement.packLabel} pack cancelled on{' '}
                  {longDate(statement.submittedAt)}. {refundState(statement)}
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </Show>
  )
}
