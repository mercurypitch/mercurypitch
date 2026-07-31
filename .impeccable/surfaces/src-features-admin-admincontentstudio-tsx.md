---
version: 1
slug: "src-features-admin-admincontentstudio-tsx"
primary_target: "src/features/admin/AdminContentStudio.tsx"
related_targets: ["src/features/admin/AdminExercisesPage.tsx","src/features/admin/AdminAscentPage.tsx","src/features/challenges/AdminWeeklyPage.tsx"]
---

# Guided Content Studio

- **Scope and mode:** Operate surface for owner-only vocal exercise, Ascent curriculum, and weekly challenge authoring.
- **Audience and job:** A small internal content team needs to create a singable pattern, verify its instructions and pronunciation example, preview the exact production canvas, publish an immutable revision, and assign that revision to a week and day.
- **Primary flow:** Unlock the studio once, select or create an exercise, author targets and cues, validate and preview it, upload the short coach example, publish a numbered revision, then pin that exact revision in The Ascent.
- **Content and proof:** The catalogue exposes lifecycle and history; the editor exposes coaching, timing, scoring and target geometry; the preview reuses `ZenPitchCanvas`; Ascent displays all seven weeks and the precise version attached to each slot.
- **Direction:** Extend Pitch Studio's dark instrument shell rather than introducing a generic admin dashboard. The amber primary action identifies irreversible publication, while the canvas and timeline remain the visual centre of the exercise editor.
- **Constraints:** Shared owner authentication, optimistic draft revisions, immutable published versions, explicit confirmation for publication and destructive actions, unsaved-change protection, accessible form equivalents for canvas gestures, responsive single-column mobile flow, and no raw singer audio.
- **Open decisions:** Final coach-authored exercise library, production recordings, passing-score curriculum rules, curriculum-level revisioning, and drag-and-drop assignment ordering remain deliberately unset.
