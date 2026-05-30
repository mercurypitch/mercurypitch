import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import rawChangelog from '../../CHANGELOG.md?raw'

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
      return <code class="changelog-code">{seg.text}</code>
    default:
      return seg.text
  }
}

const ChangelogItem = (props: { item: string }) => (
  <li class="changelog-entry">
    <For each={parseInlineMarkdown(props.item)}>
      {(seg) => renderSegment(seg)}
    </For>
  </li>
)

function sectionBadgeClass(label: string): string {
  if (label === 'Added') return 'changelog-badge badge-added'
  if (label === 'Changed') return 'changelog-badge badge-changed'
  return 'changelog-badge badge-fixed'
}

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

export const ChangelogModal: Component<ChangelogModalProps> = (props) => {
  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => props.onClose()}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>What's New</h2>
            <button class="modal-close" onClick={() => props.onClose()}>
              &times;
            </button>
          </div>
          <div class="modal-body">
            <For each={changelog}>
              {(entry, i) => (
                <>
                  {i() > 0 && <div class="fancy-divider" />}
                  <div class="changelog-version">
                    <div class="changelog-version-header">
                      <span class="changelog-version-tag">
                        v{entry.version}
                      </span>
                      <span class="changelog-date">{entry.date}</span>
                    </div>
                    <For each={entry.sections}>
                      {(section) => (
                        <div class="changelog-section">
                          <span class={sectionBadgeClass(section.label)}>
                            {section.label}
                          </span>
                          <ul class="changelog-entries">
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
