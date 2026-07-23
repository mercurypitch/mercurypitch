#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

const TIMESTAMP_RE = /\[(\d+):(\d+(?:\.\d+)?)\]/g

function timestampSeconds(match) {
  return Number(match[1]) * 60 + Number(match[2])
}

function normalizeToken(value) {
  return value.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, '')
}

function parseEnhancedLrc(text) {
  const lines = []
  for (const rawLine of text.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(TIMESTAMP_RE)]
    if (matches.length === 0) continue

    const words = matches
      .map((match, index) => {
        const start = match.index + match[0].length
        const end = matches[index + 1]?.index ?? rawLine.length
        const value = rawLine.slice(start, end).trim()
        return {
          value,
          normalized: normalizeToken(value),
          time: timestampSeconds(match),
        }
      })
      .filter((word) => word.normalized.length > 0)

    lines.push({
      normalized: words.map((word) => word.normalized).join(' '),
      words,
    })
  }
  return lines
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  )
  return sorted[index]
}

function compare(reference, candidate) {
  const signed = []
  const mismatchedLines = []
  const mismatchedWords = []
  const count = Math.max(reference.length, candidate.length)

  for (let lineIndex = 0; lineIndex < count; lineIndex++) {
    const expectedLine = reference[lineIndex]
    const actualLine = candidate[lineIndex]
    if (
      expectedLine === undefined ||
      actualLine === undefined ||
      expectedLine.normalized !== actualLine.normalized
    ) {
      mismatchedLines.push(lineIndex + 1)
      continue
    }

    const wordCount = Math.max(
      expectedLine.words.length,
      actualLine.words.length,
    )
    for (let wordIndex = 0; wordIndex < wordCount; wordIndex++) {
      const expected = expectedLine.words[wordIndex]
      const actual = actualLine.words[wordIndex]
      if (
        expected === undefined ||
        actual === undefined ||
        expected.normalized !== actual.normalized
      ) {
        mismatchedWords.push(`${lineIndex + 1}:${wordIndex + 1}`)
        continue
      }
      signed.push(actual.time - expected.time)
    }
  }

  const absolute = signed.map(Math.abs).sort((a, b) => a - b)
  const orderedSigned = [...signed].sort((a, b) => a - b)
  return {
    comparedWords: signed.length,
    mismatchedLines,
    mismatchedWords,
    meanAbsolute:
      absolute.reduce((sum, value) => sum + value, 0) /
      Math.max(1, absolute.length),
    medianAbsolute: percentile(absolute, 0.5),
    p95Absolute: percentile(absolute, 0.95),
    maxAbsolute: absolute.at(-1) ?? 0,
    medianBias: percentile(orderedSigned, 0.5),
  }
}

const [referencePath, candidatePath] = process.argv.slice(2)
if (referencePath === undefined || candidatePath === undefined) {
  console.error('Usage: pnpm lyrics:compare <reference.lrc> <candidate.lrc>')
  process.exitCode = 1
} else {
  const [referenceText, candidateText] = await Promise.all([
    readFile(referencePath, 'utf8'),
    readFile(candidatePath, 'utf8'),
  ])
  const result = compare(
    parseEnhancedLrc(referenceText),
    parseEnhancedLrc(candidateText),
  )

  console.log(`Compared words: ${result.comparedWords}`)
  console.log(`Median absolute error: ${result.medianAbsolute.toFixed(3)} s`)
  console.log(`Mean absolute error: ${result.meanAbsolute.toFixed(3)} s`)
  console.log(`95th percentile: ${result.p95Absolute.toFixed(3)} s`)
  console.log(`Maximum error: ${result.maxAbsolute.toFixed(3)} s`)
  console.log(
    `Median bias: ${result.medianBias >= 0 ? '+' : ''}${result.medianBias.toFixed(3)} s`,
  )
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
