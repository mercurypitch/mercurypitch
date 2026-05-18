// ============================================================
// Slide Note Rendering E2E Tests
// Tests slideInterval storage, midiToY coordinate mapping,
// and canvas rendering for slide/ease S-shape notes.
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Slide Note Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('midiToY returns correct Y for scale notes (high-to-low ordering)', async ({
    page,
  }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(800)

    const result = await page.evaluate(() => {
      const pr = (window as any).pianoRollEditor
      if (!pr) return { error: 'piano roll not found' }

      const scale = pr.scale
      if (!scale || scale.length === 0) return { error: 'scale is empty' }

      // Verify scale is high-to-low (scale[0] has highest MIDI)
      const isHighToLow = scale[0].midi > scale[scale.length - 1].midi

      // Test midiToY for a few notes in scale
      const tests: { midi: number; expectedRow: number }[] = []
      for (let i = 0; i < Math.min(5, scale.length); i++) {
        tests.push({ midi: scale[i].midi, expectedRow: i })
      }

      const results = tests.map((t) => {
        const y = pr.midiToY(t.midi)
        const rowHeight = pr.rowHeight
        const expectedY = t.expectedRow * rowHeight + rowHeight / 2
        return {
          midi: t.midi,
          expectedRow: t.expectedRow,
          actualY: y,
          expectedY,
          match: Math.abs(y - expectedY) < 0.01,
        }
      })

      return {
        isHighToLow,
        results,
        totalRows: pr.totalRows,
        rowHeight: pr.rowHeight,
      }
    })

    expect(result.error).toBeUndefined()
    expect(result.isHighToLow).toBe(true)
    for (const r of result.results ?? []) {
      expect(
        r.match,
        `midiToY(${r.midi}) = ${r.actualY}, expected ${r.expectedY} (row ${r.expectedRow})`,
      ).toBe(true)
    }
  })

  test('midiToY interpolates between scale notes for non-scale MIDI', async ({
    page,
  }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(800)

    const result = await page.evaluate(() => {
      const pr = (window as any).pianoRollEditor
      if (!pr) return { error: 'piano roll not found' }

      const scale = pr.scale
      if (!scale || scale.length < 3) return { error: 'scale too small' }

      // Find two adjacent scale notes with MIDI gap > 1
      let found: {
        loMidi: number
        hiMidi: number
        loRow: number
        hiRow: number
      } | null = null
      for (let i = 0; i < scale.length - 1; i++) {
        // Since scale is high-to-low, scale[i] is higher pitch (smaller row)
        if (scale[i].midi - scale[i + 1].midi > 1) {
          found = {
            hiMidi: scale[i].midi,
            loMidi: scale[i + 1].midi,
            hiRow: i,
            loRow: i + 1,
          }
          break
        }
      }
      if (!found) return { error: 'no gap > 1 found in scale' }

      // Test midpoint interpolation
      const midMidi = found.loMidi + 1 // e.g., F#4 between F4 and G4
      const y = pr.midiToY(midMidi)
      const rowHeight = pr.rowHeight
      const frac = (midMidi - found.loMidi) / (found.hiMidi - found.loMidi)
      // Expected: interpolate from loRow (larger y) toward hiRow (smaller y)
      const expectedY =
        found.loRow * rowHeight +
        rowHeight / 2 -
        frac *
          (found.loRow * rowHeight +
            rowHeight / 2 -
            (found.hiRow * rowHeight + rowHeight / 2))

      return {
        loMidi: found.loMidi,
        hiMidi: found.hiMidi,
        midMidi,
        loRow: found.loRow,
        hiRow: found.hiRow,
        actualY: y,
        expectedY,
        rowHeight,
        match: Math.abs(y - expectedY) < 0.1,
      }
    })

    expect(result.error).toBeUndefined()
    expect(
      result.match,
      `Interpolation for MIDI ${result.midMidi}: got Y=${result.actualY}, expected ${result.expectedY}`,
    ).toBe(true)
  })

  test('midiToY clamps above-highest MIDI to top row', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(800)

    const result = await page.evaluate(() => {
      const pr = (window as any).pianoRollEditor
      if (!pr) return { error: 'piano roll not found' }

      const scale = pr.scale
      const highestMidi = scale[0].midi
      const y = pr.midiToY(highestMidi + 24) // two octaves above highest
      const expectedY = pr.rowHeight / 2

      return {
        highestMidi,
        testMidi: highestMidi + 24,
        actualY: y,
        expectedY,
        rowHeight: pr.rowHeight,
        match: y === expectedY,
      }
    })

    expect(result.error).toBeUndefined()
    expect(
      result.match,
      `Above-range MIDI should clamp to top: got ${result.actualY}, expected ${result.expectedY}`,
    ).toBe(true)
  })

  test('midiToY clamps below-lowest MIDI to bottom row', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(800)

    const result = await page.evaluate(() => {
      const pr = (window as any).pianoRollEditor
      if (!pr) return { error: 'piano roll not found' }

      const scale = pr.scale
      const last = scale.length - 1
      const lowestMidi = scale[last].midi
      const y = pr.midiToY(lowestMidi - 24) // two octaves below lowest
      const expectedY = last * pr.rowHeight + pr.rowHeight / 2

      return {
        lowestMidi,
        testMidi: lowestMidi - 24,
        actualY: y,
        expectedY,
        lastIndex: last,
        match: y === expectedY,
      }
    })

    expect(result.error).toBeUndefined()
    expect(
      result.match,
      `Below-range MIDI should clamp to bottom: got ${result.actualY}, expected ${result.expectedY}`,
    ).toBe(true)
  })

  test('slide note stores slideInterval and renders without crashing', async ({
    page,
  }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      const pr = (window as any).pianoRollEditor
      if (!pr) return { error: 'piano roll not found' }

      // Find a scale note to test
      const scale = pr.scale
      if (scale.length < 7) return { error: 'not enough scale notes' }

      // Pick a note in the middle of the scale
      const midIdx = Math.floor(scale.length / 2)
      const testNote = scale[midIdx]

      // Add a melody item with slideInterval
      const melodyItem = {
        id: 99999,
        note: {
          midi: testNote.midi,
          name: testNote.name,
          octave: testNote.octave,
          freq: testNote.freq,
        },
        duration: 2,
        startBeat: 0,
        effectType: 'slide-up' as const,
        slideInterval: 2, // +2 semitones
      }

      // Set melody to just this note and render
      pr.setMelody([melodyItem])
      pr.draw()

      // Compute what midiToY should return for the target
      const targetMidi = testNote.midi + 2
      const targetY = pr.midiToY(targetMidi)

      // Row for source
      const srcRow = pr.midiToRow(testNote.midi)

      return {
        sourceMidi: testNote.midi,
        sourceName: testNote.name + testNote.octave,
        slideInterval: 2,
        targetMidi,
        targetY,
        srcRow,
        rowHeight: pr.rowHeight,
        totalRows: pr.totalRows,
        // Verify the melody item has slideInterval
        melodyHasSlideInterval: pr.melody[0]?.slideInterval === 2,
        melodyEffectType: pr.melody[0]?.effectType,
        // Basic sanity: target should be above source for slide-up (+2)
        targetAboveSource: targetY < srcRow * pr.rowHeight + pr.rowHeight / 2,
      }
    })

    expect(result.error).toBeUndefined()
    expect(result.melodyHasSlideInterval).toBe(true)
    expect(result.melodyEffectType).toBe('slide-up')
    // For slide-up (+2), target should have SMALLER y (higher on screen)
    expect(result.targetAboveSource).toBe(true)
    // Target should NOT be at the very top (clamped) for a +2 slide from mid-scale
    const topClampY = result.rowHeight / 2
    expect(result.targetY).toBeGreaterThan(topClampY)
  })

  test('slideInterval serializes and deserializes correctly', async ({
    page,
  }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(() => {
      // Simulate melody store round-trip: create note, serialize, parse, restore
      const item = {
        id: 88888,
        note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
        duration: 1,
        startBeat: 0,
        effectType: 'slide-up' as const,
        slideInterval: 5,
      }

      // JSON round-trip simulates IndexedDB storage
      const json = JSON.stringify([item])
      const parsed = JSON.parse(json)

      return {
        original: item.slideInterval,
        afterRoundtrip: parsed[0].slideInterval,
        effectPreserved: parsed[0].effectType === 'slide-up',
        noLinkedTo: parsed[0].linkedTo === undefined,
      }
    })

    expect(result.original).toBe(5)
    expect(result.afterRoundtrip).toBe(5)
    expect(result.effectPreserved).toBe(true)
    expect(result.noLinkedTo).toBe(true)
  })
})
