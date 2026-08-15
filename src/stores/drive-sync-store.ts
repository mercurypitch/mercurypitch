// ── Drive sync store ─────────────────────────────────────────────────
// The user's own Google Drive as the place a library survives.
//
// This is the phase that actually solves the original problem: a device
// can be lost, wiped or replaced, and the songs come back. Peer transfer
// (Phase 5) is faster between two devices in the same room; Drive is the
// one that works when the other device is gone.
//
// Nothing here is a server of ours. The worker mints a short-lived access
// token from a refresh token it keeps sealed (see auth-service), and the
// browser talks to googleapis.com directly -- uploaded audio is the
// user's own copyrighted material and must never transit or rest on our
// infrastructure. The `drive.file` scope means this can only see files
// the app itself created, which is why the layout is a plain visible
// MercuryPitch folder holding one file per song.
//
// Both directions work a part at a time. A backup packs a song into a
// container and pushes it in slices; a restore reads the container header,
// then pulls each part at its computed offset, verifies it against the
// manifest hash and writes it down before asking for the next -- the same
// pull loop the P2P wire runs, against a different transport.
//
// See docs/plans/device-sync.md (Phase 4).

import { createSignal } from 'solid-js'
import { currentAccountId, disconnectDrive, fetchDriveAccessToken, fetchDriveStatus, startDriveConnect, } from '@/db/services/auth-service'
import { buildPortableBundle, BundleSourceError, importPortableBundle, } from '@/db/services/portable-bundle-service'
import { sessionStemPresence } from '@/db/services/uvr-service'
import type { DriveClient, DriveSongFile } from '@/lib/drive/drive-client'
import { createDriveClient, DriveAuthError, SONG_FILE_SUFFIX, } from '@/lib/drive/drive-client'
import { platform } from '@/lib/platform'
import type { EncodeAbort } from '@/lib/portable/portable-audio'
import type { PortablePartInfo } from '@/lib/portable/portable-bundle'
import type { ParsedContainerHeader } from '@/lib/portable/portable-container'
import { buildContainerBlob, CONTAINER_HEAD_FETCH_BYTES, containerPartRanges, parseContainerHead, } from '@/lib/portable/portable-container'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessions, whenSessionStoreReady } from '@/stores/uvr-store'

export type DriveConnectionState = 'unknown' | 'disconnected' | 'connected'

/** One song the scan found a reason to move, in either direction. */
export interface DriveCandidate {
  fileHash: string
  title: string
  /** Local session id when it is here; Drive file id when it is there. */
  ref: string
  bytes?: number
}

export interface DriveScan {
  /** Songs in Drive, whether or not this device has them. */
  inDrive: number
  /** Playable songs on this device. */
  here: number
  /** Here but not in Drive — what a backup would upload. */
  toBackUp: DriveCandidate[]
  /** In Drive but not here — what a restore would download. */
  toRestore: DriveCandidate[]
}

export interface DriveJob {
  kind: 'backup' | 'restore'
  /** The song being worked on right now. */
  title: string
  /** How many songs are finished, and how many the job started with. */
  done: number
  total: number
  /** 0-1 through the current song. */
  ratio: number
  /** Songs that failed; the job carries on past them. */
  failed: number
}

/** One song a job could not move, and the reason a person can act on. */
export interface DriveFailure {
  title: string
  reason: string
}

const [driveState, setDriveState] =
  createSignal<DriveConnectionState>('unknown')
const [driveEmail, setDriveEmail] = createSignal<string | null>(null)
const [driveError, setDriveError] = createSignal<string | null>(null)
const [driveScan, setDriveScan] = createSignal<DriveScan | null>(null)
const [driveJob, setDriveJob] = createSignal<DriveJob | null>(null)
const [driveBusy, setDriveBusy] = createSignal(false)
// Survives the job that filled it — the whole point is reading it after.
const [driveJobFailures, setDriveJobFailures] = createSignal<DriveFailure[]>([])
// The MercuryPitch folder, once resolved — what "Open in Drive" links to.
const [driveFolderId, setDriveFolderId] = createSignal<string | null>(null)

export {
  driveBusy,
  driveEmail,
  driveError,
  driveFolderId,
  driveJob,
  driveJobFailures,
  driveScan,
  driveState,
}

/**
 * The current access token and when it stops being usable.
 *
 * Kept in module scope rather than fetched per request: a backup is
 * dozens of requests over minutes, and asking the worker for a token
 * before each one turns our own API into the bottleneck. Expiry is held
 * a minute short of Google's so a token cannot lapse mid-request.
 */
let token: { value: string; expiresAt: number } | null = null

/** Flipped to stop a running backup or restore between slices. */
let jobAbort: EncodeAbort = { aborted: false }

const TOKEN_SAFETY_MS = 60_000

/**
 * Which account everything above belongs to.
 *
 * Signing out does not reload the page, so without this every signal
 * here, the cached access token and the scan's Drive file ids would all
 * survive into the NEXT person's session in the same tab — and the first
 * thing they pressed would upload their songs into the previous user's
 * Drive, or import that user's files into their library. `refreshDriveStatus`
 * would not save them either: it only clears on "not connected", and the
 * second user having their own Drive answers "connected".
 */
let ownerAccountId: string | null = null

/**
 * Drop everything if the signed-in account is not the one this state was
 * built for. Called before every read of Drive state that matters.
 */
function forgetIfAccountChanged(): void {
  const account = currentAccountId()
  if (account === ownerAccountId) return
  ownerAccountId = account
  token = null
  client = null
  setDriveState('unknown')
  setDriveEmail(null)
  setDriveScan(null)
  setDriveError(null)
  setDriveJob(null)
  setDriveJobFailures([])
  setDriveFolderId(null)
  jobAbort.aborted = true
}

// ── The folder, remembered by id ─────────────────────────────────────
// The id survives what the name cannot: a rename or move in Drive. A
// name-only lookup after a rename finds nothing, quietly creates a
// second "MercuryPitch" folder, and the next scan offers the whole
// library for re-upload. Keyed per account so two people sharing a
// browser cannot inherit each other's folder.

const FOLDER_ID_KEY_PREFIX = 'pitchperfect_drive_folder:'

function folderKey(): string {
  return `${FOLDER_ID_KEY_PREFIX}${ownerAccountId ?? 'anonymous'}`
}

async function resolveFolder(drive: DriveClient): Promise<string> {
  let remembered: string | null = null
  try {
    remembered = localStorage.getItem(folderKey())
  } catch {
    /* storage unavailable — the name lookup still works */
  }
  const id = await drive.ensureFolder(remembered)
  try {
    localStorage.setItem(folderKey(), id)
  } catch {
    /* storage unavailable */
  }
  setDriveFolderId(id)
  return id
}

/**
 * A usable access token, or null with the reason recorded.
 *
 * The worker separates a dead grant (410 — the refresh token is gone or
 * revoked, and the row has been dropped) from a transient failure (502 —
 * Google's token endpoint blipped, the session lapsed). Collapsing those
 * into one "reconnect Drive" would push somebody through a full consent
 * round trip because of a five-second outage, so only the first one is
 * allowed to say the Drive is disconnected.
 */
let lastTokenFailure: 'disconnected' | 'failed' | null = null

async function accessToken(forceFresh = false): Promise<string | null> {
  const now = Date.now()
  if (!forceFresh && token !== null && token.expiresAt > now) return token.value
  const minted = await fetchDriveAccessToken()
  if (!minted.ok) {
    token = null
    lastTokenFailure = minted.reason
    if (minted.reason === 'disconnected') {
      // The grant is gone on Google's side. Saying "connected" after this
      // would offer buttons that cannot work.
      setDriveState('disconnected')
      setDriveEmail(null)
    }
    return null
  }
  lastTokenFailure = null
  token = {
    value: minted.accessToken,
    expiresAt: now + Math.max(0, minted.expiresIn * 1000 - TOKEN_SAFETY_MS),
  }
  return token.value
}

let client: DriveClient | null = null

function driveClient(): DriveClient {
  client ??= createDriveClient({ getToken: accessToken })
  return client
}

/**
 * Songs this device can actually back up: separated and hashed.
 *
 * Deliberately NOT gated on `outputs`: those URLs are minted lazily the
 * first time a song is played, and a session loaded from the database
 * carries none at all (`dbRecordToSession`). Requiring them made every
 * unplayed song invisible to the scan after a reload — a full library
 * answered "0 songs here", which is the bug the first Drive connect
 * found. Packing reads the stems from the database itself, so a minted
 * URL proves nothing it needs. Same filter as the peer-transfer send
 * list, for the same reason (REQ-SYNC-018).
 */
function localSongs(): UvrSession[] {
  return getAllUvrSessions().filter(
    (s) =>
      s.status === 'completed' && s.fileHash !== undefined && s.fileHash !== '',
  )
}

function titleOf(session: UvrSession): string {
  const name = session.originalFile?.name ?? ''
  return name === '' ? 'Untitled song' : name.replace(/\.[^.]+$/, '')
}

function describe(error: unknown): string {
  if (error instanceof DriveAuthError) return error.message
  return error instanceof Error ? error.message : String(error)
}

/** One line a person can act on, from whatever a failed song threw. */
function describeSongFailure(error: unknown): string {
  if (error instanceof BundleSourceError) {
    return 'A stem could not be read on this device.'
  }
  if (error instanceof TypeError) {
    // fetch throws TypeError for network-level failure — the one case
    // where "try again" is genuinely the whole answer.
    return 'The connection dropped. It will be offered again on the next scan.'
  }
  if (error instanceof Error && error.name === 'StemEncodeUnsupportedError') {
    return 'This browser cannot re-encode audio for backup.'
  }
  return describe(error)
}

/** How many times one song's upload is attempted before giving up. */
const UPLOAD_ATTEMPTS = 3
const UPLOAD_RETRY_DELAY_MS = 1500

/**
 * Turn a thrown error into the state it implies.
 *
 * A dead grant is not a failure to retry: every later request would fail
 * the same way, so the connection is marked gone and the UI offers
 * reconnect instead of "try again".
 */
function noteError(error: unknown): void {
  if (error instanceof DriveAuthError) {
    token = null
    // Only a grant the worker has actually declared dead marks the Drive
    // disconnected; a blip leaves the section standing so the message
    // below is somewhere the user can read it, and "try again" is the
    // truthful next step rather than a fresh trip through consent.
    if (lastTokenFailure === 'disconnected') {
      setDriveState('disconnected')
      setDriveEmail(null)
      setDriveError('Google Drive access has expired — reconnect to continue.')
      return
    }
    setDriveError(
      'Could not reach Google Drive just now. Your connection is still set up — try again.',
    )
    return
  }
  setDriveError(describe(error))
}

/** Ask the worker whether this account has Drive connected. */
export async function refreshDriveStatus(): Promise<void> {
  forgetIfAccountChanged()
  const status = await fetchDriveStatus()
  // "Could not ask" is not "not connected": answering an offline device
  // with a Connect button offers a redirect that cannot complete, for a
  // Drive that may well already be attached. Leave the state unresolved,
  // but say why, or the section sits on "Checking…" with no explanation.
  if (!status.known) {
    setDriveError(
      'Could not check your Google Drive connection. Check your connection, or sign in again.',
    )
    return
  }
  setDriveError(null)
  setDriveState(status.connected ? 'connected' : 'disconnected')
  setDriveEmail(status.email ?? null)
  if (!status.connected) {
    token = null
    setDriveScan(null)
  }
}

/** Start the connect-Drive redirect. Leaves the app when it succeeds. */
export async function connectDrive(): Promise<void> {
  forgetIfAccountChanged()
  setDriveBusy(true)
  setDriveError(null)
  try {
    const started = await startDriveConnect()
    if (!started.ok) {
      setDriveError(
        started.error === 'offline'
          ? 'Could not reach the server to start connecting Drive.'
          : 'Could not start connecting Google Drive. Please try again.',
      )
    }
  } finally {
    setDriveBusy(false)
  }
}

/**
 * Forget the grant here and on the worker.
 *
 * A refusal has to stay refused: saying "disconnected" while the sealed
 * refresh token is still in the database and Google still lists the grant
 * tells somebody they revoked access when they did not.
 */
export async function disconnectDriveSync(): Promise<void> {
  forgetIfAccountChanged()
  setDriveBusy(true)
  setDriveError(null)
  try {
    const gone = await disconnectDrive().catch(() => false)
    if (!gone) {
      setDriveError(
        'Google Drive could not be disconnected just now — it is still connected. Please try again.',
      )
      return
    }
    token = null
    client = null
    lastTokenFailure = null
    setDriveScan(null)
    setDriveJob(null)
    setDriveJobFailures([])
    setDriveFolderId(null)
    try {
      localStorage.removeItem(folderKey())
    } catch {
      /* storage unavailable */
    }
    setDriveState('disconnected')
    setDriveEmail(null)
  } finally {
    setDriveBusy(false)
  }
}

/**
 * Compare what is here with what is in Drive, by content hash.
 *
 * The hash is the identity every transport already agrees on, so a song
 * that arrived by peer transfer, by ZIP import or by separation on
 * another device is recognised as the same song without downloading a
 * byte of it.
 */
export async function scanDrive(): Promise<DriveScan | null> {
  forgetIfAccountChanged()
  setDriveBusy(true)
  setDriveError(null)
  try {
    // The scan that runs on the way back from the OAuth redirect fires
    // while the library is still loading from IndexedDB; comparing Drive
    // against a cache that is merely EMPTY SO FAR reports a full device
    // as having nothing to back up.
    await whenSessionStoreReady()
    const drive = driveClient()
    const folderId = await resolveFolder(drive)
    const remote = await drive.listSongs(folderId)
    const local = localSongs()

    const remoteByHash = new Map<string, DriveSongFile>()
    for (const file of remote) remoteByHash.set(file.properties.fileHash, file)
    const localByHash = new Map<string, UvrSession>()
    for (const s of local) localByHash.set(s.fileHash as string, s)

    // A hash match only blocks a restore offer when the stems are actually
    // on disk. An interrupted delete can leave (or resurrect) a completed
    // row whose blobs are gone; that ghost made the scan swear the song
    // was safe here while the library could not play it, and the one copy
    // in Drive was never offered back (REQ-DRV-020). 'unknown' stays
    // blocking: restoring over a session that may have stems would
    // duplicate it, and the import guard rechecks anyway.
    const ghostHashes = new Set<string>()
    for (const file of remote) {
      const match = localByHash.get(file.properties.fileHash)
      if (match === undefined) continue
      if ((await sessionStemPresence(match.sessionId)) === 'absent') {
        ghostHashes.add(file.properties.fileHash)
      }
    }

    const scan: DriveScan = {
      inDrive: remote.length,
      here: local.length,
      toBackUp: local
        .filter((s) => !remoteByHash.has(s.fileHash as string))
        .map((s) => ({
          fileHash: s.fileHash as string,
          title: titleOf(s),
          ref: s.sessionId,
        })),
      toRestore: remote
        .filter(
          (f) =>
            !localByHash.has(f.properties.fileHash) ||
            ghostHashes.has(f.properties.fileHash),
        )
        .map((f) => ({
          fileHash: f.properties.fileHash,
          title: f.name.endsWith(SONG_FILE_SUFFIX)
            ? f.name.slice(0, -SONG_FILE_SUFFIX.length)
            : f.name,
          ref: f.fileId,
          bytes: f.bytes,
        })),
    }
    setDriveScan(scan)
    return scan
  } catch (error) {
    noteError(error)
    return null
  } finally {
    setDriveBusy(false)
  }
}

/** Stop a running backup or restore after the slice in flight. */
export function stopDriveJob(): void {
  jobAbort.aborted = true
}

function startJob(kind: DriveJob['kind'], total: number): void {
  jobAbort = { aborted: false }
  setDriveJob({ kind, title: '', done: 0, total, ratio: 0, failed: 0 })
  setDriveJobFailures([])
  // The screen going to sleep is the number-one way a phone backup dies:
  // the OS freezes the page and the job stalls where it stood. Held for
  // the job, released with it. (Best effort — the browser refuses the
  // lock when the page is hidden or the battery is low, and the job
  // still works without it.)
  void platform.keepAwake.enable()
}

function endJob(): void {
  setDriveJob(null)
  void platform.keepAwake.disable()
}

function advanceJob(patch: Partial<DriveJob>): void {
  setDriveJob((job) => (job === null ? null : { ...job, ...patch }))
}

/**
 * Upload every song that is here but not in Drive, one at a time.
 *
 * One at a time on purpose: packing a song is minutes of encoding on a
 * phone, and two at once compete for the same decoder while doubling
 * peak memory. A song that fails is counted and stepped over -- one
 * unreadable stem must not strand the other twenty.
 */
export async function backUpToDrive(): Promise<void> {
  forgetIfAccountChanged()
  const scan = driveScan() ?? (await scanDrive())
  if (scan === null) return
  const queue = scan.toBackUp
  if (queue.length === 0) return

  setDriveError(null)
  startJob('backup', queue.length)
  const drive = driveClient()
  let done = 0
  let failed = 0

  try {
    const folderId = await resolveFolder(drive)
    for (const song of queue) {
      if (jobAbort.aborted) break
      advanceJob({ title: song.title, ratio: 0 })
      try {
        // Packing reports 0-1 within EACH part, so a bar wired straight
        // to it would snap back to zero as every stem began -- which
        // reads as the job restarting. Counting the parts as they arrive
        // gives a bar that only moves forward, without having to know how
        // many parts a song has before it is packed.
        const partsSeen = new Set<string>()
        const bundle = await buildPortableBundle(song.ref, {
          signal: jobAbort,
          // Packing is most of the wall clock; the upload that follows is
          // fast by comparison, so the bar tracks packing to 90%.
          onProgress: (p) => {
            partsSeen.add(p.part)
            const of = Math.max(partsSeen.size, 2)
            advanceJob({ ratio: ((partsSeen.size - 1 + p.ratio) / of) * 0.9 })
          },
        })
        if (jobAbort.aborted) break
        const container = buildContainerBlob(bundle)
        // Two more tries for transient trouble: a router blip must not
        // cost a song that took minutes to pack. Auth failures and Stop
        // pass straight through — retrying those helps nobody.
        let uploaded = false
        let lastError: unknown = null
        for (
          let attempt = 1;
          attempt <= UPLOAD_ATTEMPTS && !uploaded;
          attempt += 1
        ) {
          if (attempt > 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * (attempt - 1)),
            )
            if (jobAbort.aborted) break
          }
          try {
            await drive.uploadSong(
              folderId,
              container,
              {
                // The scan's title, not the manifest's: the manifest
                // carries the raw upload name, and "Song.mp3.mpsong"
                // is a Drive listing nobody should have to read.
                title: song.title,
                properties: {
                  fileHash: bundle.manifest.song.fileHash,
                  quality: bundle.manifest.song.quality,
                  ...(bundle.manifest.song.durationSec !== undefined
                    ? { durationSec: bundle.manifest.song.durationSec }
                    : {}),
                },
              },
              {
                signal: jobAbort,
                onProgress: (sent, total) =>
                  advanceJob({
                    ratio: 0.9 + (total === 0 ? 0 : sent / total) * 0.1,
                  }),
              },
            )
            uploaded = true
          } catch (error) {
            if (error instanceof DriveAuthError) throw error
            lastError = error
            if (jobAbort.aborted) break
          }
        }
        if (!uploaded) throw lastError ?? new Error('The upload failed.')
        done += 1
        // ratio back to 0, not 1: the bar reads (done + ratio) / total,
        // so leaving it at 1 counts the finished song twice and the next
        // song's reset then slides the bar visibly backwards.
        advanceJob({ done, ratio: 0 })
        // The headline figures move as each song lands, so somebody
        // deciding whether to press Stop can see what they would keep.
        // The rescan at the end is still the authoritative count.
        setDriveScan((prev) =>
          prev === null
            ? null
            : {
                ...prev,
                inDrive: prev.inDrive + 1,
                toBackUp: prev.toBackUp.filter(
                  (c) => c.fileHash !== song.fileHash,
                ),
              },
        )
      } catch (error) {
        if (error instanceof DriveAuthError) throw error
        // Stopping throws from inside the encoder and the uploader both.
        // Counting that as a failure would tell somebody who pressed Stop
        // that their song could not be backed up.
        if (jobAbort.aborted) break
        failed += 1
        advanceJob({ failed })
        setDriveJobFailures((list) => [
          ...list,
          { title: song.title, reason: describeSongFailure(error) },
        ])
        console.warn(`[drive] "${song.title}" could not be backed up:`, error)
      }
    }

    const stopped = jobAbort.aborted
    showNotification(
      done === 0 && failed > 0
        ? 'No songs could be backed up to Drive.'
        : `${done} ${done === 1 ? 'song' : 'songs'} backed up to Drive${
            failed > 0 ? `, ${failed} could not be` : ''
          }${stopped ? ' before you stopped' : ''}.`,
      failed > 0 ? 'warning' : 'success',
    )
  } catch (error) {
    noteError(error)
  } finally {
    endJob()
    await scanDrive()
  }
}

/**
 * Read a container's header, fetching more only if the manifest is big.
 *
 * One request covers every real song; the second branch exists so a
 * future format with a longer manifest does not need a new reader.
 */
async function readContainerHeader(
  drive: DriveClient,
  fileId: string,
  fileBytes: number,
): Promise<ParsedContainerHeader> {
  const first = Math.min(CONTAINER_HEAD_FETCH_BYTES, Math.max(fileBytes, 12))
  let bytes = await drive.downloadRange(fileId, 0, first)
  let head = parseContainerHead(bytes)
  if (head.outcome === 'need-more') {
    bytes = await drive.downloadRange(fileId, 0, head.wanted)
    head = parseContainerHead(bytes)
  }
  if (head.outcome !== 'ok') {
    throw new Error('That file is not a song this version can read.')
  }
  return head.header
}

/**
 * Download every song that is in Drive but not here, one part at a time.
 *
 * `importPortableBundle` drives this: it asks for a part, and the range
 * read that answers is the whole transport. Nothing assembles the file
 * locally, so restoring a library onto a phone never needs more free
 * memory than its largest single part.
 */
export async function restoreFromDrive(): Promise<void> {
  forgetIfAccountChanged()
  const scan = driveScan() ?? (await scanDrive())
  if (scan === null) return
  const queue = scan.toRestore
  if (queue.length === 0) return

  setDriveError(null)
  startJob('restore', queue.length)
  const drive = driveClient()
  let done = 0
  let failed = 0

  try {
    for (const song of queue) {
      if (jobAbort.aborted) break
      advanceJob({ title: song.title, ratio: 0 })
      try {
        const header = await readContainerHeader(
          drive,
          song.ref,
          song.bytes ?? CONTAINER_HEAD_FETCH_BYTES,
        )
        const ranges = containerPartRanges(header)
        const totalBytes = header.manifest.parts.reduce(
          (n, p) => n + p.bytes,
          0,
        )
        let pulled = 0

        const getPart = async (info: PortablePartInfo): Promise<Uint8Array> => {
          if (jobAbort.aborted) throw new Error('Restore stopped.')
          const range = ranges.get(info.id)
          if (range === undefined) {
            throw new Error(`The file has no ${info.id} part.`)
          }
          const bytes = await drive.downloadRange(
            song.ref,
            range.start,
            range.end,
          )
          pulled += info.bytes
          advanceJob({ ratio: totalBytes === 0 ? 1 : pulled / totalBytes })
          return bytes
        }

        // Corruption is caught inside importPortableBundle, against the
        // manifest hash, and a torn import rolls itself back -- the same
        // guarantees the peer transport gets, from the same code.
        await importPortableBundle(header.manifest, getPart)
        done += 1
        // ratio back to 0, not 1: the bar reads (done + ratio) / total,
        // so leaving it at 1 counts the finished song twice and the next
        // song's reset then slides the bar visibly backwards.
        advanceJob({ done, ratio: 0 })
        // Headline figures move as each song arrives — the same live
        // count the backup keeps, for the same Stop decision.
        setDriveScan((prev) =>
          prev === null
            ? null
            : {
                ...prev,
                here: prev.here + 1,
                toRestore: prev.toRestore.filter(
                  (c) => c.fileHash !== song.fileHash,
                ),
              },
        )
      } catch (error) {
        if (error instanceof DriveAuthError) throw error
        // The stop signal reaches this as a thrown error from getPart; it
        // is the person's own choice, not a song that would not come down.
        if (jobAbort.aborted) break
        failed += 1
        advanceJob({ failed })
        setDriveJobFailures((list) => [
          ...list,
          { title: song.title, reason: describeSongFailure(error) },
        ])
        console.warn(`[drive] "${song.title}" could not be restored:`, error)
      }
    }

    const stopped = jobAbort.aborted
    showNotification(
      done === 0 && failed > 0
        ? 'No songs could be restored from Drive.'
        : `${done} ${done === 1 ? 'song' : 'songs'} restored from Drive${
            failed > 0 ? `, ${failed} could not be` : ''
          }${stopped ? ' before you stopped' : ''}.`,
      failed > 0 ? 'warning' : 'success',
    )
  } catch (error) {
    noteError(error)
  } finally {
    endJob()
    await scanDrive()
  }
}
