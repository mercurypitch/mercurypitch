// The Drive client against a fake Drive. Everything here is a behaviour
// that only shows up against the real API on somebody's slow connection:
// a resumable upload that gets a short slice acknowledged, a Range read
// answered with the whole file, a token that expired mid-song. Each of
// those silently corrupts or strands a song if it is handled wrongly, and
// none of them are reproducible by hand.

import { describe, expect, it, vi } from 'vitest'
import { createDriveClient, DRIVE_FOLDER_NAME, DriveApiError, DriveAuthError, SONG_FILE_SUFFIX, UPLOAD_CHUNK_BYTES, UPLOAD_STALL_LIMIT, } from '@/lib/drive/drive-client'

interface Call {
  url: string
  init: RequestInit
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A fetch that answers from a queue of handlers, recording every call. */
function fakeFetch(handlers: ((call: Call) => Response | null)[]) {
  const calls: Call[] = []
  const impl = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init }
    calls.push(call)
    for (const handler of handlers) {
      const res = handler(call)
      if (res !== null) return Promise.resolve(res)
    }
    return Promise.resolve(new Response('unhandled', { status: 500 }))
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

function clientWith(
  handlers: ((call: Call) => Response | null)[],
  getToken: (forceFresh?: boolean) => Promise<string | null> = () =>
    Promise.resolve('tok'),
) {
  const { impl, calls } = fakeFetch(handlers)
  return { client: createDriveClient({ getToken, fetchImpl: impl }), calls }
}

describe('drive client — the folder', () => {
  it('uses the folder that is already there', async () => {
    const { client, calls } = clientWith([
      (c) =>
        c.url.includes('/files?q=')
          ? jsonResponse({ files: [{ id: 'folder-1' }] })
          : null,
    ])
    expect(await client.ensureFolder()).toBe('folder-1')
    // One lookup and no creation: a second folder of the same name is a
    // library split in half, and Drive allows duplicate names.
    expect(calls).toHaveLength(1)
    expect(decodeURIComponent(calls[0]!.url)).toContain(
      `name = '${DRIVE_FOLDER_NAME}'`,
    )
  })

  it('creates the folder the first time, and names it plainly', async () => {
    const { client, calls } = clientWith([
      (c) => (c.url.includes('/files?q=') ? jsonResponse({ files: [] }) : null),
      (c) =>
        c.init.method === 'POST' ? jsonResponse({ id: 'folder-new' }) : null,
    ])
    expect(await client.ensureFolder()).toBe('folder-new')
    const body = JSON.parse(String(calls[1]!.init.body)) as {
      name: string
      mimeType: string
    }
    expect(body.name).toBe(DRIVE_FOLDER_NAME)
    expect(body.mimeType).toBe('application/vnd.google-apps.folder')
  })

  it('REQ-DRV-016: trusts the remembered id over the name', async () => {
    // The user renamed the folder in Drive. The id still resolves, so
    // nothing is created — a name-only lookup here would quietly make a
    // second "MercuryPitch" and split the library in half.
    const { client, calls } = clientWith([
      (c) =>
        c.url.includes('/files/folder-kept?fields=id,trashed')
          ? jsonResponse({ id: 'folder-kept', trashed: false })
          : null,
    ])
    expect(await client.ensureFolder('folder-kept')).toBe('folder-kept')
    expect(calls).toHaveLength(1)
  })

  it('falls back to the name when the remembered folder is gone', async () => {
    const { client, calls } = clientWith([
      (c) =>
        c.url.includes('/files/folder-gone?fields=id,trashed')
          ? new Response('not found', { status: 404 })
          : null,
      (c) =>
        c.url.includes('/files?q=')
          ? jsonResponse({ files: [{ id: 'folder-1' }] })
          : null,
    ])
    expect(await client.ensureFolder('folder-gone')).toBe('folder-1')
    expect(calls).toHaveLength(2)
  })

  it('does not trust a remembered folder sitting in the trash', async () => {
    // Trashed is not gone: uploads into a trashed folder vanish with it
    // in thirty days, silently.
    const { client } = clientWith([
      (c) =>
        c.url.includes('fields=id,trashed')
          ? jsonResponse({ id: 'folder-t', trashed: true })
          : null,
      (c) =>
        c.url.includes('/files?q=')
          ? jsonResponse({ files: [{ id: 'folder-fresh' }] })
          : null,
    ])
    expect(await client.ensureFolder('folder-t')).toBe('folder-fresh')
  })
})

describe('drive client — listing', () => {
  it('follows paging to the end and ignores files that are not songs', async () => {
    let page = 0
    const { client } = clientWith([
      (c) => {
        if (!c.url.includes('/files?q=')) return null
        page += 1
        if (page === 1) {
          return jsonResponse({
            nextPageToken: 'page-2',
            files: [
              {
                id: 'a',
                name: `One${SONG_FILE_SUFFIX}`,
                size: '100',
                modifiedTime: '2026-01-01T00:00:00Z',
                appProperties: {
                  mpKind: 'song',
                  fileHash: 'h-a',
                  quality: 'portable-128',
                  durationSec: '90',
                },
              },
              // Something the user dropped in the folder by hand, or an
              // older file of ours: no hash means nothing can be matched
              // against the library, so it is not a song we know.
              { id: 'junk', name: 'notes.txt', appProperties: {} },
            ],
          })
        }
        return jsonResponse({
          files: [
            {
              id: 'b',
              name: `Two${SONG_FILE_SUFFIX}`,
              size: '200',
              appProperties: { mpKind: 'song', fileHash: 'h-b' },
            },
          ],
        })
      },
    ])

    const songs = await client.listSongs('folder-1')
    expect(songs.map((s) => s.fileId)).toEqual(['a', 'b'])
    expect(songs[0]!.properties).toEqual({
      fileHash: 'h-a',
      quality: 'portable-128',
      durationSec: 90,
    })
    expect(songs[0]!.bytes).toBe(100)
    // A file written before the quality property existed still restores.
    expect(songs[1]!.properties.quality).toBe('portable-128')
    expect(songs[1]!.properties.durationSec).toBeUndefined()
  })
})

describe('drive client — upload', () => {
  const container = (bytes: number): Blob =>
    new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' })

  /** Answers the post-upload size check with what Drive "stored". */
  const storedSize =
    (bytes: number) =>
    (c: Call): Response | null =>
      c.url.includes('fields=size')
        ? jsonResponse({ size: String(bytes) })
        : null

  it('refuses an upload Drive stored short, and trashes the remnant', async () => {
    // The resumable protocol verifies offsets, not arrival. A truncated
    // file discovered at restore time, on the replacement device, is a
    // song lost for good — so the size is checked while the original is
    // still here to send again.
    const trashed: string[] = []
    const { client } = clientWith([
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-7' },
            })
          : null,
      (c) =>
        c.url.startsWith('https://upload.example/')
          ? jsonResponse({ id: 'file-7' })
          : null,
      storedSize(3),
      (c) => {
        if (c.init.method !== 'PATCH' || !c.url.includes('/files/file-7')) {
          return null
        }
        trashed.push(c.url)
        return jsonResponse({ id: 'file-7' })
      },
    ])

    await expect(
      client.uploadSong('f', container(16), {
        title: 'T',
        properties: { fileHash: 'h', quality: 'portable-128' },
      }),
    ).rejects.toThrow(/did not arrive intact/)
    // The bad copy is trashed so the next scan offers the song again
    // instead of counting a truncated file as a backup.
    expect(trashed).toHaveLength(1)
  })

  it('opens a session, sends slices, and reports honest progress', async () => {
    const size = UPLOAD_CHUNK_BYTES * 2 + 10
    const ranges: string[] = []
    const { client, calls } = clientWith([
      storedSize(size),
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-1' },
            })
          : null,
      (c) => {
        if (!c.url.startsWith('https://upload.example/')) return null
        const range = String(
          (c.init.headers as Record<string, string>)['Content-Range'],
        )
        ranges.push(range)
        return ranges.length < 3
          ? new Response(null, {
              status: 308,
              headers: {
                Range: `bytes=0-${UPLOAD_CHUNK_BYTES * ranges.length - 1}`,
              },
            })
          : jsonResponse({ id: 'file-1' })
      },
    ])

    const seen: number[] = []
    const fileId = await client.uploadSong(
      'folder-1',
      container(size),
      {
        title: 'My Song',
        properties: {
          fileHash: 'h-1',
          quality: 'portable-128',
          durationSec: 90.4,
        },
      },
      { onProgress: (sent) => seen.push(sent) },
    )

    expect(fileId).toBe('file-1')
    expect(ranges).toEqual([
      `bytes 0-${UPLOAD_CHUNK_BYTES - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_BYTES}-${UPLOAD_CHUNK_BYTES * 2 - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_BYTES * 2}-${size - 1}/${size}`,
    ])
    expect(seen[seen.length - 1]).toBe(size)

    const meta = JSON.parse(String(calls[0]!.init.body)) as {
      name: string
      parents?: string[]
      appProperties: Record<string, string>
    }
    // The visible name carries the title, because the point of a plain
    // Drive folder is that the user can recognise what is in it.
    expect(meta.name).toBe(`My Song${SONG_FILE_SUFFIX}`)
    expect(meta.parents).toEqual(['folder-1'])
    expect(meta.appProperties.fileHash).toBe('h-1')
    expect(meta.appProperties.durationSec).toBe('90')
  })

  it("resumes from Drive's offset, not its own counter", async () => {
    const size = UPLOAD_CHUNK_BYTES * 2
    const ranges: string[] = []
    const { client } = clientWith([
      storedSize(size),
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-2' },
            })
          : null,
      (c) => {
        if (!c.url.startsWith('https://upload.example/')) return null
        ranges.push(
          String((c.init.headers as Record<string, string>)['Content-Range']),
        )
        // A proxy delivered only half the first slice. Believing our own
        // counter here would skip those bytes and store a corrupt song
        // that nothing complains about until it is played.
        if (ranges.length === 1) {
          return new Response(null, {
            status: 308,
            headers: { Range: `bytes=0-${UPLOAD_CHUNK_BYTES / 2 - 1}` },
          })
        }
        if (ranges.length === 2) {
          return new Response(null, {
            status: 308,
            headers: {
              Range: `bytes=0-${UPLOAD_CHUNK_BYTES + UPLOAD_CHUNK_BYTES / 2 - 1}`,
            },
          })
        }
        return jsonResponse({ id: 'file-2' })
      },
    ])

    await client.uploadSong('f', new Blob([new Uint8Array(size)]), {
      title: 'T',
      properties: { fileHash: 'h', quality: 'portable-128' },
    })
    // Every later slice starts where Drive said it stopped, so the half
    // it never received is sent again rather than skipped.
    expect(ranges).toEqual([
      `bytes 0-${UPLOAD_CHUNK_BYTES - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_BYTES / 2}-${UPLOAD_CHUNK_BYTES + UPLOAD_CHUNK_BYTES / 2 - 1}/${size}`,
      `bytes ${UPLOAD_CHUNK_BYTES + UPLOAD_CHUNK_BYTES / 2}-${size - 1}/${size}`,
    ])
  })

  it('replaces in place when the song is already in Drive', async () => {
    const { client, calls } = clientWith([
      storedSize(8),
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-3' },
            })
          : null,
      (c) =>
        c.url.startsWith('https://upload.example/')
          ? jsonResponse({ id: 'file-3' })
          : null,
    ])

    const fileId = await client.uploadSong(
      'folder-1',
      new Blob([new Uint8Array(8)]),
      {
        title: 'T',
        properties: { fileHash: 'h', quality: 'portable-256' },
        existingFileId: 'file-3',
      },
    )
    expect(fileId).toBe('file-3')
    expect(calls[0]!.init.method).toBe('PATCH')
    expect(calls[0]!.url).toContain('/files/file-3?uploadType=resumable')
    // No parents on a replace: Drive treats that as a move request.
    expect(JSON.parse(String(calls[0]!.init.body))).not.toHaveProperty(
      'parents',
    )
  })

  it('re-sends a slice Drive did not keep, rather than skipping it', async () => {
    const size = UPLOAD_CHUNK_BYTES + 100
    const ranges: string[] = []
    const { client } = clientWith([
      storedSize(size),
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-5' },
            })
          : null,
      (c) => {
        if (!c.url.startsWith('https://upload.example/')) return null
        ranges.push(
          String((c.init.headers as Record<string, string>)['Content-Range']),
        )
        // 308 with NO Range header is Drive saying it stored NOTHING.
        // Reading that as "the slice landed" is what silently produces a
        // truncated song, or a 400 on the next, non-contiguous slice.
        if (ranges.length === 1) return new Response(null, { status: 308 })
        return ranges.length === 2
          ? new Response(null, {
              status: 308,
              headers: { Range: `bytes=0-${UPLOAD_CHUNK_BYTES - 1}` },
            })
          : jsonResponse({ id: 'file-5' })
      },
    ])

    expect(
      await client.uploadSong('f', container(size), {
        title: 'T',
        properties: { fileHash: 'h', quality: 'portable-128' },
      }),
    ).toBe('file-5')
    expect(ranges[0]).toBe(`bytes 0-${UPLOAD_CHUNK_BYTES - 1}/${size}`)
    expect(ranges[1]).toBe(ranges[0])
    expect(ranges[2]).toBe(`bytes ${UPLOAD_CHUNK_BYTES}-${size - 1}/${size}`)
  })

  it('gives up on a song Drive keeps acknowledging without storing', async () => {
    let slices = 0
    const { client } = clientWith([
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-6' },
            })
          : null,
      (c) => {
        if (!c.url.startsWith('https://upload.example/')) return null
        slices += 1
        // Never advances. Without a stall limit this is an infinite loop
        // with a frozen progress bar that only Stop can end.
        return new Response(null, { status: 308 })
      },
    ])

    await expect(
      client.uploadSong('f', container(UPLOAD_CHUNK_BYTES * 4), {
        title: 'T',
        properties: { fileHash: 'h', quality: 'portable-128' },
      }),
    ).rejects.toThrow(/made no progress/)
    expect(slices).toBe(UPLOAD_STALL_LIMIT + 1)
  })

  it('cancels the session when the upload is abandoned', async () => {
    const { client, calls } = clientWith([
      (c) =>
        c.url.includes('uploadType=resumable')
          ? new Response(null, {
              status: 200,
              headers: { Location: 'https://upload.example/session-4' },
            })
          : null,
      (c) =>
        c.init.method === 'DELETE' ? new Response(null, { status: 204 }) : null,
    ])

    await expect(
      client.uploadSong(
        'f',
        new Blob([new Uint8Array(16)]),
        { title: 'T', properties: { fileHash: 'h', quality: 'portable-128' } },
        { signal: { aborted: true } },
      ),
    ).rejects.toThrow(/cancelled/)
    // Left alone, an abandoned session is a half-written file sitting in
    // the user's Drive for a week.
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(true)
  })
})

describe('drive client — download', () => {
  it('range-reads one part', async () => {
    const whole = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
    const { client, calls } = clientWith([
      (c) =>
        c.url.includes('alt=media')
          ? new Response(whole.subarray(2, 5), { status: 206 })
          : null,
    ])
    expect(await client.downloadRange('file-1', 2, 5)).toEqual(
      new Uint8Array([2, 3, 4]),
    )
    expect((calls[0]!.init.headers as Record<string, string>).Range).toBe(
      'bytes=2-4',
    )
  })

  it('slices for itself when Range is ignored', async () => {
    const whole = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
    const { client } = clientWith([
      // A proxy that answers 200 with the whole body. Wasteful, but the
      // part must still verify against its hash, so take our own slice
      // rather than handing the caller the wrong bytes.
      (c) =>
        c.url.includes('alt=media')
          ? new Response(whole, { status: 200 })
          : null,
    ])
    expect(await client.downloadRange('file-1', 6, 8)).toEqual(
      new Uint8Array([6, 7]),
    )
  })
})

describe('drive client — expiry and revocation', () => {
  it('mints a fresh token once when the old one expired mid-song', async () => {
    const asked: (boolean | undefined)[] = []
    let served = 0
    const { client } = clientWith(
      [
        (c) => {
          if (!c.url.includes('/files?q=')) return null
          served += 1
          return served === 1
            ? new Response('expired', { status: 401 })
            : jsonResponse({ files: [{ id: 'folder-1' }] })
        },
      ],
      (forceFresh) => {
        asked.push(forceFresh)
        return Promise.resolve(forceFresh === true ? 'fresh' : 'stale')
      },
    )

    // The user sees nothing: a token that lapsed during a long upload is
    // an implementation detail, not an error to act on.
    expect(await client.ensureFolder()).toBe('folder-1')
    expect(asked).toEqual([false, true])
  })

  it('gives up as a reconnect, not a retry loop, when the grant is gone', async () => {
    const { client } = clientWith(
      [
        (c) =>
          c.url.includes('/files?q=')
            ? new Response('no', { status: 401 })
            : null,
      ],
      () => Promise.resolve('tok'),
    )
    await expect(client.ensureFolder()).rejects.toBeInstanceOf(DriveAuthError)
  })

  it('says so when the worker cannot mint a token at all', async () => {
    const { client } = clientWith([() => jsonResponse({})], () =>
      Promise.resolve(null),
    )
    await expect(client.ensureFolder()).rejects.toBeInstanceOf(DriveAuthError)
  })

  it('carries the status through on a plain refusal', async () => {
    const { client } = clientWith([
      (c) =>
        c.url.includes('/files?q=')
          ? new Response('nope', { status: 403 })
          : null,
    ])
    const error = await client.ensureFolder().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DriveApiError)
    expect((error as DriveApiError).status).toBe(403)
  })
})
