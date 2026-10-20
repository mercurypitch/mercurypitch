// ============================================================
// Lesson state client — what the studio sends, and how it reads each answer
// ============================================================
//
// The client is the page's only way to the lesson-state API, so these hold
// the wire: the paths, the method, the credential and the body it sends,
// and every kind of answer it can get back, refusals and a dead network
// included. `fetch` is the stand-in, the true edge.

import { describe, expect, it, vi } from 'vitest'
import type { Fetcher } from './lesson-admin'
import { fetchLessonLog, fetchLessonState, saveLesson, } from './lesson-state-client'

function answering(status: number, body: unknown) {
  return vi.fn<Fetcher>(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

const ROW = {
  lesson: 3,
  published: true,
  hook: null,
  tease: null,
  updatedAt: '2026-10-20T14:02:00.000Z',
  updatedBy: 'owner@example',
}

describe('fetchLessonState', () => {
  it('reads the public state past the HTTP cache, sending no credential', async () => {
    const fetcher = answering(200, {
      version: 1,
      updatedAt: '2026-10-20T14:02:00.000Z',
      lessons: { '3': { published: true, hook: 'Not An Id' } },
    })

    const result = await fetchLessonState(fetcher)

    expect(fetcher.mock.calls).toEqual([
      ['/api/lessons/state', { cache: 'no-store' }],
    ])
    expect(result).toEqual({
      ok: true,
      value: {
        version: 1,
        updatedAt: '2026-10-20T14:02:00.000Z',
        lessons: { '3': { published: true } },
      },
    })
  })

  it('will not read a state in a version it does not know', async () => {
    const result = await fetchLessonState(
      answering(200, { version: 2, lessons: {} }),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unreadable',
        message: 'The content API answered something this page cannot read.',
      },
    })
  })
})

describe('saveLesson', () => {
  it('sends one PUT for the lesson, with the admin key and the patch as JSON', async () => {
    const fetcher = answering(200, { row: ROW, changed: ['published'] })

    const result = await saveLesson('the-key', 3, { published: true }, fetcher)

    expect(fetcher.mock.calls).toEqual([
      [
        '/api/admin/lessons/3',
        {
          method: 'PUT',
          headers: {
            'X-Admin-Key': 'the-key',
            'Content-Type': 'application/json',
          },
          body: '{"published":true}',
        },
      ],
    ])
    expect(result).toEqual({
      ok: true,
      value: { row: ROW, changed: ['published'] },
    })
  })

  it('sends null as null, which clears the field back to the default', async () => {
    const fetcher = answering(200, { row: null, changed: ['hook'] })

    const result = await saveLesson('the-key', 3, { hook: null }, fetcher)

    expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"hook":null}')
    expect(result).toEqual({
      ok: true,
      value: { row: null, changed: ['hook'] },
    })
  })

  it('reads a refused key as its own kind, in the API words', async () => {
    const result = await saveLesson(
      'wrong',
      3,
      { published: true },
      answering(403, { error: 'Admin key required' }),
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'forbidden', message: 'Admin key required' },
    })
  })

  it("passes on the API's error text for a body it refused", async () => {
    const result = await saveLesson(
      'the-key',
      3,
      {},
      answering(400, {
        error: 'Set at least one of published, hook, or tease',
      }),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'refused',
        status: 400,
        message: 'Set at least one of published, hook, or tease',
      },
    })
  })

  it('names the status when a refusal carries no error text', async () => {
    const result = await saveLesson(
      'the-key',
      3,
      { tease: 'stair' },
      answering(502, '<html>Bad gateway</html>'),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'refused',
        status: 502,
        message: 'The content API answered 502.',
      },
    })
  })

  it('reads a request that never reached the API as offline, not as a refusal', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('Failed to fetch')
    })

    const result = await saveLesson('the-key', 3, { published: false }, fetcher)

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'offline',
        message: 'The content API could not be reached.',
      },
    })
  })

  it('will not take an answer without its row for a saved one', async () => {
    const result = await saveLesson(
      'the-key',
      3,
      { published: true },
      answering(200, { changed: ['published'] }),
    )

    expect(result).toMatchObject({ ok: false, error: { kind: 'unreadable' } })
  })
})

describe('fetchLessonLog', () => {
  it("asks for one lesson's changes with the admin key, past the cache, and keeps only the ones it can read", async () => {
    const good = {
      id: 7,
      lesson: 3,
      field: 'published',
      oldValue: null,
      newValue: true,
      changedAt: '2026-10-20T14:02:00.000Z',
      changedBy: null,
    }
    const fetcher = answering(200, {
      changes: [good, { ...good, id: 6, field: 'colour' }, { id: 5 }],
    })

    const result = await fetchLessonLog('the-key', 3, fetcher)

    expect(fetcher.mock.calls).toEqual([
      [
        '/api/admin/lessons/log?lesson=3',
        { headers: { 'X-Admin-Key': 'the-key' }, cache: 'no-store' },
      ],
    ])
    expect(result).toEqual({ ok: true, value: [good] })
  })

  it('reads a refused key on the log as forbidden too', async () => {
    const result = await fetchLessonLog(
      'wrong',
      3,
      answering(403, { error: 'Admin key required' }),
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'forbidden', message: 'Admin key required' },
    })
  })
})
