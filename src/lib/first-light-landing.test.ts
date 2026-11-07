// ============================================================
// First Light's landing rule, by document
// ============================================================

import { describe, expect, it } from 'vitest'
import { ENTRY_PAGES } from '@/seo/entry-pages'
import { firstLightOpensOn, ROOM_ENTRY_PATHS } from './first-light-landing'

describe('the documents First Light may open on by itself', () => {
  // The home document, in every spelling it is served at, and the other
  // addresses that serve it: a drill's marketing link and the admin entries.
  it.each(['/', '/index.html', '/exercises/speed-scales', '/admin'])(
    'opens on %s',
    (pathname) => {
      expect(firstLightOpensOn(pathname)).toBe(true)
    },
  )

  // A search or a link that named one room gets that room.
  it.each([
    '/ear-lab',
    '/ear-lab/',
    '/ear-lab.html',
    '/jam',
    '/jam-rooms',
    '/pitch-training',
    '/pitch-training.html',
    '/studio-night',
  ])('stays shut on the room entry %s', (pathname) => {
    expect(firstLightOpensOn(pathname)).toBe(false)
  })

  // Read off the model, so an entry that gains a bootHash is held here the
  // day it does: it would otherwise open on the welcome, not its room.
  it('names every entry document that boots the studio into a room', () => {
    const booted = ENTRY_PAGES.filter(
      (page) => page.bootHash !== undefined && page.bootHash !== '',
    ).flatMap((page) => [...page.paths])

    expect([...ROOM_ENTRY_PATHS].sort()).toEqual([...booted].sort())
  })
})
