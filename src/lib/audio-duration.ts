// Audio duration probes metadata without playback and releases its element, timer and object URL.
export function audioDurationSecs(
  file: File,
  signal?: AbortSignal,
): Promise<number | null> {
  if (signal?.aborted === true) return Promise.resolve(null)
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false
    const abort = () => done(null)
    const done = (value: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => done(null), 3000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      done(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : null,
      )
    audio.onerror = () => done(null)
    signal?.addEventListener('abort', abort, { once: true })
    audio.src = url
  })
}
