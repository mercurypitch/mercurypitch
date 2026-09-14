// Night audio eligibility quotes every required stage before permitting preparation.
import { SERVER_MAX_UPLOAD_BYTES } from '@/lib/audio-upload-contract'
import { CAN_TAKE_PAYMENT } from '@/lib/native-build'
import { DEFAULT_PROCESS_REQUEST, UVR_DEFAULT_MULTI_STEM_MODEL, uvrLengthFactor, } from '@/lib/uvr-api'
import type { NightAudioRequest } from './night-music-import'

export interface NightAudioFacts {
  signedIn: boolean
  balance: number | null
  prices: Record<string, number> | null
  duration: number | null
  bytes: number
  existing: boolean
  vocals: boolean
  instrumental: boolean
  band: boolean
  issue?: string
}

export interface NightAudioEligibility {
  available: boolean
  message: string
  cost?: number
  recovery?: 'account' | 'credits' | 'retry' | 'cloud'
}

export function nightAudioEligibility(
  facts: NightAudioFacts,
  mode: 'local' | 'server',
  target: NightAudioRequest['target'],
): NightAudioEligibility {
  const blocked = (
    message: string,
    recovery?: NightAudioEligibility['recovery'],
  ): NightAudioEligibility => ({ available: false, message, recovery })
  if (facts.issue !== undefined) return blocked(facts.issue, 'retry')
  const band = target !== 'vocals'
  const prepared = band ? facts.band : facts.vocals && facts.instrumental
  if (prepared)
    return {
      available: true,
      cost: 0,
      message: 'Saved parts are ready. No separation or credits needed.',
    }
  if (facts.existing && (!facts.instrumental || (!band && !facts.vocals)))
    return blocked(
      'Saved backing is missing. Prepare it again from the original file in your library.',
    )
  if (mode === 'local') {
    if (band) return blocked('Full-band separation needs Cloud.', 'cloud')
    return {
      available: true,
      cost: 0,
      message: 'Original instruments stay together in the backing.',
    }
  }
  if (!facts.signedIn)
    return blocked(
      'Cloud requires sign-in. Local vocals + backing is free.',
      'account',
    )
  if (!facts.existing && facts.bytes > SERVER_MAX_UPLOAD_BYTES)
    return blocked(
      'Cloud limit: 50 MB. Use Local vocals + backing or a smaller file.',
    )
  if (
    facts.duration === null ||
    !Number.isFinite(facts.duration) ||
    facts.duration <= 0
  )
    return blocked(
      'Song length is unavailable. Retry to check the cost, or use Local vocals + backing.',
      'retry',
    )
  const models = [
    ...(!facts.existing && (!facts.vocals || !facts.instrumental)
      ? [DEFAULT_PROCESS_REQUEST.model!]
      : []),
    ...(band ? [UVR_DEFAULT_MULTI_STEM_MODEL] : []),
  ]
  const prices = models.map((model) => facts.prices?.[model])
  if (
    facts.balance === null ||
    !Number.isFinite(facts.balance) ||
    prices.some(
      (cost) => cost === undefined || !Number.isFinite(cost) || cost <= 0,
    )
  )
    return blocked(
      'Pricing or balance unavailable. Retry to check the cost.',
      'retry',
    )
  const cost =
    prices.reduce<number>((sum, price) => sum + price!, 0) *
    uvrLengthFactor(facts.duration)
  if (facts.balance < cost)
    return {
      ...blocked(
        `This needs ${cost} credits; you have ${facts.balance}.`,
        CAN_TAKE_PAYMENT ? 'credits' : undefined,
      ),
      cost,
    }
  return {
    available: true,
    cost,
    message: `Estimated ${cost} credits${models.length > 1 ? ' total for both stages' : ''} · ${facts.balance} available. Server confirms final cost.`,
  }
}
