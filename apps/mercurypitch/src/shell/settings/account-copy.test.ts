// ============================================================
// Account copy names the device in hand: a phone, or an iPad
// ============================================================
//
// Every line here that says where the practice is kept said "this phone",
// and the app runs on an iPad too (TestFlight 0.7.1). The lines are read
// when they are shown, so the same module says either.

import { afterEach, describe, expect, it } from 'vitest'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { ACCOUNT_OFFLINE, ACCOUNT_ROW, ACCOUNT_SIGNED_OUT, ACCOUNT_SIGNED_OUT_HERE, accountDeleted, accountPromises, DELETE_ACCOUNT, FILL_NOTE, SIGN_OUT_QUESTION, signInEverywhere, STORAGE_COPY, takesLine, takesStayHere, TWO_STEP, } from './account-copy'

/** Every line in the module that names where the practice is kept. */
function deviceLines(): string[] {
  return [
    ...accountPromises(),
    signInEverywhere(),
    takesStayHere(),
    ACCOUNT_ROW.signedOutSub,
    ACCOUNT_SIGNED_OUT.body,
    ACCOUNT_OFFLINE.body,
    ACCOUNT_SIGNED_OUT_HERE.body,
    SIGN_OUT_QUESTION.text,
    TWO_STEP.offSub,
    TWO_STEP.onSub,
    FILL_NOTE.lead,
    FILL_NOTE.failedBody,
    DELETE_ACCOUNT.staysTitle,
    DELETE_ACCOUNT.stays.sub,
    accountDeleted(),
    STORAGE_COPY.clearTakes,
    STORAGE_COPY.clearVoiceprints.account,
    STORAGE_COPY.clearVoiceprints.online,
    STORAGE_COPY.clearVoiceprints.phoneOnly,
    takesLine(23),
  ]
}

describe('account copy', () => {
  let restore: (() => void) | null = null
  afterEach(() => {
    restore?.()
    restore = null
  })

  it('says "this phone" on a phone, as it always has', () => {
    expect(accountPromises()).toEqual([
      'Your whole history, not only what this phone keeps',
      'On your next phone, and on the web',
      'Still yours if this phone is lost',
    ])
    expect(ACCOUNT_ROW.signedOutSub).toBe('Practicing on this phone only')
    expect(takesLine(23)).toBe('23 takes, only on this phone')
  })

  it('names the iPad in every line that says where the practice is kept', () => {
    restore = actAsIpad()

    expect(ACCOUNT_ROW.signedOutSub).toBe('Practicing on this iPad only')
    expect(TWO_STEP.offSub).toBe(
      'Turn it on from the web. This iPad asks for the code.',
    )
    expect(FILL_NOTE.lead).toBe("Your account's history is on this iPad now:")
    // The takes were kept by whichever device recorded them, so this line
    // names no device: "the iPad that kept them" is wrong on an iPad.
    expect(FILL_NOTE.takes).toBe('Takes stay on the device that kept them.')
    expect(STORAGE_COPY.clearTakes).toBe(
      'They are only on this iPad, so they cannot come back. Your history and voiceprints stay.',
    )
    for (const line of deviceLines()) {
      expect(line).toMatch(/\biPad\b/u)
      expect(line).not.toMatch(/\bphones?\b/iu)
    }
  })
})
