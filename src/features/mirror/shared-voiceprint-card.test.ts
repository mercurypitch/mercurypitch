import { describe, expect, it } from 'vitest'
import { renderSharedVoiceprintCard, renderSummaryCard, } from './shared-voiceprint-card'

const SUMMARY = {
  lowMidi: 48,
  highMidi: 74,
  semitones: 26,
  accuracy: 12,
  steadiness: 9,
}

describe('renderSummaryCard', () => {
  it('declines rather than drawing a frame with no twin in it', async () => {
    expect(await renderSummaryCard(SUMMARY, null, 'stats')).toBeNull()
    expect(await renderSummaryCard(SUMMARY, '', 'stats')).toBeNull()
    expect(await renderSummaryCard(SUMMARY, undefined, 'stats')).toBeNull()
  })

  it('declines a twin it has no portrait for', async () => {
    // A payload can name anyone; the caller falls back to its own layout
    // rather than rendering a blank medallion.
    expect(
      await renderSummaryCard(SUMMARY, 'Not A Real Legend', 'stats'),
    ).toBeNull()
  })
})

describe('renderSharedVoiceprintCard', () => {
  it('declines a shared payload with no twin', async () => {
    expect(await renderSharedVoiceprintCard({ lo: 48, hi: 74 })).toBeNull()
  })
})
