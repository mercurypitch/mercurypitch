// Runtime asset responses — accept readable custom-origin bodies without hiding real HTTP failures.

export interface GlassAssetResponse {
  readonly ok: boolean
  readonly status: number
  blob(): Promise<Blob>
}

/** Read one bundled asset across ordinary HTTP and Capacitor's iOS origin. */
export async function readGlassAssetBlob(
  url: string,
  response: GlassAssetResponse,
): Promise<Blob> {
  if (!response.ok && response.status !== 0)
    throw new Error(`Asset request failed (${String(response.status)}): ${url}`)
  const blob = await response.blob()
  if (blob.size === 0) throw new Error(`Asset was empty: ${url}`)
  return blob
}
