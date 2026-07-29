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

## [4.14.3] - 2026-07-17

### Fixed
- **update.bat now updates the app properly.** It had no working-directory
  handling, so `xcopy ... "."` wrote to whatever directory the console happened
  to be in — running it as administrator or from a shortcut copied the new files
  somewhere else entirely, leaving the app untouched. It now always updates the
  folder the script lives in (the same `pushd "%~dp0"` the other scripts use).

### Changed
- update.bat is more informative and safer: it refuses to run outside the app
  folder, prints the version before and after so you can see whether anything
  changed, warns if CueMii is still running (locked files), verifies the
  download isn't empty, falls back to the `master` branch if `main` is missing,
  and runs `npm install` automatically at the end.

## [4.14.2] - 2026-07-17

### Changed
- **The password prompt is now an in-app dialog too.** Entering the password for
  Reset All Data, Clear History, Reset Fingerprints, Remove Duplicates and
  Reports "Clear All" now uses the same centred dialog, with a masked input
  (Enter submits, Escape or Cancel aborts). No browser alert, confirm or prompt
  popups remain anywhere in the app.

### Fixed
- Neon Mode: the gender accent bar to the left of a match queue player's name is
  the same thickness as in Light and Dark modes (it had been thinned to 2px).

## [4.14.1] - 2026-07-17

### Changed
- **The confirmation dialogs are now centred too.** 4.14.0 only converted the
  alert popups; the warnings phrased as questions — the Higher Priority Match
  warning, non-preferred court warning, delete/clear confirmations and so on —
  were still browser `confirm()` popups pinned to the top of the window. All 19
  are now the same centred in-app dialog, with Cancel/OK buttons (Enter confirms,
  Escape or a click outside cancels).
- No browser alert or confirm popups remain in the app. The reset-password entry
  still uses the native prompt, since it takes typed input.

## [4.14.0] - 2026-07-17

### Changed
- **Warning notifications now appear centred on screen.** They were browser
  `alert()` popups, which Chrome anchors to the top of the window — a position
  the page can't control. All 20 of them are now in-app dialogs rendered in the
  centre, themed for Light, Dark and Neon, dismissable with OK, Enter, Escape or
  a click outside. Rapid alerts queue rather than overwrite each other.
- Reverted the 4.13.4 contrast change between match cards and player slots in
  Neon Mode.

## [4.13.4] - 2026-07-17

### Changed
- Neon Mode: more contrast between a match card and the player slots inside it —
  the match card surface is lifted a step while the player slots sit deeper, so
  the slots read as wells rather than blending into the card.

## [4.13.3] - 2026-07-17

### Fixed
- Neon Mode: the "Return to Queue" and "Undo" buttons became unreadable on
  hover. They had no neon hover state, so Tailwind's bright amber fill landed
  under the neon light-amber text; both now have proper neon hover styling.
- Neon Mode: dragging a player over a match in the queue highlights that match
  again. The highlight already existed, but the blanket neon match-card surface
  was overriding it. The drag-over state (and the priority, just-returned,
  preferred-court and selected states) are now restated for neon, so the match
  under the cursor lights up clearly.

## [4.13.2] - 2026-07-17

### Fixed
- Neon Mode: disabled buttons (e.g. Smart with no eligible players) no longer
  light up or change colour on hover — they now render flat and unlit.

### Changed
- Neon Mode now extends into the modal windows — Options, Manage Players,
  History, Reports and About/License. Panels get the deep neon surface with a
  glowing cyan edge, header bars and inner wells darken, hairlines and table
  rows pick up the cyan tint, row hovers glow faintly, and the player table's
  action buttons and the Reports tab underline get a lit edge.
- The About & License window is a little narrower.

## [4.13.1] - 2026-07-17

### Changed
- Neon Mode now extends properly into the player pool and match queue:
  - Wait times, games counters and other numeric readouts glow.
  - The Available / Not Present / In Court / In Match Queue count pills become
    outlined and lit rather than filled.
  - Pool cards and queue slots sit in deeper wells with a cyan-tinted edge that
    lights up on hover.
  - The gender accent bar on a queue slot becomes a thin light strip.
  - Gender-coloured names shift to brighter neon tones (kept crisp, no blur).
  - Level badges are outlined with a soft halo, empty match slots use dashed
    cyan, and the search field lights its edge on focus.

## [4.13.0] - 2026-07-17

### Added
- **Neon Mode — a third theme.** The theme button now cycles Light → Dark →
  Neon (moon / lightning / sun icons show what's next), and the choice persists.
  Neon is a variant of dark mode: surfaces drop to near-black, panels pick up a
  cyan-tinted glowing edge, the aurora wash intensifies, court status strips and
  status dots emit light, court timers glow in their status colour, and the
  primary buttons (court assign, Smart, Done, Reset) become outlined with a halo
  instead of solid fills. The check-in notification and the player pool wait
  glows burn brighter too.
- Player and court **names stay flat** in Neon Mode so they remain legible at a
  distance — the glow is reserved for timers, strips, buttons and pills.

### Changed
- Theme state moved from a dark/light boolean to a three-way setting
  (`baddixx_theme`). Components still receive `isDarkMode`, which is true for
  both Dark and Neon, so all existing styling continues to apply underneath.

## [4.12.14] - 2026-07-17

### Changed
- Player names in the "Not Present" section are less bold (medium -> normal),
  matching the Available pool.
- Court names on court cards are less bold (semibold -> medium).

## [4.12.13] - 2026-07-17

### Changed
- Player Database: the player name text is a little less bold.
- Match queue, light mode: the court-assign buttons are one shade darker (the
  amber preferred/contested variants were nudged too, so they stay level).

## [4.12.12] - 2026-07-17

### Changed
- Player names are a little less bold across the main interface — the player
  pool and court cards drop from medium to normal weight, and the match queue
  slots from semibold to medium.
- Player Database: the Fingerprint column is wider (the Gender and Level columns
  each gave up a little space to make room).

## [4.12.11] - 2026-07-17

### Changed
- **Scrollbars are now consistent everywhere.** The main panels and History used
  a thin 6px bar with a dark track that had no light-mode variant, while Reports
  fell back to the native browser scrollbar — so they differed in both width and
  colour. All scrollbars now share one style: thicker, with a light grey track in
  light mode and the dark track from the main interface in dark mode.
- Light mode: the court-assign buttons and the "Smart"/"Smart All" buttons are
  now washed-out tints with dark text instead of heavy saturated fills. (The
  Smart buttons had no light-mode variant at all — they were dark purple in both
  themes.)
- Light mode: the player pool and courts panel icons keep their cyan theme
  instead of turning grey.
- Player Database: table header icons are slightly larger, and the Status and
  Fingerprint columns have swapped places.

## [4.12.10] - 2026-07-17

### Changed
- The "Smart" and "Smart All" buttons use a deeper purple so they pop less.
- Light mode: the court-assign buttons are lighter again (they were too dark
  after the previous toning-down); the amber preferred/contested variants were
  lightened to match.
- The match queue's "Avg wait" figure now uses the same red as the player pool
  wait times (theme-aware red-400/red-600) instead of a brighter red-500.
- Manage Players: the player name and gender text are very slightly smaller.

## [4.12.9] - 2026-07-17

### Changed
- Match queue: the court-assign buttons use a deeper, less vivid colour so they
  don't pop as much (both the cyan and the amber preferred/contested variants).
- Match queue: court-assign buttons span the full width of the match card again,
  reverting the centred content-width layout from 4.12.5.
- Player Database: table header text is very slightly larger.

## [4.12.8] - 2026-07-17

### Changed
- Player Database: the Save and Cancel buttons shown while editing a player are
  now icon buttons matching the Actions column — a green check and a grey ✕.
- Player Database: the Fingerprint column is narrower and the Gender, Level,
  Status and Fingerprint columns now share an even width.

## [4.12.7] - 2026-07-17

### Changed
- Player Database table headers restyled to match the reference: each column now
  has a small icon before its label (person, gender, star, clock, fingerprint,
  gear), the labels are in mixed case instead of uppercase, and the letter
  spacing was removed. Sorting still works on every sortable column.

## [4.12.6] - 2026-07-17

### Changed
- Player Database table restyled to match the reference design:
  - Player names are now neutral, since the Gender column already carries the
    blue/pink colour.
  - Actions are compact square icon buttons — a cyan "+" (or orange "−" when the
    player is in the pool), a yellow pencil for edit, and a red trash for delete
    — replacing the text links.
  - The "Stored" fingerprint pill is now green.
  - Status reads "Not In Pool" to match the reference capitalisation.

## [4.12.5] - 2026-07-17

### Changed
- The Match History "Export Excel" and Reports "Export PDF" buttons now use the
  app's cyan button theme.
- Match queue: court-assign buttons no longer stretch across the full width of a
  match card. They size to their content (with a sensible minimum) and stay
  centred, wrapping onto another line when several courts are free.

## [4.12.4] - 2026-07-17

### Changed
- Reports: the date selector is longer, so full dates fit comfortably.
- Reports: the "Export PDF" button now uses the same green scheme as the Match
  History "Export Excel" button (with a muted disabled state).
- Manage Players, light mode: the chevron on the "Add New Player" toggle now
  matches the label's colour.

## [4.12.3] - 2026-07-17

### Fixed
- **The player pool's Levels dropdown list now opens.** The pool panel uses a
  backdrop blur, and an element with a backdrop-filter becomes the containing
  block for `position: fixed` children — so the list was being positioned
  relative to the panel and clipped by its hidden overflow instead of floating
  above the page. The list is now rendered through a portal into <body>, which
  escapes that entirely (and fixes the same latent issue inside modals).

### Changed
- Dropdown boxes are a bit larger again after being over-shrunk in 4.12.2
  (taller control, larger chevron, wider). Text size is unchanged.
- Match History: the "Clear History" button now uses the same red styling as the
  Reports "Clear All" button.

## [4.12.2] - 2026-07-17

### Fixed
- The player pool's Levels filter had disappeared: the search box beside it
  couldn't shrink (no `min-w-0`), so the filter was pushed past the panel edge
  and clipped by its hidden overflow. The search now shrinks properly.

### Changed
- Dropdown boxes are smaller (tighter padding, smaller chevron, narrower) while
  the text size stays the same — player pool level filter, History and Reports
  date selectors, and the Manage Players edit dropdowns.
- Match History: "Export Excel" and "Clear History" now look like proper solid
  buttons, and Clear History is red.

## [4.12.1] - 2026-07-17

### Changed
- **Dropdown option lists now match the reservation dropdown too.** A native
  select's list is drawn by the operating system and ignores CSS, so the open
  list kept the OS font, square corners and default colours. ThemedSelect now
  renders its own list: rounded corners, soft themed borders, the app's Inter
  font, hover highlighting and a check mark on the current value. This applies
  everywhere at once — player pool level filter, History and Reports date
  selectors, fingerprint enrolment level, and the Manage Players add/edit
  dropdowns.
- The list is positioned so it can't be clipped by a scrolling panel or modal,
  flips upward near the bottom of the screen, and supports keyboard use
  (arrows, Enter, Escape).

## [4.12.0] - 2026-07-17

### Changed
- **All dropdowns in the app now share one style**, matching the match queue's
  reservation dropdown: rounded corners, soft slate borders, muted background
  and a custom chevron. Added a shared `ThemedSelect` component and routed every
  dropdown through it — the player pool level filter, the History date filter,
  the Reports date selector, the fingerprint enrolment level, and all four in
  Manage Players (Add New Player and the inline edit row).
- Because the OS arrow is replaced with a chevron in reserved padding, selected
  values can no longer spill outside a dropdown's border, and dropdowns now look
  identical across browsers.

## [4.11.16] - 2026-07-17

### Changed
- Manage Players: the "Add New Player" section now uses a neutral grey
  background instead of cyan.
- The gender and level dropdowns (both when editing a player and in Add New
  Player) are restyled to match the match queue's reservation dropdown: soft
  slate borders, rounded corners, and a custom chevron.

### Fixed
- Editing a player: the gender and level values no longer spill outside the
  dropdown's border. The native select control's arrow and intrinsic width
  pushed the text past the box; the selects now use a custom chevron with
  reserved padding and constrained width.

## [4.11.15] - 2026-07-17

### Changed
- Manage Players, light mode only: the "Add to Pool" button and the "Stored"
  fingerprint pills now use a blue theme instead of cyan. Dark mode is unchanged.

## [4.11.14] - 2026-07-17

### Changed
- About/License: the License Information card now spans the full width across
  the top of the window, with the remaining cards in the two-column grid below.

## [4.11.13] - 2026-07-17

### Fixed
- Manage Players now uses the same LevelBadge component as the player pool, so
  the level pills match in both themes (it previously used a dark-only colour
  map, which looked wrong in light mode).
- Light mode readability in Manage Players: the Remove Duplicates, Add to Pool,
  and Remove buttons now use darker text on light tinted backgrounds, and the
  Status and Fingerprint pills gained darker text plus a border so they read
  clearly on white.

## [4.11.12] - 2026-07-17

### Fixed
- **The Manage Players window now follows light mode.** It received the theme
  setting but never used it — every surface, input, table row, and label was
  hardcoded for dark, so the window stayed dark while the rest of the app went
  light. The whole window is now theme-aware: container and header, toolbar
  buttons, the Add New Player panel and its inputs, the search field and A-Z
  filter, table header and row hovers, inline edit fields, status/fingerprint
  pills, gender-coloured names, and the Edit/Delete/Save actions.

## [4.11.11] - 2026-07-17

### Fixed
- **Moving a player between matches no longer overrides a reservation.** That
  path had no reservation check at all, so a drag from another match could take
  a seat held for someone else. It now follows the same rule as adding from the
  pool: if every remaining seat is reserved, only the reserved player can go in;
  otherwise the mover takes a free seat and the reservation moves along.
- Reservations are now kept pinned to a match's free seats. After Smart Match /
  Smart All filled a match, a reservation's slot could end up on an occupied
  position, which hid the "Waiting for ..." marker and let another player take
  the seat.

## [4.11.10] - 2026-07-17

### Fixed
- **Reserving an early slot no longer blocks the rest of the match.** Players are
  stored in a dense list, so a new player always lands in the next position — if
  that position was reserved, every add was rejected even when later seats were
  free. A reservation now holds a *seat* rather than a fixed position: other
  players can fill the match, and the reservation moves along with them. It only
  blocks once every remaining seat is reserved.

## [4.11.9] - 2026-07-17

### Changed
- Dark mode: the player pool search bar and the "New court..." input now use a
  darker, solid background, matching the Levels dropdown.

## [4.11.8] - 2026-07-17

### Changed
- The "Smart" and "Smart All" buttons are now purple instead of cyan, so they
  read as a distinct action from the cyan court-assign buttons.

## [4.11.7] - 2026-07-17

### Changed
- Manage Players: the "Add New Player" section now collapses when the window is
  closed, so it's already collapsed on reopen (previously it only reset on open,
  which left it expanded for a frame).
- Dark mode: player cards on court cards now use the same darker background as
  the match queue slots (empty slots matched too).

## [4.11.6] - 2026-07-17

### Changed
- Player pool card glow is now brighter but tighter: higher colour intensity
  with roughly half the blur radius, so it reads as a crisp edge light rather
  than a wide halo.

## [4.11.5] - 2026-07-17

### Changed
- Player pool: the ✕ remove button on a player card is now hidden until you
  hover the card (it also appears on keyboard focus).

## [4.11.4] - 2026-07-17

### Changed
- Court colour thresholds: red (overdue) now starts at 30 minutes instead of 35.
  Amber still starts at 20 minutes. This shifts the timer text, card tint, top
  status strip, and status dot together.
- The games-played counter is now grey instead of green in both the player pool
  and the match queue.

## [4.11.3] - 2026-07-17

### Changed
- The player pool card glow is noticeably softer (all three wait-time levels).
- A newly assigned court's top strip now alternates between the live cyan and
  yellow on the same 1.5s cycle as the card glow and status dot, instead of
  sitting on a static yellow.
- The "Return to Queue" arrow is flipped vertically.
- The check-in "Welcome back" notification stays on screen 1 second longer
  (3.5s -> 4.5s), with its fade animation retimed to match.
- About/License now read "2026 BADDIXX CueMii App. All rights reserved."

## [4.11.2] - 2026-07-17

### Changed
- Player pool: the Levels filter dropdown now uses the interface background
  colour in dark mode instead of a translucent lighter panel.
- Dark mode: newly assigned courts no longer get a static yellow border — the
  pulsing glow, yellow top strip, and synced status dot carry the highlight.
  (Light mode keeps the border, where the glow reads less strongly.)
- Match queue: removed the "3/4" player-count status from match cards.
- Dark mode scrollbars are now much darker and are applied app-wide (player
  pool, courts, match queue, and modals), with Firefox support.

## [4.11.1] - 2026-07-17

### Changed
- Dark mode: match queue player slots now use a darker background than the match
  card behind them (both were previously the same shade, so slots didn't stand
  out). Empty slots were darkened to match.
- A newly assigned court's top status strip is now yellow, alongside its yellow
  border and glow.
- The "Return to Queue" button now uses a u-turn return arrow icon instead of a
  double chevron.
- The player name on the check-in "Welcome back" notification is now white.
- Dark mode: the player pool's scrollbar track is darker.

## [4.11.0] - 2026-07-17

### Added
- **Aurora (step 1): ambient glow and depth.** A soft cyan/pink/indigo colour
  wash now sits behind the app in dark mode, and the Pool/Courts/Queue panels
  gained a drop shadow plus a 1px inner top highlight so they read as layered
  rather than flat. Court cards get a lighter elevation. No backdrop blur was
  added, so there is no extra GPU cost on kiosk hardware. Light mode is
  unchanged.

### Fixed
- Removing a player from the pool with the ✕ button now works while a search is
  active. Clearing the search on mouseup re-rendered the filtered list before
  the browser dispatched the click, so the click was lost (or could land on a
  different row); the clear is now deferred by a tick.

## [4.10.5] - 2026-07-17

### Changed
- A newly assigned court now shows a yellow border while it's highlighted,
  matching the amber border a smart-matched player card gets. The border
  overrides the court's status color for the duration of the highlight, then
  returns to normal.

## [4.10.4] - 2026-07-17

### Changed
- A newly assigned court's status dot now animates its color in sync with the
  card's glow: it shifts from cyan toward yellow as the glow brightens and back
  to cyan as it fades (same 1.5s ease-in-out cycle), instead of sitting on a
  static yellow.

## [4.10.3] - 2026-07-17

### Changed
- Match queue court-assign buttons now use the same cyan as the courts' "Done"
  button (amber is still used for preferred/contested courts).
- A newly assigned court's status dot now turns yellow and pulses in sync with
  the card's glow.
- The smart-matched player glow now matches the player pool card glow: soft
  two-layer halo at the same 1.5s timing, with the hard outline ring removed.

## [4.10.2] - 2026-07-17

### Changed
- The higher-priority warning when assigning a court is now concise: it lists
  only the match numbers ("Match #12") and asks "Are you sure you want to skip
  them?", instead of listing each match's players and court name.

## [4.10.1] - 2026-07-17

### Changed
- The newly-assigned court glow now matches the player pool card glow: it uses
  the same soft two-layer halo and yellow tone, instead of a hard expanding
  spread ring plus a static outline.

## [4.10.0] - 2026-07-17

### Fixed
- **Smart Match and Smart All no longer fill reserved slots.** Both now subtract
  any pending reservations from a match's free capacity, so a slot held for a
  specific player is left open. (Manual adds were already blocked; the smart
  fills appended directly and bypassed that check.) Smart Match reports when the
  only remaining slots are reserved.
- The reserved-player row ("Waiting for: ...") is now vertically centered in the
  slot instead of sitting at the top.

### Changed
- Reserved-player text and its clear (X) button are slightly larger.
- The floating "Top" button is now amber for better visibility.

## [4.9.17] - 2026-07-17

### Fixed
- **Reserve a player in the match queue works again.** The `overflow-hidden`
  added in 4.9.11 (to clip the gender accent bar to the card's rounded corners)
  also applied to empty slots, which clipped the reservation dropdown so no names
  were visible. Clipping is now applied only to filled slots.

### Removed
- The "Reset FP" button (delete all fingerprints) has been removed from Manage
  Players.

## [4.9.16] - 2026-07-17

### Added
- Manage Players: clicking "Delete" now asks for confirmation before removing a
  player. The prompt names the player and, if they have one enrolled, warns that
  their stored fingerprint will be deleted too.

## [4.9.15] - 2026-07-17

### Fixed
- Editing a court name: the text box now shrinks with the court card instead of
  pushing the ✓ and ✕ buttons outside the card. (The input lacked `min-w-0`, so
  flexbox couldn't shrink it below its default intrinsic width.)

## [4.9.14] - 2026-07-17

### Changed
- Court names now display in all caps everywhere they appear (court card titles,
  match queue court-assign buttons, and preferred-court checkboxes). This is a
  display transform — the stored name keeps whatever casing you type, so editing
  a court name is unaffected.

## [4.9.13] - 2026-07-17

### Changed
- Match queue: the court-assign button labels are now bold.

## [4.9.12] - 2026-07-17

### Changed
- Match queue player cards: added space between the left gender accent and the
  player's name, and reduced the size of the wait time, games counter, and level
  badge.
- The History header button now matches the Reports and Reset buttons (was solid
  violet).
- Match queue court-assign buttons are now solid filled in the style of the
  courts' "Done" button, using green for normal courts (amber is kept for
  preferred/contested courts, in the same solid style).

## [4.9.11] - 2026-07-17

### Changed
- Match queue: the gender-colored line is now a full-height accent along the left
  edge of the player card, instead of a short line beside the name.

### Fixed
- Player pool: dragging and dropping a player card now clears the search box.
  (The existing clear-on-mouseup didn't apply, because HTML5 drag-and-drop
  suppresses mouseup; the drop/dragend events are now handled too.)

## [4.9.10] - 2026-07-17

### Added
- Match queue player slots now show a small vertical line to the left of the
  player's name, colored to match the name (blue for male, pink for female).

## [4.9.9] - 2026-07-17

### Changed
- Match queue player slots no longer use gender-tinted backgrounds; slots are now
  neutral and the player's name carries the gender color (blue/pink), matching the
  player pool. Names were brightened slightly for contrast on the neutral slot
  (dark: blue-300/pink-300, light: blue-700/pink-700). The amber smart-match
  highlight and the dashed empty-slot style are unchanged.

## [4.9.8] - 2026-07-17

### Changed
- Player pool: the "In Court" section count is now shown as a pill badge, matching
  the Available, Not Present, and In Match Queue sections (was in parentheses).

## [4.9.7] - 2026-07-17

### Changed
- About/License: in light mode, the green used for the License status ("ACTIVE"),
  Days Remaining, and Remaining Slots values is now a darker shade for better
  readability (the amber/red states were also darkened for light mode).

## [4.9.6] - 2026-07-17

### Changed
- Player pool card glow thresholds lowered: green at 5 min, yellow at 10 min,
  red at 15 min (no glow under 5 min). The wait-time text colors are unchanged.

## [4.9.5] - 2026-07-17

### Changed
- The fingerprint check-in notification now uses the same dark green in light
  mode as in dark mode (removed the lighter light-mode variant).

## [4.9.4] - 2026-07-17

### Changed
- Fingerprint check-in notification: lighter green in light mode, and the
  player's name is now larger and shown in a distinct color for better visibility
  (with a "Welcome back" label above it).

### Fixed
- Light mode: the About & License header button is now readable when it shows a
  license-expiration warning or expired state (previously light amber/red text
  on the light header).

## [4.9.3] - 2026-07-17

### Fixed
- Fingerprint check-in notification: a second scan arriving while a notification
  is still showing now replaces it with the new person and restarts the display
  timer/fade, instead of causing the notification to disappear early.

## [4.9.2] - 2026-07-17

### Fixed
- Manage Players: the A-Z letter filter now resets to "All" when the window is
  reopened, and after clicking "Add to Pool" or "Remove", so it no longer stays
  stuck on a previously selected letter.

## [4.9.1] - 2026-07-17

### Fixed
- Light mode: the Reports window's date selector, Export PDF, Clear All, and
  close (X) controls were white-on-light and invisible; they're now theme-aware.

### Changed
- The fingerprint check-in notification now uses a darker green and fades out
  smoothly before it disappears.

## [4.9.0] - 2026-07-17

### Added
- **F1 test shortcut**: pressing F1 simulates a fingerprint scan for a random
  player (checks them in with the welcome notification). For testing.

### Changed
- Player pool cards: removed the initials avatars; player names are colored by
  gender (blue/pink) again.
- Court cards: added spacing between the timer and the Edit button.
- **Fingerprint check-in notification** redesigned — a green gradient card that
  reads "Welcome back, [Name]" with a fingerprint icon on the left.
- All timers (player pool, match queue player/match timers, court timers) now
  use the app's main font (Inter) with tabular figures, instead of the mono font.
- Root font size set to 15px.
- Light mode: the About, License, History, and Reports window headers now match
  the Settings header (readable text); the Reports and Reset header buttons now
  share the same color in light mode.
- About/License windows: header image is now the BADDIXX logo and the title
  reads "CueMii"; the "✓ Up to date" text is now a readable green.
- Removed the count pill next to the "Match Queue" header; aligned the pool
  card timer and games counter.

### Fixed
- The internal day-pass license (0067006700) now records its activation day and
  correctly expires the following day, instead of resetting to "today" on every
  app load (which meant it never expired).

## [4.8.2] - 2026-07-17

### Changed
- Reverted the court card text scaling from 4.8.1 (court name, timer, player
  names back to their previous sizes). The smaller "Return to Queue" and "Done"
  buttons are kept.

## [4.8.1] - 2026-07-17

### Changed
- Court cards: scaled down all text (court name, timer, player names, empty
  slots) and made the "Return to Queue" and "Done" buttons smaller.

## [4.8.0] - 2026-07-17

### Added
- **Court status strips**: each court card now has a slim colored top edge —
  cyan (live), amber (running long), red (overdue), muted (open) — so the whole
  grid's state is readable at a glance.
- **Initials avatars** in the player pool: each player shows a small
  gender-tinted initials circle (blue/pink); pool names are now neutral, with
  the avatar carrying the gender color.
- **Count badges**: the Available, Not Present, In Match Queue, and Match Queue
  section titles now show their counts as small pill badges.

### Changed
- The player pool search field is now rounded (pill style) with the icon inside.

## [4.7.7] - 2026-07-17

### Changed
- Root font size reduced further to 14px.

## [4.7.6] - 2026-07-17

### Changed
- Slightly reduced the root font size (16px -> 15px) so all text is a touch
  smaller and the interface feels less cramped. Since the layout's text and
  spacing are rem-based, they scale down proportionally while the viewport-height
  panels stay put, giving the court/pool/queue content more breathing room.

## [4.7.5] - 2026-07-17

### Changed
- Reverted the court card size reduction from 4.7.4 (courts are back to their
  previous size). The "✓-In" button label change is kept.

## [4.7.4] - 2026-07-17

### Changed
- Made the court cards a little smaller (shorter player slots, smaller name
  text, tighter padding).
- Player pool: the "Check-In" button now reads "✓-In".

## [4.7.3] - 2026-07-17

### Changed
- Match queue timers (per-match average wait) now use the SVG clock icon too,
  so all timers across courts, pool, and queue match.
- Manage Players: the A-Z filter buttons now always fit on a single line (they
  flex to share the available width instead of wrapping).

## [4.7.2] - 2026-07-17

### Changed
- Court timers are now right-aligned in the court header.
- The player pool and match queue wait-time labels now use the same SVG clock
  icon as the court timers (replacing the emoji).

## [4.7.1] - 2026-07-17

### Changed
- Court timers now use an SVG clock icon (instead of the emoji) and a smaller
  font size.

## [4.7.0] - 2026-07-17

### Changed
- **Refined slate theme.** Reverted the warm stone palette back to the cool
  slate scheme, kept the flatter surfaces and muted (/50) borders from the
  minimal pass, restored gender-colored player names, and muted the prominent
  cyan modal borders for a softer, better-tailored version of the original look.
- **New typography.** The app now uses Inter for the UI and JetBrains Mono
  (tabular figures) for court timers, with antialiased rendering.

## [4.6.1] - 2026-07-17

### Changed
- "Clear History", "Remove Duplicates", and the Reports "Clear All" buttons now
  require the reset password before running.
- Removed the CSV Format info panel from the Manage Players window.

### Fixed
- Search magnifying glass in the player pool is centered again (a global
  slate→stone theme replacement had accidentally broken every `translate-` CSS
  class app-wide; all restored).

## [4.6.0] - 2026-07-17

### Changed
- **New "mono minimal" theme across the entire interface** (visual only — no
  functional changes). Warm charcoal surfaces (stone palette) replace the cool
  slate; all gradients flattened to solid fills; decorative glow shadows
  removed; cyan retained as the single accent for timers, primary actions, and
  the reader status. Gender is now shown as a small blue/pink dot beside
  neutral-colored names (player pool, courts, player database) instead of
  coloring the whole name. Level pills keep their colors.

## [4.5.3] - 2026-07-07

### Fixed
- `start-cuemii.bat` no longer hangs when the fingerprint service fails to start.
  The old wait loop counted iterations (each spawning a slow PowerShell call),
  which could take minutes. It now gives the service a short head start, does one
  quick bounded status check, and launches the CueMii app regardless — the app
  connects to the service on its own once it's ready.

## [4.5.2] - 2026-07-07

### Added
- `baddixx.ico` (Baddixx logo icon) and `create-cuemii-shortcut.bat`, which
  creates a Desktop "CueMii" shortcut to start-cuemii.bat using the logo as its
  icon. (Batch files can't carry their own icon, so the shortcut is branded.)

## [4.5.1] - 2026-07-07

### Changed
- "Sync Now" now writes the merged fingerprint templates to the service's
  enrollments.json directly, so it updates even when the reader isn't currently
  listening/enrolling (previously this only happened via the reader-status
  effect).

## [4.5.0] - 2026-07-07

### Added
- **Manual reconnect button on the reader status pill.** A small refresh icon on
  the pill forces the fingerprint service to drop and re-acquire the reader
  (new `POST /reconnect` endpoint) — a quick fix if the reader ever gets stuck.

## [4.4.8] - 2026-07-07

### Changed
- `start-cuemii.bat`: reverted the service-wait backstop from ~30s back to ~60s.
  (Fast-failure detection still launches the app immediately if the service
  process exits.)

## [4.4.7] - 2026-07-07

### Changed
- `start-cuemii.bat` now launches the CueMii app even if the fingerprint service
  fails to start: it detects when the service process has exited and starts the
  app immediately instead of waiting out the full timeout (timeout also shortened
  to ~30s as a backstop).

## [4.4.6] - 2026-07-07

### Fixed
- **Fingerprint reader now auto-recovers** when the USB device is unplugged and
  reconnected, or after the PC sleeps and wakes. The capture loop detects a lost
  reader (repeated failed captures) and re-acquires it, returning to listening
  automatically instead of getting stuck.

## [4.4.5] - 2026-07-07

### Changed
- Manage Players: the A-Z filter buttons are now vertically centered against the
  search box.

## [4.4.4] - 2026-07-07

### Changed
- Manage Players: moved the A-Z filter buttons to the right of the search field
  (same row) and removed the "Search" label to the left of the search bar.

## [4.4.3] - 2026-07-07

### Changed
- The BADDIXX header logo now blends with the background — its white backdrop
  was replaced with a transparent PNG (banner.png), so the pink artwork sits
  cleanly on the header in both dark and light mode.

## [4.4.2] - 2026-07-07

### Changed
- The "Reset All Data" and "Reset FP" (reset all fingerprints) actions now
  require a password before they run.

## [4.4.1] - 2026-07-07

### Fixed
- **Deleting a player now also deletes their fingerprint** (from local storage,
  the matching service, and Firebase). Previously the fingerprint lingered, so
  scanning that finger re-matched and the self-describing enrolment re-added the
  deleted player. Also removes the player from the Not Present list on delete.

## [4.4.0] - 2026-07-07

### Added
- **Add a new player directly from the fingerprint assign dialog.** When an
  unknown finger is scanned, the dialog now has an "Existing Player" / "+ New
  Player" toggle. The New Player tab mirrors the add-player form (name, gender,
  level); "Add & Enroll" creates the player and enrolls the finger to them in
  one step.

## [4.3.7] - 2026-07-07

### Fixed
- `start-cuemii.bat` "system cannot find the path specified" error — the
  service window now uses `start /D` to set its folder instead of a fragile
  nested-quote `cd`, and the health-check line was corrected. Added a guard that
  reports clearly if the script isn't run from the project root.

## [4.3.6] - 2026-07-07

### Added
- `start-cuemii.bat` one-click launcher: frees port 9001 (stopping any stale
  service), starts the fingerprint service in its own window, waits for it to
  come online, then starts the app.

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
