// Studio WAV download ownership — object URLs retain a rendered result until they are released.
import type { StudioWavExport } from '@/lib/studio/export/render-wav'

export function ownStudioExport(
  value: StudioWavExport,
  onRelease?: () => void,
) {
  let current = true
  let released = false
  const urls = new Map<string, ReturnType<typeof setTimeout>>()

  function releaseIfUnused(): void {
    if (current || urls.size > 0 || released) return
    released = true
    value.release()
    onRelease?.()
  }

  function revoke(url: string): void {
    const timer = urls.get(url)
    if (timer !== undefined) clearTimeout(timer)
    urls.delete(url)
    URL.revokeObjectURL(url)
    releaseIfUnused()
  }
  return {
    value,
    retire() {
      current = false
      releaseIfUnused()
    },
    download(title: string) {
      if (!current) throw new Error('Export the current version again.')
      const url = URL.createObjectURL(value.blob)
      urls.set(
        url,
        setTimeout(() => revoke(url), 10_000),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${title.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100) || 'Studio song'}.wav`
      try {
        document.body.append(anchor)
        anchor.click()
      } catch (error) {
        revoke(url)
        throw error
      } finally {
        anchor.remove()
      }
    },
    dispose() {
      current = false
      for (const url of [...urls.keys()]) revoke(url)
      releaseIfUnused()
    },
  }
}

export type OwnedStudioExport = ReturnType<typeof ownStudioExport>
