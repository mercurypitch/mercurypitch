// Studio measurement worker — streaming analysis never rescans a song on the UI thread.
import type { MeterWorkerRequest, MeterWorkerResponse, } from './meter-worker-protocol'
import { createStudioMeter } from './stream-meter'

let meter: ReturnType<typeof createStudioMeter> | undefined
globalThis.onmessage = (event: MessageEvent<MeterWorkerRequest>) => {
  const request = event.data
  const reply: MeterWorkerResponse = { id: request.id }
  try {
    if (request.kind === 'start') meter = createStudioMeter(request.options)
    else if (!meter) throw new Error('Audio measurement has not started.')
    else if (request.kind === 'push') meter.push(request.channels)
    else reply.measurement = meter.finish()
  } catch (error) {
    reply.error =
      error instanceof Error ? error.message : 'Audio measurement failed.'
  }
  globalThis.postMessage(reply)
}
