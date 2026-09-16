// ============================================================
// PromoCodeCard — Promo code redemption & Product Hunt launch offer
// ============================================================
//
// Mounted inside Settings → Credits (and accessible via deep-link #/settings/credits).
// Shows:
// 1. For unauthenticated / anonymous users: CTA to sign up to claim promo credits.
// 2. For unverified accounts: alert to verify email before claiming.
// 3. For verified accounts:
//    - 1-click "Claim 5 Free Launch Credits" card if PRODUCT_HUNT has not been redeemed.
//    - Input box to redeem any promo code (supporting future campaigns).
// 4. Product Hunt featured badge with automatic dark/light theme switching.

import type { Component } from 'solid-js'
import { createEffect, createResource, createSignal, Show } from 'solid-js'
import { fetchMe, resendVerificationEmail } from '@/db/services/auth-service'
import { fetchBillingMe, redeemPromoCode } from '@/db/services/billing-service'
import { balanceVersion, refreshBalance } from '@/stores/billing-store'
import { showNotification } from '@/stores/notifications-store'
import { theme } from '@/stores/theme-store'
import { openAuthModal } from '@/stores/ui-store'
import styles from './PromoCodeCard.module.css'

export interface PromoCodeCardProps {
  initialCode?: string
}

export const PromoCodeCard: Component<PromoCodeCardProps> = (props) => {
  const [user, { refetch: refetchUser }] = createResource(() => fetchMe())
  const [billingMe, { refetch: refetchBilling }] = createResource(
    () => balanceVersion(),
    () => fetchBillingMe(),
  )

  const [code, setCode] = createSignal(props.initialCode ?? '')
  const [busy, setBusy] = createSignal(false)
  const [resendingEmail, setResendingEmail] = createSignal(false)
  const [message, setMessage] = createSignal<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  createEffect(() => {
    const init = props.initialCode
    if (init != null && init !== '') {
      setCode(init)
    }
  })

  const isAuthenticated = (): boolean => {
    const u = user()
    return u != null && u.user.authProvider !== 'anonymous'
  }

  const isEmailVerified = (): boolean => {
    return user()?.user.emailVerified === true
  }

  const hasRedeemedPh = (): boolean => {
    const promos = billingMe()?.redeemedPromos
    return Array.isArray(promos) && promos.includes('PRODUCT_HUNT')
  }

  const phTheme = (): 'dark' | 'light' => {
    return theme() === 'light' ? 'light' : 'dark'
  }

  async function handleRedeem(targetCode: string): Promise<void> {
    const clean = targetCode.trim()
    if (clean === '') {
      setMessage({ text: 'Please enter a promo code.', type: 'error' })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const res = await redeemPromoCode(clean)
      setMessage({
        text: `Promo code ${res.code} redeemed! +${res.creditsGranted} credits added.`,
        type: 'success',
      })
      showNotification(
        `+${res.creditsGranted} credits added to your account!`,
        'info',
      )
      setCode('')
      refreshBalance()
      refetchBilling()
      refetchUser()
    } catch (err) {
      const errText =
        err instanceof Error ? err.message : 'Failed to redeem promo code'
      setMessage({ text: errText, type: 'error' })
      showNotification(errText, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleResendVerification(): Promise<void> {
    const email = user()?.user.email
    if (email == null || email === '') return
    setResendingEmail(true)
    try {
      await resendVerificationEmail()
      showNotification('Verification email sent! Check your inbox.', 'info')
    } catch (err) {
      showNotification(
        err instanceof Error
          ? err.message
          : 'Failed to send verification email',
        'error',
      )
    } finally {
      setResendingEmail(false)
    }
  }

  return (
    <div class={styles.promoContainer} data-testid="promo-code-card">
      <div class={styles.promoHeader}>
        <div class={styles.promoTitleGroup}>
          <h4 class={styles.promoTitle}>Launch Promo & Codes</h4>
          <span class={styles.promoBadge}>Product Hunt</span>
        </div>

        <a
          href="https://www.producthunt.com/products/mercury-pitch?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-mercury-pitch"
          target="_blank"
          rel="noopener noreferrer"
          class={styles.phBadgeLink}
          title="MercuryPitch on Product Hunt"
        >
          <img
            src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1201891&theme=${phTheme()}&t=1789577241428`}
            alt="Mercury Pitch - Product Hunt Featured"
            width="180"
            height="38"
            class={styles.phBadgeImg}
          />
        </a>
      </div>

      <p class={styles.promoDesc}>
        Redeem a promotional code or claim your Product Hunt launch bonus
        credits for studio-quality cloud vocal separation.
      </p>

      {/* 1. Signed-out state */}
      <Show when={!isAuthenticated()}>
        <div class={styles.alertBox}>
          <span class={styles.alertTitle}>Account Required</span>
          <span>
            Create a free account and verify your email to claim 5 free cloud
            separation credits.{' '}
            <button
              type="button"
              class={styles.alertLink}
              onClick={() => openAuthModal('register')}
            >
              Sign up or log in
            </button>
          </span>
        </div>
      </Show>

      {/* 2. Unverified email state */}
      <Show when={isAuthenticated() && !isEmailVerified()}>
        <div class={styles.alertBox}>
          <span class={styles.alertTitle}>Email Verification Required</span>
          <span>
            Please verify your email address before redeeming promo codes.{' '}
            <button
              type="button"
              class={styles.alertLink}
              disabled={resendingEmail()}
              onClick={() => {
                void handleResendVerification()
              }}
            >
              {resendingEmail() ? 'Sending…' : 'Resend verification link'}
            </button>
          </span>
        </div>
      </Show>

      {/* 3. Verified email state: One-click claim for PRODUCT_HUNT */}
      <Show when={isAuthenticated() && isEmailVerified()}>
        <div class={styles.claimCard}>
          <div class={styles.claimInfo}>
            <span class={styles.claimTitle}>Product Hunt Launch Gift</span>
            <span class={styles.claimSub}>
              5 Free Studio-Grade Cloud GPU Separations
            </span>
          </div>

          <Show
            when={!hasRedeemedPh()}
            fallback={<span class={styles.claimedPill}>Claimed</span>}
          >
            <button
              type="button"
              class={styles.claimBtn}
              disabled={busy()}
              onClick={() => {
                void handleRedeem('PRODUCT_HUNT')
              }}
              data-testid="claim-ph-btn"
            >
              {busy() ? 'Claiming…' : 'Claim 5 Credits'}
            </button>
          </Show>
        </div>
      </Show>

      {/* 4. Manual promo code input (for any code) */}
      <Show when={isAuthenticated() && isEmailVerified()}>
        <form
          class={styles.formRow}
          onSubmit={(e) => {
            e.preventDefault()
            void handleRedeem(code())
          }}
        >
          <input
            type="text"
            class={styles.input}
            placeholder="Enter promo code (e.g. PRODUCT_HUNT)"
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            disabled={busy()}
            data-testid="promo-input"
            aria-label="Promo code"
          />
          <button
            type="submit"
            class={styles.redeemBtn}
            disabled={busy() || code().trim() === ''}
            data-testid="promo-submit-btn"
          >
            {busy() ? 'Redeeming…' : 'Redeem'}
          </button>
        </form>
      </Show>

      {/* Feedback messaging */}
      <Show when={message()}>
        {(msg) => (
          <div
            class={
              msg().type === 'success'
                ? styles.successMessage
                : styles.errorMessage
            }
            role="status"
          >
            {msg().text}
          </div>
        )}
      </Show>
    </div>
  )
}
