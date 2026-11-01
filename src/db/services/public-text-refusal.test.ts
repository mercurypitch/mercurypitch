import { describe, expect, it } from 'vitest'
import { CloudRequestError } from '@/db/adapters/server-adapter'
import { refusedPublicTextField } from '@/db/services/public-text-refusal'

/** A write refused the way the db-worker refuses one, as ServerAdapter throws it. */
function refusal(status: number, body: string): CloudRequestError {
  return new CloudRequestError(
    status,
    `ServerAdapter: ${status} Bad Request on https://api.test/api/x — ${body}`,
    body,
  )
}

describe('refusedPublicTextField', () => {
  it("names the field the worker's word filter refused", () => {
    expect(
      refusedPublicTextField(
        refusal(400, '{"error":"displayName uses a word that is not allowed"}'),
      ),
    ).toBe('displayName')
    expect(
      refusedPublicTextField(
        refusal(400, '{"error":"melodyName uses a word that is not allowed"}'),
      ),
    ).toBe('melodyName')
    expect(
      refusedPublicTextField(
        refusal(400, '{"error":"itemsJson uses a word that is not allowed"}'),
      ),
    ).toBe('itemsJson')
  })

  it('leaves every other failure alone', () => {
    // Another 400 from the same validation: not a word the singer can change.
    expect(
      refusedPublicTextField(
        refusal(400, '{"error":"score must be between 0 and 100"}'),
      ),
    ).toBeNull()
    // The same words under a status that is not a refusal.
    expect(
      refusedPublicTextField(
        refusal(500, '{"error":"displayName uses a word that is not allowed"}'),
      ),
    ).toBeNull()
    expect(refusedPublicTextField(refusal(400, 'not json'))).toBeNull()
    expect(refusedPublicTextField(refusal(400, ''))).toBeNull()
    expect(refusedPublicTextField(new Error('offline'))).toBeNull()
    expect(refusedPublicTextField(undefined)).toBeNull()
  })
})
