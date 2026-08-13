// ── E2E song seed ────────────────────────────────────────────────────
// Put a real, sendable song on a device from a Playwright spec.
//
// The two-device specs need a song that `buildPortableBundle` can actually
// read: stem BLOBS in IndexedDB, not just playable URLs on the session.
// Writing `outputs` alone — which is all most specs need — produces a
// session that looks complete on screen and refuses to pack, because the
// bundle reads `getStemBlobStrict` and finds nothing there.
//
// So this goes through the same services the "upload your own stems" flow
// uses, with one addition it does not make: a `fileHash`. That hash is the
// song's identity on the far device, and without it the sync modal will
// not offer the song at all. See `canSendToDevice` in UvrSessionActions.
//
// Registered only in test and E2E builds — `exposeForE2E` decides — and
// imported dynamically from the bridge so none of the database services
// land in the eager graph of a production boot.

import { exposeForE2E } from '@/lib/test-utils'

export interface SeedSongInput {
  /** Shown in the library and in the sync list. */
  name: string
  /** The song's identity across devices. Any stable string will do. */
  fileHash: string
  /** WAV bytes, base64 — Playwright cannot hand a spec's Buffer to a page. */
  vocalWavBase64: string
  /** Defaults to the vocal, so one clip can stand in for both stems. */
  instrumentalWavBase64?: string
}

function wavFile(base64: string, name: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: 'audio/wav' })
}

/**
 * Create a completed, sendable session and return its id.
 *
 * Mirrors `createManualStemSession` rather than calling it, because that
 * one deliberately has no hash to give: an uploaded pair of stems has no
 * original mix to hash. Here the spec supplies the identity it wants to
 * assert on afterwards.
 */
async function seedSong(input: SeedSongInput): Promise<string> {
  const [{ hydrateStemUrls, saveStemBlob }, appStore] = await Promise.all([
    import('@/db/services/uvr-service'),
    import('@/stores/app-store'),
  ])

  const vocal = wavFile(input.vocalWavBase64, `${input.name} vocal.wav`)
  const instrumental = wavFile(
    input.instrumentalWavBase64 ?? input.vocalWavBase64,
    `${input.name} instrumental.wav`,
  )

  const sessionId = appStore.startUvrSession(
    `${input.name}.wav`,
    vocal.size,
    'audio/wav',
    'separate',
    'local',
    input.fileHash,
  )

  await saveStemBlob(sessionId, 'vocal', vocal, vocal.name)
  await saveStemBlob(sessionId, 'instrumental', instrumental, instrumental.name)

  const urls = await hydrateStemUrls(sessionId)
  await appStore.completeUvrSession(sessionId, urls ?? {}, {
    vocal: { size: vocal.size },
    instrumental: { size: instrumental.size },
  })
  return sessionId
}

/**
 * What a session looks like from outside the app, for assertions.
 *
 * `outputs` is returned verbatim on purpose. A received song whose
 * `outputs.vocal` is a database row id rather than a `blob:` URL is
 * exactly the bug that shipped, and the only way to see it is to look.
 *
 * `stemBytes` comes from the stored blobs rather than from the session's
 * own metadata, because metadata is what a transfer writes down and
 * blobs are what it actually moved. A song can be registered, listed and
 * marked complete while carrying no audio at all.
 */
async function readSong(fileHash: string): Promise<{
  sessionId: string
  title: string
  status: string
  outputs: Record<string, string>
  stemBytes: Record<string, number>
} | null> {
  const found = window.__pp?.appStore as
    | {
        getAllUvrSessions?: () => {
          sessionId: string
          status: string
          fileHash?: string
          originalFile?: { name: string }
          outputs?: Record<string, string>
        }[]
      }
    | undefined
  const session = found
    ?.getAllUvrSessions?.()
    .find((s) => s.fileHash === fileHash)
  if (session === undefined) return null

  const { getStemBlobStrict } = await import('@/db/services/uvr-service')
  const stemBytes: Record<string, number> = {}
  for (const stem of ['vocal', 'instrumental'] as const) {
    const blob = await getStemBlobStrict(session.sessionId, stem)
    stemBytes[stem] = blob === null ? 0 : blob.size
  }

  return {
    sessionId: session.sessionId,
    title: session.originalFile?.name ?? '',
    status: session.status,
    outputs: session.outputs ?? {},
    stemBytes,
  }
}

export function registerE2ESongSeed(): void {
  exposeForE2E('__ppSongSeed', { seedSong, readSong })
}
