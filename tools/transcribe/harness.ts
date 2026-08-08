// Transcription bench harness — the shipping code, in a real browser.
// ============================================================
//
// Dev-only. Exists so the CLI can measure the transcription the app actually
// runs, rather than a Node port of it that would drift the moment either side
// changed. Everything below is a thin call into src/; nothing here reimplements
// a step, and if a call needs a wrapper the wrapper belongs in src/ instead.
//
// `decodeAudioData` is the reason this is a browser at all: it is both the
// decoder and the resampler, so the analysis rate a profile asks for is a
// browser filter chain that no Node library would reproduce exactly.

import type { MidiSong } from '@/lib/midi-song'
import { parseMidiSong } from '@/lib/midi-song'
import { parseGuitarProFile } from '@/lib/tab/gp-import'
import type { StemTranscription, TranscriptionProfile, } from '@/lib/transcription/stem-transcription'
import { BASS_TRANSCRIPTION_PROFILE, transcribeStemSamples, } from '@/lib/transcription/stem-transcription'

interface DecodedStem {
  samples: Float32Array
  sampleRate: number
  durationSeconds: number
}

/**
 * Decode to mono at the profile's analysis rate. Deliberately the same shape as
 * `decodeStemForAnalysis`, but from bytes rather than a URL — the bench reads
 * files off disk, and copying an 87 MB stem into the project just to give it a
 * URL would make the bench annoying enough that nobody would run it.
 */
async function decodeBytes(
  bytes: ArrayBuffer,
  analysisSampleRate: number,
): Promise<DecodedStem> {
  const context = new OfflineAudioContext(1, 2, analysisSampleRate)
  const decoded = await context.decodeAudioData(bytes)
  const left = decoded.getChannelData(0)
  const durationSeconds = decoded.length / decoded.sampleRate
  if (decoded.numberOfChannels === 1) {
    return { samples: left, sampleRate: decoded.sampleRate, durationSeconds }
  }
  const right = decoded.getChannelData(1)
  const mono = new Float32Array(left.length)
  for (let index = 0; index < left.length; index += 1) {
    mono[index] = (left[index] + right[index]) / 2
  }
  return { samples: mono, sampleRate: decoded.sampleRate, durationSeconds }
}

export interface BenchTranscribeResult extends StemTranscription {
  sampleRate: number
  durationSeconds: number
  elapsedMs: number
}

declare global {
  interface Window {
    transcribeBench: {
      transcribe(
        url: string,
        profileOverrides?: Partial<TranscriptionProfile>,
      ): Promise<BenchTranscribeResult>
      readTab(url: string, fileName: string): Promise<MidiSong>
      ready: true
    }
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} reading ${url}`)
  return response.arrayBuffer()
}

window.transcribeBench = {
  async transcribe(url, profileOverrides = {}) {
    const profile: TranscriptionProfile = {
      ...BASS_TRANSCRIPTION_PROFILE,
      ...profileOverrides,
    }
    const bytes = await fetchBytes(url)
    const decoded = await decodeBytes(bytes, profile.analysisSampleRate)
    const startedAt = performance.now()
    const transcription = await transcribeStemSamples(
      decoded.samples,
      decoded.sampleRate,
      { profile },
    )
    return {
      ...transcription,
      sampleRate: decoded.sampleRate,
      durationSeconds: decoded.durationSeconds,
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  },

  async readTab(url, fileName) {
    const bytes = await fetchBytes(url)
    if (/\.midi?$/i.test(fileName)) {
      const song = parseMidiSong(new Uint8Array(bytes))
      if (song === null) throw new Error(`${fileName} is not a MIDI file`)
      return song
    }
    const file = new File([bytes], fileName)
    const { song } = await parseGuitarProFile(file)
    return song
  },

  ready: true,
}
