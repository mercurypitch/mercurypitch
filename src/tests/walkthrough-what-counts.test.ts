// The Learn chapter has to actually be registered, and has to be the same
// words as the modal. A guide nobody can reach explains nothing.
// ============================================================

import { describe, expect, it } from 'vitest'
import { RUN_KINDS } from '@/features/progress/run-kinds'
import { whatCountsMarkdown } from '@/features/progress/what-counts-copy'
import { WALKTHROUGHS } from '@/types/walkthrough'

const chapter = (WALKTHROUGHS.analysis ?? []).find(
  (entry) => entry.id === 'what-counts-where',
)

describe('the "What Counts Where" Learn chapter', () => {
  it('is registered under Analysis, where the Progress card lives', () => {
    expect(chapter).toBeDefined()
    expect(chapter?.tab).toBe('analysis')
  })

  it('is reachable at #/learn/what-counts-where', () => {
    // The route builder takes the chapter id verbatim, so the id IS the URL.
    expect(chapter?.id).toBe('what-counts-where')
  })

  it('shows the same words as the in-app guide', () => {
    expect(chapter?.content).toBe(whatCountsMarkdown())
  })

  it('names every run kind, so a new kind cannot ship unexplained', () => {
    for (const meta of RUN_KINDS) {
      expect(chapter?.content).toContain(meta.label)
    }
  })

  it('has a title and description the Learn list can render', () => {
    expect(chapter?.title).toBe('What Counts Where')
    expect(chapter?.description).toBeTruthy()
    expect(chapter?.steps.length).toBeGreaterThan(0)
    expect(chapter?.thumbnail).toBeTruthy()
  })
})
