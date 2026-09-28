// ============================================================
// The store build leaves the floating console out, on every pull request
// ============================================================
//
// A native store build carries no floating developer console
// (docs/agent/DEVICE-DEBUGGING.md, "Which console is in which build"), and
// `scripts/assert-no-portable-console.mjs --store-binary` checks the binary.
// That check runs only when a store build is made, from a release tag, so a
// pull request that undid what keeps the console out would pass every check
// and fail the next submission instead. Two ways of undoing it are silent
// until then, and both are read here from the sources: a module renamed out
// of the list the native Vite config drops whole, and the console armed from
// main.tsx outside its flag.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

/** The floating console's modules, from the repository root: its panel and
 *  the switch that shows it. */
const FLOATING_CONSOLE = [
  'src/components/FloatingConsole.tsx',
  'src/stores/developer-console-store.ts',
]

/** A block of main.tsx behind the console flag, which a store build folds
 *  away: from its `if` to the brace that closes it at the margin. */
const FLAG_BLOCK =
  /^if \(import\.meta\.env\.VITE_PORTABLE_CONSOLE === 'true'\) \{\n[\s\S]*?^\}/gmu

const ARMING = /import\s*\(\s*'@\/lib\/developer-console'\s*\)/u
/** One import statement, however many lines its names take: nothing between
 *  `import` and the module's path is a string. */
const STATIC_IMPORT =
  /^import\s+(?:[^'"]*?\s+from\s+)?'@\/lib\/developer-console'/mu

describe('the floating console in a native build', () => {
  it('is dropped whole where nothing uses it, by the modules it really is', async () => {
    const path = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path,
    )
    const treeshake = loaded?.config.build?.rollupOptions?.treeshake
    const sideEffects =
      typeof treeshake === 'object' ? treeshake.moduleSideEffects : undefined
    if (typeof sideEffects !== 'function') {
      throw new Error(`no moduleSideEffects function in ${path}`)
    }

    for (const module of FLOATING_CONSOLE) {
      const id = fileURLToPath(new URL(`../../../${module}`, import.meta.url))
      expect(existsSync(id), module).toBe(true)
      expect(sideEffects(id, false), module).toBe(false)
    }
  })

  it('is armed only inside the console flag', () => {
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
    const flagged = main.match(FLAG_BLOCK) ?? []
    const unflagged = main.replace(FLAG_BLOCK, '')

    expect(flagged.some((block) => ARMING.test(block))).toBe(true)
    expect(unflagged).not.toMatch(ARMING)
    expect(main).not.toMatch(STATIC_IMPORT)
  })
})
