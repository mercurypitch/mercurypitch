import { describe, expect, it } from 'vitest'
import { karaokeEntryIntent } from './entry-intent'

describe('karaokeEntryIntent', () => {
  it.each([
    '/vocal-remover',
    '/vocal-remover/',
    '/vocal-remover//',
    '/vocal-remover.html',
  ])('opens the vocal remover at %s', (pathname) => {
    expect(karaokeEntryIntent(pathname)).toBe('vocal-remover')
  })

  it.each(['/karaoke-app', '/karaoke-app/', '/karaoke-app.html'])(
    'opens the karaoke app at %s',
    (pathname) => {
      expect(karaokeEntryIntent(pathname)).toBe('karaoke-app')
    },
  )

  // Its own address, its alias, the files behind them, and anything else:
  // a page that boots this room and is none of the other two is the room.
  it.each([
    '/karaoke-night',
    '/karaoke',
    '/karaoke.html',
    '/karaoke-night.html',
    '/',
  ])('opens Karaoke Night itself at %s', (pathname) => {
    expect(karaokeEntryIntent(pathname)).toBe('karaoke-night')
  })
})
