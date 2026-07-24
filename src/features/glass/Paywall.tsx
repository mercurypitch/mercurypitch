// ============================================================
// Paywall — RevenueCat offering renderer.
//
// A minimal, on-brand paywall driven by the `current` offering. It is a
// deliberate placeholder for RevenueCat's remote-configurable Paywalls (v2),
// which we can swap in once the dashboard offering + entitlement exist — the
// purchase/restore wiring below stays the same.
// ============================================================

import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { offering, purchase, ready, restore } from '@/lib/monetization/revenuecat'
import './paywall.css'

export const Paywall: Component<{ onClose: () => void }> = (props) => {
  const [busy, setBusy] = createSignal(false)

  const buy = async (pkg: PurchasesPackage): Promise<void> => {
    setBusy(true)
    const ok = await purchase(pkg)
    setBusy(false)
    if (ok) props.onClose()
  }

  const doRestore = async (): Promise<void> => {
    setBusy(true)
    const ok = await restore()
    setBusy(false)
    if (ok) props.onClose()
  }

  return (
    <div class="pw-overlay" role="dialog" aria-modal="true" aria-label="Break Glass Pro">
      <div class="pw-card">
        <h2 class="pw-title">
          Break Glass <span>Pro</span>
        </h2>
        <p class="pw-sub">
          Unlock every level, all cosmic glass, and unlimited attempts.
        </p>

        <Show
          when={ready() && offering()}
          fallback={<p class="pw-loading">Loading plans…</p>}
        >
          <div class="pw-packages">
            <For each={offering()!.availablePackages}>
              {(pkg) => (
                <button
                  class="pw-buy"
                  disabled={busy()}
                  onClick={() => void buy(pkg)}
                >
                  <span class="pw-buy-title">{pkg.product.title}</span>
                  <span class="pw-buy-price">{pkg.product.priceString}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <button class="pw-restore" disabled={busy()} onClick={() => void doRestore()}>
          Restore purchases
        </button>
        <button class="pw-close" onClick={() => props.onClose()}>
          Not now
        </button>
      </div>
    </div>
  )
}
