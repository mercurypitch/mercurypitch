// ============================================================
// Studio storage copy — what the storage ask and Song options say, with the numbers the song budget gives
// ============================================================
//
// The counts come from the budget's own arithmetic (storage-quality.ts), so
// they move with it: a four-minute stereo WAV is the take they are told in,
// because it is what a singer brings, and the case the audit measured.
import type { StudioStorageQuality } from '@/lib/studio/audio/storage-quality'
import { STUDIO_REFERENCE_TAKE, studioTakesPerSong, } from '@/lib/studio/audio/storage-quality'
import type { StudioProtection } from './studio-persistence'

export interface StudioStorageChoiceCopy {
  readonly quality: StudioStorageQuality
  readonly label: string
  readonly note: string
}

const tracks = (quality: StudioStorageQuality) =>
  studioTakesPerSong(STUDIO_REFERENCE_TAKE, quality)

export const STUDIO_STORAGE_CHOICES: readonly StudioStorageChoiceCopy[] = [
  {
    quality: 'full',
    label: 'Full quality',
    note: `Every detail, as you added it. About ${tracks('full')} four-minute stereo tracks fit in a song.`,
  },
  {
    quality: 'compact',
    label: 'Save space',
    note: `CD quality, in a smaller copy. About ${tracks('compact')} four-minute stereo tracks fit in a song.`,
  },
]

export const STUDIO_STORAGE_QUESTION = 'How should Studio keep your audio?'

export const STUDIO_STORAGE_EXPLAINED =
  'Studio keeps each file you add in this browser, with a copy it plays from. That copy can keep every detail, or be smaller so more fits in a song.'

/** True of both choices, and the reason Save space is safe to pick. */
export const STUDIO_STORAGE_EXPORTS =
  'Playback and exports run at full quality either way. A 16-bit WAV at 48 kHz stays exact.'

/** What the readouts say about the browser keeping the songs; null before it has answered. */
export function studioProtectionText(
  protection: StudioProtection | null,
): string | null {
  switch (protection) {
    case 'protected':
      return 'This browser keeps your songs even when the device runs low on space.'
    case 'unprotected':
      return 'This browser may clear your songs if the device runs low on space. Save a project backup to keep a copy.'
    case 'unknown':
      return 'This browser does not say whether it keeps your songs when the device runs low on space. Save a project backup to keep a copy.'
    default:
      return null
  }
}
