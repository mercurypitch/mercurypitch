// ============================================================
// DonatePanel — supporter donation tiers, driven by /api/billing/pricing
// ============================================================
// One-time donations that grant a time-boxed `supporter` entitlement. They
// keep every core singing and practice tool free while adding optional art,
// recognition and early access to experimental Lab tools as a thank-you.
//
// The "Other amount" card carries no price of its own: its Stripe price uses
// custom_unit_amount, so the donor types the figure on Stripe's own page and
// Stripe enforces the min/max. Nothing here ever handles a client-supplied
// amount.

import type { Component } from 'solid-js'
import { createResource, For, onMount, Show } from 'solid-js'
import { SupporterBadge } from '@/components/billing/SupporterBadge'
import { fetchMe, restoreAuth } from '@/db/services/auth-service'
import type { PricingPlan } from '@/db/services/billing-service'
import { fetchBillingMe, fetchPricing, formatPrice, formatSupportDuration, startCheckout, supporterEntitlement, supporterPlanId, } from '@/db/services/billing-service'
import { trackEvent } from '@/lib/analytics'
import { GITHUB_SPONSORS_URL, KOFI_URL, SPONSORS_LIVE, } from '@/lib/contact-links'
import { balanceVersion } from '@/stores/billing-store'
import { showNotification } from '@/stores/notifications-store'
import styles from './DonatePanel.module.css'

// Warmer accents than the credit cards, cycled by position — donations should
// not read as another row of products.
const DONATE_ACCENTS = ['#ef6f9b', '#f2a64d', '#b57bf0', '#28c2a8']

const cardVars = (index: number): Record<string, string> => ({
  '--card-accent': DONATE_ACCENTS[index % DONATE_ACCENTS.length],
})

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 12.5l5.5 5.5L20 6.5"
      />
    </svg>
  )
}

export const DonatePanel: Component = () => {
  onMount(() => trackEvent('donate_view'))
  const [pricing] = createResource(() => fetchPricing())
  // Keyed on balanceVersion like the credits panel, so returning from a
  // donation re-reads the entitlement without remounting.
  const [me] = createResource(
    () => balanceVersion() + 1,
    () => fetchBillingMe(),
  )
  // Anonymous accounts cannot check out (the worker 403s them, deliberately:
  // a receipt needs a real identity), so ask them to upgrade before they hit
  // a dead button.
  const [account] = createResource(async () => {
    // Restore only: browsing the donate panel is a read and must not mint
    // an identity under the lazy-auth model. startCheckout() calls
    // requireAuth() itself, so the write path still self-provisions.
    await restoreAuth()
    return fetchMe()
  })

  // Reading an errored resource accessor re-throws into the render tree — the
  // same trap PricingPanel documents. Only touch it once it settled cleanly.
  const donations = (): PricingPlan[] =>
    !pricing.loading && pricing.error == null
      ? (pricing()?.donations ?? [])
      : []

  const isUpgraded = (): boolean => {
    const provider = account()?.user.authProvider
    return provider === 'password' || provider === 'google'
  }
  const isManagedTestAccount = (): boolean =>
    account()?.user.isTestAccount === true
  const supporter = () => supporterEntitlement(me() ?? null)

  async function donate(plan: PricingPlan): Promise<void> {
    try {
      const url = await startCheckout(plan.id)
      trackEvent('donate_start')
      window.location.assign(url)
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Could not start the donation',
        'error',
      )
    }
  }

  /** A custom amount only sets the FLOOR — the grant scales with what is
   *  actually paid, so "1 month" alone would undersell a generous donation. */
  const durationLabel = (plan: PricingPlan): string => {
    const base = formatSupportDuration(plan.entitlementDays ?? null)
    if (base === '') return ''
    return plan.customAmount === true ? `From ${base}` : base
  }

  const priceLabel = (plan: PricingPlan): string => {
    if (plan.customAmount === true) {
      return plan.purchasable ? 'You choose' : 'Soon'
    }
    return formatPrice(plan.amount, plan.currency)
  }

  return (
    <div class={styles.panel} data-testid="donate-panel">
      <h4 class={styles.heading}>Not here for credits? Support the work</h4>
      <p class={styles.intro}>
        Core singing and practice tools stay free. Supporter status funds the
        work and adds optional backgrounds, recognition and early Lab access.
      </p>

      <Show when={supporter()}>
        {(grant) => (
          <div data-testid="donate-supporter-note">
            <SupporterBadge
              planId={supporterPlanId(grant())}
              label={grant().sourceLabel}
              expiresAt={grant().expiresAt}
              verbose
            />
          </div>
        )}
      </Show>

      <Show when={pricing.loading}>
        <p class={styles.note}>Loading support options…</p>
      </Show>
      <Show when={!pricing.loading && donations().length === 0}>
        <p class={styles.note}>Supporter tiers are coming soon.</p>
      </Show>

      <Show when={donations().length > 0}>
        <div class={styles.grid}>
          <For each={donations()}>
            {(plan, i) => (
              <div
                class={styles.card}
                data-testid="donate-tier"
                style={cardVars(i())}
              >
                <div class={styles.cardHead}>
                  <span class={styles.label}>{plan.label}</span>
                  <Show when={plan.badge != null && plan.badge !== ''}>
                    <span class={styles.badge}>{plan.badge}</span>
                  </Show>
                </div>
                <div
                  class={styles.price}
                  classList={{ [styles.soon]: !plan.purchasable }}
                >
                  {priceLabel(plan)}
                </div>
                <Show when={durationLabel(plan) !== ''}>
                  <span class={styles.duration}>{durationLabel(plan)}</span>
                </Show>
                <Show when={(plan.perks ?? []).length > 0}>
                  <ul class={styles.perks}>
                    <For each={plan.perks}>
                      {(perk) => (
                        <li class={styles.perk}>
                          <CheckIcon />
                          <span>{perk}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
                <Show
                  when={isUpgraded()}
                  fallback={
                    <a
                      class={styles.donateBtn}
                      href="#/settings/account"
                      data-testid="donate-signin"
                    >
                      Create an account
                    </a>
                  }
                >
                  <button
                    class={styles.donateBtn}
                    disabled={!plan.purchasable || isManagedTestAccount()}
                    onClick={() => void donate(plan)}
                    data-testid="donate-button"
                  >
                    {!plan.purchasable
                      ? 'Soon'
                      : isManagedTestAccount()
                        ? 'Managed account'
                        : 'Donate'}
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class={styles.altRow}>
        <a
          class={styles.altLink}
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="donate-kofi"
        >
          <HeartIcon />
          <span>Ko-fi</span>
        </a>
        <Show when={SPONSORS_LIVE}>
          <a
            class={styles.altLink}
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="donate-sponsors"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
              />
            </svg>
            <span>GitHub Sponsors</span>
          </a>
        </Show>
      </div>
      <p class={styles.altNote}>
        Supporter perks are applied automatically only for donations made here —
        the other channels cannot tell the app who you are.
      </p>
    </div>
  )
}
