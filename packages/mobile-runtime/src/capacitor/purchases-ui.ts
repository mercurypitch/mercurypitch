// ============================================================
// Capacitor paywall adapter — RevenueCat's native paywall and Customer Center
// ============================================================
//
// Both surfaces are rendered natively from templates configured in the
// dashboard, so pricing, localisation and store management stay out of the
// web layer. Presentation resolves to an outcome; only a genuine SDK failure
// throws, and a customer dismissing the sheet does not.

import type { PurchasesOffering } from '@revenuecat/purchases-capacitor'
import { Purchases } from '@revenuecat/purchases-capacitor'
import { PAYWALL_RESULT, PaywallPresentationConfiguration, RevenueCatUI, } from '@revenuecat/purchases-capacitor-ui'
import type { PaywallOutcome, PaywallPort, PaywallRequest } from '../contracts'
import { PurchasesFailure } from '../contracts'

const OUTCOMES: Record<PAYWALL_RESULT, PaywallOutcome> = {
  [PAYWALL_RESULT.NOT_PRESENTED]: 'not-presented',
  [PAYWALL_RESULT.PURCHASED]: 'purchased',
  [PAYWALL_RESULT.RESTORED]: 'restored',
  [PAYWALL_RESULT.CANCELLED]: 'cancelled',
  [PAYWALL_RESULT.ERROR]: 'error',
}

async function findOffering(
  offeringId: string,
): Promise<PurchasesOffering | undefined> {
  const offerings = await Purchases.getOfferings()
  return offerings.all[offeringId]
}

export function createCapacitorPaywallPort(): PaywallPort {
  return {
    available: true,
    async present(request: PaywallRequest = {}): Promise<PaywallOutcome> {
      try {
        // Omitting the offering lets the dashboard's current offering decide,
        // which is what makes a paywall swap a dashboard change.
        const offering =
          request.offeringId === undefined
            ? undefined
            : await findOffering(request.offeringId)

        if (request.offeringId !== undefined && offering === undefined) {
          throw new PurchasesFailure(
            'configuration',
            `No offering named "${request.offeringId}" is configured.`,
          )
        }

        const options = {
          ...(offering === undefined ? {} : { offering }),
          ...(request.fullScreen === true
            ? {
                presentationConfiguration:
                  PaywallPresentationConfiguration.FULL_SCREEN,
              }
            : {}),
        }

        const { result } =
          request.requiredEntitlementId === undefined
            ? await RevenueCatUI.presentPaywall(options)
            : await RevenueCatUI.presentPaywallIfNeeded({
                ...options,
                requiredEntitlementIdentifier: request.requiredEntitlementId,
              })

        return OUTCOMES[result] ?? 'error'
      } catch (error) {
        if (error instanceof PurchasesFailure) throw error
        throw new PurchasesFailure(
          'unknown',
          error instanceof Error && error.message !== ''
            ? error.message
            : 'The upgrade screen could not be opened.',
          { cause: error },
        )
      }
    },
    async presentCustomerCenter() {
      try {
        await RevenueCatUI.presentCustomerCenter()
      } catch (error) {
        throw new PurchasesFailure(
          'unknown',
          error instanceof Error && error.message !== ''
            ? error.message
            : 'Subscription management could not be opened.',
          { cause: error },
        )
      }
    },
  }
}
