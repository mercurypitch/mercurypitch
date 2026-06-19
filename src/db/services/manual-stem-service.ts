// ============================================================
// Manual Stem Service — build/update sessions from uploaded stems
// ============================================================
//
// Lets users package pre-separated stems (a vocal and/or an instrumental) into
// a normal session WITHOUT running the UVR separation algorithm. Reuses the
// existing session + stem-blob plumbing so the result plays/exports like any
// other separated session.

import { deleteStemBlobs, hydrateStemUrls, saveStemBlob, } from '@/db/services/uvr-service'
import { completeUvrSession, getUvrSession, setUvrSessionProvider, startUvrSession, } from '@/stores/app-store'

type StemType = 'vocal' | 'instrumental'

/** Decode a clip's duration; undefined if it can't be decoded. */
async function decodeDuration(file: File): Promise<number | undefined> {
  try {
    const ctx = new AudioContext()
    const buf = await file.arrayBuffer()
    const audio = await ctx.decodeAudioData(buf)
    const duration = audio.duration
    await ctx.close()
    return duration
  } catch {
    return undefined
  }
}

export interface ManualStemInput {
  songName: string
  vocal?: File
  instrumental?: File
}

/**
 * Create a completed session from one or both uploaded stems (no separation).
 * Returns the new session id, or null if no stem was provided.
 */
export async function createManualStemSession(
  input: ManualStemInput,
): Promise<string | null> {
  const stems: { type: StemType; file: File }[] = []
  if (input.vocal) stems.push({ type: 'vocal', file: input.vocal })
  if (input.instrumental)
    stems.push({ type: 'instrumental', file: input.instrumental })
  if (stems.length === 0) return null

  const first = stems[0].file
  const name = input.songName.trim() || first.name.replace(/\.[^.]+$/, '')
  const sessionId = startUvrSession(
    name,
    first.size,
    first.type || 'audio/mpeg',
    'separate',
    'local',
  )

  const stemMeta: Record<string, { duration?: number; size?: number }> = {}
  for (const { type, file } of stems) {
    await saveStemBlob(sessionId, type, file, file.name)
    stemMeta[type] = { duration: await decodeDuration(file), size: file.size }
  }

  const urls = await hydrateStemUrls(sessionId)
  completeUvrSession(sessionId, urls ?? {}, stemMeta)
  // Cosmetic tag so the UI can show "Uploaded stems" vs "Separated".
  setUvrSessionProvider(sessionId, 'manual')
  return sessionId
}

/**
 * Add or replace a single stem on an existing session and refresh its outputs.
 * Replacing drops the previous blob(s) for that stem first.
 */
export async function setSessionStem(
  sessionId: string,
  stemType: StemType,
  file: File,
): Promise<void> {
  await deleteStemBlobs(sessionId, stemType)
  await saveStemBlob(sessionId, stemType, file, file.name)

  const urls = await hydrateStemUrls(sessionId)
  const session = getUvrSession(sessionId)
  const stemMeta = {
    ...(session?.stemMeta ?? {}),
    [stemType]: { duration: await decodeDuration(file), size: file.size },
  }
  // Merge so any generated MIDI URLs on the session are preserved.
  completeUvrSession(sessionId, { ...session?.outputs, ...urls }, stemMeta)
}
