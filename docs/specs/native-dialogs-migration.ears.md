# Native Dialogs Migration — EARS Requirements

Requirements for migrating remaining native `alert` and `confirm` dialogs to the application's styled notification and confirmation systems.

## REQ-UI-001 — Piano Roll Export Alert
**WHEN** the user triggers a MIDI/WAV export from the Piano Roll
**WHILE** the melody is empty or the audio engine is unready
**THE** system shall display an error or warning message using the in-app notification system (`showNotification`) instead of a native browser `alert`.

## REQ-UI-002 — Piano Roll Trim Confirm
**WHEN** the user reduces the total beats in the Piano Roll
**WHILE** there are notes that extend beyond the new total beats
**THE** system shall prompt the user to confirm the trimming action using the styled `ConfirmDialog` instead of a native browser `confirm`.
