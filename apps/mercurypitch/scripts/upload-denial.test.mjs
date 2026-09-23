import { describe, expect, it } from 'vitest'
import { DENIAL_NEGATIVES, DENIAL_POSITIVES, selfTestUploadDenial, UPLOAD_DENIAL, uploadDenialMisses, } from './upload-denial.mjs'

const caught = (text) => {
  UPLOAD_DENIAL.lastIndex = 0
  return UPLOAD_DENIAL.test(text)
}

describe('the upload-denial tripwire', () => {
  it.each(DENIAL_POSITIVES)('catches "%s"', (text) => {
    expect(caught(text)).toBe(true)
  })

  it.each(DENIAL_NEGATIVES)('lets "%s" through', (text) => {
    expect(caught(text)).toBe(false)
  })

  it("carries review N5's four", () => {
    for (const text of [
      'not uploaded',
      'do not upload',
      'No uploads.',
      'no upload happens',
    ]) {
      expect(DENIAL_POSITIVES.some((p) => p.includes(text))).toBe(true)
    }
  })

  it('self-tests clean, as the probe runs it', () => {
    expect(uploadDenialMisses()).toEqual({ missed: [], caught: [] })
    expect(selfTestUploadDenial()).toMatch(/^tripwire self-test: 7 denials/u)
  })
})
