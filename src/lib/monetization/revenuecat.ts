// ============================================================
// Monetization — RevenueCat (native only).
// ============================================================
//
// The web build never imports this module, so @revenuecat/purchases-capacitor
// and @capacitor/core stay out of the browser bundles. Shared components
// (GlassApp) never import this directly either — they trigger the paywall via
// paywall-control and read entitlement state passed down as props, which keeps
// them web-clean. Only the native shell (GameShell / native-main) wires this.
//
// Shipaton 2026 requires the RevenueCat SDK to power at least one in-app
// purchase; the `pro` entitlement below is that purchase.

import { Capacitor } from '@capacitor/core'
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from '@revenuecat/purchases-capacitor'
import { Purchases } from '@revenuecat/purchases-capacitor'
import { createSignal } from 'solid-js'

const ENTITLEMENT_ID = 'pro'

// App-lifetime global state. Signals created at module scope are fine in
// Solid (only computations need an owner); these live as long as the app.
const [isPro, setIsPro] = createSignal(false)
const [offering, setOffering] = createSignal<PurchasesOffering | null>(null)
const [ready, setReady] = createSignal(false)

export { isPro, offering, ready }

const env = import.meta.env as unknown as Record<string, string | undefined>

function apiKey(): string | undefined {
  const p = Capacitor.getPlatform()
  if (p === 'ios') return env.VITE_RC_IOS_KEY
  if (p === 'android') return env.VITE_RC_ANDROID_KEY
  return undefined
}

function applyCustomerInfo(info: CustomerInfo): void {
  setIsPro(info.entitlements.active[ENTITLEMENT_ID] !== undefined)
}

/** Configure RevenueCat and hydrate entitlement + offering state. Safe no-op
 *  on web / when no API key is provided. Call once at native startup. */
export async function initPurchases(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const key = apiKey()
  if (key === undefined || key === '') {
    console.warn('[monetization] no RevenueCat API key for', Capacitor.getPlatform())
    return
  }
  try {
    await Purchases.configure({ apiKey: key })
    void Purchases.addCustomerInfoUpdateListener((info) => applyCustomerInfo(info))
    const { customerInfo } = await Purchases.getCustomerInfo()
    applyCustomerInfo(customerInfo)
    const offerings = await Purchases.getOfferings()
    setOffering(offerings.current ?? null)
    setReady(true)
  } catch (err) {
    console.error('[monetization] init failed', err)
  }
}

/** Purchase a package; returns true if the `pro` entitlement is now active. */
export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
    applyCustomerInfo(customerInfo)
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined
  } catch (err) {
    const e = err as { userCancelled?: boolean; code?: string }
    if (e.userCancelled === true || e.code === 'PURCHASE_CANCELLED') return false
    console.error('[monetization] purchase failed', err)
    return false
  }
}

/** Restore prior purchases (required by App Store); returns pro state. */
export async function restore(): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.restorePurchases()
    applyCustomerInfo(customerInfo)
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined
  } catch (err) {
    console.error('[monetization] restore failed', err)
    return false
  }
}
