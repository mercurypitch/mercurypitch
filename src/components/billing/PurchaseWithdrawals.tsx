// ============================================================
// PurchaseWithdrawals — "Withdraw from contract here" in Settings › Credits
// ============================================================
//
// The withdrawal function EU law asks of an online seller (CRD Art. 11a):
// each credit pack that can still be cancelled, with a link to cancel it;
// the form names the buyer, the purchase and where the confirmation goes;
// "Confirm withdrawal" sends the statement
// (workers/db-worker/src/withdrawal.ts), and the panel says it arrived,
// whatever the refund then does. It says the confirmation email went only
// once it has, and the refund went back only once Stripe finished it. A
// pack keeps the terms its own checkout
// recorded, so the panel asks whatever WITHDRAWAL_MODE says now, and shows
// only while there is something to show, at the top of the Credits tab,
// where the purchase mail sends the buyer.
//
// The labels are the ones the law and the lawyer's draft use, from
// withdrawal-wording.ts.

import type { Component } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import type { CancellablePack, WithdrawalStatement, } from '@/db/services/billing-service'
import { fetchWithdrawals, formatPrice, submitWithdrawal, } from '@/db/services/billing-service'
import { balanceVersion, refreshBalance } from '@/stores/billing-store'
import { CONFIRM_WITHDRAWAL_LABEL, WITHDRAW_LINK_LABEL, WITHDRAWAL_RECEIVED, } from '../../../workers/db-worker/src/withdrawal-wording'
import styles from './PurchaseWithdrawals.module.css'

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

/** What cancelling the pack refunds. A pack with no consent on record
 *  refunds the whole price. */
function refundOf(pack: CancellablePack): string {
  const money =
    pack.refund === null
      ? null
      : formatPrice(pack.refund.amountMinor, pack.refund.currency)
  if (pack.basis === 'full') {
    return money === null ? 'the whole price' : `${money}, the whole price`
  }
  return money ?? 'the price of those credits'
}

/** What leaves the balance with the pack, or null when nothing is left. */
function creditsTaken(pack: CancellablePack): string | null {
  const bonus = plural(pack.bonusCredits, 'bonus credit', 'bonus credits')
  if (pack.unusedCredits === 0) {
    return pack.bonusCredits > 0 ? `the ${bonus} that came with it` : null
  }
  const credits = plural(pack.unusedCredits, 'unused credit', 'unused credits')
  return pack.bonusCredits > 0
    ? `the ${credits} and the ${bonus} that came with it`
    : `the ${credits}`
}

/** What confirming does, said before the button. */
function consequence(pack: CancellablePack): string {
  const taken = creditsTaken(pack)
  const take = taken === null ? '' : `take ${taken} off your balance and `
  // "refund €5.00, the whole price, to the card": the aside takes both
  // commas.
  const aside = pack.basis === 'full' && pack.refund !== null ? ',' : ''
  return `We'll ${take}refund ${refundOf(pack)}${aside} to the card or account you paid with.`
}

/** Whether the confirmation email went. Only a sent one is called sent,
 *  and only one still being tried promises another try. */
function confirmationState(statement: WithdrawalStatement): string {
  switch (statement.mailStatus) {
    case 'sent':
      return `We've sent a confirmation to ${statement.email}.`
    case 'refused':
    case 'gave-up':
      return `We couldn't email this confirmation to ${statement.email}. Your cancellation still counts, and we'll contact you about it.`
    default:
      return `Your confirmation email to ${statement.email} hasn't gone out yet. We'll keep trying.`
  }
}

/** Where the refund of a statement stands. */
function refundState(statement: WithdrawalStatement): string {
  const money =
    statement.refundMinor === null
      ? null
      : formatPrice(statement.refundMinor, statement.currency)
  switch (statement.refundStatus) {
    case 'refunded':
      // Stripe has the refund; only once it succeeded has the money gone.
      if (statement.stripeRefundStatus !== 'succeeded') {
        return `We've started a refund of ${money ?? 'what you paid'} to the card or account you paid with.`
      }
      return `${money ?? 'Your refund'} refunded to the card or account you paid with.`
    case 'none':
      return 'There was nothing left to refund.'
    default:
      if (money !== null) return `We'll refund ${money} within 14 days.`
      return statement.basis === 'full'
        ? "We'll refund what you paid within 14 days."
        : "We'll refund what you paid for those credits within 14 days."
  }
}

export const PurchaseWithdrawals: Component = () => {
  const [data, { refetch }] = createResource(
    () => (accountHeld() ? balanceVersion() + 1 : false),
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
                {confirmationState(statement())} {refundState(statement())}
              </p>
            </div>
          )}
        </Show>

        <Show when={packs().length > 0}>
          <p class={styles.text}>
            <Show
              when={packs().every((pack) => pack.basis === 'unused')}
              fallback="You can cancel a pack within 14 days of buying it."
            >
              You can cancel a pack within 14 days of buying it and get back the
              price of the credits you haven't used.
            </Show>
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
