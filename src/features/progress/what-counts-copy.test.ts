// The Learn chapter and the in-app guide read the same sentences. These
// tests are what stops that being true only on the day it was written.
// ============================================================

import { describe, expect, it } from 'vitest'
import { RUN_KINDS } from './run-kinds'
import { WHAT_COUNTS_LEDE, WHAT_COUNTS_SECTIONS, whatCountsMarkdown, } from './what-counts-copy'

describe('whatCountsMarkdown', () => {
  const markdown = whatCountsMarkdown()

  it('opens with the same lede the in-app guide shows', () => {
    expect(markdown).toContain(WHAT_COUNTS_LEDE)
  })

  it('lists every run kind with its own blurb', () => {
    for (const meta of RUN_KINDS) {
      expect(markdown).toContain(`**${meta.label}**`)
      expect(markdown).toContain(meta.blurb)
    }
  })

  it('says which kinds are ranked', () => {
    expect(markdown).toContain('**Challenge** (ranked)')
    expect(markdown).toContain('**Practice** (not ranked)')
  })

  it('carries every section of the guide, as a markdown heading', () => {
    for (const section of WHAT_COUNTS_SECTIONS) {
      expect(markdown).toContain(`## ${section.heading}`)
      expect(markdown).toContain(section.body)
    }
  })

  it('keeps the copy free of inline markup, so both renderers can use it', () => {
    // The guide renders these strings as plain JSX text. A stray `**` would
    // show up literally there, which is the tell that the two surfaces had
    // started to need different copy.
    for (const section of WHAT_COUNTS_SECTIONS) {
      expect(section.body).not.toMatch(/[*_`#]/)
    }
    expect(WHAT_COUNTS_LEDE).not.toMatch(/[*_`#]/)
  })
})
