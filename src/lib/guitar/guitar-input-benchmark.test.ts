// Input benchmark tests keep fixtures deterministic and reports metadata-only.
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildGuitarInputEvidenceReport, runGuitarAttackFixtureBenchmark, runGuitarPitchFixtureBenchmark, serializeGuitarInputEvidenceReport, } from './guitar-input-benchmark'
import { createGuitarInputFixture, GUITAR_INPUT_FIXTURE_IDS, } from './guitar-input-fixtures'

describe('runGuitarAttackFixtureBenchmark', () => {
  it.each(GUITAR_INPUT_FIXTURE_IDS)(
    'runs the named %s fixture deterministically',
    (fixtureId) => {
      const fixture = createGuitarInputFixture(fixtureId)
      const first = runGuitarAttackFixtureBenchmark(fixture)
      const second = runGuitarAttackFixtureBenchmark(
        createGuitarInputFixture(fixtureId),
      )

      expect(first).toEqual(second)
      expect(first.matchedAttacks).toBeLessThanOrEqual(first.expectedAttacks)
      expect(first.missedAttacks).toBeGreaterThanOrEqual(0)
      expect(first.falseAttacks).toBeGreaterThanOrEqual(0)
    },
  )

  it('retains the clean baseline and exposes the current fast-picking limit', () => {
    const clean = runGuitarAttackFixtureBenchmark(
      createGuitarInputFixture('clean-single-note'),
    )
    expect(clean.matchedAttacks).toBe(clean.expectedAttacks)
    expect(clean.missedAttacks).toBe(0)
    expect(clean.falseAttacks).toBe(0)
    expect(clean.detectorDelayP95Ms).toBeLessThan(6)

    const fast = runGuitarAttackFixtureBenchmark(
      createGuitarInputFixture('fast-alternate-picking'),
    )
    expect(fast.expectedAttacks).toBe(8)
    expect(fast.matchedAttacks).toBe(6)
    expect(fast.missedAttacks).toBe(2)
    expect(fast.falseAttacks).toBe(0)
  })
})

describe('runGuitarPitchFixtureBenchmark', () => {
  it.each([
    'clean-single-note',
    'whole-step-bend',
    'legato-slide',
    'wide-vibrato',
  ] as const)('reports note and cents evidence for %s', (fixtureId) => {
    const result = runGuitarPitchFixtureBenchmark(
      createGuitarInputFixture(fixtureId),
    )
    expect(result.expectedFrames).toBeGreaterThan(0)
    expect(result.detectedFrames > 0 || result.unavailableReason !== null).toBe(
      true,
    )
    if (result.detectedFrames > 0) {
      expect(result.medianAbsoluteCentsError).not.toBeNull()
      expect(result.p95AbsoluteCentsError).not.toBeNull()
    }
  })

  it('keeps polyphonic and clipped pitch claims explicitly unavailable', () => {
    for (const fixtureId of ['chord-onset', 'clipped-input'] as const) {
      const result = runGuitarPitchFixtureBenchmark(
        createGuitarInputFixture(fixtureId),
      )
      expect(result.detectedFrames).toBe(0)
      expect(result.unavailableReason).not.toBeNull()
    }
  })

  it('holds a clean synthetic note within five cents', () => {
    const result = runGuitarPitchFixtureBenchmark(
      createGuitarInputFixture('clean-single-note'),
    )
    expect(result.wrongNoteFrames).toBe(0)
    expect(result.p95AbsoluteCentsError).toBeLessThan(5)
  })
})

describe('GuitarInputEvidenceReport', () => {
  it('exports provenance and metrics without fixture samples or raw audio', () => {
    const fixture = createGuitarInputFixture('fast-alternate-picking')
    const metrics = runGuitarAttackFixtureBenchmark(fixture)
    const pitch = runGuitarPitchFixtureBenchmark(fixture)
    const report = buildGuitarInputEvidenceReport({
      createdAt: '2026-08-11T12:00:00.000Z',
      evidenceOrigin: 'synthetic-fixture',
      hardwareValidation: 'not-run',
      fixture: {
        id: fixture.id,
        title: fixture.title,
        origin: fixture.origin,
      },
      input: {
        kind: 'interface',
        requestedDeviceId: 'fixture-route',
        activeDeviceId: 'fixture-route',
        activeDeviceLabel: 'Synthetic route',
      },
      runtime: { browser: 'test-browser', appVersion: 'test-build' },
      take: null,
      attack: metrics,
      pitch,
    })

    const json = serializeGuitarInputEvidenceReport(report)
    expect(JSON.parse(json)).toEqual(report)
    expect(report.hardwareValidation).toBe('not-run')
    expect(report.rawAudioIncluded).toBe(false)
    expect(json).not.toContain('samples')
    expect(json).not.toContain('Float32Array')
  })
})
