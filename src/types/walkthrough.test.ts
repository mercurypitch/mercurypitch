import { describe, expect, it } from 'vitest'
import { WALKTHROUGHS } from './walkthrough'

// Lesson 10 (docs/plans/find-your-pitch/lessons/10-major-minor/FACTS.md, 55)
// found this chapter writing moods as what the scales are, and naming A
// major as C minor's relative major. A minor key's tonic sits three half
// steps below its relative major's, so C minor's is E flat major.
const scales = (WALKTHROUGHS.study ?? []).find(
  (entry) => entry.id === 'study-scale-types',
)

describe('the "Common Musical Scales" Learn chapter', () => {
  it("names E flat major as C minor's relative major", () => {
    // Arrange
    const content = scales?.content ?? ''

    // Act
    const relative = /relative major \(([^)]+)\)/.exec(content)?.[1]

    // Assert
    expect(relative).toBe('Eb Major')
  })

  it('gives major and minor moods as a tendency, never as what the scales are', () => {
    // Arrange
    const content = scales?.content ?? ''

    // Act
    const minor = content.split('## Natural Minor Scales')[1] ?? ''

    // Assert
    expect(minor).toMatch(/a tendency, not a rule/)
    expect(content).not.toMatch(
      /cheerful|uplifting|optimistic|melancholic|reflective/i,
    )
  })
})
