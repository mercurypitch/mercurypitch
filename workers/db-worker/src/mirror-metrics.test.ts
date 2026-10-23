// ============================================================
// mirror-metrics tests — which numbers a funnel event may keep
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { GUIDE_FUNNEL_EVENTS, TOUR_FUNNEL_EVENTS, } from '../../../src/lib/funnel-event-catalog'
import type { Env } from './auth'
import worker from './index'
import { cleanMirrorMetrics, LESSON_ANSWER_METRIC_KEYS, MIRROR_METRIC_KEYS, TOUR_METRIC_KEYS, } from './mirror-metrics'

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

  const post = (env: Env, body: unknown, headers: HeadersInit = {}) =>
    worker.fetch(
      new Request('https://api.test/api/mirror/event', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
      env,
      {} as ExecutionContext,
    )

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
})
