// ============================================================
// UI copy seam — released locales share one complete, typed catalog
// ============================================================

import type { AppLocale } from './locale'
import type { UiCopySource } from './ui-copy'
import { translateUi } from './ui-copy'

export type { AppLocale } from './locale'
export {
  AVAILABLE_LOCALES,
  LANGUAGE_NAMES,
  PLANNED_LOCALES,
  resolveAppLocale,
} from './locale'

const semanticSources = {
  'home.title': 'Your current pressing',
  'premium.show': 'Show premium',
  'premium.hide': 'Hide premium',
  'premium.available': 'Your Pro cast. Choose the Pull you want to notice.',
  'premium.locked':
    'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.',
  'premium.choices': 'Premium Pull choices',
  'premium.revoked':
    'Pro is no longer active. Choose one of the six free Pulls, or name your own.',
  'audio.mute': 'Mute audio',
  'audio.unmute': 'Unmute audio',
  'purchases.betaNotice':
    'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.',
  'purchases.redeemApple': 'Redeem App Store code',
  'purchases.redeemGoogle': 'Redeem on Google Play',
  'purchases.redeemMock': 'Test an offer',
  'purchases.checkAccess': 'Check premium access',
  'purchases.offerTerms':
    'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.',
  'purchases.googleHelp':
    'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.',
  'purchases.accessConfirmed': 'Premium access is confirmed.',
  'purchases.accessNotConfirmed':
    'No active premium access was confirmed. If you just redeemed a code, wait a moment and check again, or use Restore purchases.',
  'purchases.redemptionPending':
    'Finish redeeming in the App Store. Premium unlocks only when the store confirms it. You can check access here afterward.',
  'purchases.redeemUnavailable':
    'Code redemption needs the supported mobile store. Use the redemption link supplied with your offer.',
  'purchases.support': 'Purchase support',
  'purchases.supportId': 'Purchase support ID',
  'purchases.supportHelp':
    'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.',
  'purchases.mockBadge': 'Test purchases — no charge',
  'purchases.mockOfferTitle': 'Test a premium offer',
  'purchases.mockOfferApply': 'Apply a 60-day test offer',
  'purchases.mockOfferHelp':
    'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.',
} as const satisfies Readonly<Record<string, UiCopySource>>

export type MessageKey = keyof typeof semanticSources

export function message(key: MessageKey, locale: AppLocale = 'en'): string {
  return translateUi(semanticSources[key], locale)
}

/** Domain/storage still uses strict local HH:mm; only its visible label is localized. */
export function formatLocalTime(
  localTime: string,
  locale: string = 'en',
): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(localTime)) return localTime
  const [hour, minute] = localTime.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
}
