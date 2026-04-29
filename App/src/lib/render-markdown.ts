// ============================================================
// Lightweight Markdown-to-HTML Renderer
// Supports: **bold**, *italic*, ##/### headings, - lists,
//            1. numbered lists, > callouts, inline code
// ============================================================

type AdmonitionType = 'note' | 'tip' | 'warning' | 'info'

function detectAdmonition(line: string): AdmonitionType | null {
  const lower = line.toLowerCase()
  if (lower.includes('note')) return 'note'
  if (lower.includes('tip')) return 'tip'
  if (lower.includes('warn') || lower.includes('important')) return 'warning'
  return 'info'
}

function inlineMarkdown(text: string): string {
  // Escape HTML entities first
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')

  return text
}

export function renderMarkdownToHtml(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let inUnorderedList = false
  let inOrderedList = false

  function closeLists() {
    if (inUnorderedList) {
      htmlParts.push('</ul>')
      inUnorderedList = false
    }
    if (inOrderedList) {
      htmlParts.push('</ol>')
      inOrderedList = false
    }
  }

  // Process lines in blocks
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      closeLists()
      i++
      continue
    }

    // Heading ## or ###
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      closeLists()
      const level = headingMatch[1].length
      const text = inlineMarkdown(headingMatch[2])
      htmlParts.push(`<h${level} class="md-h${level}">${text}</h${level}>`)
      i++
      continue
    }

    // Callout/admonition: > **Note:** text
    const calloutMatch = trimmed.match(/^>\s+\*\*(.+?):\*\*\s*(.*)/)
    if (calloutMatch) {
      closeLists()
      const type = detectAdmonition(calloutMatch[1])
      const label = calloutMatch[1].replace(':', '')
      let body = calloutMatch[2]

      // Collect continuation lines that start with >
      i++
      while (i < lines.length) {
        const next = lines[i].trim()
        if (next.startsWith('>')) {
          const cont = next.slice(1).trim()
          body += cont ? `\n${cont}` : ''
          i++
        } else {
          break
        }
      }

      // Render body lines
      const bodyHtml = body
        .split('\n')
        .map((l) => inlineMarkdown(l.trim()))
        .filter(Boolean)
        .map((l) => `<p>${l}</p>`)
        .join('')

      htmlParts.push(
        `<div class="md-admonition md-admonition-${type}">` +
          `<span class="md-admonition-icon"></span>` +
          `<div class="md-admonition-content">` +
          `<strong class="md-admonition-label">${label}</strong>${ 
          bodyHtml 
          }</div></div>`,
      )
      continue
    }

    // Unordered list item: - text
    const ulMatch = trimmed.match(/^- \s*(.+)/)
    if (ulMatch) {
      if (inOrderedList) closeLists()
      if (!inUnorderedList) {
        htmlParts.push('<ul class="md-list">')
        inUnorderedList = true
      }
      htmlParts.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`)
      i++
      continue
    }

    // Ordered list item: 1. text
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      if (inUnorderedList) closeLists()
      if (!inOrderedList) {
        htmlParts.push('<ol class="md-list md-list-ordered">')
        inOrderedList = true
      }
      htmlParts.push(`<li>${inlineMarkdown(olMatch[1])}</li>`)
      i++
      continue
    }

    // Regular paragraph
    closeLists()
    htmlParts.push(`<p class="md-paragraph">${inlineMarkdown(trimmed)}</p>`)
    i++
  }

  closeLists()
  return htmlParts.join('\n')
}
