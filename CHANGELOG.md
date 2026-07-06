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
