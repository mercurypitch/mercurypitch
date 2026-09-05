import type { EntitlementStatus } from '@irchiinnuss/mobile-runtime'
import { Show, untrack } from 'solid-js'
import { message } from '@/i18n/messages'
import { Selectable } from '@/interaction/selection'
import type { ProAccessStatus } from '@/purchases/pro-access'
import styles from './ProSection.module.css'

interface ProSectionProps {
  name: string
  available: boolean
  status: ProAccessStatus
  isPro: boolean
  entitlement?: EntitlementStatus
  busy: boolean
  notice?: string
  error?: string
  locale: string
  onUpgrade: (() => void) | (() => Promise<unknown>)
  onManage: (() => void) | (() => Promise<unknown>)
  onRestore: () => void
  platform?: 'web' | 'ios' | 'android'
  mock?: boolean
  supportId?: string
  onRedeemCode?: (() => void) | (() => Promise<unknown>)
  onCheckAccess?: () => void
  onExternalRedemption?: () => void
}

function formatDate(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function renewalNote(entitlement: EntitlementStatus, locale: string): string {
  if (entitlement.expiresAt === null) return 'Yours for good.'
  const date = formatDate(entitlement.expiresAt, locale)
  return entitlement.willRenew ? `Renews ${date}.` : `Active until ${date}.`
}

export function ProSection(props: ProSectionProps) {
  async function openSheet(
    trigger: HTMLButtonElement,
    action: (() => void) | (() => Promise<unknown>),
  ) {
    try {
      await action()
    } finally {
      // Capture the trigger before busy disables it and the browser drops focus.
      if (trigger.isConnected) trigger.focus()
    }
  }

  return (
    <section class="settings-group" aria-labelledby="pro-settings-title">
      <div class="settings-group__heading">
        <div>
          <p class="screen-kicker">Support</p>
          <h2 id="pro-settings-title">{props.name}</h2>
        </div>
        <Show when={props.isPro}>
          <strong>Active</strong>
        </Show>
      </div>

      <Show when={props.mock}>
        <p class="settings-group__intro">{message('purchases.betaNotice')}</p>
      </Show>

      <Show
        when={props.available}
        fallback={
          <p class="settings-group__intro">
            {props.error ?? 'Purchases need the Android or iOS app.'}
          </p>
        }
      >
        <Show
          when={props.status !== 'loading'}
          fallback={
            <p class="settings-group__intro" role="status">
              Checking your purchases…
            </p>
          }
        >
          <Show
            when={props.isPro ? props.entitlement : undefined}
            fallback={
              <p class="settings-group__intro">
                The six original Pulls, your own words, and the cue loop stay
                free. {props.name} unlocks the extra character cast and supports
                the work.
              </p>
            }
          >
            {(entitlement) => (
              <p class="settings-group__intro">
                Thank you for supporting Beside Cue.{' '}
                {renewalNote(entitlement(), props.locale)}
              </p>
            )}
          </Show>

          <Show when={props.entitlement?.billingIssueDetectedAt != null}>
            <p class="schedule-status schedule-status--error" role="alert">
              The store could not take the last payment. Manage your
              subscription to keep {props.name} active.
            </p>
          </Show>

          <div class="pro-actions">
            <Show
              when={props.isPro}
              fallback={
                <button
                  class="secondary-button"
                  type="button"
                  disabled={props.busy}
                  onClick={(event) =>
                    void openSheet(event.currentTarget, props.onUpgrade)
                  }
                >
                  {props.busy ? 'Opening…' : `Unlock ${props.name}`}
                </button>
              }
            >
              <button
                class="secondary-button"
                type="button"
                disabled={props.busy}
                onClick={(event) =>
                  void openSheet(event.currentTarget, props.onManage)
                }
              >
                Manage subscription
              </button>
            </Show>
            <button
              class="text-button"
              type="button"
              disabled={props.busy}
              onClick={() => props.onRestore()}
            >
              Restore purchases
            </button>
          </div>

          <Show
            when={
              props.onRedeemCode !== undefined &&
              (props.mock === true || props.platform === 'ios')
            }
          >
            <button
              class="settings-row"
              type="button"
              disabled={props.busy}
              onClick={(event) =>
                void openSheet(event.currentTarget, () =>
                  untrack(() => props.onRedeemCode?.()),
                )
              }
            >
              <span>
                <strong>
                  {message(
                    props.mock === true
                      ? 'purchases.redeemMock'
                      : 'purchases.redeemApple',
                  )}
                </strong>
                <small>
                  {message(
                    props.mock === true
                      ? 'purchases.mockOfferHelp'
                      : 'purchases.offerTerms',
                  )}
                </small>
              </span>
            </button>
          </Show>
          <Show when={props.mock !== true && props.platform === 'android'}>
            <div class={styles.promo}>
              <a
                class={styles.storeLink}
                href="https://play.google.com/redeem"
                onClick={(event) => {
                  if (props.busy) event.preventDefault()
                  else props.onExternalRedemption?.()
                }}
                aria-disabled={props.busy}
              >
                {message('purchases.redeemGoogle')}
              </a>
              <p class="settings-group__intro">
                {message('purchases.googleHelp')}
              </p>
              <p class="settings-group__intro">
                {message('purchases.offerTerms')}
              </p>
            </div>
          </Show>
          <Show when={props.onCheckAccess !== undefined}>
            <button
              class="text-button"
              type="button"
              disabled={props.busy}
              onClick={() => props.onCheckAccess?.()}
            >
              {message('purchases.checkAccess')}
            </button>
          </Show>
          <Show when={props.mock !== true ? props.supportId : undefined}>
            <details class={styles.support}>
              <summary>{message('purchases.support')}</summary>
              <p class="settings-group__intro">
                {message('purchases.supportHelp')}
              </p>
              <label>
                {message('purchases.supportId')}
                <input
                  {...Selectable}
                  readOnly
                  value={props.supportId}
                  spellcheck={false}
                />
              </label>
            </details>
          </Show>
        </Show>

        <Show when={props.notice}>
          {(notice) => (
            <p class="schedule-status" role="status">
              {notice()}
            </p>
          )}
        </Show>
        <Show when={props.error}>
          {(error) => (
            <p class="schedule-status schedule-status--error" role="alert">
              {error()}
            </p>
          )}
        </Show>
      </Show>
    </section>
  )
}
