// Studio failure copy — a refusal written for people is said as it is, and so are Studio's storage, backup and memory refusals; a check's own words (a clip's path), a plain or engine error, and anything not an Error are said as playback stopping, never in their own words.
import { describe, expect, it, vi } from 'vitest'
import { logStudioFailure, STUDIO_PLAYBACK_STOPPED, studioPlaybackFailureText, StudioRefusal, studioSpokenMessage, } from './failure-copy'
import { STUDIO_MEMORY_REFUSAL, StudioMemoryError } from './memory-budget'
import { StudioValidationError } from './model/validation-values'

/** An error named as one of Studio's own storage refusals is, outside src/lib. */
function storageRefusal(message: string): Error {
  const error = new Error(message)
  error.name = 'StudioStorageError'
  return error
}

describe('the words a Studio failure shows a person', () => {
  it('are a refusal’s own, and a storage refusal’s, as written for people', () => {
    // Arrange
    const refusal = new StudioRefusal('Add an audible take before playing.')
    const storage = storageRefusal('This project audio is missing.')

    // Act
    const said = [refusal, storage].map(studioSpokenMessage)

    // Assert
    expect(said).toEqual([
      'Add an audible take before playing.',
      'This project audio is missing.',
    ])
  })

  it('are the memory budget’s for any memory refusal, the engine’s included', () => {
    // Arrange
    const budget = new StudioMemoryError(STUDIO_MEMORY_REFUSAL)
    const engine = new RangeError('Array buffer allocation failed')

    // Act
    const said = [budget, engine].map(studioPlaybackFailureText)

    // Assert
    expect(said).toEqual([STUDIO_MEMORY_REFUSAL, STUDIO_MEMORY_REFUSAL])
  })

  it('never are a check’s, a plain error’s or the engine’s own: playback says it stopped and what to do', () => {
    // Arrange
    const failures: unknown[] = [
      new StudioValidationError('clip.c1.assetId', 'Owned source is missing'),
      new Error('Studio chain timing has not been measured.'),
      new TypeError('Cannot read properties of undefined'),
      'a string',
      undefined,
    ]

    // Act
    const spoken = failures.map(studioSpokenMessage)
    const said = failures.map(studioPlaybackFailureText)

    // Assert
    expect(spoken).toEqual([null, null, null, null, null])
    expect(new Set(said)).toEqual(new Set([STUDIO_PLAYBACK_STOPPED]))
    expect(STUDIO_PLAYBACK_STOPPED).not.toMatch(/—/)
  })
})

describe('a Studio failure’s error', () => {
  it('goes to the console when it is not written for people, and a refusal does not', () => {
    // Arrange
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const check = new StudioValidationError(
      'clip.c1.assetId',
      'Owned source is missing',
    )

    // Act
    logStudioFailure('Playback stopped', check)
    logStudioFailure(
      'Playback stopped',
      new StudioRefusal('Add an audible take before playing.'),
    )

    // Assert
    expect(logged.mock.calls).toEqual([['[studio] Playback stopped:', check]])
    logged.mockRestore()
  })
})
