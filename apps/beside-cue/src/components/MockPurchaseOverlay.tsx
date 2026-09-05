// ============================================================
// Internal beta store — explicit simulation, never a real purchase sheet
// ============================================================

import type { Accessor } from 'solid-js'
import { For, Match, onMount, Show, Switch } from 'solid-js'
import { useCopy } from '@/i18n/ui-copy'
import type { MockPurchaseRequest } from '@/purchases/mock-purchases'

interface MockPurchaseOverlayProps {
  request: () => MockPurchaseRequest | undefined
  name: string
}

/**
 * Stands in for RevenueCat's native paywall and Customer Center so the Pro loop
 * is walkable in a browser or internal beta. Deliberately labelled as a mock: it must never be
 * mistaken for the real purchase sheet in a screenshot.
 */
export function MockPurchaseOverlay(props: MockPurchaseOverlayProps) {
  return (
    <Show when={props.request()}>
      {(request) => <MockPurchaseDialog request={request} name={props.name} />}
    </Show>
  )
}

function MockPurchaseDialog(props: {
  request: Accessor<MockPurchaseRequest>
  name: string
}) {
  const copy = useCopy()
  let dialog!: HTMLDivElement
  const request = () => props.request()
  const buttons = () => [
    ...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
  ]
  onMount(() => buttons()[0]?.focus())
  return (
    <div
      ref={dialog}
      class="mock-store"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-store-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          request().choose({ kind: 'cancel' })
        } else if (event.key === 'Tab') {
          const targets = buttons()
          const first = targets[0]
          const last = targets.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }
      }}
    >
      <div class="mock-store__panel">
        <p class="mock-store__badge">{copy.t('Test purchases — no charge')}</p>
        <h2 id="mock-store-title">
          {request().kind === 'redeem-code'
            ? copy.t('Test a premium offer')
            : request().kind === 'paywall'
              ? copy.t('Unlock {name}', { name: props.name })
              : copy.t('Manage subscription')}
        </h2>

        <Switch>
          <Match when={request().kind === 'redeem-code'}>
            <p>
              {copy.t(
                'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.',
              )}
            </p>
            <button
              class="secondary-button"
              type="button"
              onClick={() => request().choose({ kind: 'redeem-offer' })}
            >
              {copy.t('Apply a 60-day test offer')}
            </button>
          </Match>
          <Match when={request().kind === 'customer-center'}>
            <div class="mock-store__actions">
              <button
                class="secondary-button"
                type="button"
                onClick={() => request().choose({ kind: 'stop-renewal' })}
              >
                {copy.t('Turn off renewal')}
              </button>
              <button
                class="secondary-button"
                type="button"
                onClick={() => request().choose({ kind: 'billing-issue' })}
              >
                {copy.t('Simulate a billing problem')}
              </button>
              <button
                class="secondary-button"
                type="button"
                onClick={() => request().choose({ kind: 'expire' })}
              >
                {copy.t('Expire the entitlement')}
              </button>
            </div>
          </Match>
          <Match when={request().kind === 'paywall'}>
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
          </Match>
        </Switch>

        <button
          class="text-button"
          type="button"
          onClick={() => request().choose({ kind: 'cancel' })}
        >
          {copy.t('Close without changing anything')}
        </button>
      </div>
    </div>
  )
}
