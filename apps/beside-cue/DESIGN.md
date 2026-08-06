# Beside Cue app design

## Direction

**The Pocket B-Side** adapts the approved Better B-Side landing world for an operating surface. It feels like one carefully handled 7-inch record and its paper sleeve—not a wellness dashboard, game inventory, or phone full of cards. Brand expression concentrates in the active cue; controls and history stay disciplined.

## Signature interaction

The active cue is one physical sleeve. **Cue me now** draws the record into focus; choosing the B-side turns its label from orange to turquoise, settles the mascot, records the choice, and then lets the interface become quiet. Reduced motion preserves the same label and content change without rotation or travel.

## Palette

| Token            | Value     | Role                              |
| ---------------- | --------- | --------------------------------- |
| `paper`          | `#fff5dd` | Main surface                      |
| `paper-deep`     | `#f0dfba` | Sleeve and quiet controls         |
| `ink`            | `#241913` | Text and hard edges               |
| `ink-soft`       | `#5a463d` | Secondary text on paper           |
| `orange`         | `#c93513` | Pull and primary cue action       |
| `orange-dark`    | `#94250d` | Pressed orange state              |
| `turquoise`      | `#00777d` | B-side, focus, and selected state |
| `turquoise-dark` | `#005b60` | High-contrast turquoise text      |
| `custard`        | `#f2c84b` | Warm highlight                    |
| `spruce`         | `#165c4a` | Quiet state and deep surface      |

## Typography

- Coiny: wordmark and rare compact display moments.
- Gabarito Variable: body, form controls, and actions.
- Saira Condensed: labels, timing, metadata, and progress dates.

All three are bundled locally through Fontsource so the native app works offline.

## Layout and component language

- The operating viewport is a centred mobile stage with safe-area padding and a tablet maximum width.
- The active cue may own one large paper sleeve; secondary information uses open rows and rules rather than nested cards.
- Buttons have tactile offset depth, a 12–16 px radius, explicit pressed movement, and visible focus.
- Pills are reserved for compact status and selection controls.
- Bottom navigation contains only Cue and Reflection in this slice.
- Daily timing uses open record-list rows, not a calendar or productivity
  dashboard. Manual-only remains the first and fully valid choice.
- On tablets, the cue and reflection may sit side by side; phone screens remain a single clear column.

## Motion

- One authored cue transition uses `cubic-bezier(0.16, 1, 0.3, 1)` over roughly 680 ms.
- Supporting controls use short 160–220 ms responses.
- Reduced motion removes rotation, travel, and parallax while retaining every state and message.

## Content and states

- Supplied language names a moment, never an identity or diagnosis.
- **Not now**, zero counts, paused cues, and empty history remain neutral.
- Notification permission is requested only after a person chooses a time;
  denial keeps **Cue me now** fully available.
- Loading, empty, validation, paused, cue, B-side acknowledgement, and Not-now acknowledgement states are designed explicitly.
- A cue can be completed with keyboard, screen reader, touch, reduced motion, and all sensory output disabled.

## Deliberate omissions

No streaks, badges, completion percentages, confetti, feeds, social comparison, pricing, account prompts, health claims, or category-specific character roster in v0.
