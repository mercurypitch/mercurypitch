// Guitar recording worker previews short PCM batches while retaining bounded durable checkpoints.
import { createGuitarRecordingAnalysis } from '@/lib/guitar/recording-analysis'
import type { GuitarPitchEvidence, GuitarRecordingChunk, GuitarRecordingWorkerCommand, GuitarRecordingWorkerMessage, } from '@/lib/guitar/recording-types'
import { GUITAR_RECORDING_CHUNK_FRAMES, GUITAR_RECORDING_PCM_FRAMES, } from '@/lib/guitar/recording-types'

let analysis: ReturnType<typeof createGuitarRecordingAnalysis> | null = null
let pending: GuitarRecordingChunk | null = null
let encoded: Uint8Array | null = null
let recycled: ArrayBuffer[] = []
let inputSequence = 0
let chunkSequence = 0
let previewSequence = 0
let completedNotes = 0
let lastPitch: GuitarPitchEvidence | null = null
let ended = false
const send = (
  message: GuitarRecordingWorkerMessage,
  transfer: Transferable[] = [],
): void => self.postMessage(message, transfer)

const flush = (): void => {
  if (pending === null || encoded === null) return
  pending.pcm = encoded.buffer.slice(0, pending.frames * 2) as ArrayBuffer
  send(
    {
      type: 'chunk',
      chunk: pending,
      recycled,
      previewNote: analysis!.preview(),
    },
    [pending.pcm, ...recycled],
  )
  pending = null
  encoded = null
  recycled = []
}

self.onmessage = (event: MessageEvent<GuitarRecordingWorkerCommand>): void => {
  if (ended) return
  try {
    const command = event.data
    if (command.type === 'init') {
      if (analysis !== null)
        throw new Error('Recorder analysis was already initialized.')
      analysis = createGuitarRecordingAnalysis(
        command.recordingId,
        command.sampleRate,
      )
    } else if (analysis === null)
      throw new Error('Recorder analysis was not initialized.')
    else if (command.type === 'pcm') {
      if (
        command.sequence !== inputSequence ||
        command.frames > GUITAR_RECORDING_PCM_FRAMES
      )
        throw new Error('Recording audio is incomplete or out of order.')
      const chunk = analysis.process(
        new Float32Array(command.buffer),
        command.frames,
        command.sequence,
        command.firstFrame,
      )
      inputSequence++
      completedNotes += chunk.notes.length
      lastPitch = chunk.pitches.at(-1) ?? lastPitch
      send({
        type: 'preview',
        preview: {
          sequence: previewSequence++,
          frames: chunk.firstFrame + chunk.frames,
          notes: chunk.notes,
          pendingNote: analysis.preview(),
          pitch: lastPitch,
          ended: false,
        },
      })
      // Four short deliveries share one storage transaction. Their input
      // buffers stay leased until that whole checkpoint is durable.
      if (pending === null) {
        pending = {
          ...chunk,
          id: `${chunk.recordingId}:${chunkSequence}`,
          sequence: chunkSequence++,
          frames: 0,
          pcm: null,
          notes: [],
          attacks: [],
          pitches: [],
          peak: 0,
        }
        encoded = new Uint8Array(GUITAR_RECORDING_CHUNK_FRAMES * 2)
      }
      encoded!.set(new Uint8Array(chunk.pcm!), pending.frames * 2)
      pending.frames += chunk.frames
      pending.notes.push(...chunk.notes)
      pending.attacks.push(...chunk.attacks)
      pending.pitches.push(...chunk.pitches)
      pending.peak = Math.max(pending.peak, chunk.peak)
      recycled.push(command.buffer)
      if (pending.frames === GUITAR_RECORDING_CHUNK_FRAMES) flush()
    } else {
      flush()
      const summary = {
        ...analysis.finish(),
        clockAnomalies: command.clockAnomalies,
        interruption: command.reason,
      }
      send({
        type: 'preview',
        preview: {
          sequence: previewSequence++,
          frames: summary.frames,
          notes: summary.notes.slice(completedNotes),
          pendingNote: null,
          pitch: null,
          ended: true,
        },
      })
      ended = true
      send({ type: 'finished', summary })
    }
  } catch (error) {
    ended = true
    send({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Recording analysis failed.',
    })
  }
}
