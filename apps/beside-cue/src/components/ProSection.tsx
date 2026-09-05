import type { EntitlementStatus } from '@irchiinnuss/mobile-runtime'
import { Show, untrack } from 'solid-js'
import type { Copy } from '@/i18n/ui-copy'
import { useCopy } from '@/i18n/ui-copy'
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

function renewalNote(
  entitlement: EntitlementStatus,
  locale: string,
  copy: Copy,
): string {
  if (entitlement.expiresAt === null) return copy.t('Yours for good.')
  const date = formatDate(entitlement.expiresAt, locale)
  return entitlement.willRenew
    ? copy.t('Renews {date}.', { date })
    : copy.t('Active until {date}.', { date })
}

export function ProSection(props: ProSectionProps) {
  const copy = useCopy()

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
          <p class="screen-kicker">{copy.t('Support')}</p>
          <h2 id="pro-settings-title">{props.name}</h2>
        </div>
        <Show when={props.isPro}>
          <strong>{copy.t('Active')}</strong>
        </Show>
      </div>

      <Show when={props.mock}>
        <p class="settings-group__intro">
          {copy.t(
            'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.',
          )}
        </p>
      </Show>

      <Show
        when={props.available}
        fallback={
          <p class="settings-group__intro">
            {props.error ?? copy.t('Purchases need the Android or iOS app.')}
          </p>
        }
      >
        <Show
          when={props.status !== 'loading'}
          fallback={
            <p class="settings-group__intro" role="status">
              {copy.t('Checking your purchases…')}
            </p>
          }
        >
          <Show
            when={props.isPro ? props.entitlement : undefined}
            fallback={
              <p class="settings-group__intro">
                {copy.t(
                  'The six original Pulls, your own words, and the cue loop stay free. {name} unlocks the extra character cast and supports the work.',
                  { name: props.name },
                )}
              </p>
            }
          >
            {(entitlement) => (
              <p class="settings-group__intro">
                {copy.t('Thank you for supporting Beside Cue.')}{' '}
                {renewalNote(entitlement(), props.locale, copy)}
              </p>
            )}
          </Show>

          <Show when={props.entitlement?.billingIssueDetectedAt != null}>
            <p class="schedule-status schedule-status--error" role="alert">
              {copy.t(
                'The store could not take the last payment. Manage your subscription to keep {name} active.',
                { name: props.name },
              )}
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
                  {props.busy
                    ? copy.t('Opening…')
                    : copy.t('Unlock {name}', { name: props.name })}
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
                {copy.t('Manage subscription')}
              </button>
            </Show>
            <button
              class="text-button"
              type="button"
              disabled={props.busy}
              onClick={() => props.onRestore()}
            >
              {copy.t('Restore purchases')}
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
                  {copy.t(
                    props.mock === true
                      ? 'Test an offer'
                      : 'Redeem App Store code',
                  )}
                </strong>
                <small>
                  {copy.t(
                    props.mock === true
                      ? 'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.'
                      : 'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.',
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
                {copy.t('Redeem on Google Play')}
              </a>
              <p class="settings-group__intro">
                {copy.t(
                  'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.',
                )}
              </p>
              <p class="settings-group__intro">
                {copy.t(
                  'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.',
                )}
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
              {copy.t('Check premium access')}
            </button>
          </Show>
          <Show when={props.mock !== true ? props.supportId : undefined}>
            <details class={styles.support}>
              <summary>{copy.t('Purchase support')}</summary>
              <p class="settings-group__intro">
                {copy.t(
                  'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.',
                )}
              </p>
              <label>
                {copy.t('Purchase support ID')}
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
