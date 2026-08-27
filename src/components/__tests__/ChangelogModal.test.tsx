// ============================================================
// The changelog modal has to show the whole sentence
// ============================================================
//
// CHANGELOG.md is hard-wrapped at ~78 columns, so one bullet is spread over
// several physical lines and only the first carries the `- ` marker. The
// parser matched `^- ` and nothing else, so every line after the first was
// silently dropped: 228 of 464 bullets ended mid-clause, and 48,842
// characters never reached the app. It looked like corrupted release notes.
//
// Two kinds of test, deliberately:
//
//   * the shapes the parser has to survive — a wrapped bullet, a sub-bullet,
//     a second paragraph — are checked against a fixture, because they are
//     properties of markdown rather than of this week's release notes. The
//     first version of these tests quoted real entries and broke the moment
//     the changelog was rewritten, which taught nobody anything.
//   * the whole-file checks still run against the REAL CHANGELOG.md, because
//     the bug was a mismatch between the parser and the file's actual shape,
//     and they must keep holding for whatever the file says next.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import rawChangelog from '../../../CHANGELOG.md?raw'
import { ChangelogModal, parseChangelog } from '../ChangelogModal'

afterEach(cleanup)

const openModal = (): void => {
  render(() => <ChangelogModal open onClose={() => {}} />)
}

/** Every markdown shape a changelog entry is allowed to take. */
const FIXTURE = `## [9.9.9] - 2026-01-01

### Added

- **A bullet that runs past the wrap.** The rest of the sentence sits on a
  second physical line, indented, carrying no marker of its own.
- **A bullet with a list under it.**
  - the first sub-bullet
  - the second sub-bullet
- **A bullet with two paragraphs.** This one is the first.

  And this one is the second, after a blank line.

### Fixed

- One short bullet.
`

/**
 * Every run of prose the file contains, as its own string.
 *
 * A paragraph and a sub-bullet each render as their own block, so they are
 * listed separately here rather than glued together — the check is that each
 * one survives whole, not that they end up adjacent.
 */
function proseFromFile(): string[] {
  const out: string[] = []
  let openIndex = -1
  let inSection = false
  let inChild = false
  let paragraphBreak = false
  const close = (): void => {
    openIndex = -1
    inChild = false
    paragraphBreak = false
  }
  for (const line of rawChangelog.split('\n')) {
    if (/^## \[/.test(line)) {
      close()
      inSection = false
      continue
    }
    if (/^### /.test(line)) {
      close()
      inSection = true
      continue
    }
    const item = line.match(/^- (.*)/)
    if (item && inSection) {
      out.push(item[1])
      openIndex = out.length - 1
      inChild = false
      paragraphBreak = false
      continue
    }
    if (line.trim() === '') {
      paragraphBreak = true
      continue
    }
    const indented = line.match(/^\s{2,}(\S.*)$/)
    if (indented && openIndex >= 0) {
      const child = indented[1].match(/^[-*] (.*)/)
      if (child) {
        out.push(child[1])
        openIndex = out.length - 1
        inChild = true
        paragraphBreak = false
        continue
      }
      if (paragraphBreak && !inChild) {
        out.push(indented[1])
        openIndex = out.length - 1
      } else {
        out[openIndex] = `${out[openIndex]} ${indented[1]}`
      }
      paragraphBreak = false
      continue
    }
    close()
  }
  return out
}

/** Markdown as the reader sees it, so a run can be looked for in the DOM. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(?<![\w*])_([^_\n]+)_(?![\w*])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('the changelog parser', () => {
  const added = parseChangelog(FIXTURE)[0]!.sections[0]!

  it('joins a bullet that wraps onto the next line', () => {
    // The reported symptom, in miniature: this used to stop at "on a".
    expect(added.items[0]!.paragraphs).toEqual([
      '**A bullet that runs past the wrap.** The rest of the sentence sits on a second physical line, indented, carrying no marker of its own.',
    ])
  })

  it('keeps an indented sub-bullet as a child, not as prose', () => {
    // Sub-bullets matched neither `^- ` nor a heading, so they were dropped
    // without trace. They must not be swallowed into the parent either.
    expect(added.items[1]!.children).toEqual([
      'the first sub-bullet',
      'the second sub-bullet',
    ])
    expect(added.items[1]!.paragraphs).toHaveLength(1)
  })

  it('reads a blank line as a paragraph break, not the end of the bullet', () => {
    expect(added.items[2]!.paragraphs).toEqual([
      '**A bullet with two paragraphs.** This one is the first.',
      'And this one is the second, after a blank line.',
    ])
  })

  it('still ends a bullet at the next heading', () => {
    const sections = parseChangelog(FIXTURE)[0]!.sections
    expect(sections.map((section) => section.label)).toEqual(['Added', 'Fixed'])
    expect(sections[1]!.items).toHaveLength(1)
  })
})

describe('the changelog modal', () => {
  it('does not cut the most heavily wrapped bullet in the file', () => {
    // Whichever entry the file currently spreads over the most lines: the
    // longest run is where a truncation is most likely and most obvious.
    openModal()

    const longest = proseFromFile().reduce((a, b) =>
      b.length > a.length ? b : a,
    )
    expect(longest.length).toBeGreaterThan(120)
    const rendered = (
      screen.getByRole('dialog', { name: 'Changelog' }).textContent ?? ''
    ).replace(/\s+/g, ' ')
    expect(rendered).toContain(plain(longest))
  })

  it('never ends an entry mid-clause', () => {
    // The invariant that would have caught this the day it shipped. A wrapped
    // line cut at 78 columns ends on an ordinary word; a finished one ends on
    // sentence punctuation, allowing the bold run that title-only bullets close
    // with.
    openModal()

    const cut = [...document.querySelectorAll('li')]
      .map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0)
      .filter((text) => !/[.!?:)\]]$/.test(text))

    expect(
      cut,
      `entries ending mid-clause:\n${cut.slice(0, 5).join('\n')}`,
    ).toHaveLength(0)
  })

  it('renders every run of prose the file has, whole', () => {
    // Not a spot check: every paragraph and every sub-bullet in CHANGELOG.md
    // must appear in the modal in one piece. Catches truncation at the wrap,
    // a dropped sub-bullet, and a whole entry going missing.
    openModal()

    const rendered = (
      screen.getByRole('dialog', { name: 'Changelog' }).textContent ?? ''
    ).replace(/\s+/g, ' ')
    const prose = proseFromFile()
    // A floor on the extractor itself, not on how long the notes are: if this
    // ever returns nothing, the check below passes for the wrong reason.
    expect(prose.length).toBeGreaterThan(200)

    const missing = prose.filter((run) => !rendered.includes(plain(run)))

    expect(
      missing,
      `${missing.length} runs not rendered in full, e.g.:\n${missing
        .slice(0, 3)
        .join('\n')}`,
    ).toHaveLength(0)
  })

  it('keeps the sub-bullets that used to vanish', () => {
    // The real file's sub-bullets, in the app — including the ones that say
    // what Karaoke Night actually does.
    openModal()

    const rendered = (
      screen.getByRole('dialog', { name: 'Changelog' }).textContent ?? ''
    ).replace(/\s+/g, ' ')
    expect(rendered).toContain('Bring your own music')
    expect(rendered).toContain('Your library and playlists come along')
    expect(rendered).toContain('Jump over from the studio')
  })

  it('never shows raw markdown to the reader', () => {
    // The truncation was the loud half of the same problem: the file is
    // markdown, and anything the renderer does not understand arrives as
    // punctuation. `_next_` sat in the release notes as literal underscores
    // until italics were taught, and the next `**` or `[label](url)` would
    // do the same.
    openModal()

    const rendered = (
      screen.getByRole('dialog', { name: 'Changelog' }).textContent ?? ''
    ).replace(/\s+/g, ' ')

    const raw = [
      ...rendered.matchAll(/\*\*|`|\]\([^)]*\)|(?<![\w*])_[^_\n]+_(?![\w*])/g),
    ].map((match) =>
      rendered.slice(Math.max(0, match.index - 40), match.index + 40),
    )

    expect(
      raw,
      `raw markdown reached the reader:\n${raw.slice(0, 3).join('\n')}`,
    ).toHaveLength(0)
  })

  it('renders emphasis as emphasis', () => {
    openModal()

    const emphasised = [...document.querySelectorAll('em')].map(
      (em) => em.textContent,
    )
    expect(emphasised).toContain('each')
  })

  it('still labels each version and its sections', () => {
    openModal()

    const versions = screen.getAllByTestId('changelog-version')
    expect(versions.length).toBeGreaterThan(40)
    const newest = versions[0]!
    expect(within(newest).getByText('v0.9.1')).toBeInTheDocument()
    expect(within(newest).getByText('2026-08-25')).toBeInTheDocument()
  })
})
