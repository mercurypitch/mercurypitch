// Asset load admission — share decode capacity across retiring scenes and their retries.

const MAXIMUM_ACTIVE_LOADS = 2

interface WaitingLoad {
  readonly grant: () => void
}

const waitingLoads: WaitingLoad[] = []
let activeLoads = 0

function abortError(): DOMException {
  return new DOMException('Asset loading was aborted.', 'AbortError')
}

function admitWaitingLoads(): void {
  while (activeLoads < MAXIMUM_ACTIVE_LOADS && waitingLoads.length > 0)
    waitingLoads.shift()!.grant()
}

function acquireAdmission(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const abort = () => {
      const index = waitingLoads.indexOf(waiter)
      if (index >= 0) waitingLoads.splice(index, 1)
      signal.removeEventListener('abort', abort)
      reject(abortError())
    }
    const waiter: WaitingLoad = {
      grant: () => {
        signal.removeEventListener('abort', abort)
        if (signal.aborted) {
          reject(abortError())
          return
        }
        activeLoads++
        let released = false
        resolve(() => {
          if (released) return
          released = true
          activeLoads--
          admitWaitingLoads()
        })
      },
    }
    signal.addEventListener('abort', abort, { once: true })
    waitingLoads.push(waiter)
    admitWaitingLoads()
  })
}

/** Hold capacity through actual parsing, profiling and late cancellation cleanup. */
export async function withAssetLoadAdmission<T>(
  signal: AbortSignal,
  load: () => Promise<T>,
): Promise<T> {
  const release = await acquireAdmission(signal)
  try {
    // Abort can follow a synchronous grant before this continuation runs.
    if (signal.aborted) throw abortError()
    return await load()
  } finally {
    release()
  }
}
