// ============================================================
// Piano Night free-room catalog tests — public, complete, route-local art
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_PIANO_NIGHT_FREE_ROOM_ID, getPianoNightFreeRoom, PIANO_NIGHT_FREE_ROOMS, } from './piano-night-rooms'

describe('Piano Night free rooms', () => {
  it('ships the two approved public room identities with responsive sources', () => {
    expect(PIANO_NIGHT_FREE_ROOMS).toEqual([
      {
        id: 'afterglow-studio',
        label: 'Afterglow Studio',
        landscapeUrl: '/piano-night/afterglow-studio-landscape.webp',
        portraitUrl: '/piano-night/afterglow-studio-portrait.webp',
        treatment: 'dark',
      },
      {
        id: 'morning-conservatory',
        label: 'Morning Conservatory',
        landscapeUrl: '/piano-night/morning-conservatory-landscape.webp',
        portraitUrl: '/piano-night/morning-conservatory-portrait.webp',
        treatment: 'light',
      },
    ])
  })

  it('uses Afterglow as the route-local default', () => {
    expect(DEFAULT_PIANO_NIGHT_FREE_ROOM_ID).toBe('afterglow-studio')
    expect(
      getPianoNightFreeRoom(DEFAULT_PIANO_NIGHT_FREE_ROOM_ID),
    ).toMatchObject({
      label: 'Afterglow Studio',
      treatment: 'dark',
    })
  })
})
