// ============================================================
// consent-regions — where the app asks before it measures
// ============================================================
//
// EEA + UK + Switzerland, by an address's country and by a clock's time
// zone. The app's consent module (consent.ts) reads them to decide its
// banner and Google's Consent Mode region default. They live here, in a
// module with no imports, so the lesson pages (kit/telemetry.ts) and the
// db-worker can read the same lists without loading consent.ts, which
// brings solid-js and the build's defaults with it.

// EEA + UK + Switzerland — where prior opt-in consent is required. Passed to
// the Consent Mode `region` default (ISO 3166-1 alpha-2), so Google applies
// the denied-by-default state by the visitor's actual IP location.
export const RESTRICTED_COUNTRIES = [
  // EU-27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA (non-EU)
  'IS',
  'LI',
  'NO',
  // UK + Switzerland
  'GB',
  'CH',
  // EU territory with its own ISO code, so an IP there never reads as FI
  // or FR: Åland, and the French outermost regions.
  'AX',
  'GF',
  'GP',
  'MF',
  'MQ',
  'RE',
  'YT',
]

// European timezones that are NOT in scope (used only to avoid showing the
// banner to visitors whose clock says Europe/* but who are outside the EEA).
const NON_EEA_EUROPE_TZ = new Set([
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Simferopol',
  'Europe/Volgograd',
  'Europe/Kirov',
  'Europe/Samara',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Astrakhan',
  'Europe/Istanbul',
  'Europe/Minsk',
])

// EEA time zones outside Europe/*: Iceland, Cyprus, the Canaries, Ceuta,
// Madeira, the Azores and the French outermost regions. Each of these once
// fell through to a silent grant.
const EEA_TZ_OUTSIDE_EUROPE = new Set([
  'Atlantic/Reykjavik',
  'Asia/Nicosia',
  'Asia/Famagusta',
  'Atlantic/Canary',
  'Africa/Ceuta',
  'Atlantic/Madeira',
  'Atlantic/Azores',
  'America/Cayenne',
  'America/Guadeloupe',
  'America/Marigot',
  'America/Martinique',
  'Indian/Reunion',
  'Indian/Mayotte',
])

// A clock that says nothing about where it is: UTC, as privacy-hardened
// browsers and many Linux desktops report it. Treated like an unknown zone.
const PLACELESS_TZ = new Set([
  'UTC',
  'Etc/UTC',
  'Etc/UCT',
  'UCT',
  'GMT',
  'Etc/GMT',
  'Etc/GMT0',
  'Etc/GMT+0',
  'Etc/GMT-0',
  'Etc/Greenwich',
  'Etc/Universal',
  'Etc/Zulu',
  'Universal',
  'Zulu',
])

/** Pure: is this IANA timezone inside the EEA / UK / CH banner scope? */
export function isRestrictedTimezone(tz: string): boolean {
  // Unknown, or a clock that names no place → be cautious and ask.
  if (tz === '' || PLACELESS_TZ.has(tz)) return true
  if (EEA_TZ_OUTSIDE_EUROPE.has(tz)) return true
  return tz.startsWith('Europe/') && !NON_EEA_EUROPE_TZ.has(tz)
}

// Cloudflare's codes for an address with no country: unknown, and Tor.
const PLACELESS_COUNTRIES = new Set(['', 'XX', 'T1'])

const RESTRICTED_COUNTRY_SET: ReadonlySet<string> = new Set(
  RESTRICTED_COUNTRIES,
)

/**
 * Whether an address in `country` (Cloudflare's `request.cf.country`) is in
 * the consent regions. A missing or unknown code ('', 'XX', Tor's 'T1')
 * counts as in them, and so does a code in lower case that names one.
 */
export function isRestrictedCountry(
  country: string | null | undefined,
): boolean {
  if (country === null || country === undefined) return true
  const code = country.trim().toUpperCase()
  return PLACELESS_COUNTRIES.has(code) || RESTRICTED_COUNTRY_SET.has(code)
}
