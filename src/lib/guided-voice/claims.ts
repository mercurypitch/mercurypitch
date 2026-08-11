// ============================================================
// Guided Voice claim safety — reject unsupported dynamic copy
// ============================================================
//
// Findings and recommendations may be phrased dynamically, but they may not
// invent a physiological, medical, prestige, or composite interpretation.
// This module reports deterministic violations and always preserves the
// submitted text so callers cannot mistake validation for sanitisation.

export type GuidedDynamicClaimSurface = 'finding' | 'recommendation'

export type GuidedClaimViolationId =
  | 'empty-copy'
  | 'breath-support-rating'
  | 'health-or-safety-clearance'
  | 'medical-or-tissue-inference'
  | 'respiratory-or-laryngeal-inference'
  | 'register-disorder-inference'
  | 'prestige-tonal-quality'
  | 'onset-classification'
  | 'composite-voice-score'

export interface GuidedClaimViolation {
  id: GuidedClaimViolationId
}

export interface GuidedDynamicClaimValidation {
  surface: GuidedDynamicClaimSurface
  /** The exact caller-owned text. Validation never returns rewritten copy. */
  sourceText: string
  valid: boolean
  violations: readonly GuidedClaimViolation[]
}

interface ForbiddenClaimRule {
  id: Exclude<GuidedClaimViolationId, 'empty-copy'>
  patterns: readonly RegExp[]
}

const FORBIDDEN_CLAIM_RULES: readonly ForbiddenClaimRule[] = [
  {
    id: 'breath-support-rating',
    patterns: [
      /\bbreath[-\s]+support\b/iu,
      /\bbreath[-\s]+support\s+(?:score|quality|rating|grade)\b/iu,
      /\b(?:score|quality|rating|grade)\s+(?:for\s+)?(?:your\s+)?breath[-\s]+support\b/iu,
      /\bbreath[-\s]+support\s+(?:is|sounds|appears|was)\s+(?:excellent|good|poor|strong|weak|healthy)\b/iu,
      /\b(?:excellent|good|poor|strong|weak|healthy)\s+breath[-\s]+support\b/iu,
      /\bbreath[-\s]+support\s+(?:needs?\s+(?:more\s+)?(?:work|improvement)|(?:is|was|seems?|sounds?|appears?)\s+(?:lacking|insufficient|limited)|could\s+(?:improve|be\s+better|use\s+work))\b/iu,
      /\b(?:work\s+on|improve|build|strengthen)\s+(?:your\s+)?breath[-\s]+support\b/iu,
    ],
  },
  {
    id: 'health-or-safety-clearance',
    patterns: [
      /\b(?:vocal|voice|singing)[-\s]+(?:health|safety|fitness|clearance)\b/iu,
      /\b(?:healthy|safe|cleared|medically\s+fit)\s+(?:voice|vocals?|singing)\b/iu,
      /\b(?:voice|vocals?|singing)\s+(?:is|are|appears?|sounds?)\s+(?:healthy|safe|cleared|medically\s+fit)\b/iu,
      /\bsafe\s+to\s+(?:sing|continue)\b/iu,
      /\b(?:safe|unsafe)[-\s]+(?:(?:vocal|singing)[-\s]+)?range\b/iu,
    ],
  },
  {
    id: 'medical-or-tissue-inference',
    patterns: [
      /\b(?:injur(?:y|ies|ed)|patholog(?:y|ies|ical)|damag(?:e|ed|ing)|strain(?:ed)?|swelling|fatigue(?:d)?|paresis)\b/iu,
      /\b(?:vocal[-\s]+)?fold[-\s]+closure\b/iu,
      /\bheal(?:s|ed|ing)?\b/iu,
    ],
  },
  {
    id: 'respiratory-or-laryngeal-inference',
    patterns: [
      /\blung\s+capacity\b/iu,
      /\bairflow\s+efficiency\b/iu,
      /\bsubglottal\s+pressure\b/iu,
      /\blaryngeal\s+tension\b/iu,
      /\bmuscle[-\s]+tension\b/iu,
    ],
  },
  {
    id: 'register-disorder-inference',
    patterns: [
      /\b(?:register|passaggio)\b.{0,24}\b(?:disorder|problem|issue|dysfunction)\b/iu,
      /\b(?:disorder|problem|issue|dysfunction)\b.{0,24}\b(?:register|passaggio)\b/iu,
    ],
  },
  {
    id: 'prestige-tonal-quality',
    patterns: [
      /\b(?:professional|excellent)\b.{0,24}\b(?:tonal\s+quality|tone\s+quality|vocal\s+quality|voice\s+quality|tone|voice)\b/iu,
      /\b(?:tonal\s+quality|tone\s+quality|vocal\s+quality|voice\s+quality)\b.{0,24}\b(?:professional|excellent)\b/iu,
    ],
  },
  {
    id: 'onset-classification',
    patterns: [
      /\b(?:balanced|breathy|pressed|hard|healthy|damaging)\b.{0,24}\bonset\b/iu,
      /\bonset\b.{0,24}\b(?:balanced|breathy|pressed|hard|healthy|damaging)\b/iu,
    ],
  },
  {
    id: 'composite-voice-score',
    patterns: [
      /\b(?:composite|overall)(?:\s+(?:voice|vocal|singing))?\s+(?:score|rating|grade)\b/iu,
      /\bvoice[-\s]+(?:score|rating|grade)\b/iu,
    ],
  },
]

/**
 * Validate text that may appear as a dynamic finding or recommendation.
 * Violations are returned in stable policy order. The source text is retained
 * verbatim; callers must choose approved static fallback copy themselves.
 */
export function validateGuidedDynamicClaim(input: {
  surface: GuidedDynamicClaimSurface
  text: string
}): GuidedDynamicClaimValidation {
  const violations: GuidedClaimViolation[] = []
  if (input.text.trim().length === 0) violations.push({ id: 'empty-copy' })
  const searchableText = input.text
    .normalize('NFKC')
    .replace(/[\u2010-\u2015]/gu, '-')
    .replace(/\s+/gu, ' ')

  for (const rule of FORBIDDEN_CLAIM_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(searchableText))) {
      violations.push({ id: rule.id })
    }
  }

  return {
    surface: input.surface,
    sourceText: input.text,
    valid: violations.length === 0,
    violations,
  }
}

/**
 * IDs only: reviewed disclaimer copy belongs in a static product-copy registry
 * and deliberately bypasses the dynamic claim validator.
 */
export const GUIDED_REVIEWED_DISCLAIMER_IDS = [
  'guided-recording-description-only-v1',
  'guided-stop-on-discomfort-v1',
  'guided-professional-care-v1',
] as const

export type GuidedReviewedDisclaimerId =
  (typeof GUIDED_REVIEWED_DISCLAIMER_IDS)[number]

export function isGuidedReviewedDisclaimerId(
  value: string,
): value is GuidedReviewedDisclaimerId {
  return (GUIDED_REVIEWED_DISCLAIMER_IDS as readonly string[]).includes(value)
}
