// ============================================================
// Local media: an element whose sound is the graph's stays off a TV
// ============================================================
//
// An element AirPlay takes as remote playback plays on the TV, or fails to,
// and leaves the Web Audio graph it feeds silent with no error (owner, 1 and
// 2 Nov 2026, an iPhone 13 Pro and an LG C2). The second half reads the
// source: each element handed to Web Audio, by `createMediaElementSource`
// or `new MediaElementAudioSourceNode`, is kept local where it is made or
// where it is handed over, so a new one cannot quietly skip it. Each hand-
// over is checked for its own element: a file that keeps one element local
// and hands another over bare once passed a check of the file as a whole
// (review, 2 Nov).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

/** Each element a source hands to Web Audio, as its argument is written. */
function handOvers(source: string): string[] {
  const viaMethod = [
    ...source.matchAll(/\.createMediaElementSource\(\s*([^)]*?)\s*\)/g),
  ].map((match) => match[1])
  const viaConstructor = [
    ...source.matchAll(
      /new\s+MediaElementAudioSourceNode\([^]*?mediaElement\s*:\s*([\w.]+(?:\([^)]*\))?)/g,
    ),
  ].map((match) => match[1])
  return [...viaMethod, ...viaConstructor]
}

/**
 * Whether the element a hand-over names is kept local in the same source:
 * wrapped at the hand-over, given to keepMediaLocal by name, or made by it.
 */
function keptLocal(source: string, element: string): boolean {
  if (element.startsWith('keepMediaLocal(')) return true
  const name = element.split('.').at(-1) ?? element
  return (
    new RegExp(`keepMediaLocal\\(\\s*[\\w.]*\\b${name}\\s*\\)`).test(source) ||
    new RegExp(`\\b${name}\\s*=\\s*keepMediaLocal\\(`).test(source)
  )
}

/** The elements a source hands to Web Audio and never keeps local. */
function bareHandOvers(source: string): string[] {
  return handOvers(source).filter((element) => !keptLocal(source, element))
}

const REPO = resolve(__dirname, '../..')

/**
 * Every source of the app's own: the web app's, the native app's and its
 * packages'. Tests, specs, fixtures and browser helpers are left out, as
 * the repo's other source guards leave them (MISTAKES.md, "Name a test
 * helper that imports production code `*.fixture.ts`").
 */
function appSources(): string[] {
  const packages = readdirSync(join(REPO, 'packages'))
    .map((name) => join('packages', name, 'src'))
    .filter((root) => existsSync(join(REPO, root)))
  return ['src', join('apps', 'mercurypitch', 'src'), ...packages].flatMap(
    (root) =>
      readdirSync(join(REPO, root), { recursive: true, encoding: 'utf8' })
        .filter((path) => /\.(ts|tsx)$/.test(path))
        .filter((path) => !/\.d\.ts$/.test(path))
        .filter(
          (path) =>
            !/\.(test|spec|fixture|test-fixtures)\.(ts|tsx)$/.test(path),
        )
        .filter((path) => !/(^|[\\/])(e2e|tests|node_modules)[\\/]/.test(path))
        .map((path) => join(REPO, root, path)),
  )
}

describe('every element handed to Web Audio', () => {
  it('is caught bare by the scan, one element at a time and in either form (review)', () => {
    // One kept local, another handed over bare, in the same file.
    const oneOfTwo = [
      'const kept = keepMediaLocal(new Audio("/a.mp3"))',
      'const bare = new Audio("/b.mp3")',
      'ctx.createMediaElementSource(bare)',
    ].join('\n')
    // The constructor form of the same hand-over.
    const constructed = [
      'const bare = new Audio("/c.mp3")',
      'return new MediaElementAudioSourceNode(ctx, { mediaElement: bare })',
    ].join('\n')
    const wrapped = 'ctx.createMediaElementSource(keepMediaLocal(element))'
    const made = [
      'const el = keepMediaLocal(new Audio())',
      'ctx.createMediaElementSource(track.el)',
    ].join('\n')

    expect(bareHandOvers(oneOfTwo)).toEqual(['bare'])
    expect(bareHandOvers(constructed)).toEqual(['bare'])
    expect(bareHandOvers(wrapped)).toEqual([])
    expect(bareHandOvers(made)).toEqual([])
  })

  it('is kept local, in the web app, the native app and its packages', () => {
    const sources = appSources()
    const found = sources.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return handOvers(source).map((element) => ({
        file: relative(REPO, file),
        element,
        local: keptLocal(source, element),
      }))
    })

    // The scan has to reach every root and find the hand-overs known today,
    // or it proves nothing.
    expect(sources.some((file) => file.includes('apps/mercurypitch/src'))).toBe(
      true,
    )
    expect(sources.some((file) => file.includes('packages/'))).toBe(true)
    expect(found.length).toBeGreaterThanOrEqual(7)
    expect(found.filter((handOver) => !handOver.local)).toEqual([])
  })
})
