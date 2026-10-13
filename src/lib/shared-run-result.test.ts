// Shared result payload tests cover bounds, malformed links, and the public data boundary.
import { describe, expect, it } from 'vitest'
import { buildHash, parseHash } from './hash-router'
import { decodeSharedRunResult, encodeSharedRunResult, parseSharedRunResult, } from './shared-run-result'

const summary = {
  name: 'Žuti cvijet',
  author: 'Maff',
  results: [0, 87.5, 100],
  date: 123456,
}
const rawPayload = (value: unknown) =>
  btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(value)), (byte) =>
      String.fromCharCode(byte),
    ).join(''),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

describe('shared result payloads', () => {
  it('round-trips Unicode and boundary scores without carrying private fields', () => {
    const encoded = encodeSharedRunResult({
      ...summary,
      userId: 'owner',
      sourceSessionId: 'private-run',
      items: ['private-notes'],
    } as typeof summary)
    expect(encoded).not.toBeNull()
    expect(decodeSharedRunResult(encoded!)).toEqual(summary)
    const route = parseHash(`#/result/${encoded}`)
    expect(route).toEqual({ type: 'shared-result', payload: encoded })
    expect(buildHash(route)).toBe(`/result/${encoded}`)
  })

  it.each([
    { name: '' },
    { name: 'a'.repeat(201) },
    { author: 'a'.repeat(101) },
    { results: [] },
    { results: Array.from({ length: 101 }, () => 80) },
    { results: [-1] },
    { results: [101] },
    { results: ['80'] },
    { results: [NaN] },
    { results: [Infinity] },
    { results: [null] },
    { date: -1 },
    { date: Infinity },
    { date: 8_640_000_000_000_001 },
    { date: 0.5 },
    { date: '123' },
  ])('rejects an invalid summary %j', (patch) => {
    expect(parseSharedRunResult({ ...summary, ...patch })).toBeNull()
    expect(
      encodeSharedRunResult({ ...summary, ...patch } as typeof summary),
    ).toBeNull()
  })

  it('accepts the largest supported summary and the epoch date', () => {
    const value = {
      name: 'a'.repeat(200),
      author: 'b'.repeat(100),
      results: Array.from({ length: 100 }, () => 100),
      date: 0,
    }
    expect(decodeSharedRunResult(encodeSharedRunResult(value)!)).toEqual(value)
  })

  it.each([
    '',
    'not+a+payload',
    'a'.repeat(8193),
    rawPayload({ v: 2, ...summary }),
    rawPayload({ v: 1 }),
    rawPayload(null),
  ])('rejects malformed or unsupported links', (encoded) => {
    expect(decodeSharedRunResult(encoded)).toBeNull()
    // The result page owns the error state instead of routing elsewhere.
    expect(parseHash(`#/result/${encoded}`).type).toBe('shared-result')
  })

  it('rejects non-finite JSON numbers and drops unexpected decoded fields', () => {
    expect(
      decodeSharedRunResult(
        btoa('{"v":1,"name":"Run","author":"A","results":[1e999],"date":1}'),
      ),
    ).toBeNull()
    expect(
      decodeSharedRunResult(
        rawPayload({
          v: 1,
          name: 'Run',
          author: 'A',
          results: [80],
          date: 1,
          userId: 'secret',
          sourceSessionId: 'secret',
        }),
      ),
    ).toEqual({ name: 'Run', author: 'A', results: [80], date: 1 })
  })
})
