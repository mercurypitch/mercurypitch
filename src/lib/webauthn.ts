// ── WebAuthn, the browser half ───────────────────────────────────────
//
// `navigator.credentials` speaks ArrayBuffers; the server speaks JSON. This
// converts between them and nothing else — no fetching, no state — so the
// awkward part is in one place and the service above it reads like the
// protocol it implements.
//
// @simplewebauthn/browser does exactly this too, and is deliberately not a
// dependency: it is about sixty lines of base64url, and the server package is
// already carrying the part that genuinely should not be hand-rolled (CBOR,
// COSE, attestation).

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export function bytesToBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Is there an authenticator here at all?
 *
 * Checked before showing any passkey control. A "Sign in with a passkey"
 * button on a browser with no platform authenticator is a button that opens a
 * dialog saying no — which reads as the site being broken.
 */
export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator.credentials?.create === 'function'
  )
}

/**
 * Whether the browser can offer passkeys through form autofill.
 *
 * This is the mechanism behind "your password manager suggests the passkey":
 * a `get()` with conditional mediation shows NOTHING on its own. The browser
 * checks its own credential store and, if it holds one for this site, offers it
 * in the autofill dropdown of a field tagged `autocomplete="webauthn"`. If it
 * holds none, nothing appears and the promise simply never settles.
 *
 * That indirection is the point. There is no API that answers "does this person
 * have a passkey here" — it would be a fingerprinting vector — so the browser
 * answers it privately, to the person, and never to the page.
 */
export async function conditionalMediationAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false
  try {
    const check = window.PublicKeyCredential.isConditionalMediationAvailable
    if (typeof check !== 'function') return false
    return await check.call(window.PublicKeyCredential)
  } catch {
    return false
  }
}

/** Whether this device can do the biometric/PIN gesture a passkey requires. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * The JSON shapes the server sends.
 *
 * Declared structurally rather than by intersecting the DOM types: in those,
 * `challenge` is a BufferSource, and intersecting it with `string` produces a
 * field nothing can satisfy.
 */
interface CredentialDescriptorJson {
  id: string
  type: 'public-key'
  transports?: AuthenticatorTransport[]
}

interface CreationOptionsJson {
  challenge: string
  user: { id: string; name: string; displayName: string }
  excludeCredentials?: CredentialDescriptorJson[]
  [key: string]: unknown
}

interface RequestOptionsJson {
  challenge: string
  allowCredentials?: CredentialDescriptorJson[]
  [key: string]: unknown
}

/** The server's JSON options, with the base64url fields turned back into bytes. */
function toCreationOptions(
  options: Record<string, unknown>,
): PublicKeyCredentialCreationOptions {
  const raw = options as unknown as CreationOptionsJson
  return {
    ...raw,
    challenge: base64UrlToBytes(raw.challenge),
    user: { ...raw.user, id: base64UrlToBytes(raw.user.id) },
    excludeCredentials: raw.excludeCredentials?.map((c) => ({
      ...c,
      id: base64UrlToBytes(c.id),
    })),
  } as unknown as PublicKeyCredentialCreationOptions
}

function toRequestOptions(
  options: Record<string, unknown>,
): PublicKeyCredentialRequestOptions {
  const raw = options as unknown as RequestOptionsJson
  return {
    ...raw,
    challenge: base64UrlToBytes(raw.challenge),
    allowCredentials: raw.allowCredentials?.map((c) => ({
      ...c,
      id: base64UrlToBytes(c.id),
    })),
  } as unknown as PublicKeyCredentialRequestOptions
}

/** Run the create ceremony and shape the result the way the server reads it. */
export async function createCredential(
  options: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const credential = (await navigator.credentials.create({
    publicKey: toCreationOptions(options),
  })) as PublicKeyCredential | null
  if (credential === null) throw new Error('No passkey was created')
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  }
}

/**
 * Run the get ceremony and shape the assertion the way the server reads it.
 *
 * With `conditional`, nothing is shown until the person picks the passkey from
 * their autofill dropdown — so the call can sit pending for the whole time a
 * sign-in form is on screen, and MUST be given a signal that is aborted when
 * that form goes away. An orphaned conditional request keeps the browser's
 * autofill wired to a page that has moved on.
 */
export async function getCredential(
  options: Record<string, unknown>,
  opts: { conditional?: boolean; signal?: AbortSignal } = {},
): Promise<Record<string, unknown>> {
  const credential = (await navigator.credentials.get({
    publicKey: toRequestOptions(options),
    ...(opts.conditional === true ? { mediation: 'conditional' as const } : {}),
    ...(opts.signal === undefined ? {} : { signal: opts.signal }),
  })) as PublicKeyCredential | null
  if (credential === null) throw new Error('No passkey was offered')
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      signature: bytesToBase64Url(response.signature),
      userHandle:
        response.userHandle === null
          ? null
          : bytesToBase64Url(response.userHandle),
    },
  }
}

/**
 * Turn a WebAuthn exception into a sentence worth showing.
 *
 * The DOM names are precise and useless to a reader: NotAllowedError is what
 * both "you cancelled" and "it timed out" raise, and showing it verbatim is
 * how a cancelled dialog ends up looking like a failure of the site.
 */
export function describeWebAuthnError(err: unknown): string {
  if (err instanceof DOMException) {
    // An aborted conditional request is the page tidying up after itself, not
    // anything the reader did. It must never reach the screen.
    if (err.name === 'AbortError') return ''
    if (err.name === 'NotAllowedError') return 'That was cancelled.'
    if (err.name === 'InvalidStateError') {
      return 'This device already has a passkey for your account.'
    }
    if (err.name === 'SecurityError') {
      return 'Passkeys are not available on this address.'
    }
  }
  return err instanceof Error ? err.message : 'That did not work.'
}
