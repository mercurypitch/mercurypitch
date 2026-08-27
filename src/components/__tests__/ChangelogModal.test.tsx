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
// These tests run against the REAL CHANGELOG.md rather than a fixture — the
// bug was a mismatch between the parser and the file's actual shape, and a
// fixture written by the same hand as the parser would have agreed with it.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import rawChangelog from '../../../CHANGELOG.md?raw'
import { ChangelogModal } from '../ChangelogModal'

afterEach(cleanup)

const openModal = (): void => {
  render(() => <ChangelogModal open onClose={() => {}} />)
}

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

describe('the changelog modal', () => {
  it('does not cut a bullet at the line wrap', () => {
    // The exact symptom that was reported, on the version it was reported on:
    // this bullet used to render as "...Four rooms ship as" and stop.
    openModal()

    const entries = [...document.querySelectorAll('li')].map((li) =>
      (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )
    const slider = entries.find((text) =>
      text.startsWith('Guitar Night has a room visibility slider.'),
    )
    expect(slider).toBeDefined()
    expect(slider).toContain('Velvet Rehearsal')
    expect(slider).toMatch(/the room exactly as it was\.$/)
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
    expect(prose.length).toBeGreaterThan(400)

    const missing = prose.filter((run) => {
      const plain = run
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
      return !rendered.includes(plain)
    })

    expect(
      missing,
      `${missing.length} runs not rendered in full, e.g.:\n${missing
        .slice(0, 3)
        .join('\n')}`,
    ).toHaveLength(0)
  })

  it('keeps the sub-bullets that used to vanish', () => {
    // Indented sub-bullets matched neither `^- ` nor a heading, so they were
    // dropped without trace — including the four that describe what Karaoke
    // Night actually does.
    openModal()

    const rendered = (
      screen.getByRole('dialog', { name: 'Changelog' }).textContent ?? ''
    ).replace(/\s+/g, ' ')
    expect(rendered).toContain('Bring your own music')
    expect(rendered).toContain('Your library and playlists come along')
    expect(rendered).toContain('Jump over from the studio')
  })

  it('keeps a second paragraph as its own block', () => {
    // One bullet in 0.8.0 runs to two paragraphs. A blank line must not be
    // read as the end of the bullet, or the second half is lost.
    openModal()

    const entry = [...document.querySelectorAll('li')].find((li) =>
      (li.textContent ?? '').startsWith(
        'The tabs are grouped by what you came',
      ),
    )
    expect(entry).toBeDefined()
    expect(entry?.textContent).toContain('It also fits the window now.')
    expect(entry?.querySelectorAll('p')).toHaveLength(1)
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
