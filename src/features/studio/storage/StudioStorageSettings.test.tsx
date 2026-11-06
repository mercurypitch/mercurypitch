// Studio audio storage in Song options — the choice is remembered on this device, the song's room is read by the budget's count, and the browser's keeping is said.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { STUDIO_REFERENCE_TAKE, studioStorageChoice, studioTakeStorageBytes, } from '@/lib/studio/audio/storage-quality'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset } from '@/lib/studio/model/types'
import { StudioStorageSettings } from './StudioStorageSettings'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** Three four-minute stereo WAVs kept at Full quality. */
function threeFullTakes(): StudioAsset[] {
  const { asset } = studioFixture()
  const total = studioTakeStorageBytes(STUDIO_REFERENCE_TAKE, 'full')
  return [1, 2, 3].map((n) => ({
    ...asset,
    id: `take-${n}`,
    byteLength: STUDIO_REFERENCE_TAKE.originalBytes,
    canonicalPcmByteLength: total - STUDIO_REFERENCE_TAKE.originalBytes,
  }))
}

describe('Studio audio storage in Song options', () => {
  it('keeps Save space on this device once chosen, so no import asks again', () => {
    render(() => <StudioStorageSettings assets={[]} protection={null} />)
    const full = screen.getByRole('radio', { name: /^Full quality/ })
    const compact = screen.getByRole('radio', { name: /^Save space/ })
    expect(full).toBeChecked()

    fireEvent.click(compact)

    expect(compact).toBeChecked()
    expect(studioStorageChoice()).toBe('compact')
    expect(
      JSON.parse(localStorage.getItem('mercurypitch.studio.storage') ?? '{}'),
    ).toEqual({ quality: 'compact', remembered: true })
  })

  it("reads the song's room as the budget counts it, and says whether the browser keeps the songs", () => {
    render(() => (
      <StudioStorageSettings
        assets={threeFullTakes()}
        protection="unprotected"
      />
    ))

    expect(
      screen.getByText('This song’s audio fills 82% of its room.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/may clear your songs if the device runs low on space/),
    ).toHaveAttribute('data-studio-protection', 'unprotected')
  })

  it('says a song with no audio has none, and nothing about the browser before it answers', () => {
    render(() => <StudioStorageSettings assets={[]} protection={null} />)

    expect(screen.getByText('This song has no audio yet.')).toBeInTheDocument()
    expect(document.querySelector('[data-studio-protection]')).toBeNull()
  })
})
