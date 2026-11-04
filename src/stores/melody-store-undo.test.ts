// ============================================================
// Deleting a melody, then Undo — the playlists come back too
// ============================================================
//
// Deleting a melody takes it out of every playlist as well as the library.
// The Library's Undo put it back in the library only, so a singer who
// deleted the wrong melody and undid it found "Warm-ups" a melody short,
// with nothing on screen saying a playlist had changed.

import { beforeEach, describe, expect, it } from 'vitest'
import { addMelodyToPlaylist, createNewMelody, createPlaylist, deleteMelody, deletePlaylist, getMelody, getMelodyLibrary, resetMelodyLibrary, restoreMelody, } from './melody-store'

const keysOf = (playlistId: string): string[] =>
  getMelodyLibrary().playlists[playlistId]?.melodyKeys ?? []

beforeEach(() => {
  resetMelodyLibrary()
})

describe('restoreMelody after deleteMelody', () => {
  it('puts an undone melody back into each playlist, where it was', () => {
    const a = createNewMelody('A')
    const b = createNewMelody('B')
    const c = createNewMelody('C')
    const warmUps = createPlaylist('Warm-ups')
    const favourites = createPlaylist('Favourites')
    for (const melody of [a, b, c]) addMelodyToPlaylist(warmUps, melody.id)
    addMelodyToPlaylist(favourites, b.id)
    addMelodyToPlaylist(favourites, a.id)
    const deleted = getMelody(b.id)!

    const places = deleteMelody(b.id)
    restoreMelody(deleted, places)

    expect(keysOf(warmUps)).toEqual([a.id, b.id, c.id])
    expect(keysOf(favourites)).toEqual([b.id, a.id])
    expect(getMelody(b.id)?.name).toBe('B')
  })

  it('still restores the melody when one of its playlists was deleted meanwhile', () => {
    const a = createNewMelody('A')
    const keep = createPlaylist('Keep')
    const gone = createPlaylist('Gone')
    addMelodyToPlaylist(keep, a.id)
    addMelodyToPlaylist(gone, a.id)
    const deleted = getMelody(a.id)!
    const places = deleteMelody(a.id)
    deletePlaylist(gone)

    restoreMelody(deleted, places)

    expect(keysOf(keep)).toEqual([a.id])
    expect(getMelodyLibrary().playlists[gone]).toBeUndefined()
  })
})
