// ============================================================
// mirror-metrics tests — which numbers a funnel event may keep
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { GUIDE_FUNNEL_EVENTS, TOUR_FUNNEL_EVENTS, } from '../../../src/lib/funnel-event-catalog'
import type { Env } from './auth'
import worker from './index'
import { cleanMirrorMetrics, LESSON_ANSWER_BOUNDS, LESSON_ANSWER_METRIC_KEYS, lessonAnswerInBounds, MIRROR_METRIC_KEYS, TOUR_METRIC_KEYS, } from './mirror-metrics'

describe('cleanMirrorMetrics', () => {
  it('keeps tour, step and of on a tour event and drops every other key', () => {
    expect(
      cleanMirrorMetrics('tour_exit', {
        tour: 3,
        step: 2,
        of: 7,
        accuracy: 90,
      }),
    ).toBe('{"tour":3,"step":2,"of":7}')
  })

  it('drops a metric that arrives as a string', () => {
    expect(cleanMirrorMetrics('tour_start', { tour: '3', step: null })).toBe(
      '{"step":null}',
    )
  })

  it('keeps results_view to its five voice keys', () => {
    const kept = cleanMirrorMetrics('results_view', {
      lowMidi: 48,
      highMidi: 72,
      semitones: 24,
      accuracy: 81,
      steadiness: 70,
      tour: 1,
    })
    expect(JSON.parse(kept!)).toEqual({
      lowMidi: 48,
      highMidi: 72,
      semitones: 24,
      accuracy: 81,
      steadiness: 70,
    })
  })

  it("keeps a lesson answer's seven numbers and drops every other key", () => {
    const kept = cleanMirrorMetrics('lesson_answer', {
      page: 4,
      qLesson: 3,
      q: 2,
      firstTry: 1,
      k: 4,
      visit: 2,
      consent: 2,
      option: 1,
      clientId: 7,
    })
    expect(JSON.parse(kept!)).toEqual({
      page: 4,
      qLesson: 3,
      q: 2,
      firstTry: 1,
      k: 4,
      visit: 2,
      consent: 2,
    })
  })

  it('never lets a string through on a lesson answer, a question id included', () => {
    expect(
      cleanMirrorMetrics('lesson_answer', {
        page: 2,
        qLesson: 'l01',
        q: 'l01-q2',
        firstTry: '1',
        visit: 1,
      }),
    ).toBe('{"page":2,"visit":1}')
  })

  it('stores nothing for an event that carries no metrics', () => {
    expect(cleanMirrorMetrics('onboarding_map_room', { tour: 1 })).toBeNull()
  })

  it('stores nothing when metrics is not an object', () => {
    expect(cleanMirrorMetrics('tour_done', 'tour=1')).toBeNull()
    expect(cleanMirrorMetrics('tour_done', 3)).toBeNull()
    expect(cleanMirrorMetrics('tour_done', null)).toBeNull()
    expect(cleanMirrorMetrics('tour_done', undefined)).toBeNull()
  })

  it('stores an empty object when no key of an allowlisted event survives', () => {
    expect(cleanMirrorMetrics('tour_done', { accuracy: 90 })).toBe('{}')
    expect(cleanMirrorMetrics('results_view', { tour: 1 })).toBe('{}')
  })

  it('keeps a tour number on every tour event', () => {
    for (const event of TOUR_FUNNEL_EVENTS) {
      expect(cleanMirrorMetrics(event, { tour: 2, step: 0 })).toBe(
        '{"tour":2,"step":0}',
      )
    }
  })

  it('stores nothing for a first-value event, which carries no metrics', () => {
    const firstValue = GUIDE_FUNNEL_EVENTS.filter((event) =>
      event.startsWith('first_value_'),
    )
    expect(firstValue).toHaveLength(6)
    for (const event of firstValue) {
      expect(cleanMirrorMetrics(event, { tour: 1, step: 2 })).toBeNull()
    }
  })

  it('stores nothing when metrics is an array', () => {
    expect(cleanMirrorMetrics('tour_done', [1, 2])).toBeNull()
    expect(cleanMirrorMetrics('results_view', [48, 72])).toBeNull()
  })

  it('never lets an event name resolve through the object prototype', () => {
    for (const event of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(cleanMirrorMetrics(event, { tour: 1 })).toBeNull()
    }
  })

  it('exposes the key sets the events draw from', () => {
    expect([...TOUR_METRIC_KEYS].sort()).toEqual(['of', 'step', 'tour'])
    expect([...LESSON_ANSWER_METRIC_KEYS].sort()).toEqual([
      'consent',
      'firstTry',
      'k',
      'page',
      'q',
      'qLesson',
      'visit',
    ])
    expect([...MIRROR_METRIC_KEYS].sort()).toEqual([
      'accuracy',
      'highMidi',
      'lowMidi',
      'semitones',
      'steadiness',
    ])
  })
})

describe('lessonAnswerInBounds', () => {
  /** A lesson answer as the pages send it. */
  const ANSWER = {
    page: 4,
    qLesson: 3,
    q: 2,
    firstTry: 1,
    k: 3,
    visit: 2,
    consent: 2,
  }

  it('takes every number at both ends of its range', () => {
    for (const [key, [min, max]] of LESSON_ANSWER_BOUNDS) {
      expect(lessonAnswerInBounds({ ...ANSWER, [key]: min })).toBe(true)
      expect(lessonAnswerInBounds({ ...ANSWER, [key]: max })).toBe(true)
    }
  })

  it('refuses any number one past either end of its range', () => {
    for (const [key, [min, max]] of LESSON_ANSWER_BOUNDS) {
      expect(lessonAnswerInBounds({ ...ANSWER, [key]: min - 1 })).toBe(false)
      expect(lessonAnswerInBounds({ ...ANSWER, [key]: max + 1 })).toBe(false)
    }
  })

  it('holds the ranges the pages send', () => {
    expect(Object.fromEntries(LESSON_ANSWER_BOUNDS)).toEqual({
      page: [1, 14],
      qLesson: [1, 14],
      q: [1, 4],
      firstTry: [0, 1],
      k: [2, 6],
      visit: [1, 3],
      consent: [1, 2],
    })
  })

  it('refuses a number that is not an integer, or is missing', () => {
    for (const key of LESSON_ANSWER_BOUNDS.keys()) {
      for (const value of [1.5, '2', null, Number.NaN, Infinity, true]) {
        expect(lessonAnswerInBounds({ ...ANSWER, [key]: value })).toBe(false)
      }
      const missing: Record<string, number> = { ...ANSWER }
      delete missing[key]
      expect(lessonAnswerInBounds(missing)).toBe(false)
    }
  })

  it('refuses metrics that are not an object', () => {
    for (const metrics of [null, undefined, 3, 'page=4', [4, 3, 2]]) {
      expect(lessonAnswerInBounds(metrics)).toBe(false)
    }
  })

  it('takes an answer with an extra key, which the store then drops', () => {
    expect(lessonAnswerInBounds({ ...ANSWER, option: 1 })).toBe(true)
  })
})

describe('POST /api/mirror/event', () => {
  /** A lesson answer as the pages send it. */
  const LESSON_ANSWER = {
    clientId: 'lesson-anonymous',
    event: 'lesson_answer',
    metrics: {
      page: 2,
      qLesson: 1,
      q: 4,
      firstTry: 0,
      k: 3,
      visit: 1,
      consent: 1,
    },
  }

  /** A stand-in for the LESSON_EVENT_LIMIT binding, recording each key. */
  function limiter(outcome: boolean | 'throws'): RateLimit & {
    keys: string[]
  } {
    const keys: string[] = []
    return {
      keys,
      limit: async ({ key }) => {
        keys.push(key)
        if (outcome === 'throws') throw new Error('limiter unavailable')
        return { success: outcome }
      },
    }
  }

  /** Enough of D1 to take the rate limit and the inserts, recording the
   *  mirrorEvents and funnelAcquisition inserts' bound values, each
   *  rate-limit bucket spent, and every statement that names auth_ratelimit. */
  function envRecordingInserts(lessonLimit?: RateLimit): {
    env: Env
    inserts: unknown[][]
    acquisitions: unknown[][]
    buckets: unknown[]
    rateLimitStatements: string[]
  } {
    const inserts: unknown[][] = []
    const acquisitions: unknown[][] = []
    const buckets: unknown[] = []
    const rateLimitStatements: string[] = []
    const env = {
      LESSON_EVENT_LIMIT: lessonLimit,
      DB: {
        prepare: (sql: string) => {
          if (sql.includes('auth_ratelimit')) rateLimitStatements.push(sql)
          let bound: unknown[] = []
          const statement = {
            bind: (...args: unknown[]) => {
              bound = args
              return statement
            },
            first: async () => {
              // Bound as (ip, endpoint, ...): the bucket is the second.
              if (sql.includes('auth_ratelimit')) buckets.push(bound[1])
              return { count: 1, windowStart: Date.now() }
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith('INSERT INTO mirrorEvents')) {
                inserts.push(bound)
              }
              if (sql.includes('INSERT INTO funnelAcquisition')) {
                acquisitions.push(bound)
              }
              return {}
            },
          }
          return statement
        },
      },
    } as unknown as Env
    return { env, inserts, acquisitions, buckets, rateLimitStatements }
  }

  /** A POST of `body`; `cf` is Cloudflare's request.cf, which a Request
   *  built here has none of until the test gives it one. */
  const post = (
    env: Env,
    body: unknown,
    headers: HeadersInit = {},
    cf?: { country?: string },
  ) => {
    const request = new Request('https://api.test/api/mirror/event', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (cf !== undefined) Object.defineProperty(request, 'cf', { value: cf })
    return worker.fetch(request, env, {} as ExecutionContext)
  }

  /** A POST whose body streams in `chunkBytes` chunks with no
   *  Content-Length, as a chunked upload arrives; `pulls` counts the chunks
   *  the Worker asked for. */
  function postStreamed(
    env: Env,
    totalBytes: number,
    chunkBytes: number,
    fill = ' ',
  ): { response: Promise<Response>; pulls: () => number } {
    let pulls = 0
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (sent >= totalBytes) {
          controller.close()
          return
        }
        const size = Math.min(chunkBytes, totalBytes - sent)
        controller.enqueue(new TextEncoder().encode(fill.repeat(size)))
        sent += size
      },
    })
    const init = {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit
    const response = worker.fetch(
      new Request('https://api.test/api/mirror/event', init),
      env,
      {} as ExecutionContext,
    )
    return { response, pulls: () => pulls }
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores a tour event with its tour, step and steps shown as the metrics JSON', async () => {
    const { env, inserts } = envRecordingInserts()
    const response = await post(env, {
      clientId: 'client-0001',
      event: 'tour_exit',
      metrics: { tour: 2, step: 3, of: 7 },
    })
    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
    // Bound in the insert's column order: id, createdAt, clientId, event,
    // metricsJson.
    expect(inserts[0].slice(2)).toEqual([
      'client-0001',
      'tour_exit',
      '{"tour":2,"step":3,"of":7}',
    ])
  })

  it("stores a lesson answer under the lesson pages' one client id, its numbers alone", async () => {
    const { env, inserts } = envRecordingInserts(limiter(true))
    const response = await post(env, {
      ...LESSON_ANSWER,
      metrics: { ...LESSON_ANSWER.metrics, id: 'l01-q4' },
    })
    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].slice(2)).toEqual([
      'lesson-anonymous',
      'lesson_answer',
      '{"page":2,"qLesson":1,"q":4,"firstTry":0,"k":3,"visit":1,"consent":1}',
    ])
  })

  it("keeps a lesson answer's UTC day and no time of day; another event keeps its time", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-10-22T23:59:59.999Z'))
    const { env, inserts } = envRecordingInserts(limiter(true))

    await post(env, LESSON_ANSWER)
    await post(env, { clientId: 'client-0001', event: 'tour_start' })

    expect(inserts.map((bound) => bound[1])).toEqual([
      '2026-10-22T00:00:00.000Z',
      '2026-10-22T23:59:59.999Z',
    ])
  })

  it("spends Cloudflare's limiter on a lesson answer, keyed by the address's limiter key, and writes no counter", async () => {
    const lessonLimit = limiter(true)
    const { env, inserts, rateLimitStatements } =
      envRecordingInserts(lessonLimit)

    const response = await post(env, LESSON_ANSWER, {
      'CF-Connecting-IP': '2001:db8:1:2:3:4:5:6',
    })

    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(lessonLimit.keys).toEqual(['v6:2001:db8:1:2::/64'])
    expect(rateLimitStatements).toEqual([])
  })

  it('refuses a lesson answer the limiter refuses, and stores nothing', async () => {
    const { env, inserts, rateLimitStatements } = envRecordingInserts(
      limiter(false),
    )

    const response = await post(env, LESSON_ANSWER)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(inserts).toEqual([])
    expect(rateLimitStatements).toEqual([])
  })

  it('refuses every lesson answer when the binding is missing, never falling back to the D1 limiter', async () => {
    const { env, inserts, rateLimitStatements } = envRecordingInserts()

    const response = await post(env, LESSON_ANSWER)

    expect(response.status).toBe(429)
    expect(inserts).toEqual([])
    expect(rateLimitStatements).toEqual([])
  })

  it('refuses a lesson answer when the limiter fails, and stores nothing', async () => {
    const { env, inserts, rateLimitStatements } = envRecordingInserts(
      limiter('throws'),
    )

    const response = await post(env, LESSON_ANSWER)

    expect(response.status).toBe(429)
    expect(inserts).toEqual([])
    expect(rateLimitStatements).toEqual([])
  })

  it("spends the funnel's bucket on any other event, never the lesson limiter", async () => {
    const lessonLimit = limiter(true)
    const { env, buckets } = envRecordingInserts(lessonLimit)

    const response = await post(env, {
      clientId: 'client-0001',
      event: 'tour_start',
    })

    expect(response.status).toBe(201)
    expect(buckets).toEqual(['mirror-event'])
    expect(lessonLimit.keys).toEqual([])
  })

  it.each([
    [
      'a number out of range',
      { ...LESSON_ANSWER, metrics: { ...LESSON_ANSWER.metrics, q: 5 } },
    ],
    [
      'a number that is not an integer',
      { ...LESSON_ANSWER, metrics: { ...LESSON_ANSWER.metrics, k: 2.5 } },
    ],
    [
      'a number sent as null',
      { ...LESSON_ANSWER, metrics: { ...LESSON_ANSWER.metrics, visit: null } },
    ],
    ['no metrics', { clientId: 'lesson-anonymous', event: 'lesson_answer' }],
    ["a device's own id", { ...LESSON_ANSWER, clientId: 'client-0001' }],
  ])(
    "refuses a lesson answer with %s, on the funnel's bucket",
    async (_label, body) => {
      const lessonLimit = limiter(true)
      const { env, inserts, buckets } = envRecordingInserts(lessonLimit)

      const response = await post(env, body)

      expect(response.status).toBe(400)
      expect(inserts).toEqual([])
      expect(buckets).toEqual(['mirror-event'])
      expect(lessonLimit.keys).toEqual([])
    },
  )

  describe('from the consent regions without a yes (the owner, 23 October 2026)', () => {
    /** A lesson answer from a reader never asked, as the pages send it. */
    const NEVER_ASKED = {
      ...LESSON_ANSWER,
      metrics: { ...LESSON_ANSWER.metrics, consent: 2 },
    }

    it.each([
      ['DE', { country: 'DE' }],
      ['GB', { country: 'GB' }],
      ['CH', { country: 'CH' }],
      ['a request with no cf', undefined],
    ])(
      'answers one from %s as a stored answer, and keeps nothing',
      async (_label, cf) => {
        const stored = await post(
          envRecordingInserts(limiter(true)).env,
          LESSON_ANSWER,
        )
        const lessonLimit = limiter(true)
        const { env, inserts, rateLimitStatements } =
          envRecordingInserts(lessonLimit)

        const response = await post(env, NEVER_ASKED, {}, cf)

        expect(response.status).toBe(stored.status)
        expect(await response.json()).toEqual(await stored.json())
        expect(inserts).toEqual([])
        expect(rateLimitStatements).toEqual([])
        expect(lessonLimit.keys).toEqual([])
      },
    )

    it('stores one from the US, marked never asked', async () => {
      const { env, inserts } = envRecordingInserts(limiter(true))

      const response = await post(env, NEVER_ASKED, {}, { country: 'US' })

      expect(response.status).toBe(201)
      expect(inserts).toHaveLength(1)
      expect(JSON.parse(String(inserts[0][4]))).toMatchObject({ consent: 2 })
    })

    it('stores one from Germany once the reader said yes', async () => {
      const { env, inserts } = envRecordingInserts(limiter(true))

      const response = await post(env, LESSON_ANSWER, {}, { country: 'DE' })

      expect(response.status).toBe(201)
      expect(inserts).toHaveLength(1)
    })
  })

  it("keeps no first-touch row for the lesson pages' shared id", async () => {
    const { env, inserts, acquisitions } = envRecordingInserts(limiter(true))

    const response = await post(env, {
      ...LESSON_ANSWER,
      acq: { gclid: 'CjwKCA-test', utmSource: 'google' },
    })

    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
    expect(acquisitions).toEqual([])
  })

  it("keeps no first-touch row for 'no-storage', and one for a device's own id", async () => {
    const { env, acquisitions } = envRecordingInserts()
    const acq = { gclid: 'CjwKCA-test', utmSource: 'google' }

    await post(env, { clientId: 'no-storage', event: 'mirror_view', acq })
    await post(env, { clientId: 'client-0001', event: 'mirror_view', acq })

    expect(acquisitions.map((bound) => bound[0])).toEqual(['client-0001'])
  })

  it('refuses a declared body over 4096 bytes unread', async () => {
    const { env, inserts } = envRecordingInserts(limiter(true))

    const response = await post(env, LESSON_ANSWER, {
      'Content-Length': '4097',
    })

    expect(response.status).toBe(413)
    expect(inserts).toEqual([])
  })

  it('stops reading a chunked body with no Content-Length at the first chunk past 4096 bytes', async () => {
    const { env, inserts } = envRecordingInserts(limiter(true))

    // 1 MB offered in 512-byte chunks: the read stops at the ninth.
    const { response, pulls } = postStreamed(env, 1_048_576, 512)

    expect((await response).status).toBe(413)
    expect(inserts).toEqual([])
    expect(pulls()).toBeLessThanOrEqual(10)
  })

  it('takes a chunked body of exactly 4096 bytes', async () => {
    const { env, inserts } = envRecordingInserts(limiter(true))
    const json = JSON.stringify(LESSON_ANSWER)
    const padded = json + ' '.repeat(4096 - json.length)
    let offset = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= padded.length) {
          controller.close()
          return
        }
        controller.enqueue(
          new TextEncoder().encode(padded.slice(offset, offset + 1000)),
        )
        offset += 1000
      },
    })
    const init = { method: 'POST', body: stream, duplex: 'half' } as RequestInit

    const response = await worker.fetch(
      new Request('https://api.test/api/mirror/event', init),
      env,
      {} as ExecutionContext,
    )

    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
  })

  it('refuses a chunked body of 4097 bytes', async () => {
    const { env, inserts } = envRecordingInserts(limiter(true))

    const { response } = postStreamed(env, 4097, 1000)

    expect((await response).status).toBe(413)
    expect(inserts).toEqual([])
  })
})
