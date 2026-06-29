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

// Distinct, subtle per-card accent hues, cycled by card position. Drive the
// gradient tint, colored outline and animated sheen; kept theme-adaptive via
// color-mix() against the surface in PricingPanel.module.css.
const CARD_ACCENTS = [
  '#5b8def', // blue
  '#28c2a8', // teal
  '#b57bf0', // violet
  '#f2a64d', // amber
  '#ef6f9b', // rose
  '#5fc97a', // green
]

const cardVars = (index: number, offset = 0): Record<string, string> => ({
  '--card-accent': CARD_ACCENTS[(index + offset) % CARD_ACCENTS.length],
  // Negative stagger so the row's sheen ripples left → right from the start.
  '--sheen-delay': `${-index * 0.9}s`,
})

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
                  {(tier, i) => (
                    <div
                      class={styles.card}
                      data-testid="pricing-tier"
                      style={cardVars(i())}
                    >
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
                  {(pack, i) => (
                    <div
                      class={styles.card}
                      data-testid="pricing-pack"
                      style={cardVars(i(), 3)}
                    >
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

      <div class={styles.supportRow}>
        <a
          class={styles.supportBtn}
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="pricing-support"
          aria-label="Support development on Ko-fi"
        >
          <svg
            class={styles.supportHeart}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span>Support development</span>
        </a>
      </div>
    </div>
  )
}
