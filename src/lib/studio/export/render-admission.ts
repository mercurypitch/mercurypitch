// Studio render admission — exports and balance analysis cannot overlap native offline jobs.
let active = false
export function acquireStudioRenderJob(): () => void {
  if (active)
    throw new Error(
      'Another song is still rendering. Wait for it to finish before exporting again.',
    )
  active = true
  let released = false
  return () => {
    if (!released) {
      released = true
      active = false
    }
  }
}
