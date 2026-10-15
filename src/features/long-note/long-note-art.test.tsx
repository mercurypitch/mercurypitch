import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { hasPreload, resetPlatesForTests, } from '@/components/room-kit/plate-loader'
import { LanternBack, LanternFront } from './Lantern'
import lanternStyles from './Lantern.module.css'
import { LANTERN_PLATES, preloadLongNoteArt } from './long-note-art'

afterEach(() => {
  cleanup()
  resetPlatesForTests()
})

const keys = (): string[] => LANTERN_PLATES.map((plate) => plate.spec.key)

function lantern(): void {
  render(() => (
    <div>
      <LanternBack level={() => 0.4} glow={() => 1} shine={() => 0} />
      <LanternFront level={() => 0.4} glow={() => 1} shine={() => 0} />
    </div>
  ))
}

/** Every plate's image in the lantern, by its file. */
const shownPlates = (): HTMLImageElement[] => [
  ...screen.getByTestId('lantern-back').querySelectorAll('img'),
  ...screen.getByTestId('lantern-front').querySelectorAll('img'),
]

describe('the lantern plates on the tap that opens Long note', () => {
  it('starts every plate decoding, each under its own key', () => {
    preloadLongNoteArt()

    expect(new Set(keys()).size).toBe(5)
    for (const key of keys()) expect(hasPreload(key)).toBe(true)
  })

  it('is adopted by the lantern: no plate is loaded twice', () => {
    preloadLongNoteArt()

    lantern()

    for (const key of keys()) expect(hasPreload(key)).toBe(false)
    expect(shownPlates()).toHaveLength(5)
  })
})

describe('the lantern plates in the room', () => {
  it('shows each plate in its place, with its own file', () => {
    lantern()

    const plates = shownPlates()
    const files = plates.map((img) => img.getAttribute('srcset'))
    expect(files).toHaveLength(5)
    for (const plate of LANTERN_PLATES) {
      const [candidate] = plate.spec.candidates
      expect(files).toContain(`${candidate.url} ${candidate.width}w`)
    }
    for (const img of plates) {
      expect(img.parentElement?.tagName).toBe('PICTURE')
      expect(img.classList.contains(lanternStyles.plate)).toBe(true)
      expect(img.alt).toBe('')
      expect(img.draggable).toBe(false)
    }
    // The frame, in view-box percentages as it was cut.
    const frameFile = `${LANTERN_PLATES[0].spec.candidates[0].url} `
    const frame = plates.find((img) =>
      (img.getAttribute('srcset') ?? '').startsWith(frameFile),
    )
    expect(frame?.style.left).toBe(`${(19.945 / 200) * 100}%`)
    expect(frame?.style.width).toBe(`${(160.109 / 200) * 100}%`)
  })

  it('lets every plate go when the lantern leaves', () => {
    lantern()
    const plates = shownPlates()

    cleanup()

    for (const img of plates) {
      expect(img.hasAttribute('srcset')).toBe(false)
      expect(img.isConnected).toBe(false)
    }
  })
})
