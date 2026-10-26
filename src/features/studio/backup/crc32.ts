// Studio ZIP integrity — incremental CRC32 for every uncompressed archive entry.

const table = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

/** Start with 0xffffffff; finish with (value ^ 0xffffffff) >>> 0. */
export function updateStudioCrc32(value: number, bytes: Uint8Array): number {
  for (const byte of bytes) value = table[(value ^ byte) & 0xff] ^ (value >>> 8)
  return value >>> 0
}
