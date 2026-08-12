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
import { disconnectDrive, driveConnectUrl, fetchDriveAccessToken, fetchDriveStatus, } from '@/db/services/auth-service'
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import type { DriveClient, DriveSongFile } from '@/lib/drive/drive-client'
import { createDriveClient, DriveAuthError, SONG_FILE_SUFFIX, } from '@/lib/drive/drive-client'
import type { EncodeAbort } from '@/lib/portable/portable-audio'
import type { PortablePartInfo } from '@/lib/portable/portable-bundle'
import type { ParsedContainerHeader } from '@/lib/portable/portable-container'
import { buildContainerBlob, CONTAINER_HEAD_FETCH_BYTES, containerPartRanges, parseContainerHead, } from '@/lib/portable/portable-container'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessions } from '@/stores/uvr-store'

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

const [driveState, setDriveState] =
  createSignal<DriveConnectionState>('unknown')
const [driveEmail, setDriveEmail] = createSignal<string | null>(null)
const [driveError, setDriveError] = createSignal<string | null>(null)
const [driveScan, setDriveScan] = createSignal<DriveScan | null>(null)
const [driveJob, setDriveJob] = createSignal<DriveJob | null>(null)
const [driveBusy, setDriveBusy] = createSignal(false)

export { driveBusy, driveEmail, driveError, driveJob, driveScan, driveState }

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

async function accessToken(forceFresh = false): Promise<string | null> {
  const now = Date.now()
  if (!forceFresh && token !== null && token.expiresAt > now) return token.value
  const minted = await fetchDriveAccessToken()
  if (!minted.ok) {
    token = null
    if (minted.reason === 'disconnected') {
      // The grant is gone on Google's side. Saying "connected" after this
      // would offer buttons that cannot work.
      setDriveState('disconnected')
      setDriveEmail(null)
    }
    return null
  }
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

/** Songs this device can actually send: separated, hashed, playable. */
function localSongs(): UvrSession[] {
  return getAllUvrSessions().filter(
    (s) =>
      s.status === 'completed' &&
      s.fileHash !== undefined &&
      s.fileHash !== '' &&
      (s.outputs?.vocal !== undefined || s.outputs?.instrumental !== undefined),
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

/**
 * Turn a thrown error into the state it implies.
 *
 * A dead grant is not a failure to retry: every later request would fail
 * the same way, so the connection is marked gone and the UI offers
 * reconnect instead of "try again".
 */
function noteError(error: unknown): void {
  if (error instanceof DriveAuthError) {
    setDriveState('disconnected')
    setDriveEmail(null)
    token = null
  }
  setDriveError(describe(error))
}

/** Ask the worker whether this account has Drive connected. */
export async function refreshDriveStatus(): Promise<void> {
  const status = await fetchDriveStatus()
  setDriveState(status.connected ? 'connected' : 'disconnected')
  setDriveEmail(status.email ?? null)
  if (!status.connected) {
    token = null
    setDriveScan(null)
  }
}

/** Start the connect-Drive redirect. Leaves the app. */
export function connectDrive(): void {
  window.location.href = driveConnectUrl()
}

/** Forget the grant here and on the worker. */
export async function disconnectDriveSync(): Promise<void> {
  setDriveBusy(true)
  try {
    await disconnectDrive()
  } finally {
    token = null
    client = null
    setDriveScan(null)
    setDriveJob(null)
    setDriveState('disconnected')
    setDriveEmail(null)
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
  setDriveBusy(true)
  setDriveError(null)
  try {
    const drive = driveClient()
    const folderId = await drive.ensureFolder()
    const remote = await drive.listSongs(folderId)
    const local = localSongs()

    const remoteByHash = new Map<string, DriveSongFile>()
    for (const file of remote) remoteByHash.set(file.properties.fileHash, file)
    const localHashes = new Set(local.map((s) => s.fileHash as string))

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
        .filter((f) => !localHashes.has(f.properties.fileHash))
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
    const folderId = await drive.ensureFolder()
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
        await drive.uploadSong(
          folderId,
          container,
          {
            title: bundle.manifest.song.title,
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
        done += 1
        advanceJob({ done, ratio: 1 })
      } catch (error) {
        if (error instanceof DriveAuthError) throw error
        // Stopping throws from inside the encoder and the uploader both.
        // Counting that as a failure would tell somebody who pressed Stop
        // that their song could not be backed up.
        if (jobAbort.aborted) break
        failed += 1
        advanceJob({ failed })
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
    setDriveJob(null)
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
        advanceJob({ done, ratio: 1 })
      } catch (error) {
        if (error instanceof DriveAuthError) throw error
        // The stop signal reaches this as a thrown error from getPart; it
        // is the person's own choice, not a song that would not come down.
        if (jobAbort.aborted) break
        failed += 1
        advanceJob({ failed })
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
    setDriveJob(null)
    await scanDrive()
  }
}
