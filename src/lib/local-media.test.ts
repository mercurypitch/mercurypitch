// ============================================================
// Local media: an element whose sound is the graph's stays off a TV
// ============================================================
//
// An element AirPlay takes as remote playback plays on the TV, or fails to,
// and leaves the Web Audio graph it feeds silent with no error (owner, 1 and
// 2 Nov 2026, an iPhone 13 Pro and an LG C2). The second half reads the
// source: every module that hands a media element to Web Audio keeps it
// local, so a new one cannot quietly skip it.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AIRPLAY_ATTRIBUTE, keepMediaLocal } from './local-media'

describe('keepMediaLocal', () => {
  it('turns remote playback off and denies AirPlay on an <audio>', () => {
    const element = document.createElement('audio')

    keepMediaLocal(element)

    expect(element.disableRemotePlayback).toBe(true)
    expect(element.getAttribute(AIRPLAY_ATTRIBUTE)).toBe('deny')
  })

  it('does the same for a <video>', () => {
    const element = document.createElement('video')

    keepMediaLocal(element)

    expect(element.disableRemotePlayback).toBe(true)
    expect(element.getAttribute('x-webkit-airplay')).toBe('deny')
  })

  it('hands back the element it was given, so it can wrap a constructor', () => {
    const element = new Audio()

    expect(keepMediaLocal(element)).toBe(element)
  })

  it('leaves a double that cannot take attributes as it was, playable', () => {
    const double = { paused: true } as unknown as HTMLMediaElement

    const kept = keepMediaLocal(double)

    expect(kept).toBe(double)
    // The property is set before the attribute that cannot be.
    expect(kept.disableRemotePlayback).toBe(true)
    expect(kept.paused).toBe(true)
  })
})

/** Every app source file under `src/`, its tests and browser specs left out. */
function appSources(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => !/\.(test|spec)\.(ts|tsx)$/.test(path))
    .filter((path) => !/^(e2e|tests)[\\/]/.test(path))
    .map((path) => join(root, path))
}

describe('every element handed to Web Audio', () => {
  it('is kept local by the module that hands it over', () => {
    const src = resolve(__dirname, '..')
    const handsOver = appSources(src).filter((file) =>
      /\.createMediaElementSource\(/.test(readFileSync(file, 'utf8')),
    )

    const skipped = handsOver
      .filter((file) => !readFileSync(file, 'utf8').includes('keepMediaLocal('))
      .map((file) => relative(src, file))

    // The scan has to find the ones known today, or it proves nothing.
    expect(handsOver.length).toBeGreaterThanOrEqual(7)
    expect(skipped).toEqual([])
  })
})
