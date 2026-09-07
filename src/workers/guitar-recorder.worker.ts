// Guitar recording worker extracts complete single-note evidence and encodes dry PCM away from monitoring.
import { createGuitarRecordingAnalysis } from '@/lib/guitar/recording-analysis'
import type { GuitarRecordingWorkerCommand, GuitarRecordingWorkerMessage, } from '@/lib/guitar/recording-types'

let analysis: ReturnType<typeof createGuitarRecordingAnalysis> | null = null
const send = (
  message: GuitarRecordingWorkerMessage,
  transfer: Transferable[] = [],
): void => self.postMessage(message, transfer)
self.onmessage = (event: MessageEvent<GuitarRecordingWorkerCommand>): void => {
  try {
    const command = event.data
    if (command.type === 'init')
      analysis = createGuitarRecordingAnalysis(
        command.recordingId,
        command.sampleRate,
      )
    else if (analysis === null)
      throw new Error('Recorder analysis was not initialized.')
    else if (command.type === 'pcm') {
      const chunk = analysis.process(
        new Float32Array(command.buffer),
        command.frames,
        command.sequence,
        command.firstFrame,
      )
      send(
        {
          type: 'chunk',
          chunk,
          recycled: command.buffer,
          previewNote: analysis.preview(),
        },
        [chunk.pcm!, command.buffer],
      )
    } else {
      send({
        type: 'finished',
        summary: {
          ...analysis.finish(),
          clockAnomalies: command.clockAnomalies,
          interruption: command.reason,
        },
      })
    }
  } catch (error) {
    send({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Recording analysis failed.',
    })
  }
}
