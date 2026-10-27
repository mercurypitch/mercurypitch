// Studio SHA-256 tests — the in-place hash agrees with WebCrypto at every padding boundary and however the bytes are split.
import fc from 'fast-check'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createStudioSha256, sha256InPlace } from './sha256'

async function reference(bytes: Uint8Array): Promise<string> {
  const hash = await webcrypto.subtle.digest('SHA-256', bytes)
  return Buffer.from(hash).toString('hex')
}

function pattern(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length)
  for (let index = 0; index < length; index++)
    bytes[index] = (index * 31 + 7) & 255
  return bytes
}

describe('Studio SHA-256', () => {
  it('matches the FIPS 180-4 examples', () => {
    const hash = (text: string) => {
      const sha = createStudioSha256()
      sha.update(new TextEncoder().encode(text))
      return sha.digest()
    }
    expect(hash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(
      hash('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })

  it('agrees with WebCrypto on every length around the 64-byte block and its padding', async () => {
    for (let length = 0; length <= 200; length++) {
      const bytes = pattern(length)
      const sha = createStudioSha256()
      sha.update(bytes)
      expect(sha.digest(), `${length} bytes`).toBe(await reference(bytes))
    }
  })

  it('gives the same hash however the bytes are split into parts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ maxLength: 700 }),
        fc.array(fc.nat({ max: 700 }), { maxLength: 6 }),
        async (bytes, cuts) => {
          const sha = createStudioSha256()
          let from = 0
          for (const cut of [...cuts].sort((left, right) => left - right)) {
            const to = Math.min(bytes.length, cut)
            sha.update(bytes.subarray(from, Math.max(from, to)))
            from = Math.max(from, to)
          }
          sha.update(bytes.subarray(from))
          expect(sha.digest()).toBe(await reference(bytes))
        },
      ),
      { numRuns: 200 },
    )
  })

  it('hashes a buffer of several slices in place, as WebCrypto does with a copy', async () => {
    const bytes = pattern(3 * 1024 * 1024 + 17)

    expect(await sha256InPlace(bytes.buffer)).toBe(await reference(bytes))
  })

  it('stops when the work is cancelled', async () => {
    const cancelled = new AbortController()
    cancelled.abort()

    await expect(
      sha256InPlace(pattern(1024).buffer, cancelled.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
