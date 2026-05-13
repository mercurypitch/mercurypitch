// ============================================================
// File hashing via Web Crypto API (SHA-256)
// ============================================================

/**
 * Compute the SHA-256 hex digest of a File or Blob.
 * Fallback to metadata-based pseudo-hash if crypto.subtle is unavailable (non-secure contexts).
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  // crypto.subtle is only available in Secure Contexts (HTTPS / localhost)
  if (globalThis.crypto?.subtle === undefined) {
    console.warn(
      'crypto.subtle not available. Falling back to metadata-based hash.',
    )
    // Create a pseudo-hash from metadata for identification
    const metadata =
      file instanceof File
        ? `${file.name}-${file.size}-${file.lastModified}`
        : `blob-${file.size}`

    // Simple string hash function for fallback
    let hash = 0
    for (let i = 0; i < metadata.length; i++) {
      const char = metadata.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `meta-${Math.abs(hash).toString(16)}`
  }

  const buffer = await file.arrayBuffer()
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
