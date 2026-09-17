// ============================================================
// Guitar recording mix export — offline guitar plus a separate drummer lane
// ============================================================
//
// Export is the only place the two sources are committed to one file. The
// durable take remains dry guitar audio, detected notes, and drummer events.

import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createDrumKitPlayer } from '@/features/drum-night/audio/drum-kit-player'
import { encodeAudioBufferToPcmWav } from '@/lib/audio-buffer-wav'
import { loadGuitarAmpCabinet } from '@/lib/guitar/guitar-amp-cabinet'
import { createGuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { createGuitarVoice } from '@/lib/guitar/guitar-synth'
import { guitarRecordingFilename } from '@/lib/guitar/recording-export'
import type { RecordingPlaybackNote } from '@/lib/guitar/recording-note-player'
import type { GuitarRecordingPlaybackSource } from '@/lib/guitar/recording-playback'
import type { GuitarNightDrumKitId } from './guitar-night-drum-sound'
import { isGuitarNightDrumKitId } from './guitar-night-drum-sound'

const MIX_TAIL_SECONDS = 1.5
const MAX_EXPORT_SAMPLE_RATE = 48_000
const downloadCounts = new Map<string, number>()
type OfflineDrumPlayer = ReturnType<typeof createDrumKitPlayer>

interface ScheduledDrumGroup {
  readonly output: GainNode
  readonly player: OfflineDrumPlayer
}

export interface GuitarRecordingMixExport {
  readonly draft: GuitarRecordingDraft
  readonly source: GuitarRecordingPlaybackSource
  readonly notes: readonly RecordingPlaybackNote[]
  readonly amp: GuitarElectricAmpParameters
  readonly drumLevel: number
  readonly includeDrums: boolean
}

function scheduleNotes(
  context: BaseAudioContext,
  destination: AudioNode,
  notes: readonly RecordingPlaybackNote[],
): Array<ReturnType<typeof createGuitarVoice>> {
  return notes.map((note) => {
    const voice = createGuitarVoice(
      context,
      440 * 2 ** ((note.midi - 69) / 12),
      (note.endSeconds - note.startSeconds) * 1000,
      'electric',
      note.startSeconds,
      'shared',
    )
    voice.gain.gain.cancelScheduledValues(0)
    voice.gain.gain.setValueAtTime(0.0001, 0)
    voice.gain.gain.setValueAtTime(0.0001, note.startSeconds)
    voice.gain.gain.exponentialRampToValueAtTime(
      1,
      note.startSeconds +
        Math.min(0.005, (note.endSeconds - note.startSeconds) / 2),
    )
    voice.gain.gain.setTargetAtTime(0, note.endSeconds, 0.012)
    voice.gain.connect(destination)
    for (const source of voice.oscillators) source.stop(note.endSeconds + 0.12)
    return voice
  })
}

async function scheduleDrums(
  context: OfflineAudioContext,
  destination: AudioNode,
  input: GuitarRecordingMixExport,
): Promise<ScheduledDrumGroup[]> {
  const track = input.draft.drumTrack
  if (!input.includeDrums || track === undefined || input.drumLevel <= 0)
    return []
  const groups = new Map<
    string,
    {
      kitId: GuitarNightDrumKitId
      level: number
      hits: typeof track.hits
    }
  >()
  for (const hit of track.hits) {
    if (!isGuitarNightDrumKitId(hit.kitId)) continue
    const key = `${hit.kitId}:${hit.level.toFixed(4)}`
    const group = groups.get(key) ?? {
      kitId: hit.kitId,
      level: hit.level,
      hits: [],
    }
    if (!groups.has(key)) groups.set(key, group)
    group.hits.push(hit)
  }
  const scheduled: ScheduledDrumGroup[] = []
  try {
    for (const group of groups.values()) {
      const output = context.createGain()
      output.gain.value = group.level * input.drumLevel
      output.connect(destination)
      const player = createDrumKitPlayer({
        getAudioContext: () => context,
        getOutput: () => output,
        initialKitId: group.kitId,
        offline: true,
        selectionSeed: 0x6d6978,
      })
      scheduled.push({ output, player })
      if (!(await player.activate())) {
        scheduled.pop()
        await player.dispose()
        output.disconnect()
        continue
      }
      await player
        .prewarm(
          group.hits.map((hit) => ({
            gmKey: hit.gmKey,
            velocity: hit.velocity,
          })),
        )
        .catch(() => undefined)
      for (const [index, hit] of group.hits.entries())
        player.trigger({
          gmKey: hit.gmKey,
          velocity: hit.velocity,
          atContextTime: hit.offsetSeconds,
          lane: 'authored',
          sourceId: `mix:${index}`,
        })
    }
    return scheduled
  } catch (cause) {
    await Promise.all(
      scheduled.map(async ({ output, player }) => {
        await player.dispose()
        output.disconnect()
      }),
    )
    throw cause
  }
}

export async function renderGuitarRecordingMix(
  input: GuitarRecordingMixExport,
): Promise<Blob> {
  if (typeof OfflineAudioContext === 'undefined')
    throw new Error('Audio mix export is unavailable in this browser.')
  const capturedDuration =
    input.draft.recording.frames / input.draft.recording.sampleRate
  const noteDuration = input.notes.reduce(
    (latest, note) => Math.max(latest, note.endSeconds),
    0,
  )
  const duration = Math.max(capturedDuration, noteDuration)
  if (duration <= 0) throw new Error('There is no take audio to export.')
  if (input.source === 'recording' && input.draft.blob === null)
    throw new Error('The original recording is unavailable for export.')
  if (input.source === 'notes' && input.notes.length === 0)
    throw new Error('There are no detected notes to export.')

  const sampleRate = Math.min(
    MAX_EXPORT_SAMPLE_RATE,
    Math.max(8_000, input.draft.recording.sampleRate),
  )
  const context = new OfflineAudioContext(
    2,
    Math.ceil((duration + MIX_TAIL_SECONDS) * sampleRate),
    sampleRate,
  )
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 6
  limiter.ratio.value = 10
  limiter.attack.value = 0.003
  limiter.release.value = 0.12
  limiter.connect(context.destination)

  let cabinet: AudioBuffer | undefined
  if (input.amp.enabled && input.amp.engine === 'studio') {
    try {
      cabinet = await loadGuitarAmpCabinet(context)
    } catch {
      cabinet = undefined
    }
  }
  const amp = createGuitarAmpStage(context, input.amp, {
    ...(cabinet === undefined ? {} : { cabinetBuffer: cabinet }),
    loadCabinet: async () => {
      throw new Error('Cabinet unavailable during offline export.')
    },
  })
  amp.output.connect(limiter)

  let source: AudioBufferSourceNode | null = null
  let voices: Array<ReturnType<typeof createGuitarVoice>> = []
  let drumGroups: ScheduledDrumGroup[] = []
  try {
    if (input.source === 'recording') {
      source = context.createBufferSource()
      source.buffer = await context.decodeAudioData(
        await input.draft.blob!.arrayBuffer(),
      )
      source.connect(amp.input)
      source.start(0)
    } else voices = scheduleNotes(context, amp.input, input.notes)

    drumGroups = await scheduleDrums(context, limiter, input)
    const rendered = await context.startRendering()
    return new Blob([encodeAudioBufferToPcmWav(rendered)], {
      type: 'audio/wav',
    })
  } finally {
    source?.disconnect()
    for (const voice of voices) voice.dispose()
    amp.dispose()
    await Promise.all(
      drumGroups.map(async ({ output, player }) => {
        await player.dispose()
        output.disconnect()
      }),
    )
    limiter.disconnect()
  }
}

export async function downloadGuitarRecordingMix(
  input: GuitarRecordingMixExport,
  container: HTMLElement = document.body,
): Promise<void> {
  const blob = await renderGuitarRecordingMix(input)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const base = guitarRecordingFilename(input.draft.recording.title, 'wav')
  const count = (downloadCounts.get(base) ?? 0) + 1
  downloadCounts.set(base, count)
  link.download = count === 1 ? base : base.replace('.wav', `-${count}.wav`)
  container.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
