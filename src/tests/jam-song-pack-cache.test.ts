// Packing a song is the slow half of sharing it -- tens of seconds of
// decode and encode -- and the same song goes out again every time
// somebody joins late, reloads, or drops mid-transfer. These cover that it
// is paid for once, and that a run which did not finish is never served as
// though it had.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeStemsForShare, forgetPackedStems, getPackedStems, } from '@/lib/jam/jam-song-share'
import type * as StemEncoder from '@/lib/jam/stem-encoder'
import { StemEncodeAbortedError } from '@/lib/jam/stem-encoder'

// Typed with its real parameters so a call's third argument -- the stop
// signal -- can be asserted on.
const encode = vi.fn(
  async (
    _wav: ArrayBuffer,
    _onProgress?: unknown,
    _signal?: unknown,
  ): Promise<Uint8Array> => new Uint8Array(8),
)

vi.mock('@/lib/jam/stem-encoder', async () => {
  const actual = await vi.importActual<typeof StemEncoder>(
    '@/lib/jam/stem-encoder',
  )
  return {
    ...actual,
    encodeStemToAac: (...args: unknown[]) =>
      (encode as unknown as (...a: unknown[]) => Promise<Uint8Array>)(...args),
  }
})

const wav = (n = 32) => new ArrayBuffer(n)
const both = () => ({ instrumental: wav(), vocal: wav() })

describe('packed stem cache', () => {
  beforeEach(() => {
    forgetPackedStems()
    encode.mockClear()
    encode.mockImplementation(async () => new Uint8Array(8))
  })

  it('packs a song once, however many times it is sent', async () => {
    const first = await encodeStemsForShare(both(), { key: 'session-1' })
    expect(encode).toHaveBeenCalledTimes(2) // instrumental + vocal

    const second = await encodeStemsForShare(both(), { key: 'session-1' })
    expect(encode).toHaveBeenCalledTimes(2)
    // The same bytes, not merely equal ones: the transfer hashes them and
    // the peers are told that hash.
    expect(second).toBe(first)
  })

  it('answers for the packed song only', async () => {
    await encodeStemsForShare(both(), { key: 'session-1' })
    expect(getPackedStems('session-1')).not.toBeNull()
    expect(getPackedStems('session-2')).toBeNull()
  })

  it('packs again for a different song, and keeps only the new one', async () => {
    await encodeStemsForShare(both(), { key: 'session-1' })
    await encodeStemsForShare(both(), { key: 'session-2' })
    expect(encode).toHaveBeenCalledTimes(4)
    // One entry, so a phone is not holding every song it has ever shared.
    expect(getPackedStems('session-1')).toBeNull()
    expect(getPackedStems('session-2')).not.toBeNull()
  })

  it('keeps nothing from a run that was stopped', async () => {
    encode
      .mockImplementationOnce(async () => new Uint8Array(8))
      .mockImplementationOnce(async () => {
        throw new StemEncodeAbortedError()
      })

    await expect(
      encodeStemsForShare(both(), { key: 'session-1' }),
    ).rejects.toBeInstanceOf(StemEncodeAbortedError)

    // A half-packed song must never be served as ready -- the peers would
    // be offered a backing track and no guide vocal, with no sign of it.
    expect(getPackedStems('session-1')).toBeNull()
  })

  it('forgets on request, so leaving a room frees the audio', async () => {
    await encodeStemsForShare(both(), { key: 'session-1' })
    forgetPackedStems()
    expect(getPackedStems('session-1')).toBeNull()

    await encodeStemsForShare(both(), { key: 'session-1' })
    expect(encode).toHaveBeenCalledTimes(4)
  })

  it('hands the stop signal to the encoder', async () => {
    const signal = { aborted: false }
    await encodeStemsForShare(both(), { key: 'session-1', signal })
    // Third argument, so a Stop lands inside the slice loop rather than
    // after the whole stem.
    expect(encode.mock.calls[0]?.[2]).toBe(signal)
  })

  it('packs without a key rather than refusing, and caches nothing', async () => {
    const out = await encodeStemsForShare(both())
    expect(out).toHaveLength(2)
    expect(getPackedStems('session-1')).toBeNull()
  })
})
