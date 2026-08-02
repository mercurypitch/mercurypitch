// ============================================================
// Freeform Voice Take — stable local threads for self-chosen prompts
// ============================================================

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import { generateId } from '@/lib/id'

const FREEFORM_CONTEXT_VERSION = 1

export interface FreeformThreadTarget {
  comparisonKey: string
  title: string
}

export interface FreeformVoiceTakeCapture {
  blob: Blob
  durationMs: number
  peaks: Float32Array
  capturedAt: string
}

export function createFreeformThreadTarget(): FreeformThreadTarget {
  return {
    comparisonKey: `freeform:${generateId()}:v${FREEFORM_CONTEXT_VERSION}`,
    title: '',
  }
}

export async function keepFreeformVoiceTake(input: {
  target: FreeformThreadTarget
  threadTitle: string
  take: FreeformVoiceTakeCapture
}): Promise<SaveVoiceTakeResult> {
  const threadTitle = input.threadTitle.trim()
  return saveVoiceTake({
    source: 'freeform',
    comparisonKey: input.target.comparisonKey,
    contextVersion: FREEFORM_CONTEXT_VERSION,
    capturedAt: input.take.capturedAt,
    durationMs: input.take.durationMs,
    blob: input.take.blob,
    peaks: input.take.peaks,
    title: threadTitle,
    context: {
      threadTitle,
      prompt: threadTitle,
    },
  })
}
