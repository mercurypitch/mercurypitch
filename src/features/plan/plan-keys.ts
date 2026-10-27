// ============================================================
// Plan keys — where the plan is stored, in a file with no imports
// ============================================================
//
// A lesson page reads PLAN_RECORD_KEY to show the way back to the plan, and
// a lesson bundle must not grow because it knows where the plan lives. So
// this file imports nothing, and a name belongs here only when a plain
// string is all its reader needs.
//
// The prefix says where a key goes: `pitchperfect_` keys sync to the
// account's settings, `mp.` keys stay on the device. The record holds ids
// only; whatever the person typed lives under PLAN_TEXT_KEY and never in
// the record.

/** The answers, as ids. Syncs to the account. */
export const PLAN_RECORD_KEY = 'pitchperfect_plan_v1'

/** What the person typed under "Something else" and "Another app". */
export const PLAN_TEXT_KEY = 'mp.plan.text.v1'

/** Set when the person hides Home's plan card: the date of the plan it showed (`true` from before the date was kept). */
export const PLAN_CARD_DISMISSED_KEY = 'mp.plan.card.dismissed.v1'

/** Which of the plan's stops the person has opened. */
export const PLAN_OPENED_KEY = 'mp.plan.opened.v1'

/** The height Home's plan card last drew at, so Home holds the card's slot before the card's chunk is in. */
export const PLAN_CARD_SLOT_KEY = 'mp.plan.card.slot.v1'
