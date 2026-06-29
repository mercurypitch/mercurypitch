// ============================================================
// PricingPanel — plans + credit packs, driven by /api/billing/pricing
// ============================================================
// Prices come from the DB; an unset price renders as "Soon" and its Buy
// button is disabled. On-device separation stays free — this only sells
// faster server-side processing (see docs/plans/premium.md).

import type { Component } from 'solid-js'
import { createResource, For, Show } from 'solid-js'
import type { PricingPlan } from '@/db/services/billing-service'
import { fetchPricing, formatPrice, startCheckout, } from '@/db/services/billing-service'
import { showNotification } from '@/stores/notifications-store'
import styles from './PricingPanel.module.css'

const KOFI_URL = 'https://ko-fi.com/chaosmatters'

export const PricingPanel: Component = () => {
  const [pricing] = createResource(() => fetchPricing())

  async function buy(plan: PricingPlan): Promise<void> {
    try {
      const url = await startCheckout(plan.id)
      window.location.assign(url)
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Checkout failed',
        'error',
      )
    }
  }

  const hasBadge = (b: string | null): boolean => b != null && b !== ''

  return (
    <div class={styles.panel} data-testid="pricing-panel">
      <p class={styles.intro}>
        On-device separation is free forever. Credits only cover faster
        server-side processing — pricing is being finalised.
      </p>

      <Show when={pricing.loading}>
        <p class={styles.note}>Loading plans…</p>
      </Show>
      <Show when={pricing.error != null}>
        <p class={styles.note}>Pricing is unavailable right now.</p>
      </Show>
      <Show
        when={!pricing.loading && pricing.error == null && pricing() == null}
      >
        <p class={styles.note}>Pricing is coming soon.</p>
      </Show>

      <Show when={pricing()}>
        {(p) => (
          <>
            <Show when={p().tiers.length > 0}>
              <h4 class={styles.heading}>Separation speed</h4>
              <div class={styles.grid}>
                <For each={p().tiers}>
                  {(tier) => (
                    <div class={styles.card} data-testid="pricing-tier">
                      <div class={styles.cardHead}>
                        <span class={styles.label}>{tier.label}</span>
                        <Show when={hasBadge(tier.badge)}>
                          <span class={styles.badge}>{tier.badge}</span>
                        </Show>
                      </div>
                      <Show when={tier.description != null}>
                        <p class={styles.desc}>{tier.description}</p>
                      </Show>
                      <div
                        class={styles.price}
                        classList={{ [styles.soon]: tier.amount == null }}
                      >
                        {formatPrice(tier.amount, tier.currency)}
                        <Show
                          when={
                            tier.unit != null &&
                            tier.amount != null &&
                            tier.amount > 0
                          }
                        >
                          <span class={styles.unit}> / {tier.unit}</span>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={p().packs.length > 0}>
              <h4 class={styles.heading}>Credit packs</h4>
              <div class={styles.grid}>
                <For each={p().packs}>
                  {(pack) => (
                    <div class={styles.card} data-testid="pricing-pack">
                      <div class={styles.cardHead}>
                        <span class={styles.label}>{pack.label}</span>
                        <Show when={hasBadge(pack.badge)}>
                          <span class={styles.badge}>{pack.badge}</span>
                        </Show>
                      </div>
                      <div
                        class={styles.price}
                        classList={{ [styles.soon]: pack.amount == null }}
                      >
                        {formatPrice(pack.amount, pack.currency)}
                      </div>
                      <p class={styles.desc}>
                        {pack.credits != null
                          ? `${pack.credits} credits`
                          : 'Credits: Soon'}
                      </p>
                      <button
                        class={styles.buyBtn}
                        disabled={!pack.purchasable}
                        onClick={() => void buy(pack)}
                        data-testid="pricing-buy"
                      >
                        {pack.purchasable ? 'Buy' : 'Soon'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>

      <p class={styles.support}>
        Want to support development now?{' '}
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
          Buy me a coffee on Ko-fi
        </a>
        .
      </p>
    </div>
  )
}
