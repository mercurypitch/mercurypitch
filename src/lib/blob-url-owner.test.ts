// ============================================================
// Blob-URL ownership
// ============================================================
//
// The defect this exists for: the stem mixer was handed object URLs for
// multi-megabyte separated stems — UvrPanel even minted them and said in a
// comment that the mixer now owned them — and nothing ever revoked them. A
// blob URL pins its data for the life of the document, so a session of adding
// and re-opening mixes left hundreds of megabytes alive for the rest of the
// tab.
//
// `URL.revokeObjectURL` is stubbed here rather than left to jsdom. It has to
// be: the project's own bug notes record that this class of leak was
// *untestable* because setup.ts stubs createObjectURL and leaves
// revokeObjectURL undefined, so the mint/revoke balance could not be observed
// at all. Counting the calls is the whole point.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlobUrlOwner, revokeBlobUrl } from '@/lib/blob-url-owner'

let revoked: string[]

beforeEach(() => {
  revoked = []
  vi.stubGlobal('URL', {
    ...URL,
    revokeObjectURL: (url: string) => revoked.push(url),
    createObjectURL: URL.createObjectURL,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('taking custody at handover', () => {
  it('releases every url it was given, once, on releaseAll', () => {
    const owner = createBlobUrlOwner(['blob:a', 'blob:b', 'blob:c'])
    expect(owner.size).toBe(3)

    owner.releaseAll()

    expect(revoked).toEqual(['blob:a', 'blob:b', 'blob:c'])
    expect(owner.size).toBe(0)
  })

  it('ignores urls it has no business revoking', () => {
    // A stem streamed from R2, or a runtime url the session store still
    // holds. Revoking one is either a no-op or somebody else's bug.
    const owner = createBlobUrlOwner([
      'blob:mine',
      'https://cdn.example/stem.wav',
      '/local/path.wav',
      '',
    ])
    expect(owner.size).toBe(1)

    owner.releaseAll()

    expect(revoked).toEqual(['blob:mine'])
  })

  it('starts empty when handed nothing', () => {
    const owner = createBlobUrlOwner()

    owner.releaseAll()

    expect(owner.size).toBe(0)
    expect(revoked).toEqual([])
  })

  it('holds one url once, however many times it arrives', () => {
    // Two mixes of the same song can hand over the same url. Revoking it
    // twice is a silent no-op in browsers, which is exactly why a
    // double-release bug survives until the day it is a use-after-revoke.
    const owner = createBlobUrlOwner(['blob:a', 'blob:a'])
    owner.own('blob:a')

    expect(owner.size).toBe(1)
    owner.releaseAll()
    expect(revoked).toEqual(['blob:a'])
  })
})

describe('taking custody later', () => {
  it('releases what was added after construction', () => {
    const owner = createBlobUrlOwner(['blob:initial'])
    owner.own('blob:added')

    owner.releaseAll()

    expect(revoked).toEqual(['blob:initial', 'blob:added'])
  })

  it('will not adopt a url it cannot revoke', () => {
    const owner = createBlobUrlOwner()
    owner.own('https://cdn.example/stem.wav')

    expect(owner.size).toBe(0)
    owner.releaseAll()
    expect(revoked).toEqual([])
  })
})

describe('releasing one at a time', () => {
  it('revokes just that url and forgets it', () => {
    const owner = createBlobUrlOwner(['blob:a', 'blob:b'])

    owner.release('blob:a')

    expect(revoked).toEqual(['blob:a'])
    expect(owner.size).toBe(1)

    owner.releaseAll()
    expect(revoked).toEqual(['blob:a', 'blob:b'])
  })

  it('does not revoke a url twice, however it is released', () => {
    const owner = createBlobUrlOwner(['blob:a'])

    owner.release('blob:a')
    owner.release('blob:a')
    owner.releaseAll()

    expect(revoked).toEqual(['blob:a'])
  })

  it('refuses to revoke a url it was never given', () => {
    // The safety property: custody is what authorises a revoke. Releasing a
    // stranger's url would be a use-after-revoke in whatever still holds it.
    const owner = createBlobUrlOwner(['blob:mine'])

    owner.release('blob:someone-elses')

    expect(revoked).toEqual([])
    expect(owner.size).toBe(1)
  })

  it('drops a url whose revoke throws rather than retrying it', () => {
    // A hostile polyfill, or jsdom without the stub. The set must not keep an
    // entry that releaseAll would then throw on all over again.
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: () => {
        throw new Error('revoke unavailable')
      },
    })
    const owner = createBlobUrlOwner(['blob:a'])

    expect(() => owner.release('blob:a')).toThrow('revoke unavailable')
    expect(owner.size).toBe(0)
  })
})

describe('releaseAll is safe to wire to a cleanup', () => {
  it('does nothing the second time', () => {
    const owner = createBlobUrlOwner(['blob:a'])

    owner.releaseAll()
    owner.releaseAll()

    expect(revoked).toEqual(['blob:a'])
  })

  it('empties the set before revoking, so a throw cannot double-revoke', () => {
    let calls = 0
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: (url: string) => {
        calls += 1
        revoked.push(url)
        throw new Error('revoke unavailable')
      },
    })
    const owner = createBlobUrlOwner(['blob:a', 'blob:b'])

    expect(() => owner.releaseAll()).toThrow('revoke unavailable')
    expect(owner.size).toBe(0)
    expect(calls).toBe(1)

    // The second url was dropped without being revoked — a leak, but a bounded
    // one, and the alternative is revoking 'blob:a' twice on the next call.
    owner.releaseAll()
    expect(calls).toBe(1)
  })
})

describe('revokeBlobUrl', () => {
  it('lets go of a mint nobody took', () => {
    revokeBlobUrl('blob:refused')

    expect(revoked).toEqual(['blob:refused'])
  })

  it('leaves anything that is not a blob url alone', () => {
    revokeBlobUrl('https://cdn.example/stem.wav')
    revokeBlobUrl('')

    expect(revoked).toEqual([])
  })
})
