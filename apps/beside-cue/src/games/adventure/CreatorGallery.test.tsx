// Creator gallery navigation — art auditions never mount the campaign or share its progress identity.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./AdventureScreen', () => ({
  AdventureScreen: (props: {
    level: { id: string }
    assetBase?: string
    onExit(): void
  }) => (
    <button
      data-testid="study"
      data-level={props.level.id}
      data-assets={props.assetBase}
      onClick={() => props.onExit()}
    >
      Leave study
    </button>
  ),
}))

import { CreatorGallery } from './CreatorGallery'

describe('creator art studies', () => {
  it.each([
    ['The pearl alcove', 'cloudway-thawing-song-alcove'],
    ['Resonance veins', 'cloudway-crystal-interior-resonance-veins'],
    ['Frost roots', 'cloudway-crystal-interior-frost-roots'],
    ['Aurora heart', 'cloudway-crystal-interior-aurora-heart'],
  ])('opens and leaves %s independently', (title, id) => {
    const exit = vi.fn()
    render(() => <CreatorGallery onExit={exit} assetBase="../games/" />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
    expect(screen.getByTestId('study')).toHaveAttribute('data-level', id)
    expect(screen.getByTestId('study')).toHaveAttribute(
      'data-assets',
      '../games/',
    )
    fireEvent.click(screen.getByTestId('study'))
    expect(
      screen.getByRole('heading', { name: 'Little discoveries' }),
    ).toBeVisible()
    expect(exit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to games' }))
    expect(exit).toHaveBeenCalledOnce()
  })
})
