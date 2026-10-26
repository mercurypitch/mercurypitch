// Studio worker client — bounded request lifetime with abort/error cleanup and transferred chunks.
import type { MeterWorkerPayload, MeterWorkerResponse, } from './meter-worker-protocol'

export function createMeterWorkerClient(target: Worker, signal: AbortSignal) {
  let sequence = 0
  return (
    message: MeterWorkerPayload,
    transfer: Transferable[] = [],
  ): Promise<MeterWorkerResponse> => {
    const id = ++sequence
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        target.removeEventListener('message', received)
        target.removeEventListener('error', failed)
        signal.removeEventListener('abort', aborted)
      }
      const aborted = () => {
        cleanup()
        reject(signal.reason)
      }
      const failed = () => {
        cleanup()
        reject(
          new Error('Audio measurement could not finish. Try exporting again.'),
        )
      }
      const received = (event: MessageEvent<MeterWorkerResponse>) => {
        if (event.data.id !== id) return
        cleanup()
        if (event.data.error !== undefined) reject(new Error(event.data.error))
        else resolve(event.data)
      }
      const timeout = setTimeout(failed, 30000)
      target.addEventListener('message', received)
      target.addEventListener('error', failed)
      signal.addEventListener('abort', aborted, { once: true })
      try {
        target.postMessage({ ...message, id }, transfer)
      } catch (error) {
        cleanup()
        reject(error)
      }
    })
  }
}
