// ── Google Drive client ──────────────────────────────────────────────
// The handful of Drive REST calls sync needs, and nothing else.
//
// Talks to googleapis.com straight from the browser: the audio must
// never transit our servers, so the worker's only role is minting the
// short-lived access token this client is handed (see auth-service's
// fetchDriveAccessToken). Scope is `drive.file` — this client can see
// and touch ONLY files this app created, which is both the privacy story
// and why a visible MercuryPitch folder full of one-file-per-song is the
// whole layout.
//
// Uploads are Drive's resumable protocol in fixed slices, so a dropped
// connection costs the slice, not the song. Downloads are Range reads at
// offsets computed from the container header (portable-container.ts) —
// a receiver pulls one part at a time and verifies each against the
// manifest, exactly as the P2P wire does.
//
// See docs/plans/device-sync.md (Phase 4).

export const DRIVE_FOLDER_NAME = 'MercuryPitch'
export const SONG_FILE_SUFFIX = '.mpsong'

/**
 * Upload slice size. Drive requires a multiple of 256 KiB for every
 * slice but the last; 4 MiB keeps a whole song to a few requests while
 * giving the progress bar a few honest steps.
 */
export const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024

/**
 * How many times a slice may be acknowledged without the offset moving
 * before the song is given up on. Re-sending a slice the server did not
 * keep is correct; doing it forever is a hung job with a frozen bar.
 */
export const UPLOAD_STALL_LIMIT = 3

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export class DriveApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
  }
}

/** The access token is dead and a fresh one could not be minted. */
export class DriveAuthError extends Error {
  constructor() {
    super('Google Drive access has expired — reconnect Drive to continue.')
    this.name = 'DriveAuthError'
  }
}

/** What sync stores alongside a song file, queryable without downloading. */
export interface DriveSongProperties {
  fileHash: string
  quality: string
  durationSec?: number
}

export interface DriveSongFile {
  fileId: string
  /** The visible file name, which carries the song title. */
  name: string
  bytes: number
  modifiedTime: string
  properties: DriveSongProperties
}

export interface DriveClientDeps {
  /**
   * A usable access token. `forceFresh` demands a new one — the client
   * asks for that exactly once after a 401 before giving up, so an
   * expired-mid-session token heals invisibly and a revoked grant
   * surfaces as DriveAuthError.
   */
  getToken: (forceFresh?: boolean) => Promise<string | null>
  fetchImpl?: typeof fetch
}

interface DriveFileResource {
  id?: string
  name?: string
  size?: string
  modifiedTime?: string
  appProperties?: Record<string, string>
}

export function createDriveClient(deps: DriveClientDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis)

  async function request(
    input: string,
    init: RequestInit = {},
    retriedAuth = false,
  ): Promise<Response> {
    const token = await deps.getToken(retriedAuth)
    if (token === null) throw new DriveAuthError()
    const res = await fetchImpl(input, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    })
    if (res.status === 401 && !retriedAuth) {
      return request(input, init, true)
    }
    if (res.status === 401) throw new DriveAuthError()
    return res
  }

  async function requestJson<T>(
    input: string,
    init: RequestInit = {},
  ): Promise<T> {
    const res = await request(input, init)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new DriveApiError(
        res.status,
        `Drive answered ${res.status}${detail !== '' ? `: ${detail.slice(0, 300)}` : ''}`,
      )
    }
    return (await res.json()) as T
  }

  /**
   * The MercuryPitch folder's id, creating the folder on first use.
   *
   * Looked up by name under the Drive root. Deliberately visible and
   * ordinarily named: the user should be able to open Drive and see
   * their songs as files, not find an opaque app-data blob.
   *
   * A remembered `preferredId` is tried first because it survives what a
   * name cannot: the user renaming or moving the folder in Drive. On a
   * name-only lookup a rename silently splits the library — the search
   * finds nothing, a second "MercuryPitch" folder appears, and the next
   * scan offers every song for re-upload.
   */
  async function ensureFolder(preferredId?: string | null): Promise<string> {
    if (
      preferredId !== undefined &&
      preferredId !== null &&
      preferredId !== ''
    ) {
      try {
        const known = await requestJson<{ id?: string; trashed?: boolean }>(
          `${API}/files/${preferredId}?fields=id,trashed`,
        )
        if (known.id !== undefined && known.trashed !== true) return known.id
      } catch (error) {
        // 404 means the remembered folder is gone for good (or belongs
        // to a different account): fall through to the name search.
        // Anything else — auth, a 5xx — would fail that search too, so
        // let it speak for itself.
        if (!(error instanceof DriveApiError) || error.status !== 404) {
          throw error
        }
      }
    }
    const q = encodeURIComponent(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`,
    )
    const found = await requestJson<{ files?: DriveFileResource[] }>(
      `${API}/files?q=${q}&fields=files(id)&pageSize=1`,
    )
    const existing = found.files?.[0]?.id
    if (existing !== undefined && existing !== '') return existing
    const created = await requestJson<DriveFileResource>(`${API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })
    if (created.id === undefined || created.id === '') {
      throw new DriveApiError(500, 'Drive did not return a folder id.')
    }
    return created.id
  }

  function toSongFile(file: DriveFileResource): DriveSongFile | null {
    const props = file.appProperties
    if (
      file.id === undefined ||
      props === undefined ||
      props['mpKind'] !== 'song' ||
      props['fileHash'] === undefined ||
      props['fileHash'] === ''
    ) {
      return null
    }
    const durationSec = Number(props['durationSec'])
    return {
      fileId: file.id,
      name: file.name ?? 'Untitled song',
      bytes: Number(file.size ?? 0),
      modifiedTime: file.modifiedTime ?? '',
      properties: {
        fileHash: props['fileHash'],
        quality: props['quality'] ?? 'portable-128',
        ...(Number.isFinite(durationSec) && durationSec > 0
          ? { durationSec }
          : {}),
      },
    }
  }

  /** Every song file in the folder, follows paging to the end. */
  async function listSongs(folderId: string): Promise<DriveSongFile[]> {
    const out: DriveSongFile[] = []
    let pageToken: string | undefined
    do {
      const q = encodeURIComponent(
        `'${folderId}' in parents and trashed = false and appProperties has { key = 'mpKind' and value = 'song' }`,
      )
      const fields = encodeURIComponent(
        'nextPageToken, files(id, name, size, modifiedTime, appProperties)',
      )
      const page = await requestJson<{
        files?: DriveFileResource[]
        nextPageToken?: string
      }>(
        `${API}/files?q=${q}&fields=${fields}&pageSize=1000${pageToken !== undefined ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      )
      for (const file of page.files ?? []) {
        const song = toSongFile(file)
        if (song !== null) out.push(song)
      }
      pageToken = page.nextPageToken
    } while (pageToken !== undefined && pageToken !== '')
    return out
  }

  /**
   * Upload one container, resumably.
   *
   * `existingFileId` turns this into an in-place replace (same file id,
   * new bytes and properties) — how a standard-quality backup is upgraded
   * without leaving two copies of a song.
   */
  async function uploadSong(
    folderId: string,
    container: Blob,
    meta: {
      title: string
      properties: DriveSongProperties
      existingFileId?: string
    },
    opts: {
      onProgress?: (sentBytes: number, totalBytes: number) => void
      signal?: { aborted: boolean }
    } = {},
  ): Promise<string> {
    const metadata: Record<string, unknown> = {
      name: `${meta.title}${SONG_FILE_SUFFIX}`,
      appProperties: {
        mpKind: 'song',
        fileHash: meta.properties.fileHash,
        quality: meta.properties.quality,
        ...(meta.properties.durationSec !== undefined
          ? { durationSec: String(Math.round(meta.properties.durationSec)) }
          : {}),
      },
      ...(meta.existingFileId === undefined ? { parents: [folderId] } : {}),
    }

    // 1. Open the resumable session: metadata now, bytes to follow.
    const sessionRes = await request(
      meta.existingFileId === undefined
        ? `${UPLOAD_API}/files?uploadType=resumable`
        : `${UPLOAD_API}/files/${meta.existingFileId}?uploadType=resumable`,
      {
        method: meta.existingFileId === undefined ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/octet-stream',
          'X-Upload-Content-Length': String(container.size),
        },
        body: JSON.stringify(metadata),
      },
    )
    if (!sessionRes.ok) {
      throw new DriveApiError(
        sessionRes.status,
        'Drive would not open an upload session.',
      )
    }
    const sessionUrl = sessionRes.headers.get('Location')
    if (sessionUrl === null || sessionUrl === '') {
      throw new DriveApiError(500, 'Drive did not return an upload session.')
    }

    // 2. Push the bytes in slices. 308 means "got it, keep going".
    const total = container.size
    let at = 0
    let fileId = meta.existingFileId ?? ''
    // Drive can acknowledge a 308 without having advanced -- a proxy that
    // dropped the body, a slice it refused to store. Re-sending is right,
    // re-sending forever is not: without this the loop spins on the same
    // 4 MiB with the progress bar frozen, and only the Stop button ends it.
    let stalledSlices = 0
    while (at < total) {
      if (opts.signal?.aborted === true) {
        // Tell Drive the session is dead so it does not linger for a week.
        await fetchImpl(sessionUrl, { method: 'DELETE' }).catch(() => {})
        throw new DriveApiError(0, 'The upload was cancelled.')
      }
      const end = Math.min(at + UPLOAD_CHUNK_BYTES, total)
      const chunk = container.slice(at, end)
      const res = await fetchImpl(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${at}-${end - 1}/${total}`,
        },
        body: chunk,
      })
      if (res.status === 308) {
        // Trust Drive's Range over our own counter: a proxy can deliver
        // a partial slice, and resuming from the wrong offset corrupts
        // the file silently.
        //
        // No Range header at all is Drive saying it has stored NOTHING --
        // that is the documented meaning, and reading it as "the slice
        // landed" is the version of this bug that produces a truncated
        // song or a 400 on the next, non-contiguous slice.
        const range = res.headers.get('Range')
        const match = range === null ? null : /bytes=0-(\d+)/.exec(range)
        const acknowledged = match === null ? 0 : Number(match[1]) + 1
        if (acknowledged <= at) {
          stalledSlices += 1
          if (stalledSlices > UPLOAD_STALL_LIMIT) {
            throw new DriveApiError(
              0,
              'Drive stopped accepting this song — the upload made no progress.',
            )
          }
        } else {
          stalledSlices = 0
          at = acknowledged
        }
      } else if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as DriveFileResource
        fileId = body.id ?? fileId
        at = total
      } else {
        throw new DriveApiError(
          res.status,
          `Drive refused an upload slice (${res.status}).`,
        )
      }
      opts.onProgress?.(Math.min(at, total), total)
    }
    if (fileId === '') {
      throw new DriveApiError(500, 'Drive did not return the uploaded file.')
    }
    // The resumable protocol verifies offsets, not arrival: a finalize
    // that slipped through a flaky proxy can leave a shorter file Drive
    // still reports as complete. Ask for the stored size and refuse a
    // mismatch — a truncated backup discovered at restore time, months
    // later on a replacement device, is a song lost for good. The bad
    // copy is trashed so the next scan offers the song again.
    const stored = await requestJson<{ size?: string }>(
      `${API}/files/${fileId}?fields=size`,
    )
    if (Number(stored.size ?? -1) !== total) {
      await trashFile(fileId).catch(() => {})
      throw new DriveApiError(
        0,
        'The upload did not arrive intact — Drive stored a different number of bytes than was sent.',
      )
    }
    return fileId
  }

  /**
   * Read bytes [start, endExclusive) of a file — one container part.
   *
   * Drive honors Range on media downloads with a 206; a 200 with the
   * whole body is tolerated (and sliced) so a misbehaving proxy degrades
   * to correct-but-wasteful rather than to corrupt.
   */
  async function downloadRange(
    fileId: string,
    start: number,
    endExclusive: number,
  ): Promise<Uint8Array> {
    const res = await request(`${API}/files/${fileId}?alt=media`, {
      headers: { Range: `bytes=${start}-${endExclusive - 1}` },
    })
    if (res.status === 206) {
      return new Uint8Array(await res.arrayBuffer())
    }
    if (res.ok) {
      const whole = new Uint8Array(await res.arrayBuffer())
      return whole.subarray(start, endExclusive).slice()
    }
    throw new DriveApiError(
      res.status,
      `Drive refused the download (${res.status}).`,
    )
  }

  /** Move a song file to the Drive trash (the user can still recover it). */
  async function trashFile(fileId: string): Promise<void> {
    await requestJson<DriveFileResource>(`${API}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }

  return {
    ensureFolder,
    listSongs,
    uploadSong,
    downloadRange,
    trashFile,
  }
}

export type DriveClient = ReturnType<typeof createDriveClient>
