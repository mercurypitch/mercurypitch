// Studio comparison ownership — cached WAVs survive pending previews, then release exactly once.
import type { StudioComparison } from '@/lib/studio/export/prepare-comparison'

export function ownStudioComparison(
  value: StudioComparison,
  onRelease: () => void,
) {
  let current = true
  let users = 0
  let released = false

  function releaseIfUnused(): void {
    if (current || users > 0 || released) return
    released = true
    value.release()
    onRelease()
  }
  return {
    value,
    use() {
      if (released) throw new Error('Prepare Compare again.')
      users++
      let done = false
      return () => {
        if (done) return
        done = true
        users--
        releaseIfUnused()
      }
    },
    retire() {
      current = false
      releaseIfUnused()
    },
  }
}
export type OwnedStudioComparison = ReturnType<typeof ownStudioComparison>
