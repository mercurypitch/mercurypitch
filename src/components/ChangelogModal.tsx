import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import modalStyles from '@/components/Modal.module.css'
import { FancyDivider } from '@/components/shared/FancyDivider'
import { useFocusTrap } from '@/lib/use-focus-trap'
import rawChangelog from '../../CHANGELOG.md?raw'
import styles from './ChangelogModal.module.css'

interface VersionEntry {
  version: string
  date: string
  sections: { label: string; items: string[] }[]
}

type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }

const INLINE_MD_REGEX = /\*\*(.*?)\*\*|`([^`]+)`/g

function parseChangelog(md: string): VersionEntry[] {
  const versions: VersionEntry[] = []
  const lines = md.split('\n')
  let currentVersion: VersionEntry | null = null
  let currentSection: { label: string; items: string[] } | null = null

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
      continue
    }

    const sectionMatch = line.match(/^### (.*)/)
    if (sectionMatch && currentVersion) {
      currentSection = { label: sectionMatch[1], items: [] }
      currentVersion.sections.push(currentSection)
      continue
    }

    const itemMatch = line.match(/^- (.*)/)
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1])
    }
  }

  if (currentVersion) versions.push(currentVersion)
  return versions
}

function parseInlineMarkdown(text: string): TextSegment[] {
  INLINE_MD_REGEX.lastIndex = 0
  const segments: TextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_MD_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'bold', text: match[1] })
    } else {
      segments.push({ type: 'code', text: match[2] })
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
    default:
      return seg.text
  }
}

const ChangelogItem = (props: { item: string }) => (
  <li class={styles.entry}>
    <For each={parseInlineMarkdown(props.item)}>
      {(seg) => renderSegment(seg)}
    </For>
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
                  <div class={styles.version}>
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
                              {(item) => <ChangelogItem item={item} />}
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
