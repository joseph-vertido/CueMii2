# Changelog

All notable changes to the **BADDIXX CueMii App** are documented here.

This project uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR** — incompatible or sweeping changes (data model, redesign).
- **MINOR** — new features, backwards-compatible.
- **PATCH** — bug fixes and small tweaks, backwards-compatible.

The current version is defined in `package.json` and mirrored to
`src/data/initialData.js` (`APP_VERSION`). Use `npm run version:patch`
(or `minor` / `major`) to bump both at once, then add an entry below.

---

## [4.3.5] - 2026-07-07

### Changed
- Manage Players: the Status and Fingerprint columns are now sortable (click the
  header to order by pool status or by who has a fingerprint stored).
- Made the Name, Gender, and Level header labels render uppercase, consistent
  with the other column headers.

## [4.3.4] - 2026-07-07

### Changed
- Manage Players fingerprint column: the "Stored" pill no longer shows a check
  mark, and deletion is now an "✕" beside the pill (the separate "Delete FP"
  button was removed). Narrowed the Actions column to use the freed space.

## [4.3.3] - 2026-07-07

### Changed
- Narrowed the Manage Players window.
- Centered the A-Z index in Manage Players.
- Removed the player level letter (E/A/I/N) from players shown in the Courts
  section.

## [4.3.2] - 2026-07-07

### Fixed
- **The "has fingerprint" badge in Manage Players now reflects what's actually
  stored in the fingerprint service.** The app now pulls the service's live
  enrollment list (new `GET /enrollments` endpoint) when the service is online
  and merges it into its own state, so prints in `enrollments.json` show up in
  the player database even if the app's local copy had drifted.

## [4.3.1] - 2026-07-07

### Fixed
- **Fingerprint enrolment now reliably pushes to Firebase.** The cloud sync ran
  as a side effect inside a state updater (fragile); it now runs directly after
  enrolment. Added console diagnostics that report whether an enrolment synced,
  was skipped (cloud sync off), or failed (with the error) — so sync problems
  are visible instead of silent.

## [4.3.0] - 2026-07-07

### Added
- **CSV export/import now includes player ID and fingerprint template.** Exports
  carry `id, name, gender, level, fingerprint` so a full roster — fingerprints
  included — can be moved between machines in one file. Importing preserves IDs
  and loads the fingerprint templates into the app, the matching service, and
  (if cloud sync is on) Firebase, so the imported fingerprints work immediately.

### Changed
- In Manage Players, the "Delete FP" action now sits to the left of the
  "Add to Pool" button.

## [4.2.2] - 2026-07-07

### Fixed
- **Two-way sync now collapses players by name**, so the same person can no
  longer appear twice after a sync (even if they exist under different IDs across
  versions/devices). The cleaned set is pushed back, healing the cloud copy.
- Added sync diagnostics to the browser console (cloud doc count vs unique
  names, and any name-collapse) to help trace duplication.

## [4.2.1] - 2026-07-07

### Fixed
- **"Remove Duplicates" is now cloud-aware.** It de-duplicates players by name
  across both the cloud and the local list (so it works even when the local
  database is empty) and rewrites the cloud to a single copy of each player.
  This cleans up rosters that were doubled in Firebase by the earlier
  seed-vs-cloud ID collision.

## [4.2.0] - 2026-07-07

### Changed
- **Fingerprint check-in re-architected to direct capture.** The local C#
  service now owns the reader and does capture + matching; the browser polls it.
  Removed the browser WebSDK/agent dependency entirely (no more agent install,
  certificates, or crypto handshake). The reader opens in exclusive priority
  (avoids Windows Biometric Framework interference) and captures at 508 DPI.
- **Cloud sync now auto-syncs at most once every 2 hours** while enabled. The
  manual "Sync Now" button still syncs immediately.
- **Seed player roster removed.** `initialPlayers` is now empty; the roster is
  sourced from Firebase. This eliminates seed-vs-cloud ID collisions that
  duplicated players after a cache clear.

### Added
- **Fingerprint management in Manage Players**: separate Status and Fingerprint
  columns show who has an enrolment; per-player "Delete FP" and a toolbar
  "Reset FP" (clear all) that remove templates from local, service, and cloud.
- **Self-describing fingerprints**: each enrolment stores the player's identity
  (name, level, gender) with the template, so scans still resolve — and the
  player is restored — even after the local database is cleared.
- **Fingerprint templates sync to Firebase** (two-way merge on manual sync, plus
  auto-push on enrolment) and seed the local service on other machines.
- **"Remove Duplicates"** repair tool in Manage Players — de-duplicates players
  by name and authoritatively rewrites the cloud copy.
- Wider Manage Players window for readability.

### Fixed
- Fingerprint check-ins no longer duplicate players in the Available pool
  (service cooldown + atomic check-in).
- Reloading the page no longer replays old scans (re-opening the assign dialog
  or re-checking-in players); the app starts from the service's current event
  position.
- Fingerprint service API corrections for the DigitalPersona SDK
  (`PROBABILITY_ONE`, `Constants.Formats.Fmd.DP_VERIFICATION`,
  `Constants.CaptureProcessing`, `Resolutions.Length`).

## [4.1.0] - 2026-07-06

### Added
- **Fingerprint check-in** (DigitalPersona U.are.U 4500 support), using a
  **direct-capture** architecture — the local service owns the reader; the
  browser polls it. No browser WebSDK agent, certificates, or handshake.
  - A **known** finger checks that player straight into the Available pool.
  - An **unknown** finger opens an assign dialog: pick a player, then scan a few
    times to enroll (capture + template building happen in the service).
  - Live reader-status pill and check-in toast.
  - **Local capture + matching service** (`fingerprint-service/`) — a C#/.NET
    companion (DPUruNet) that captures from the reader and matches. Exposes
    `/health`, `/events`, `/enroll/start`, `/enroll/cancel`, `/import` on
    `localhost:9001`. Everything stays on the local machine.
  - Browser side: `useFingerprintService` hook (polling), `FingerprintController`
    / `FingerprintModal`, `fingerprintService` client, `baddixx_fingerprints`
    enrollment store.
  - **Optional Firebase storage** of enrollment templates (`fingerprints`
    collection), synced when cloud sync is enabled, and used to seed the service
    on other machines. Biometric data — lock down Firestore rules and obtain
    consent before enabling (see firebase.js notes).

### Notes
- Requires the DigitalPersona U.are.U SDK (`DPUruNet.dll`) and the 4500 device
  driver on the machine. Without the service running, the app works normally and
  the reader pill reads "service offline".

## [4.0.38] - 2026-07-06

### Added
- **Open Firebase Database** link in the Cloud Sync section of the About
  modal, opening the project's Firestore console in a new tab.
- Versioning system: `CHANGELOG.md`, a `scripts/bump-version.js` helper, and
  `version:patch` / `version:minor` / `version:major` / `version:set` npm
  scripts that keep `package.json` and `APP_VERSION` in sync.

### Changed
- Update / distribution URLs now point to the `CueMii2` repository.

## [4.0.37] - Baseline

- Starting point inherited from the original `CueMii` repository: player
  database, player pool with wait-time tracking, match queue, Smart Match
  algorithm, court management, match history, reports, CSV import/export,
  localStorage persistence, Firebase cloud sync, and license-key system.
