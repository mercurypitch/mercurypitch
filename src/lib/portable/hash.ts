// Content hashing for anything portable. One implementation, because a
// hash computed two ways is two hashes: the sender's digest and the
// receiver's verification must be the same function or the comparison
// means nothing. Moved here from lib/jam so the bundle format does not
// depend on the jam module; jam re-exports it unchanged.

export function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  // globalThis.crypto, not the bare global: the repo bans the latter so a
  // page-level `crypto` variable can never shadow the real one.
  return globalThis.crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  )
}
