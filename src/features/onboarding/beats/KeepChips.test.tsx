// ============================================================
// Keep's motion chips
// ============================================================
//
// Owner decision, 12 Oct 2026: a motion chip leads each of Keep's rows.
// These pin what the chips draw from (the singer's own glides, else the
// range's rise and fall, else a plain gentle glide), how many there are
// with and without the launch gift, that they add nothing to the rows'
// words, and the motion rules: once, only stroke-dashoffset, transform and
// opacity, and the settled frame under reduced motion.

import { cleanup, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeaturedPromo } from '@/db/services/billing-service'
import type { MirrorResult, RangeResult } from '@/lib/mirror/metrics'
import { idealStrip, ridgeShape } from '../voice-strip'
import { BeatKeep } from './BeatKeep'
import { KeepChip, LAPTOP_RIDGE, PHONE_RIDGE, PLAIN_GLIDE, VOICE_RIDGE, } from './KeepChips'

afterEach(cleanup)

const RANGE: RangeResult = {
  lowMidi: 45,
  highMidi: 69,
  lowNote: 'A2',
  highNote: 'A4',
  semitones: 24,
  qualifyingMidis: [],
  voiceHint: 'Baritone',
}

/** A glide up and back down, as voice-strip.ts hands it over. */
const STRIP = [45.5, 49, 53.2, 57, 60.8, 64.1, 68.5, 66, 61.7, 57.4, 52, 46]

const VOICEPRINT: MirrorResult = {
  range: RANGE,
  steadiness: null,
  accuracy: null,
}

const LAUNCH: FeaturedPromo = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T23:59:59.000Z',
}

/** The `d` of every ridge line in one chip, in drawing order. */
const ridges = (kind: string): (string | null)[] =>
  [...document.querySelectorAll(`[data-chip="${kind}"] [data-ridge-line]`)].map(
    (line) => line.getAttribute('d'),
  )

describe("the voiceprint chip's ridge", () => {
  it("is the singer's own glides", () => {
    render(() => (
      <KeepChip kind="voiceprint" tone="teal" strip={STRIP} range={RANGE} />
    ))

    expect(ridges('voiceprint')).toEqual([
      ridgeShape(STRIP, RANGE, VOICE_RIDGE.box).line,
    ])
    expect(ridges('voiceprint')[0]).not.toBe(
      ridgeShape(idealStrip(RANGE), RANGE, VOICE_RIDGE.box).line,
    )
  })

  it("is the range's own rise and fall when the glides did not come with it", () => {
    render(() => (
      <KeepChip kind="voiceprint" tone="teal" strip={null} range={RANGE} />
    ))

    expect(ridges('voiceprint')).toEqual([
      ridgeShape(idealStrip(RANGE), RANGE, VOICE_RIDGE.box).line,
    ])
  })

  it('is a plain gentle glide when the voiceprint has no range', () => {
    render(() => (
      <KeepChip kind="voiceprint" tone="teal" strip={STRIP} range={null} />
    ))

    const plain = ridgeShape(
      idealStrip(PLAIN_GLIDE),
      PLAIN_GLIDE,
      VOICE_RIDGE.box,
    )
    expect(ridges('voiceprint')).toEqual([plain.line])
    // Low: a fifth in a box tall for an octave, so it claims no range.
    expect(plain.high.y).toBeGreaterThan(30)
  })

  it('ends in the check', () => {
    render(() => (
      <KeepChip kind="voiceprint" tone="teal" strip={STRIP} range={RANGE} />
    ))

    const points = ridgeShape(STRIP, RANGE, VOICE_RIDGE.box).points
    const [x, y] = points[points.length - 1]
    const at = document
      .querySelector('[data-check]')
      ?.parentElement?.getAttribute('transform')
    expect(at).toBe(
      `translate(${(VOICE_RIDGE.x + x * VOICE_RIDGE.scale).toFixed(2)} ${(
        VOICE_RIDGE.y +
        y * VOICE_RIDGE.scale
      ).toFixed(2)})`,
    )
  })
})

describe('the devices chip', () => {
  it("lights the phone, then the laptop, with the singer's same ridge", () => {
    render(() => (
      <KeepChip kind="devices" tone="blue" strip={STRIP} range={RANGE} />
    ))

    expect(ridges('devices')).toEqual([
      ridgeShape(STRIP, RANGE, PHONE_RIDGE.box).line,
      ridgeShape(STRIP, RANGE, LAPTOP_RIDGE.box).line,
    ])
  })
})

describe('the chips on Keep', () => {
  function renderKeep(gift: FeaturedPromo | null) {
    const view = render(() => (
      <BeatKeep
        twin={null}
        voiceprint={VOICEPRINT}
        strip={STRIP}
        gift={gift}
        onCreateAccount={vi.fn()}
      />
    ))
    const chips = [
      ...view.container.querySelectorAll<HTMLElement>('[data-chip]'),
    ]
    return { view, chips }
  }

  it('leads each of the three rows with its chip when there is no gift', () => {
    const { view, chips } = renderKeep(null)

    expect(chips.map((chip) => chip.dataset.chip)).toEqual([
      'voiceprint',
      'devices',
      'podium',
    ])
    expect(chips.map((chip) => chip.dataset.tone)).toEqual([
      'teal',
      'blue',
      'violet',
    ])
    const rows = [...view.container.querySelectorAll('li')]
    expect(rows.map((row) => row.firstElementChild)).toEqual(chips)
  })

  it('has two chips with the gift: the podium goes with the leaderboard row', () => {
    const { chips } = renderKeep(LAUNCH)

    expect(chips.map((chip) => chip.dataset.chip)).toEqual([
      'voiceprint',
      'devices',
    ])
  })

  it('draws the strip it is handed', () => {
    renderKeep(null)

    expect(ridges('voiceprint')).toEqual([
      ridgeShape(STRIP, RANGE, VOICE_RIDGE.box).line,
    ])
  })

  it('hides the chips and adds no words: the rows say what is kept', () => {
    const { chips } = renderKeep(null)

    for (const chip of chips) {
      expect(chip.getAttribute('aria-hidden')).toBe('true')
      expect(chip.textContent).toBe('')
    }
  })
})

describe('the motion', () => {
  // jsdom applies no stylesheet, so these read the rules themselves,
  // without their comments.
  const css = readFileSync(
    resolve(__dirname, 'KeepChips.module.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')
  const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map(
    (match) => {
      // The block runs to the brace that closes the one after the name.
      let depth = 0
      let end = match.index + match[0].length - 1
      for (; end < css.length; end++) {
        if (css[end] === '{') depth++
        if (css[end] === '}' && --depth === 0) break
      }
      return { name: match[1], body: css.slice(match.index, end + 1) }
    },
  )
  const reducedAt = css.indexOf('prefers-reduced-motion: reduce')
  /** Every rule outside the keyframes and the reduced-motion block. */
  const resting = keyframes
    .reduce((rest, frame) => rest.replace(frame.body, ''), css)
    .slice(0, reducedAt)

  it('moves only stroke-dashoffset, transform and opacity', () => {
    expect(keyframes.length).toBeGreaterThan(0)
    const moved = new Set(
      keyframes.flatMap((frame) =>
        [...frame.body.matchAll(/([\w-]+)\s*:/g)].map((match) => match[1]),
      ),
    )

    expect([...moved].sort()).toEqual([
      'opacity',
      'stroke-dashoffset',
      'transform',
    ])
  })

  it('plays once and holds', () => {
    expect(css).not.toMatch(/infinite|animation-iteration-count|alternate/)
    for (const [animation] of css.matchAll(/animation:[^;]+;/g)) {
      if (animation.trim() === 'animation: none;') continue
      expect(animation).toMatch(/\bboth;$/)
    }
  })

  it('rests in the settled frame, so reduced motion only turns it off', () => {
    const reduced = css.slice(reducedAt)
    expect(reduced).toMatch(/\.chip \*\s*\{\s*animation: none;\s*\}/)

    // Nothing drawn waits at its start state outside an animation: no line
    // rests undrawn, and only the light and the glint, which are gone once
    // they have played, rest unseen.
    expect(resting).not.toMatch(/stroke-dashoffset/)
    const hidden = [...resting.matchAll(/\.(\w+)\s*\{[^}]*opacity:\s*0;/g)].map(
      (match) => match[1],
    )
    expect(hidden.sort()).toEqual(['glint', 'spark'])
  })
})
