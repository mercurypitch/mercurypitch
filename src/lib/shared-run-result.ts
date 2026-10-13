// Shared run results validate and encode the displayed summary without practice history or account identifiers.
import { z } from 'zod/v4'

const SharedRunResultSchema = z.object({
  name: z.string().min(1).max(200),
  author: z.string().max(100),
  results: z.array(z.number().min(0).max(100)).min(1).max(100),
  date: z.number().int().min(0).max(8_640_000_000_000_000),
})

export type SharedRunResultData = z.infer<typeof SharedRunResultSchema>

export function parseSharedRunResult(
  value: unknown,
): SharedRunResultData | null {
  const parsed = SharedRunResultSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

// A summary has at most 300 text characters and 100 scores. Bound the wire
// representation before decoding too, including deliberately padded JSON.
const MAX_RESULT_PAYLOAD_LENGTH = 8192

export function encodeSharedRunResult(
  value: SharedRunResultData,
): string | null {
  const summary = parseSharedRunResult(value)
  if (!summary) return null
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ...summary }))
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSharedRunResult(
  encoded: string,
): SharedRunResultData | null {
  if (
    encoded.length > MAX_RESULT_PAYLOAD_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(encoded)
  )
    return null
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    )
    if (
      value === null ||
      typeof value !== 'object' ||
      !('v' in value) ||
      value.v !== 1
    )
      return null
    return parseSharedRunResult(value)
  } catch {
    return null
  }
}
