// ============================================================
// PricingPanel — plans + credit packs, driven by /api/billing/pricing
// ============================================================
// Prices come from the DB; an unset price renders as "Soon" and its Buy
// button is disabled. On-device separation stays free — this only sells
// faster server-side processing (see docs/plans/premium.md).

import type { Component } from 'solid-js'
import { createResource, For, Show } from 'solid-js'
import type { PricingPlan } from '@/db/services/billing-service'
import { fetchBillingMe, fetchPricing, formatPrice, formatTierPrice, isTierSoon, startCheckout, } from '@/db/services/billing-service'
import type { UvrProcessingMode, UvrQualityModel } from '@/stores/app-store'
import { setUvrProcessingMode, setUvrQualityModel, uvrProcessingMode, uvrQualityModel, } from '@/stores/app-store'
import { balanceVersion } from '@/stores/billing-store'
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
  // Credit balance for the signed-in user (null when logged out / no cloud).
  // Keyed on balanceVersion (+1 so the initial 0 still fetches): bumping it
  // after a checkout return re-fetches without remounting the panel.
  const [me] = createResource(
    () => balanceVersion() + 1,
    () => fetchBillingMe(),
  )

  // Reading an errored resource accessor re-throws into the render tree,
  // which crashed Settings to the error screen whenever the billing API was
  // unreachable (e.g. local dev without the db-worker running). Only touch
  // the accessor once the resource settled without error; the error itself
  // renders as the friendly "unavailable" note below.
  const loadedPricing = () =>
    !pricing.loading && pricing.error == null ? pricing() : undefined

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

  // The tier cards double as the processing-default picker: clicking
  // On-device or Server (GPU) selects where separation runs (persisted —
  // the Karaoke page mode toggle uses the same signal and stays in sync).
  // Server (CPU) has no endpoint yet, so its card is not selectable.
  const tierMode = (id: string): UvrProcessingMode | null =>
    id === 'tier-ondevice'
      ? 'local'
      : id === 'tier-runpod-gpu'
        ? 'server'
        : null
  const tierSelected = (tier: PricingPlan): boolean =>
    tierMode(tier.id) === uvrProcessingMode()
  const selectTier = (tier: PricingPlan): void => {
    const mode = tierMode(tier.id)
    if (mode !== null) setUvrProcessingMode(mode)
  }

  // Server quality chips (shown while Server GPU is selected). Costs come
  // from the same pricing payload (tier base × model multiplier).
  const QUALITY_OPTIONS: {
    model: UvrQualityModel
    label: string
    hint: string
  }[] = [
    {
      model: 'roformer',
      label: 'High Quality',
      hint: 'cleanest vocals, takes longer',
    },
    { model: 'mdx', label: 'Basic', hint: 'faster, slightly more bleed' },
  ]

  return (
    <div class={styles.panel} data-testid="pricing-panel">
      <Show when={me()}>
        {(m) => (
          <div class={styles.balanceRow} data-testid="credit-balance">
            <span class={styles.balanceLabel}>Your credits</span>
            <span class={styles.balanceValue}>{m().creditBalance}</span>
          </div>
        )}
      </Show>
      <p class={styles.intro}>
        On-device separation is free forever. Credits only cover faster
        server-side processing.
      </p>

      <Show when={pricing.loading}>
        <p class={styles.note}>Loading credit options…</p>
      </Show>
      <Show when={pricing.error != null}>
        <p class={styles.note}>Credit options are unavailable right now.</p>
      </Show>
      <Show
        when={
          !pricing.loading && pricing.error == null && loadedPricing() == null
        }
      >
        <p class={styles.note}>Credit packs are coming soon.</p>
      </Show>

      <Show when={loadedPricing()}>
        {(p) => (
          <>
            <Show when={p().tiers.length > 0}>
              <h4 class={styles.heading}>Processing — pick your default</h4>
              <div class={styles.grid}>
                <For each={p().tiers}>
                  {(tier, i) => (
                    <button
                      type="button"
                      class={styles.card}
                      classList={{
                        [styles.cardSelectable]: tierMode(tier.id) !== null,
                        [styles.cardSelected]: tierSelected(tier),
                        [styles.cardDisabled]: tierMode(tier.id) === null,
                      }}
                      disabled={tierMode(tier.id) === null}
                      aria-pressed={tierSelected(tier)}
                      onClick={() => selectTier(tier)}
                      data-testid={`pricing-tier-${tier.id}`}
                      title={
                        tierMode(tier.id) === null
                          ? `${tier.label} is coming soon`
                          : `Use ${tier.label} for vocal separation`
                      }
                      style={cardVars(i())}
                    >
                      <div class={styles.cardHead}>
                        <span class={styles.label}>{tier.label}</span>
                        <Show
                          when={tierSelected(tier)}
                          fallback={
                            <Show when={hasBadge(tier.badge)}>
                              <span class={styles.badge}>{tier.badge}</span>
                            </Show>
                          }
                        >
                          <span class={styles.selectedTag}>
                            <svg
                              viewBox="0 0 24 24"
                              width="10"
                              height="10"
                              aria-hidden="true"
                            >
                              <path
                                fill="none"
                                stroke="currentColor"
                                stroke-width="4"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M4 12.5l5.5 5.5L20 6.5"
                              />
                            </svg>
                            Selected
                          </span>
                        </Show>
                      </div>
                      <Show when={tier.description != null}>
                        <p class={styles.desc}>{tier.description}</p>
                      </Show>
                      <div
                        class={styles.price}
                        classList={{ [styles.soon]: isTierSoon(tier) }}
                      >
                        {formatTierPrice(tier)}
                        <Show
                          when={
                            tier.unit != null &&
                            (tier.credits != null ||
                              (tier.amount != null && tier.amount > 0))
                          }
                        >
                          <span class={styles.unit}> / {tier.unit}</span>
                        </Show>
                      </div>
                    </button>
                  )}
                </For>
              </div>

              <Show when={uvrProcessingMode() === 'server'}>
                <div
                  class={styles.qualityRow}
                  data-testid="settings-uvr-quality"
                >
                  <span class={styles.qualityLabel}>Server quality</span>
                  <For each={QUALITY_OPTIONS}>
                    {(opt) => {
                      const cost = () => p().uvrModelCredits?.[opt.model]
                      return (
                        <button
                          type="button"
                          class={styles.qualityChip}
                          classList={{
                            [styles.qualityChipActive]:
                              uvrQualityModel() === opt.model,
                          }}
                          aria-pressed={uvrQualityModel() === opt.model}
                          onClick={() => setUvrQualityModel(opt.model)}
                          title={`${opt.label} — ${opt.hint}`}
                          data-testid={`settings-uvr-quality-${opt.model}`}
                        >
                          {opt.label}
                          <Show when={cost() != null && (cost() as number) > 0}>
                            <span class={styles.qualityCost}>
                              {` · ${cost()} credit${cost() === 1 ? '' : 's'}`}
                            </span>
                          </Show>
                        </button>
                      )
                    }}
                  </For>
                </div>
              </Show>
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
