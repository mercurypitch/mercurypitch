import { For, Show } from 'solid-js'
import type { MockPurchaseRequest } from '@/purchases/mock-purchases'

interface MockPurchaseOverlayProps {
  request: () => MockPurchaseRequest | undefined
  name: string
}

/**
 * Stands in for RevenueCat's native paywall and Customer Center so the Pro loop
 * is walkable in a browser. Deliberately labelled as a mock: it must never be
 * mistaken for the real purchase sheet in a screenshot.
 */
export function MockPurchaseOverlay(props: MockPurchaseOverlayProps) {
  return (
    <Show when={props.request()}>
      {(request) => (
        <div
          class="mock-store"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mock-store-title"
        >
          <div class="mock-store__panel">
            <p class="mock-store__badge">Mock store — development only</p>
            <h2 id="mock-store-title">
              {request().kind === 'paywall'
                ? `Unlock ${props.name}`
                : 'Manage subscription'}
            </h2>

            <Show
              when={request().kind === 'paywall'}
              fallback={
                <div class="mock-store__actions">
                  <button
                    class="secondary-button"
                    type="button"
                    onClick={() => request().choose({ kind: 'stop-renewal' })}
                  >
                    Turn off renewal
                  </button>
                  <button
                    class="secondary-button"
                    type="button"
                    onClick={() => request().choose({ kind: 'billing-issue' })}
                  >
                    Simulate a billing problem
                  </button>
                  <button
                    class="secondary-button"
                    type="button"
                    onClick={() => request().choose({ kind: 'expire' })}
                  >
                    Expire the entitlement
                  </button>
                </div>
              }
            >
              <ul class="mock-store__plans">
                <For each={request().plans}>
                  {(plan) => (
                    <li>
                      <button
                        class="mock-store__plan"
                        type="button"
                        onClick={() => request().choose({ kind: 'buy', plan })}
                      >
                        <span class="mock-store__plan-title">{plan.title}</span>
                        <span class="mock-store__plan-price">
                          {plan.priceText}
                        </span>
                        <span class="mock-store__plan-note">
                          {plan.description}
                        </span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <button
              class="text-button"
              type="button"
              onClick={() => request().choose({ kind: 'cancel' })}
            >
              Close without changing anything
            </button>
          </div>
        </div>
      )}
    </Show>
  )
}
