import type { EntitlementStatus } from '@irchiinnuss/mobile-runtime'
import { Show } from 'solid-js'
import type { ProAccessStatus } from '@/purchases/pro-access'

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
  onUpgrade: () => void
  onManage: () => void
  onRestore: () => void
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
            when={props.entitlement}
            fallback={
              <p class="settings-group__intro">
                Every part of the cue loop stays free. {props.name} is a way to
                support the work if it has earned a place in your day.
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
                  onClick={() => props.onUpgrade()}
                >
                  {props.busy ? 'Opening…' : `Unlock ${props.name}`}
                </button>
              }
            >
              <button
                class="secondary-button"
                type="button"
                disabled={props.busy}
                onClick={() => props.onManage()}
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
