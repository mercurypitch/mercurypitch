import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import modalStyles from '@/components/Modal.module.css'
import { FancyDivider } from '@/components/shared/FancyDivider'
import { useFocusTrap } from '@/lib/use-focus-trap'
import rawChangelog from '../../CHANGELOG.md?raw'
import styles from './ChangelogModal.module.css'

/**
 * One bullet, reassembled.
 *
 * The changelog is hard-wrapped at ~78 columns, so a single bullet is spread
 * over several physical lines and the ones after the first are indented
 * rather than marked. Matching only `^- ` therefore kept the first line and
 * silently dropped the rest — half of every entry since 0.8.0 read as a
 * sentence cut mid-clause. `paragraphs` holds the wrapped text joined back
 * up (more than one only where a bullet genuinely has a second paragraph),
 * and `children` holds the indented sub-bullets, which used to vanish
 * outright.
 */
interface ChangelogItem {
  paragraphs: string[]
  children: string[]
}

interface VersionEntry {
  version: string
  date: string
  sections: { label: string; items: ChangelogItem[] }[]
}

type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

/**
 * Links come FIRST, because a label like ``[`/glass`](…)`` contains a code
 * span — matched the other way round the backticks win and the reader is
 * shown the raw `[text](url)` that used to sit in the modal.
 *
 * Built per call rather than shared: a link's label goes back through this
 * parser, and a module-level `/g` regex carries `lastIndex` across calls, so
 * one shared instance would have the nested call eat the outer one's place
 * in the string.
 */
const inlineMarkdownRegex = (): RegExp =>
  /\[([^\]]+)\]\(([^)]+)\)|\*\*(.*?)\*\*|`([^`]+)`/g

/** Our own changelog, imported at build time — but not a reason to emit any
 *  scheme a future edit might paste in. */
function safeHref(href: string): string | null {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('/') || href.startsWith('./')) return href
  return null
}

function parseChangelog(md: string): VersionEntry[] {
  const versions: VersionEntry[] = []
  const lines = md.split('\n')
  let currentVersion: VersionEntry | null = null
  let currentSection: { label: string; items: ChangelogItem[] } | null = null
  /** The bullet an indented line belongs to, and whether that is a sub-bullet. */
  let openItem: ChangelogItem | null = null
  let openChild = false
  /**
   * A blank line does NOT end a bullet — one entry in 0.8.0 runs to two
   * paragraphs. It only means that if the bullet does continue, the next
   * indented line starts a new paragraph rather than joining the last one.
   */
  let paragraphBreak = false

  const closeItem = (): void => {
    openItem = null
    openChild = false
    paragraphBreak = false
  }

  for (const line of lines) {
    const versionMatch = line.match(/^## \[([^\]]+)\](?: - (.*))?/)
    if (versionMatch) {
      if (currentVersion) versions.push(currentVersion)
      currentVersion = {
        version: versionMatch[1].replace(/^v/, ''),
        date: versionMatch[2] || '',
        sections: [],
      }
      currentSection = null
      closeItem()
      continue
    }

    const sectionMatch = line.match(/^### (.*)/)
    if (sectionMatch && currentVersion) {
      currentSection = { label: sectionMatch[1], items: [] }
      currentVersion.sections.push(currentSection)
      closeItem()
      continue
    }

    const itemMatch = line.match(/^- (.*)/)
    if (itemMatch && currentSection) {
      const item: ChangelogItem = { paragraphs: [itemMatch[1]], children: [] }
      currentSection.items.push(item)
      openItem = item
      openChild = false
      paragraphBreak = false
      continue
    }

    if (line.trim() === '') {
      paragraphBreak = true
      continue
    }

    // Anything indented under an open bullet belongs to it.
    const indented = line.match(/^\s{2,}(\S.*)$/)
    if (indented && openItem) {
      const childMatch = indented[1].match(/^[-*] (.*)/)
      if (childMatch) {
        openItem.children.push(childMatch[1])
        openChild = true
        paragraphBreak = false
        continue
      }
      if (openChild) {
        const last = openItem.children.length - 1
        openItem.children[last] = `${openItem.children[last]} ${indented[1]}`
      } else if (paragraphBreak) {
        openItem.paragraphs.push(indented[1])
      } else {
        const last = openItem.paragraphs.length - 1
        openItem.paragraphs[last] =
          `${openItem.paragraphs[last]} ${indented[1]}`
      }
      paragraphBreak = false
      continue
    }

    // A non-indented line that is none of the above ends the bullet.
    closeItem()
  }

  if (currentVersion) versions.push(currentVersion)
  return versions
}

function parseInlineMarkdown(text: string): TextSegment[] {
  const pattern = inlineMarkdownRegex()
  const segments: TextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      const href = safeHref(match[2])
      segments.push(
        href === null
          ? { type: 'text', text: match[1] }
          : { type: 'link', text: match[1], href },
      )
    } else if (match[3] !== undefined) {
      segments.push({ type: 'bold', text: match[3] })
    } else {
      segments.push({ type: 'code', text: match[4] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) })
  }
  return segments
}

const changelog = parseChangelog(rawChangelog)

function renderSegment(seg: TextSegment) {
  switch (seg.type) {
    case 'bold':
      return <strong>{seg.text}</strong>
    case 'code':
      return <code class={styles.code}>{seg.text}</code>
    case 'link':
      return (
        <a class={styles.link} href={seg.href} target="_blank" rel="noreferrer">
          {/* The label carries its own markup — every link in the file is a
              code span — so it goes back through the same parser. Links do
              not nest, so this cannot recurse further. */}
          <For each={parseInlineMarkdown(seg.text)}>
            {(inner) => renderSegment(inner)}
          </For>
        </a>
      )
    default:
      return seg.text
  }
}

const InlineText = (props: { text: string }) => (
  <For each={parseInlineMarkdown(props.text)}>
    {(seg) => renderSegment(seg)}
  </For>
)

const ChangelogEntry = (props: { item: ChangelogItem }) => (
  <li class={styles.entry}>
    <InlineText text={props.item.paragraphs[0] ?? ''} />
    {/* Rendered bare rather than wrapped in a <p>, because all but one of
        the 464 bullets is a single paragraph and that is the layout the
        surrounding CSS was built around. Only the rare second paragraph
        needs a block of its own. */}
    <For each={props.item.paragraphs.slice(1)}>
      {(paragraph) => (
        <p class={styles.entryParagraph}>
          <InlineText text={paragraph} />
        </p>
      )}
    </For>
    <Show when={props.item.children.length > 0}>
      <ul class={styles.subEntries}>
        <For each={props.item.children}>
          {(child) => (
            <li>
              <InlineText text={child} />
            </li>
          )}
        </For>
      </ul>
    </Show>
  </li>
)

function sectionBadgeClass(label: string): string {
  if (label === 'Added') return `${styles.badge} ${styles.badgeAdded}`
  if (label === 'Changed') return `${styles.badge} ${styles.badgeChanged}`
  return `${styles.badge} ${styles.badgeFixed}`
}

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

export const ChangelogModal: Component<ChangelogModalProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: () => props.onClose(),
  })

  return (
    <Show when={props.open}>
      <div class={modalStyles.modalOverlay} onClick={() => props.onClose()}>
        <div
          class={modalStyles.modalContent}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Changelog"
          onClick={(e) => e.stopPropagation()}
        >
          <div class={modalStyles.modalHeader}>
            <h2>What's New</h2>
            <button
              class={modalStyles.modalClose}
              onClick={() => props.onClose()}
            >
              &times;
            </button>
          </div>
          <div class={modalStyles.modalBody}>
            <For each={changelog}>
              {(entry, i) => (
                <>
                  {i() > 0 && <FancyDivider />}
                  <div class={styles.version} data-testid="changelog-version">
                    <div class={styles.versionHeader}>
                      <span class={styles.versionTag}>v{entry.version}</span>
                      <span class={styles.date}>{entry.date}</span>
                    </div>
                    <For each={entry.sections}>
                      {(section) => (
                        <div class={styles.section}>
                          <span class={sectionBadgeClass(section.label)}>
                            {section.label}
                          </span>
                          <ul class={styles.entries}>
                            <For each={section.items}>
                              {(item) => <ChangelogEntry item={item} />}
                            </For>
                          </ul>
                        </div>
                      )}
                    </For>
                  </div>
                </>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
