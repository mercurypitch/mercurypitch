// Extracts class name mappings from the CSS refactor commit
// and applies them to the current (main) versions of files.
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

const REFACTOR = 'c7e128c'
const MAIN = 'origin/main'

const files = [
  'src/App.tsx',
  'src/components/AppSidebar.tsx',
  'src/components/CrashModal.tsx',
  'src/components/FocusMode.tsx',
  'src/components/LibraryModal.tsx',
  'src/components/LibraryTab.tsx',
  'src/components/MelodyPillList.tsx',
  'src/components/MetronomeButton.tsx',
  'src/components/NoteList.tsx',
  'src/components/PianoRollCanvas.tsx',
  'src/components/PrecCountButton.tsx',
  'src/components/ScaleBuilder.tsx',
  'src/components/SessionBrowser.tsx',
  'src/components/SessionEditor.tsx',
  'src/components/SessionMiniTimeline.tsx',
  'src/components/SessionPlayer.tsx',
  'src/components/SettingsPanel.tsx',
  'src/components/StatsBars.tsx',
  'src/components/WelcomeScreen.tsx',
  'src/components/shared/SharedControlToolbar.tsx',
]

function refactorVersion(file) {
  return execSync(`git show ${REFACTOR}:${file}`, { encoding: 'utf8' })
}

function mainVersion(file) {
  return readFileSync(file, 'utf8')
}

// CamelCase to kebab-case
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).replace(/^-/, '')
}

// kebab-case to camelCase
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function extractClassMappings(refactorSrc, mainSrc) {
  // Find all class="xxx" or class={`xxx`} patterns in main
  const mainClasses = new Set()
  const classRegex = /class="([^"]*)"|class={`([^`]*)`}/g
  let m
  while ((m = classRegex.exec(mainSrc)) !== null) {
    const val = (m[1] || m[2]).trim()
    val.split(/\s+/).filter(Boolean).forEach((c) => {
      // Only keep kebab-case class names (likely CSS module targets)
      if (/^[a-z][a-z0-9-]*$/.test(c) && c.includes('-')) {
        mainClasses.add(c)
      }
    })
  }

  // Find styles.xxx patterns in refactor
  const refactorClasses = new Set()
  const stylesRegex = /styles\[['"]?([^'"\]]+)['"]?\]|styles\.([a-zA-Z][a-zA-Z0-9]*)/g
  while ((m = stylesRegex.exec(refactorSrc)) !== null) {
    const key = m[1] || m[2]
    refactorClasses.add(key)
  }

  // Build mapping: kebab-case -> CSS module key
  const mapping = {}
  for (const refKey of refactorClasses) {
    const kebab = camelToKebab(refKey)
    if (mainClasses.has(kebab)) {
      mapping[kebab] = refKey
    }
  }

  return mapping
}

function buildReplacements(mapping) {
  const reps = []
  for (const [kebab, camel] of Object.entries(mapping)) {
    // Replace class="kebab-class"
    reps.push({
      from: new RegExp(`class="([^"]*\\b)${kebab}(\\b[^"]*)"`, 'g'),
      to: (_, pre, post) => {
        const before = pre.trimEnd()
        const after = post.trimStart()
        const parts = []
        if (before) parts.push(...before.split(/\s+/).map((c) => `'${c}'`))
        parts.push(`styles.${camel}`)
        if (after) parts.push(...after.split(/\s+/).map((c) => `'${c}'`))
        return `class={[${parts.join(', ')}].join(' ')}`
      },
    })
    // Replace in template literals
    reps.push({
      from: new RegExp(`\\$\\{([^}]*\\b)['"]${kebab}['"](\\b[^}]*)}`, 'g'),
      to: (_, pre, post) => {
        const before = pre.trimEnd()
        const after = post.trimStart()
        let result = '${'
        if (before) result += before + ' '
        result += `styles.${camel}`
        if (after) result += ' ' + after
        return result + '}'
      },
    })
  }
  return reps
}

for (const file of files) {
  console.log(`Processing ${file}...`)
  const refactor = refactorVersion(file)
  const main = mainVersion(file)

  const mapping = extractClassMappings(refactor, main)
  console.log(`  Found ${Object.keys(mapping).length} class mappings`)

  // Check if the refactor version has a CSS module import
  const importMatch = refactor.match(/import styles from ['"]([^'"]+\.module\.css)['"]/)
  const hasImportInMain = /import styles from/.test(main)

  let result = main

  // Add import if needed
  if (importMatch && !hasImportInMain) {
    const importPath = importMatch[1]
    // Find the right place to add the import (after the last solid-js or component import)
    const lines = result.split('\n')
    let insertAt = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertAt = i + 1
      }
    }
    lines.splice(insertAt, 0, `import styles from './${importPath}'`)
    result = lines.join('\n')
  }

  // Apply replacements
  for (const { from, to } of buildReplacements(mapping)) {
    result = result.replace(from, to)
  }

  // Handle className that are in template literals with conditions
  // e.g., class={`${cond ? 'my-class' : 'other-class'}`}
  // Convert to class={`${cond ? styles.myClass : styles.otherClass}`}

  writeFileSync(file, result)
  console.log(`  Done: ${file}`)
}

console.log('All files processed.')
