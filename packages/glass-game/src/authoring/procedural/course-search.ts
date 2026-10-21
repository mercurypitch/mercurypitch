// Complete course search — bounded backtracking never substitutes a partial route.

export function searchCompleteCourse<T>(options: {
  readonly initial: T
  readonly steps: number
  readonly candidates: (state: T, step: number) => Iterable<T>
  readonly isValid: (state: T, step: number) => boolean
  readonly candidateLimit?: number
}): T {
  const limit = options.candidateLimit ?? 2048
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 2048 ||
    !Number.isSafeInteger(options.steps) ||
    options.steps < 1 ||
    options.steps > 32
  ) {
    throw new Error('Invalid course search limits.')
  }
  let evaluated = 0

  function visit(state: T, step: number): { value: T } | undefined {
    for (const candidate of options.candidates(state, step)) {
      if (evaluated >= limit) {
        throw new Error(
          'This seed exceeded the course search limit. Try another seed.',
        )
      }
      evaluated++
      if (!options.isValid(candidate, step)) continue
      if (step === options.steps) return { value: candidate }
      const result = visit(candidate, step + 1)
      if (result !== undefined) return result
    }
    return undefined
  }
  const result = visit(options.initial, 1)
  if (result === undefined) {
    throw new Error(
      'No complete course fits this seed and lesson. Try another seed.',
    )
  }
  return result.value
}
