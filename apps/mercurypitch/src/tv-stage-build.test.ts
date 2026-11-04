// ============================================================
// Every native build carries the TV stage's page, the store build too
// ============================================================
//
// The TV chooser asks what a connected TV shows in every build, the store
// build included, and the stage is one of the answers (shell/tv/
// tv-choice.ts). The stage is a page of its own (stage.html), which
// TVStage.swift shows on the TV; a bundle without it leaves a TV whose
// singer picked the stage mirroring the phone, and nothing says why. It was
// built for a test build alone, behind the portable console; the PR gate
// builds only the dev target, so a store build that lost the page again
// would pass every pull request. The config is asked here, as a store build
// would ask it, and assert-bundle.mjs asks the built bundle.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- a plain .mjs module with no types, shared with a Vite
// config and with a bare-node script that runs before any install.
import { API_TARGET_ENV } from '../api-base.mjs'

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = API_TARGET_ENV as string
const before = process.env[TARGET]

afterEach(() => {
  if (before === undefined) delete process.env[TARGET]
  else process.env[TARGET] = before
})

/** What a build of this target makes: its entry pages, and its console. */
async function buildOf(target: 'dev' | 'production'): Promise<{
  inputs: unknown
  console: unknown
}> {
  process.env[TARGET] = target
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    resolve(APP_DIR, 'vite.config.ts'),
    APP_DIR,
    'silent',
  )
  return {
    inputs: loaded?.config.build?.rollupOptions?.input,
    console: loaded?.config.define?.['import.meta.env.VITE_PORTABLE_CONSOLE'],
  }
}

describe('the TV stage page in a native build', () => {
  it('is an entry of the store build, which carries no Developer screen', async () => {
    const store = await buildOf('production')

    expect(store.console).toBe(JSON.stringify('false'))
    expect(store.inputs).toEqual({
      index: resolve(APP_DIR, 'index.html'),
      stage: resolve(APP_DIR, 'stage.html'),
    })
  })

  it('is an entry of the dev build, beside the app', async () => {
    const dev = await buildOf('dev')

    expect(dev.inputs).toEqual({
      index: resolve(APP_DIR, 'index.html'),
      stage: resolve(APP_DIR, 'stage.html'),
    })
  })
})
