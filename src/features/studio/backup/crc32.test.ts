// Studio ZIP CRC32 tests — the standard check value, a byte-at-a-time reference, and any split of the input.
import { describe, expect, it } from 'vitest'
import { updateStudioCrc32 } from './crc32'

/** The byte-at-a-time CRC32 the backups were always checked with. */
function reference(bytes: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return (value ^ 0xffffffff) >>> 0
}

const finish = (value: number) => (value ^ 0xffffffff) >>> 0

function noise(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let state = seed
  for (let index = 0; index < length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    bytes[index] = state >>> 24
  }
  return bytes
}

describe('Studio CRC32', () => {
  it('gives the standard check value', () => {
    const bytes = new TextEncoder().encode('123456789')
    expect(finish(updateStudioCrc32(0xffffffff, bytes))).toBe(0xcbf43926)
  })

  it('matches the byte-at-a-time CRC for every length around its eight-byte step', () => {
    for (let length = 0; length <= 40; length++) {
      const bytes = noise(length, length + 1)
      expect(finish(updateStudioCrc32(0xffffffff, bytes))).toBe(
        reference(bytes),
      )
    }
    const large = noise(1_000_003, 7)
    expect(finish(updateStudioCrc32(0xffffffff, large))).toBe(reference(large))
  })

  it('gives the same value however the input is split', () => {
    const bytes = noise(10_000, 3)
    const whole = updateStudioCrc32(0xffffffff, bytes)
    for (const cut of [1, 7, 8, 9, 4093, 9999]) {
      const split = updateStudioCrc32(
        updateStudioCrc32(0xffffffff, bytes.subarray(0, cut)),
        bytes.subarray(cut),
      )
      expect(split).toBe(whole)
    }
  })
})
