// Band preparation admission reuses durable parts before checking paid-job prerequisites.
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { PlayAlongBandPreparationPort, PlayAlongBandPreparationUpdate, } from './band-preparation-port'

export async function prepareBandWithPreflight(
  port: PlayAlongBandPreparationPort,
  sessionId: string,
  options: {
    signal: AbortSignal
    assertCurrent?: () => void
    checkPreflight?: (
      sessionId: string,
    ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
    onUpdate: (update: PlayAlongBandPreparationUpdate) => void
  },
): Promise<CloudSplitBlocker | null> {
  options.signal.throwIfAborted()
  options.assertCurrent?.()
  const reused = await port.reusePreparedBand?.(sessionId, {
    signal: options.signal,
  })
  options.signal.throwIfAborted()
  if (reused != null) return null
  const blocker = await options.checkPreflight?.(sessionId)
  options.signal.throwIfAborted()
  if (blocker != null) return blocker
  options.assertCurrent?.()
  await port.prepareBand(sessionId, {
    signal: options.signal,
    onUpdate: options.onUpdate,
  })
  options.signal.throwIfAborted()
  return null
}
