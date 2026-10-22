// gltf_validate.mjs — Khronos glTF-Validator on a GLB; exit 1 on any error.
//
// node gltf_validate.mjs FILE.glb [--json REPORT.json]
//
// Uses the validator that @gltf-transform/cli (a Beside Cue devDependency)
// already installs, so no new package is needed.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../../../../apps/beside-cue')
const cli = realpathSync(
  join(APP, 'node_modules/@gltf-transform/cli/package.json'),
)
const validator = createRequire(cli)('gltf-validator')

const file = process.argv[2]
const jsonOut = process.argv.includes('--json')
  ? process.argv[process.argv.indexOf('--json') + 1]
  : null
const report = await validator.validateBytes(
  new Uint8Array(readFileSync(file)),
  { maxIssues: 200 },
)
const issues = report.issues
const summary = {
  file,
  errors: issues.numErrors,
  warnings: issues.numWarnings,
  infos: issues.numInfos,
  messages: issues.messages
    .filter((m) => m.severity <= 1)
    .slice(0, 30)
    .map(
      (m) =>
        `${m.severity === 0 ? 'ERROR' : 'WARN'} ${m.code} ${m.pointer ?? ''} ${m.message}`,
    ),
  extensionsUsed: report.info?.extensionsUsed ?? [],
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (issues.numErrors > 0) process.exit(1)
