// A live draft holds an origin-local lock so another tab cannot recover or discard it.
export async function acquireGuitarRecordingLock(
  id: string,
): Promise<(() => void) | null> {
  if (typeof navigator.locks?.request !== 'function') return () => undefined
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(
        `guitar-recording:${id}`,
        { ifAvailable: true },
        async (lock) => {
          if (lock === null) {
            resolve(null)
            return
          }
          await new Promise<void>((release) => resolve(release))
        },
      )
      .catch(reject)
  })
}
