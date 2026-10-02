// ============================================================
// Import a song: the checks made on the phone first (plan S8 §6.1)
// ============================================================
//
// Everything that can be known before a song is sent is checked here, so a
// song the server would refuse costs the singer nothing and a wait for
// nothing: the type the server reads, its 50 MB cap, the handler's twelve
// minutes, and room for the copy the app keeps and the stems that come
// back. Each refusal says why and ends "Nothing was used."
//
// A length the phone cannot read passes. The server verifies the length of
// every song it is sent and refuses past its cap before anything runs, and a
// slow phone's metadata probe times out on songs that are perfectly good.

import { hasRoomFor } from '@/db/durable-write'
import { audioDurationSecs } from '@/lib/audio-duration'
import { SERVER_MAX_UPLOAD_BYTES } from '@/lib/audio-upload-contract'
import { thisDeviceLower } from '@/lib/device-noun'

const MB = 1024 * 1024

/** The server's cap on a song's file (audio-upload-contract.ts). */
export const IMPORT_MAX_BYTES = SERVER_MAX_UPLOAD_BYTES
/** The separation's cap on a song's length, in seconds. */
export const IMPORT_MAX_SECONDS = 12 * 60
/** About what two AAC stems of a twelve-minute song take (plan §7). */
export const IMPORT_STEM_BYTES = 20 * MB

const EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac'] as const
const TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
] as const

/**
 * The picker's `accept`. Named types rather than `audio/*`: on iOS the
 * wildcard maps to a narrow set that greys out ordinary MP3 files in Files
 * (audio-upload-contract.ts).
 */
export const IMPORT_ACCEPT = [
  ...EXTENSIONS.map((extension) => `.${extension}`),
  ...TYPES,
].join(',')

export interface ImportRefusal {
  readonly title: string
  readonly body: string
}

export interface ImportCheckDeps {
  readonly duration: (file: File) => Promise<number | null>
  readonly hasRoom: (bytes: number) => Promise<boolean>
}

const DEFAULT_DEPS: ImportCheckDeps = {
  duration: async (file) => audioDurationSecs(file),
  hasRoom: hasRoomFor,
}

/** The song as the singer knows it: the file's name, less its extension. */
export function songTitleOf(file: Pick<File, 'name'>): string {
  const title = file.name.replace(/\.[a-z0-9]{1,5}$/iu, '').trim()
  return title === '' ? 'Untitled song' : title
}

function readable(file: File): boolean {
  const type = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return (
    (TYPES as readonly string[]).includes(type) ||
    (file.name.includes('.') &&
      (EXTENSIONS as readonly string[]).includes(extension))
  )
}

function clock(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const NOTHING_USED = 'Nothing was used.'

/** The queue's refusal when the copy kept for a resend cannot be saved. */
export function noRoomForCopy(): ImportRefusal {
  return {
    title: `Not enough space on ${thisDeviceLower()}`,
    body: `Free up some space and try again. ${NOTHING_USED}`,
  }
}

/** Null for a song that can be sent, else why it cannot. */
export async function checkImport(
  file: File,
  deps: ImportCheckDeps = DEFAULT_DEPS,
): Promise<ImportRefusal | null> {
  const title = songTitleOf(file)
  if (file.size === 0) {
    return {
      title: 'This file is empty',
      body: `Choose ${title} again from Files. ${NOTHING_USED}`,
    }
  }
  if (!readable(file)) {
    return {
      title: 'This file cannot be separated',
      body: `Songs can be MP3, M4A, WAV or FLAC. ${title} is not one of them. ${NOTHING_USED}`,
    }
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return {
      title: 'This song is too big',
      body: `Songs up to ${IMPORT_MAX_BYTES / MB} MB can be separated. ${title} is ${Math.ceil(file.size / MB)} MB. ${NOTHING_USED}`,
    }
  }
  const seconds = await deps.duration(file)
  if (seconds !== null && Math.round(seconds) > IMPORT_MAX_SECONDS) {
    return {
      title: 'This song is too long',
      body: `Songs up to ${IMPORT_MAX_SECONDS / 60} minutes can be separated. ${title} is ${clock(seconds)}. ${NOTHING_USED}`,
    }
  }
  // The copy the app keeps until the song is sent, and the stems.
  const needed = file.size + IMPORT_STEM_BYTES
  if (!(await deps.hasRoom(needed))) {
    return {
      title: `Not enough space on ${thisDeviceLower()}`,
      body: `Free up about ${Math.ceil(needed / MB)} MB and try again. ${NOTHING_USED}`,
    }
  }
  return null
}
