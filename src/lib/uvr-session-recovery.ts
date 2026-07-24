import { getOriginalFileBlob } from '@/db/services/uvr-service'
import type { UvrStatus } from '@/types/uvr'

export type RecoveryAvailability = 'checking' | 'available' | 'unavailable'

export interface RecoveryCopy {
  title: string
  description: string
}

const RECOVERY_COPY: Record<RecoveryAvailability, RecoveryCopy> = {
  checking: {
    title: 'Checking original upload',
    description: 'Confirming this song is still available on this device.',
  },
  available: {
    title: 'Original song kept',
    description: 'Process it again to finish creating karaoke stems.',
  },
  unavailable: {
    title: 'Original upload unavailable',
    description: 'Delete this card or upload the song again.',
  },
}

export function getRecoveryCopy(
  availability: RecoveryAvailability,
): RecoveryCopy {
  return RECOVERY_COPY[availability]
}

export async function loadRetainedOriginalSong(
  sessionId: string,
  loadOriginal: typeof getOriginalFileBlob = getOriginalFileBlob,
): Promise<boolean> {
  return (await loadOriginal(sessionId)) !== null
}

export function canRetryUvrSession(
  status: UvrStatus | undefined,
  hasOriginalMetadata: boolean,
  recoveryAvailability: RecoveryAvailability,
  hasRetryHandler: boolean,
): boolean {
  if (!hasRetryHandler) return false
  if (status === 'error') return hasOriginalMetadata
  return (
    (status === 'cancelled' || status === 'interrupted') &&
    recoveryAvailability === 'available'
  )
}
