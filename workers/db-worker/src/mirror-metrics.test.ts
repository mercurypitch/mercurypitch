// ============================================================
// mirror-metrics tests — which numbers a funnel event may keep
// ============================================================

import { describe, expect, it } from 'vitest'
import { GUIDE_FUNNEL_EVENTS, TOUR_FUNNEL_EVENTS, } from '../../../src/lib/funnel-event-catalog'
import type { Env } from './auth'
import worker from './index'
import { cleanMirrorMetrics, MIRROR_METRIC_KEYS, TOUR_METRIC_KEYS, } from './mirror-metrics'

describe('cleanMirrorMetrics', () => {
  it('keeps tour and step on a tour event and drops every other key', () => {
    expect(
      cleanMirrorMetrics('tour_exit', { tour: 3, step: 2, accuracy: 90 }),
    ).toBe('{"tour":3,"step":2}')
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

  it('exposes the two key sets the events draw from', () => {
    expect([...TOUR_METRIC_KEYS].sort()).toEqual(['step', 'tour'])
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
  /** Enough of D1 to take the rate limit and one insert, recording the
   *  mirrorEvents insert's bound values. */
  function envRecordingInserts(): { env: Env; inserts: unknown[][] } {
    const inserts: unknown[][] = []
    const env = {
      DB: {
        prepare: (sql: string) => {
          let bound: unknown[] = []
          const statement = {
            bind: (...args: unknown[]) => {
              bound = args
              return statement
            },
            first: async () => ({ count: 1, windowStart: Date.now() }),
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith('INSERT INTO mirrorEvents')) {
                inserts.push(bound)
              }
              return {}
            },
          }
          return statement
        },
      },
    } as unknown as Env
    return { env, inserts }
  }

  const post = (env: Env, body: unknown) =>
    worker.fetch(
      new Request('https://api.test/api/mirror/event', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      env,
      {} as ExecutionContext,
    )

  it('stores a tour event with its tour and step as the metrics JSON', async () => {
    const { env, inserts } = envRecordingInserts()
    const response = await post(env, {
      clientId: 'client-0001',
      event: 'tour_exit',
      metrics: { tour: 2, step: 3 },
    })
    expect(response.status).toBe(201)
    expect(inserts).toHaveLength(1)
    // Bound in the insert's column order: id, createdAt, clientId, event,
    // metricsJson.
    expect(inserts[0].slice(2)).toEqual([
      'client-0001',
      'tour_exit',
      '{"tour":2,"step":3}',
    ])
  })
})
