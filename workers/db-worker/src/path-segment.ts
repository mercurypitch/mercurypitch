// ============================================================
// Path segments — decoding an id the URL carried
// ============================================================
//
// decodeURIComponent throws on a broken percent-escape (`%zz`, a truncated
// `%E0%A4`). Called bare in a router, that throw reached the worker's
// last-resort handler, so a typo'd or truncated link answered 500, which a
// client reads as "try again" and which pollutes the error logs. A broken
// escape is the caller's mistake: the fetch boundary in index.ts answers this
// error with 400.

/** A path segment that is not valid percent-encoding. */
export class MalformedPathSegmentError extends Error {
  constructor(segment: string) {
    super(`Malformed path segment: ${segment.slice(0, 64)}`)
    this.name = 'MalformedPathSegmentError'
  }
}

/** `segment` decoded, or a MalformedPathSegmentError the boundary answers 400. */
export function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw new MalformedPathSegmentError(segment)
  }
}
