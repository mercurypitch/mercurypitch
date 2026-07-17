// ============================================================
// Password policy — client mirror of the db-worker's isStrongPassword
// (workers/db-worker/src/auth.ts). The server stays authoritative; this
// exists so forms give live feedback instead of a rejection after submit.
// Keep the two in sync.
// ============================================================

export const PASSWORD_MIN_LENGTH = 8

export interface PasswordRequirement {
  key: 'length' | 'letter' | 'number'
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    key: 'length',
    label: `${PASSWORD_MIN_LENGTH}+ characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: 'letter',
    label: 'a letter',
    test: (p) => /[A-Za-z]/.test(p),
  },
  {
    key: 'number',
    label: 'a number',
    test: (p) => /[0-9]/.test(p),
  },
]

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(password))
}
