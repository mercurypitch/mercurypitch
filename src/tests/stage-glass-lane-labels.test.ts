// ============================================================
// The stage-glass slider reaches the lane names too
// ============================================================
//
// The lane rails down the left of the waveform — Vocal, Instrumental, and
// the MONITORING badge — are painted onto the canvas, so no CSS rule can
// fade them with the rest of the glass. The canvas controller works around
// that by reading a custom property on each redraw and using it as its
// fillStyle.
//
// That property was defined only in karaoke-night.css, so the standalone
// stage faded its lane rails and the in-app studio — which has the very same
// slider — left them at a fixed near-opaque plate. It read as the slider
// being ignored, because for those blocks it was.
//
// Three things have to hold, and each one alone is silently insufficient:
// the property is defined where the mixer can inherit it, it is derived from
// the alpha the slider writes, and moving the slider asks for a repaint —
// canvas paint does not follow a CSS variable on its own.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const mixerSource = source('src/components/StemMixer.tsx')
const karaokeNightCss = source('src/features/karaoke-night/karaoke-night.css')
const canvasControllerSource = source(
  'src/features/stem-mixer/useStemMixerCanvasController.ts',
)

/** The declaration block of `.stem-mixer`, where the glass tokens live. */
function stemMixerBlock(): string {
  const start = mixerSource.indexOf('\n.stem-mixer {')
  expect(start).toBeGreaterThan(-1)
  const end = mixerSource.indexOf('\n}', start)
  expect(end).toBeGreaterThan(start)
  return mixerSource.slice(start, end)
}

describe('stage glass — canvas-painted lane labels', () => {
  it('defines the lane-label backdrop on the mixer itself', () => {
    expect(stemMixerBlock()).toMatch(/--sm-lane-label-bg:/)
  })

  it('derives it from the alpha the slider writes', () => {
    const block = stemMixerBlock()
    const declaration = block.slice(block.indexOf('--sm-lane-label-bg:'))
    // Bounded to this declaration: a lazy match across the closing semicolon
    // would happily find the NEXT property's use of the alpha.
    const value = declaration.slice(0, declaration.indexOf(';'))
    expect(value).toMatch(/var\(--sm-stage-alpha\)/)
  })

  it('leaves one definition, so the studio cannot drift from the stage', () => {
    expect(karaokeNightCss).not.toMatch(/^\s*--sm-lane-label-bg:/m)
  })

  it('is the property the canvas controller actually reads', () => {
    expect(canvasControllerSource).toMatch(
      /getPropertyValue\(\s*'--sm-lane-label-bg'\s*\)/,
    )
  })

  it('asks for a repaint when the studio slider moves', () => {
    const updater = mixerSource.slice(
      mixerSource.indexOf('const updateStageAlpha ='),
    )
    const body = updater.slice(0, updater.indexOf('\n  }'))
    expect(body).toMatch(/persistKaraokeStageAlpha/)
    expect(body).toMatch(/eventBus\.dispatch\('karaoke:stage-glass'/)
  })

  it('has a listener on the other end of that event', () => {
    expect(canvasControllerSource).toMatch(
      /eventBus\.on\('karaoke:stage-glass',\s*queueCanvasRedraw\)/,
    )
  })
})
