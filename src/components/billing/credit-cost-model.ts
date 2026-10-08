// ============================================================
// What a song costs in credits, for the guide in Settings › Credits
// ============================================================
//
// Settings › Credits is the one place that states prices: the purchase mail
// and the short labels elsewhere point here, because a sent mail cannot be
// corrected and a fixed "1 credit per song" goes stale. Every number comes
// from the live pricing; the db-worker still decides each debit
// (billing-core uvrJobCost), this only explains it.

import type { Pricing } from '@/db/services/billing-service'
// The worker's own length rule, not the uvr-api mirror: that module reads the
// native build's origin on load, which a pricing panel has no need for.
import { UVR_BASE_MINUTES, UVR_SURCHARGE_BLOCK_MINUTES, uvrLengthFactor, } from '../../../workers/db-worker/src/billing-core'

/** The model that splits a "Full band" upload's backing into its parts.
 *  Mirrors uvr-api's UVR_DEFAULT_MULTI_STEM_MODEL; a test holds them equal. */
export const FULL_BAND_SPLIT_MODEL = 'demucs-6s'

export interface CreditCosts {
  /** Vocals and backing: the plain Cloud GPU split. */
  twoStems: number
  /** The split plus the band split of the backing (the upload's "Full band"),
   *  or null when the band split has no price. */
  fullBand: number | null
  /** Minutes a song's price covers. */
  includedMinutes: number
  /** Each started block of this many minutes past that counts again. */
  extraBlockMinutes: number
  /** A worked example just past the included length. */
  example: {
    minutes: number
    /** How many times the example song counts. */
    times: number
    twoStems: number
    fullBand: number | null
  }
}

const positive = (n: number | undefined): number | null =>
  n !== undefined && n > 0 ? n : null

/** Null while the Cloud GPU split has no price, so nothing is claimed. */
export function creditCosts(
  pricing: Pick<Pricing, 'uvrModelCredits'>,
): CreditCosts | null {
  const twoStems = positive(pricing.uvrModelCredits?.roformer)
  if (twoStems === null) return null
  const split = positive(pricing.uvrModelCredits?.[FULL_BAND_SPLIT_MODEL])
  const fullBand = split === null ? null : twoStems + split
  const minutes = UVR_BASE_MINUTES + Math.ceil(UVR_SURCHARGE_BLOCK_MINUTES / 2)
  const times = uvrLengthFactor(minutes * 60)
  return {
    twoStems,
    fullBand,
    includedMinutes: UVR_BASE_MINUTES,
    extraBlockMinutes: UVR_SURCHARGE_BLOCK_MINUTES,
    example: {
      minutes,
      times,
      twoStems: twoStems * times,
      fullBand: fullBand === null ? null : fullBand * times,
    },
  }
}

/** "1 credit", "3 credits", never split across two lines. */
export function creditCount(n: number): string {
  return `${n}\u00a0credit${n === 1 ? '' : 's'}`
}
