// ============================================================
// Portable bundles — building one from a session, keeping one
// ============================================================
//
// The database half of src/lib/portable/portable-bundle.ts: reading a
// local session out into parts, and writing arrived parts down as a
// session this device can play.
//
// Both directions reuse the machinery the ZIP import/export already
// proved -- the same Strict read and write services, the same durable
// session registration, the same rollback -- with none of the archive
// around it. A ZIP exists in one piece by definition; parts do not, so a
// phone receiving a song holds one part at a time and nothing else.
//
// See docs/plans/device-sync.md (Phase 1).

import { storageEstimate } from '@/db/durable-write'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDbStrict, saveLyricsToDbStrict, } from '@/db/services/lyrics-db-service'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict, } from '@/db/services/session-pitch-analysis-service'
import { deleteImportedUvrSessionDataStrict, getStemBlobStrict, getStemFingerprintDataStrict, hydrateStemUrls, saveStemBlobDurable, saveStemFingerprintDataStrict, sessionStemPresence, } from '@/db/services/uvr-service'
import { loadTranscriptionFromDbStrict, saveTranscriptionToDbStrict, } from '@/db/services/whisper-transcription-db-service'
import { formatBytes } from '@/lib/fetch-progress'
import { sha256Hex } from '@/lib/portable/hash'
import type { EncodeAbort, PortableTier } from '@/lib/portable/portable-audio'
import { DEFAULT_PORTABLE_TIER, encodeStemToAac, } from '@/lib/portable/portable-audio'
import type { PortableBundleManifest, PortablePartId, PortablePartInfo, PortablePrep, } from '@/lib/portable/portable-bundle'
import { decodePrep, encodePrep, PORTABLE_BUNDLE_VERSION, stemOfPart, verifyPart, } from '@/lib/portable/portable-bundle'
import type { MelodyFingerprint } from '@/lib/shazam/types'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { UvrSession } from '@/stores/uvr-store'
import { getUvrSession, getUvrSessionByHash, importUvrSessionDurable, removeUvrSessionFromCache, } from '@/stores/uvr-store'

const AAC_MIME = 'audio/mp4'
const PREP_MIME = 'application/json'

export interface BundleProgress {
  /** Which part is being worked on. */
  part: PortablePartId
  /** 0-1 within that part. */
  ratio: number
}

export interface BuiltBundle {
  manifest: PortableBundleManifest
  /** Every part's bytes, keyed by id. ~7-15 MB a song at portable tiers. */
  parts: Map<PortablePartId, Uint8Array>
}

export class BundleSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleSourceError'
  }
}

/**
 * Whether a stored stem can travel as it is.
 *
 * A session that itself arrived as a portable bundle stores AAC, not WAV.
 * Re-encoding AAC to AAC costs a generation of quality and minutes of
 * work to produce a copy that is strictly worse -- so an already-portable
 * stem is passed through untouched, and the bundle inherits the session's
 * own tier rather than claiming the one asked for.
 */
function isAlreadyPortable(blob: Blob): boolean {
  return blob.type.toLowerCase().startsWith(AAC_MIME)
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

async function partInfoFor(
  id: PortablePartId,
  bytes: Uint8Array,
  mime: string,
): Promise<PortablePartInfo> {
  const exact = new Uint8Array(bytes).slice()
  return {
    id,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(exact.buffer as ArrayBuffer),
    mime,
  }
}

/**
 * Read one song out of this device as a bundle.
 *
 * Stems are encoded (or passed through, see above) one at a time; the
 * prepared-song data -- lyrics, word timings, transcription, pitch
 * analysis, fingerprint -- rides as one small JSON part, loaded through
 * the same services the ZIP export uses so the two formats cannot
 * disagree about what preparation means.
 */
export async function buildPortableBundle(
  sessionId: string,
  opts: {
    tier?: PortableTier
    signal?: EncodeAbort
    onProgress?: (p: BundleProgress) => void
  } = {},
): Promise<BuiltBundle> {
  const { tier = DEFAULT_PORTABLE_TIER, signal, onProgress } = opts
  const session = getUvrSession(sessionId)
  if (session === undefined) {
    throw new BundleSourceError('That song is not on this device.')
  }
  if (session.status !== 'completed') {
    throw new BundleSourceError('That song has not finished separating.')
  }
  const fileHash = session.fileHash
  if (fileHash === undefined || fileHash === '') {
    throw new BundleSourceError(
      'That song has no content hash, so other devices cannot recognise it.',
    )
  }

  const parts = new Map<PortablePartId, Uint8Array>()
  const infos: PortablePartInfo[] = []
  // What the manifest claims. Downgraded to the session's own tier when a
  // pass-through stem cannot honestly claim better.
  let claimedTier: PortableTier = tier

  for (const stem of ['vocal', 'instrumental'] as const) {
    const blob = await getStemBlobStrict(sessionId, stem)
    if (blob === null) continue
    const id: PortablePartId = `stem:${stem}`
    let encoded: Uint8Array
    if (isAlreadyPortable(blob)) {
      encoded = await bytesOf(blob)
      if (session.audioQuality === 'portable-128') claimedTier = 'portable-128'
      onProgress?.({ part: id, ratio: 1 })
    } else {
      encoded = await encodeStemToAac(await blob.arrayBuffer(), {
        tier,
        signal,
        onProgress: (p) => onProgress?.({ part: id, ratio: p.ratio }),
      })
    }
    parts.set(id, encoded)
    infos.push(await partInfoFor(id, encoded, AAC_MIME))
  }

  if (!parts.has('stem:instrumental') && !parts.has('stem:vocal')) {
    throw new BundleSourceError('That song has no stored stems to send.')
  }

  const prep: PortablePrep = {
    version: 1,
    lyrics: await loadLyricsFromDbStrict(sessionId),
    transcription: await loadTranscriptionFromDbStrict(sessionId),
    pitchAnalysis: await loadPitchAnalysisFromDbStrict(sessionId),
    fingerprint: await getStemFingerprintDataStrict(sessionId),
  }
  const prepBytes = encodePrep(prep)
  parts.set('prep', prepBytes)
  infos.push(await partInfoFor('prep', prepBytes, PREP_MIME))
  onProgress?.({ part: 'prep', ratio: 1 })

  const durations = Object.values(session.stemMeta ?? {})
    .map((m) => m.duration)
    .filter((d): d is number => typeof d === 'number' && d > 0)

  return {
    manifest: {
      format: 'mercurypitch-song',
      version: PORTABLE_BUNDLE_VERSION,
      song: {
        fileHash,
        title: session.originalFile?.name ?? 'Unknown',
        durationSec: durations[0],
        quality: claimedTier,
      },
      parts: infos,
    },
    parts,
  }
}

/** A stem that would not go in, and the reason it would not. */
export class StemStoreError extends Error {
  /** True when the device is out of room, as opposed to anything else. */
  readonly outOfRoom: boolean
  constructor(message: string, outOfRoom: boolean) {
    super(message)
    this.name = 'StemStoreError'
    this.outOfRoom = outOfRoom
  }
}

/**
 * Why a stem would not store, in words with numbers in them.
 *
 * "The instrumental stem could not be stored" is a message that arrives
 * after a long transfer and tells the person nothing they can act on --
 * measured on a TV that turned out to allow 16 MB in total. A full device
 * is by far the likeliest cause and the only one the user can do anything
 * about, so it is named, with what the browser actually allows.
 */
async function describeStemStoreFailure(
  stem: string,
  saved: { quotaExceeded: boolean; error?: unknown },
): Promise<StemStoreError> {
  if (saved.quotaExceeded) {
    const room = await storageEstimate()
    const detail =
      room === null
        ? ''
        : ` This device allows ${formatBytes(room.quota)} for the app and ${formatBytes(room.usage)} is already used.`
    return new StemStoreError(
      `There is no room on this device for the ${stem} part.${detail} Free some space, or remove a song you no longer need, and try again.`,
      true,
    )
  }
  const because =
    saved.error instanceof Error && saved.error.message !== ''
      ? ` (${saved.error.message})`
      : ''
  return new StemStoreError(
    `The ${stem} part could not be saved on this device${because}.`,
    false,
  )
}

export type ImportOutcome =
  | { outcome: 'imported'; sessionId: string }
  | { outcome: 'already-here'; sessionId: string }

/**
 * Keep a song that arrived as a bundle.
 *
 * Parts are PULLED one at a time through `getPart`, verified against the
 * manifest, and written down before the next is asked for -- the receiver
 * never holds more than the part in hand, which is the property the whole
 * format exists for. Any failure rolls back everything written, using the
 * same cleanup the ZIP import trusts, so a torn import leaves no
 * half-song in the library.
 *
 * A song this device already has (by content hash) is declined before a
 * byte is pulled: the caller can skip the transfer entirely.
 */
export async function importPortableBundle(
  manifest: PortableBundleManifest,
  getPart: (info: PortablePartInfo) => Promise<Uint8Array>,
): Promise<ImportOutcome> {
  const existing = getUvrSessionByHash(manifest.song.fileHash)
  if (existing !== undefined) {
    // A completed row whose stems are gone (an interrupted delete, or the
    // pre-fix data loss) must not decline the import that would heal it:
    // "already-here" about an unplayable song strands the only good copy
    // on the other side (REQ-DRV-020). Only a definite 'absent' clears
    // the ghost; 'unknown' still declines, because importing over a
    // session whose stems merely could not be read would duplicate it.
    if ((await sessionStemPresence(existing.sessionId)) === 'absent') {
      await deleteImportedUvrSessionDataStrict(existing.sessionId)
      removeUvrSessionFromCache(existing.sessionId)
    } else {
      return { outcome: 'already-here', sessionId: existing.sessionId }
    }
  }

  const sessionId = globalThis.crypto.randomUUID()
  const stemMeta: NonNullable<UvrSession['stemMeta']> = {}
  const outputs: NonNullable<UvrSession['outputs']> = {}
  let prep: PortablePrep | null = null
  let sawAudio = false

  // Split timings, because "the song took a moment to become playable"
  // was reported after the first real two-device run and there are four
  // candidates behind it -- pulling bytes, hashing them, writing blobs to
  // IndexedDB, and the prep writes. Guessing which would be a guess. The
  // numbers cost nothing and localise it on the next real run.
  const startedAt = Date.now()
  let pullMs = 0
  let verifyMs = 0
  let writeMs = 0
  let prepMs = 0

  try {
    for (const info of manifest.parts) {
      const pullAt = Date.now()
      const bytes = await getPart(info)
      const verifyAt = Date.now()
      pullMs += verifyAt - pullAt
      await verifyPart(info, bytes)
      verifyMs += Date.now() - verifyAt

      const stem = stemOfPart(info.id)
      if (stem !== null) {
        const blob = new Blob([new Uint8Array(bytes).slice()], {
          type: info.mime,
        })
        const writeAt = Date.now()
        const saved = await saveStemBlobDurable(
          sessionId,
          stem,
          blob,
          `${stem}.m4a`,
        )
        writeMs += Date.now() - writeAt
        if (!saved.ok || saved.value === undefined) {
          throw await describeStemStoreFailure(stem, saved)
        }
        stemMeta[stem] = {
          duration: manifest.song.durationSec,
          size: info.bytes,
        }
        // NOT `outputs[stem] = saved.value`. That is the blob table's row
        // id, and `outputs` holds playable URLs everywhere else in the
        // app. See the hydration step below for what the id bought us.
        sawAudio = true
        continue
      }
      if (info.id === 'prep') prep = decodePrep(bytes)
    }

    if (!sawAudio) {
      throw new Error('The bundle carried no audio this device could keep.')
    }

    // Point `outputs` at object URLs the player can actually load.
    //
    // This used to hold the blob rows' ids, and the ids are neither a
    // `blob:` URL nor an http one -- which walked straight into
    // `ensureSessionHydrated`'s "remote stems don't die with the page"
    // branch. It returned the session untouched, the mixer was handed a
    // database id as an audio source, and a song that had arrived
    // perfectly would not play. Reloading fixed it, because the panel
    // re-hydrates every completed session on load, which is exactly the
    // shape the report took: "they need time to hydrate", and "all could
    // be loaded normally after refreshing the view".
    //
    // The ZIP import never had this: it drops `outputs` entirely and
    // lets hydration fill them. Same authority here -- IndexedDB is the
    // truth, these URLs are the view of it for this page's lifetime.
    const hydrateAt = Date.now()
    const urls = await hydrateStemUrls(sessionId)
    const hydrateMs = Date.now() - hydrateAt
    if (urls === null) {
      // The blobs went in and will not come back out. Better to roll the
      // whole import back than to leave a session that looks complete in
      // the library and cannot be opened.
      throw new Error(
        'The song was saved but could not be read back on this device.',
      )
    }
    Object.assign(outputs, urls)

    const prepAt = Date.now()
    if (prep !== null) {
      if (prep.lyrics !== null) {
        await saveLyricsToDbStrict(sessionId, prep.lyrics as LyricsData)
      }
      const transcription = prep.transcription as WhisperSegment[] | null
      if (transcription !== null && transcription.length > 0) {
        await saveTranscriptionToDbStrict(sessionId, transcription)
      }
      if (prep.pitchAnalysis !== null) {
        await savePitchAnalysisToDbStrict(
          sessionId,
          prep.pitchAnalysis as SessionPitchData,
        )
      }
      if (prep.fingerprint !== null) {
        // Re-keyed to the new session, exactly as the ZIP import does: the
        // fingerprint's melodyId embeds the session it belongs to.
        await saveStemFingerprintDataStrict(sessionId, {
          ...(prep.fingerprint as MelodyFingerprint),
          melodyId: `stem:${sessionId}`,
        })
      }
    }
    prepMs = Date.now() - prepAt

    const session: UvrSession = {
      sessionId,
      status: 'completed',
      progress: 100,
      fileHash: manifest.song.fileHash,
      originalFile: {
        name: manifest.song.title,
        // The original does not travel in a portable bundle; zero says so
        // the same way the ZIP import says it when the original is absent.
        size: 0,
        mimeType: '',
      },
      outputs,
      stemMeta,
      processingMode: 'local',
      // The honest label the library shows and the cloud list records:
      // this copy is the bundle's tier, not the original.
      audioQuality: manifest.song.quality,
      createdAt: Date.now(),
    }
    const recordAt = Date.now()
    if (!(await importUvrSessionDurable(session))) {
      throw new Error('The received session record could not be saved.')
    }
    const recordMs = Date.now() - recordAt
    console.info(
      `[portable] imported "${manifest.song.title}" in ${Date.now() - startedAt} ms ` +
        `(pull ${pullMs}, verify ${verifyMs}, write ${writeMs}, hydrate ${hydrateMs}, ` +
        `prep ${prepMs}, record ${recordMs})`,
    )
    return { outcome: 'imported', sessionId }
  } catch (error) {
    // A torn import must leave nothing: a song with one stem and no
    // record, or a record and no audio, is a support case either way.
    try {
      await deleteImportedUvrSessionDataStrict(sessionId)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'The failed import could not be completely rolled back.',
      )
    }
    throw error
  }
}
