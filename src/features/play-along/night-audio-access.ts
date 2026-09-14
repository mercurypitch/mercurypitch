// Night audio access inspects local sources and checks fresh cloud admission without starting work.
import { accountHeld, currentAccountId } from '@/db/services/auth-service'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import { readUvrStemManifest } from '@/db/services/uvr-read-service'
import { findSessionByFileHash } from '@/db/services/uvr-service'
import { audioDurationSecs } from '@/lib/audio-duration'
import { computeFileHash } from '@/lib/file-hash'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import type { NightAudioFacts } from './night-audio-eligibility'
import { nightAudioEligibility } from './night-audio-eligibility'
import type { NightAudioRequest, NightMusicTask } from './night-music-import'
import { NightMusicActionError } from './night-music-import'
import { DRUM_PLAY_ALONG_POLICY, GUITAR_PLAY_ALONG_POLICY, hasUsablePlayAlongParts, } from './song-port'

export async function loadNightAudioFacts(
  request: NightAudioRequest,
  signal: AbortSignal,
): Promise<NightAudioFacts> {
  signal.throwIfAborted()
  const signedIn = accountHeld()
  const accountId = currentAccountId()
  const billingAbort = new AbortController()
  const cancelBilling = () => billingAbort.abort()
  signal.addEventListener('abort', cancelBilling, { once: true })
  const timeout = setTimeout(cancelBilling, 8000)
  const billing = signedIn
    ? Promise.all([
        fetchBillingMe(undefined, billingAbort.signal),
        fetchPricing(undefined, billingAbort.signal).catch(() => null),
      ])
    : Promise.resolve([null, null] as const)
  const settledBilling = billing.finally(() => {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancelBilling)
  })
  const file = typeof request.source === 'string' ? null : request.source
  const match = file
    ? await findSessionByFileHash(await computeFileHash(file))
    : null
  signal.throwIfAborted()
  const id =
    typeof request.source === 'string' ? request.source : match?.sessionId
  const existing =
    typeof request.source === 'string' || match?.status === 'completed'
  const kinds =
    id !== undefined && existing ? await readUvrStemManifest(id) : []
  if (id !== undefined && existing && !(await refreshUvrSessionFromDb(id)))
    throw new Error(
      'Your saved song could not be checked. Retry to reconnect it.',
    )
  signal.throwIfAborted()
  const storedDuration =
    id !== undefined
      ? getUvrSession(id)?.stemMeta?.instrumental?.duration
      : undefined
  const duration =
    storedDuration !== undefined &&
    Number.isFinite(storedDuration) &&
    storedDuration > 0
      ? storedDuration
      : file
        ? await audioDurationSecs(file, signal)
        : null
  const [me, pricing] = await settledBilling
  signal.throwIfAborted()
  if (signedIn !== accountHeld() || accountId !== currentAccountId())
    throw new Error(
      'Your account changed. Check the music options again before starting.',
    )
  return {
    signedIn,
    balance: me?.creditBalance ?? null,
    prices: pricing?.uvrModelCredits ?? null,
    duration,
    bytes: file?.size ?? 0,
    existing,
    vocals: kinds.includes('vocal'),
    instrumental: kinds.includes('instrumental'),
    band: hasUsablePlayAlongParts(
      kinds,
      request.target === 'drums'
        ? DRUM_PLAY_ALONG_POLICY
        : GUITAR_PLAY_ALONG_POLICY,
    ),
    ...(match &&
    (match.status === 'processing' || match.status === 'finalizing')
      ? {
          issue:
            'This song is already being prepared. Open the saved result from your library when it finishes.',
        }
      : {}),
  }
}

/** Recheck immediately before the first stage, including the combined bill for a full band. */
export async function admitNightAudio(
  request: NightAudioRequest,
  task: NightMusicTask,
  resolveAccess: (section: 'account' | 'credits') => void,
): Promise<NightMusicTask> {
  task.assertCurrent()
  const accountId = currentAccountId()
  const mode = task.audioMode ?? 'local'
  const facts = await loadNightAudioFacts(request, task.signal)
  task.assertCurrent()
  const access = nightAudioEligibility(facts, mode, request.target)
  if (!access.available) {
    const section = access.recovery
    throw new NightMusicActionError(
      access.message,
      section === 'account' || section === 'credits'
        ? {
            label: section === 'account' ? 'Sign in' : 'Get credits',
            run: () => resolveAccess(section),
          }
        : undefined,
    )
  }
  return {
    ...task,
    assertCurrent: () => {
      task.assertCurrent()
      if (
        (access.cost ?? 0) > 0 &&
        (!accountHeld() || currentAccountId() !== accountId)
      )
        throw new Error(
          'Your account changed. Choose the action again before continuing cloud preparation.',
        )
    },
  }
}
