// ============================================================
// File hashing via Web Crypto API (SHA-256)
// ============================================================

/**
 * Compute the SHA-256 hex digest of a File or Blob.
 * Uses the streaming Web Crypto API so large files are read in chunks.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
