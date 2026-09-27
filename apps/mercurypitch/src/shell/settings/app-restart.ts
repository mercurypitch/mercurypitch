// ============================================================
// Start the app again from the top
// ============================================================
//
// After an account is deleted nothing that belonged to it may stay in
// memory: stores hold its streak and profile, and a queued write landing
// afterwards would provision a fresh identity seconds later. The web
// reloads for the same reason (DeleteAccountRow); the shell does the same,
// and comes back on Settings (account-deletion.ts). Its own module so a
// test can stand in for a reload.

export function restartApp(): void {
  window.location.assign('/')
}
