// Studio song metadata — a song's length, lanes and last edit, written from its summary row alone.
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'

/** A song's length from its summary's frames: `3:42`, or `1:02:05` from an hour on. */
export function songDuration(frames: number): string {
  const total =
    Number.isFinite(frames) && frames > 0
      ? Math.floor(frames / STUDIO_SAMPLE_RATE)
      : 0
  const hours = Math.floor(total / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

/** How many lanes the song has, in the Studio's own word for them. */
export function songLanes(count: number): string {
  if (count <= 0) return 'No lanes'
  return count === 1 ? '1 lane' : `${count} lanes`
}

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * When the song was last edited, by the day: `Today`, `Yesterday`, else its
 * date (with the year once it is another year's). `long` is the same for a
 * screen reader. Null for a date that cannot be read.
 */
export function songEdited(
  updatedAt: string,
  now: Date = new Date(),
  locale?: string,
): { short: string; long: string } | null {
  const edited = new Date(updatedAt)
  if (Number.isNaN(edited.getTime())) return null
  const days = Math.round((dayStart(now) - dayStart(edited)) / 86_400_000)
  if (days === 0) return { short: 'Today', long: 'Edited today' }
  if (days === 1) return { short: 'Yesterday', long: 'Edited yesterday' }
  const short = edited.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(edited.getFullYear() === now.getFullYear()
      ? {}
      : { year: 'numeric' as const }),
  })
  return { short, long: `Edited ${short}` }
}
