---
version: 1
slug: "src-features-zen-zenpitchstage-tsx"
primary_target: "src/features/zen/ZenPitchStage.tsx"
related_targets: ["src/App.tsx","src/components/StemMixerPitchStudio.tsx"]
---

# Zen Singing Practice

- **Scope and mode:** Operate surface for free pitch monitoring and guided vocal exercises inside the Singing tab.
- **Audience and job:** A singer needs to begin a short, low-distraction practice loop, understand the current cue, see their live pitch, and review prior attempts without recording their voice.
- **Primary flow:** Enter Zen, review the optional guide and example, start or resume the microphone, sing across one bounded left-to-right loop, then continue automatically or inspect another take. Guided Ascent steps open the same surface with a versioned exercise loaded.
- **Content and proof:** The canvas itself demonstrates the product: amber authored targets, a violet on-device singer trace, expression labels, score summaries, and up to 50 pitch-only attempts. Seed exercises and the supplied `en-GB` example audio are explicitly provisional.
- **Direction:** Inherit the Stem Mixer Pitch Studio visual world and chrome. The canvas owns nearly the entire viewport; header, guide rail, and bottom controls remain quiet and functional. The memorable moment is the live contour reaching the right seam, becoming a preserved take, and beginning again from the left without interrupting the singer.
- **Constraints:** Preserve current Stem Pitch Studio behavior; use the app-owned PracticeEngine and never create a competing update loop; default to a stable 24-semitone range; no playhead in free monitoring; target and playhead are configurable in exercise mode; no raw microphone audio retention; responsive mobile guide uses an existing sheet/portal pattern; respect reduced motion and keyboard/touch access.
- **Open decisions:** Final coach-reviewed exercise copy and recordings, long-term cloud contour syncing, and the final seven-week Ascent curriculum remain deliberately unset.
