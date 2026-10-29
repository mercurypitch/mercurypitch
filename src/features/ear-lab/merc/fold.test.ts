// ============================================================
// The Ear Lab with Merc folds out of a store build: a source guard
// ============================================================
//
// The PR gate builds only the dev target, which carries the room, so
// nothing there would notice a store build that carried it too. That is
// asked of the built bundle by assert-bundle.mjs (KARAOKE_STAGE_2) when
// a store build is made; this file asks the sources on every run.
//
//   - The switch is its own constant, folded from KARAOKE_IMPORT.
//   - Nothing outside this folder imports it statically: a static import
//     runs its module, fonts and all, even under a branch that folds away.
//   - The stage and the page reach it only through a lazy import behind
//     the constant, the stage's in a module of its own (stage-switch.tsx)
//     so the parts the room borrows from EarStage.tsx do not import it
//     back.
//   - The views hand the room its data only behind the constant, so the
//     web's stages build none of it.
//   - Its font is imported by its entry alone.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(path, 'utf8')

/** Every source file under a folder, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/u.test(name) && !name.includes('.test.') ? [path] : []
  })
}

const CHUNK = 'src/features/ear-lab/merc'

/** The files a source imports statically, as repo paths: the alias and
 *  relative specifiers resolved, packages left out. A dynamic
 *  `import()` is not one of them. */
function staticImports(path: string): string[] {
  const specs = [
    ...read(path).matchAll(/(?:\bfrom|^import)\s+['"]([^'"]+)['"]/gmu),
  ].map((match) => match[1])
  return specs.flatMap((spec) => {
    if (spec.startsWith('@/')) return [`src/${spec.slice(2)}`]
    if (spec.startsWith('.')) return [posix.join(posix.dirname(path), spec)]
    return []
  })
}

const inChunk = (path: string): boolean =>
  path === CHUNK || path.startsWith(`${CHUNK}/`)

describe('the Ear Lab with Merc, in the sources', () => {
  it('has a switch of its own, on exactly where the Karaoke import is', () => {
    expect(read('src/lib/native-build.ts')).toMatch(
      /export const EAR_LAB_WITH_MERC: boolean = KARAOKE_IMPORT\n/u,
    )
  })

  it('is never imported statically from outside its folder', () => {
    const offenders = [
      ...sources('src').filter((path) => !inChunk(path)),
      ...sources('apps/mercurypitch/src'),
    ].filter((path) => staticImports(path).some(inChunk))
    expect(offenders).toEqual([])
  })

  it('reaches the stage and the page through lazy imports behind the switch', () => {
    const stage = read('src/features/ear-lab/stage-switch.tsx')
    expect(stage).toMatch(
      /const MercStage: Component<EarStageProps> = EAR_LAB_WITH_MERC\s*\?\s*lazy\(async \(\) =>\s*import\('\.\/merc\/entry'\)/u,
    )
    expect(stage).toMatch(
      /export const EarStage: Component<EarStageProps> = EAR_LAB_WITH_MERC\s*\?\s*MercStage\s*:\s*BenchStage/u,
    )
    const page = read('src/pages/EarLabPage.tsx')
    expect(page).toMatch(
      /const MercBench: Component<MercBenchProps> = EAR_LAB_WITH_MERC\s*\?\s*lazy\(async \(\) =>\s*import\('@\/features\/ear-lab\/merc\/entry'\)/u,
    )
    expect(page).toMatch(/\{EAR_LAB_WITH_MERC \? \(\s*<MercBench/u)
  })

  it("builds the room's data in the views only behind the switch", () => {
    for (const view of [
      'ThresholdDrillView',
      'IdentificationDrillView',
      'HomeDrill',
      'PulseDrill',
      'ChartDrill',
    ]) {
      const text = read(`src/features/ear-lab/${view}.tsx`)
      expect(text, view).toMatch(
        /StageRoom \| undefined = EAR_LAB_WITH_MERC\s*\?|= EAR_LAB_WITH_MERC \? roomFor\(\) : undefined/u,
      )
    }
  })

  it('hands the phone its reminders, and hears their taps, only behind the switch', () => {
    expect(
      read('apps/mercurypitch/src/infrastructure/native-device.ts'),
    ).toMatch(
      /\.\.\.\(EAR_LAB_WITH_MERC \? \{ reminders: createNativeReminders\(\) \} : \{\}\)/u,
    )
    expect(read('apps/mercurypitch/src/main.tsx')).toMatch(
      /\nif \(EAR_LAB_WITH_MERC\) \{\n {2}openTabFromReminders\(\{\n/u,
    )
    // Nothing else reaches the plugin's reminder wrappers.
    const callers = sources('apps/mercurypitch/src')
      .filter((path) =>
        /\b(?:askForReminders|scheduleReminders|onReminderTap)\b/u.test(
          read(path),
        ),
      )
      .map((path) => path.replace(/\\/gu, '/'))
    expect(callers).toEqual([
      'apps/mercurypitch/src/infrastructure/native-reminders.ts',
    ])
  })

  it('imports its serif in its entry and nowhere else', () => {
    const importers = [...sources('src'), ...sources('apps/mercurypitch/src')]
      .filter((path) => read(path).includes('@fontsource-variable/crimson-pro'))
      .map((path) => path.replace(/\\/gu, '/'))
    expect(importers).toEqual([`${CHUNK}/entry.ts`])
  })
})
