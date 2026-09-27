// Merc songbook — original lyric auditions, kept separate from scored lesson examples.

export const MERC_SONGBOOK = [
  {
    id: 'first-arc',
    words: 'Let it shine',
    title: 'First light',
    setting: 'A small invitation for the first glass.',
  },
  {
    id: 'sunlit-steps',
    words: 'Tiny sparks can glow',
    title: 'Sunlit steps',
    setting: 'A playful answer from a path of little lights.',
  },
  {
    id: 'gallery-arch',
    words: 'Another beautiful mess',
    title: 'A beautiful mess',
    setting: 'Merc’s signature toast to a shattered masterpiece.',
  },
  {
    id: 'little-light',
    words: 'Little light, lead me home',
    title: 'The lantern path',
    setting: 'A warm homecoming after a winding cloudway.',
  },
  {
    id: 'quiet-garden',
    words: 'Let the quiet garden sing',
    title: 'The listening garden',
    setting: 'A gentle phrase for glass flowers and thawing fountains.',
  },
  {
    id: 'beside-you',
    words: 'Beside you, I find my tune',
    title: 'Beside you',
    setting: 'A friendly duet invitation at the end of a gallery.',
  },
] as const

export type MercSongbookId = (typeof MERC_SONGBOOK)[number]['id']
export type MercSongbookTake = 'music' | 'merc'

export function mercSongbookAssetId(
  id: MercSongbookId,
  take: MercSongbookTake,
): string {
  return `merc-songbook-${id}-${take}-v7`
}

export const MERC_SONGBOOK_ASSETS = MERC_SONGBOOK.flatMap((song) =>
  (['music', 'merc'] as const).map((take) => ({
    id: mercSongbookAssetId(song.id, take),
    path: `adventure-voice-v7/${song.id}-${take}.mp3`,
  })),
)
