// ============================================================
// make-review-code — issues one store reviewer's unlock code for an app
// ============================================================
//
//   node packages/purchase-kit/scripts/make-review-code.ts beside-cue
//
// Prints a code and its digest. The code goes into the vault and from there
// into App Store Connect's review notes and Play's "App access" field; the
// digest goes into that app's repository variable, for example
// BESIDE_CUE_REVIEW_UNLOCK_SHA256. The code must not be committed anywhere.
//
// Issue a new one whenever the old should stop working: a build carrying a
// different digest rejects every grant made against the previous code.

import { createHash, randomInt } from 'node:crypto'
import {
  normalizeReviewCode,
  REVIEW_CODE_ALPHABET,
  reviewUnlockDigestInput,
} from '../src/review-unlock.ts'

const appId = process.argv[2]
if (appId === undefined || appId.trim() === '') {
  console.error('Usage: make-review-code.ts <app-id>   (for example beside-cue)')
  process.exit(2)
}

function group(length: number): string {
  let out = ''
  for (let index = 0; index < length; index += 1) {
    out += REVIEW_CODE_ALPHABET[randomInt(REVIEW_CODE_ALPHABET.length)]
  }
  return out
}

const code = `REVIEW-${group(4)}-${group(4)}`
const input = reviewUnlockDigestInput(appId, code)
const digest = createHash('sha256').update(input).digest('hex')

// A printed code that does not survive normalisation would never match.
const expected = `REV1EW${code.split('-').slice(1).join('')}`
if (normalizeReviewCode(code) !== expected) {
  console.error('Refusing to issue: this code does not normalise to itself.')
  process.exit(1)
}

console.log(`app     ${appId}`)
console.log(`code    ${code}`)
console.log(`digest  ${digest}`)
console.log('')
console.log('Put the code in the vault. Put the digest in the app\'s')
console.log('<APP>_REVIEW_UNLOCK_SHA256 repository variable. Never commit the code.')
