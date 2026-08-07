#!/usr/bin/env node

// A CLI over src/lib/lrc-compare.ts, which is also what the Lab's mapping
// differ uses — the numbers here and the numbers on screen come from one
// implementation.
//
// Imports the TypeScript directly and lets Node strip the types, so it needs
// Node >= 22.18 (or `node --experimental-strip-types` on 22.6-22.17).

import { readFile } from 'node:fs/promises'
import { compareLrcText, shareWithin } from '../src/lib/lrc-compare.ts'

const [referencePath, candidatePath] = process.argv.slice(2)
if (referencePath === undefined || candidatePath === undefined) {
  console.error('Usage: pnpm lyrics:compare <reference.lrc> <candidate.lrc>')
  process.exitCode = 1
} else {
  const [referenceText, candidateText] = await Promise.all([
    readFile(referencePath, 'utf8'),
    readFile(candidatePath, 'utf8'),
  ])
  const result = compareLrcText(referenceText, candidateText)

  console.log(`Compared words: ${result.comparedWords}`)
  console.log(`Median absolute error: ${result.medianAbsolute.toFixed(3)} s`)
  console.log(`Mean absolute error: ${result.meanAbsolute.toFixed(3)} s`)
  console.log(`95th percentile: ${result.p95Absolute.toFixed(3)} s`)
  console.log(`Maximum error: ${result.maxAbsolute.toFixed(3)} s`)
  console.log(
    `Median bias: ${result.medianBias >= 0 ? '+' : ''}${result.medianBias.toFixed(3)} s`,
  )
  for (const tolerance of [0.05, 0.1, 0.25]) {
    const share = shareWithin(result.deltas, tolerance)
    console.log(
      `Within ${(tolerance * 1000).toFixed(0)} ms: ${(share * 100).toFixed(1)}%`,
    )
  }
  console.log(
    `Mismatched lines: ${
      result.mismatchedLines.length > 0
        ? result.mismatchedLines.join(', ')
        : 'none'
    }`,
  )
  console.log(
    `Mismatched words: ${
      result.mismatchedWords.length > 0
        ? result.mismatchedWords.join(', ')
        : 'none'
    }`,
  )
}
