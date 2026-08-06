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

## [4.36.0] - 2026-07-17

### Fixed
- **Deleted players no longer come back after syncing.** Deleting a player now
  records a marker that travels to the cloud, so other machines learn the player
  was removed. Previously the record was simply dropped, and any machine that
  still had it treated it as one the cloud was missing and uploaded it again.
  - The marker keeps propagating until every machine has seen it, so a device
    that syncs days later still applies the deletion.
  - Remove Duplicates preserves the markers too — pushing without them would have
    cleared them from the cloud and let deleted players return.

### Added
- **Re-adding a player with the same name restores their original ID.** The
  marker holds the name, so adding that person again reuses their previous
  identity instead of creating a second record, and the newer timestamp stops
  the next sync deleting them again.
- Deleting a player now also removes their fingerprint, so they can't still check
  themselves in by finger.

## [4.35.2] - 2026-07-17

### Fixed
- A deleted fingerprint could come back. When the app reconciles what the reader
  service reports, it treated a record with no template as a gap to fill — but
  since 4.35.0 that's a deletion marker, so any copy still sitting in the
  reader's file was written straight back over the delete. The marker is now
  respected, and the corrected set is pushed to the reader so it stops matching
  the removed print.
- Prints discovered from the reader are now timestamped. Without one they always
  lost a newest-wins comparison, so a print known only to the reader could be
  overwritten by any stamped record.

## [4.35.1] - 2026-07-17

### Fixed
- The Assign Fingerprint dialog no longer marks players as enrolled after their
  print has been deleted. It was counting the presence of a record rather than
  whether that record still holds a template — and since 4.35.0 keeps a marker
  behind so deletions can propagate, those markers read as enrolments.

### Changed
- That marker is now a green fingerprint icon instead of a dot, matching the one
  used in the Player Database.

## [4.35.0] - 2026-07-17

### Changed
- **Deleting a fingerprint now propagates to other machines.** Deleting clears
  the template but keeps the record, stamped with the time of the deletion. That
  marker is what other machines read on their next sync, so the print is removed
  there too.
  - Previously the record was dropped entirely. Another machine would then see a
    player missing from the cloud, treat its own copy as the one to keep, and
    upload it again — quietly undoing the deletion.
  - A re-enrolment made after a deletion still wins, since it carries a later
    time.
- Syncing now replaces the scanner's enrolment set rather than adding to it, so
  a print deleted elsewhere stops matching on this machine. Adding-only meant a
  deleted print stayed live in the reader even after the app had removed it.
- Deletion markers don't count as enrolled fingerprints: the Player Database
  badge and the scanner both ignore them.

## [4.34.4] - 2026-07-17

### Changed
- The About & License window checks for a newer version every time it opens, and
  does so silently: if the machine is offline or GitHub can't be reached, the
  panel simply shows nothing rather than an "Unable to check for updates"
  message. Previously the check ran only when the window's state happened to be
  untouched, and a failure surfaced as an error banner.

## [4.34.3] - 2026-07-17

### Added
- When a pool search narrows to one player, the Match Queue or Courts panel now
  scrolls that player into view, so the green highlight isn't left off screen.
  - It only scrolls when the player is actually out of sight — if they're already
    visible the panel stays where it is, so the view doesn't shift about while
    you type.

## [4.34.2] - 2026-07-17

### Changed
- The "Per Day" charts in Reports are hidden when a specific date is selected.
  They're built from the full match history rather than the filtered set, so on a
  single day they showed every other day alongside it — duplicating the figures
  already given above. They still appear when viewing all dates, where a
  day-by-day comparison is the point.

## [4.34.1] - 2026-07-17

### Fixed
- The daily charts in Reports no longer spill outside their cards once enough
  days have accumulated. Each column was set to share the width evenly with no
  lower limit, but the date labels underneath can only shrink so far — so past a
  certain number of days the row grew wider than the card and overflowed. Columns
  now have a minimum width and the chart scrolls sideways when they no longer all
  fit, keeping the bars and labels readable.
- Printed reports lay the charts out in full instead of clipping them, since
  there is nothing to scroll on paper.

## [4.34.0] - 2026-07-17

### Changed
- **Syncing now keeps whichever copy is newer, rather than always preferring the
  local one.**
  - *Fingerprints* record when they were captured (`enrolledAt`), and merges keep
    the most recent template for each player. Previously the local copy always
    won, so an older template could silently overwrite a fresh re-enrolment made
    on another machine. Players present on only one side are still kept, so
    nothing is lost.
  - *Player edits* now stamp an `updatedAt` time. The sync already had a
    newest-wins rule for players, but nothing was writing the timestamp — so both
    sides always compared as zero and local won by default. Adding, editing and
    importing players all record the time.

### Notes
- Existing records have no timestamp. They're treated as older than any stamped
  record, so a re-enrolment or edit always takes precedence over untouched data;
  where neither side has one, the local copy is kept, matching the old behaviour.
- The timestamp is written to and read back from Firebase, so the comparison
  works across machines rather than only within one.

## [4.33.1] - 2026-07-17

### Fixed
- Light Mode: the selected "Existing Player" / "+ New Player" tab in the Assign
  Fingerprint window is now readable. It used one style for both themes — pale
  cyan text on a pale cyan wash — which all but disappeared on a light
  background. Light Mode now uses a solid cyan tab with white text.
- Neon Mode: the tabs and the Cancel button in that window highlight on hover
  again. The neon panel styling flattens their background, and that also
  overrode their hover colour, so hovering had no visible effect. The selected
  tab keeps its cyan identity and brightens slightly on hover.

## [4.33.0] - 2026-07-17

### Fixed
- The level dropdown in the Assign Fingerprint window no longer opens behind it.
  The dropdown sat below that dialog in the stacking order; it now sits above.
- The Assign Fingerprint window's icon is a proper fingerprint, and in Neon Mode
  it no longer lights up on hover — it's a label, not a button.

### Added
- Court buttons ease in as a match becomes complete, rather than popping into
  place.
- The Available and Not Present sections grow smoothly as players are added or
  removed, instead of snapping to their new height.
- Neon Mode now styles the Assign Fingerprint window — both the existing-player
  and new-player sections.

### Changed
- The Match Queue only scrolls to the end when it should: after using Create, or
  when the follow-on empty match is added once the last one is filled. A match
  appearing for any other reason — returning from a court, or Smart Queue All —
  leaves the scroll position alone. This is now driven by an explicit signal
  rather than inferred.

## [4.32.8] - 2026-07-17

### Changed
- The Match Queue's "Top" button drifts gently up and down while it's showing,
  so it's easier to notice. The motion is its own animation rather than the one
  used elsewhere, which carries a horizontal offset this button doesn't need. It
  still fades out cleanly, and the bob is skipped for reduced-motion users.

## [4.32.7] - 2026-07-17

### Fixed
- The "Top" button is back to its full size. The zero-height wrapper added in
  4.32.6 is a flex row, and by default that stretches its children to the row's
  height — which was zero, squashing the button. It now keeps its natural size,
  and still takes up no space in the list, so the scroll doesn't shift.

## [4.32.6] - 2026-07-17

### Fixed
- The courts no longer scroll to the bottom when a match goes back to the same
  court and keeps its timer. That match also keeps its place in the order, so
  there was nothing at the bottom to scroll to. A fresh assignment still scrolls
  as before.
- The match list no longer jumps when the "Top" button appears or disappears.
  The button was sticky, which meant it occupied space in the list and pushed
  everything below it as it was added and removed. It now sits in a zero-height
  wrapper and fades in and out, so the content beneath never moves.

## [4.32.5] - 2026-07-17

### Fixed
- Return to Queue now scrolls to the match the players are going back to,
  instead of jumping to the bottom of the list. Two things were fighting:
  clearing the scroll target re-triggered the "new match" effect, which then
  couldn't tell this was a returning match and scrolled to the end; and the
  callback used to report the scroll was recreated on every render, re-running
  that effect repeatedly. The destination is now decided once, when the match
  appears, and the callback is held stable.

## [4.32.4] - 2026-07-17

### Fixed
- A match returning from a court no longer appears, vanishes, then appears
  again. The flag that holds a new card hidden until the queue has scrolled was
  React state, so the first paint still saw the previous value and showed the
  card — it was then hidden and animated in. The hold now takes effect in the
  same pass that spots the new match, so the card is hidden from its very first
  frame and eases in once.
  - A returning match no longer also jumps the list to the bottom; it's already
    being scrolled to its own position.

## [4.32.3] - 2026-07-17

### Fixed
- Pressing Done on a court threw "startDelay is not defined". Adding a start
  delay to one flight helper in 4.32.2 also edited the matching line in the
  helper that sends players from a court back to the pool, which had no such
  parameter. That helper now accepts one too, and both were checked for the same
  slip.

## [4.32.2] - 2026-07-17

### Fixed
- The animation of players returning from a court to the queue is back. Delaying
  it until after the scroll also delayed the measuring, by which point the
  players were already showing in the queue and their original positions on the
  court were gone — so there was nothing to animate. Positions are now captured
  immediately and only the flight itself waits for the scroll.
- Neon Mode: a higher-priority match has its green border again. Softening the
  border in the last release changed the class it uses, which stopped the Neon
  rule matching it.

## [4.32.1] - 2026-07-17

### Changed
- Return to Queue now scrolls the queue to the destination match before the
  players fly back to it, so the cards aren't travelling to a slot that's off
  screen.
- A newly created match stays hidden until the queue has finished scrolling to
  it, then plays its entrance — the two used to happen at once, so the card
  appeared while the list was still moving.
- The green glow on a higher-priority match is subtler, and its background now
  breathes in step with the border (one animation drives both, so they can't
  drift apart). Neon gets a deeper wash to suit its darker panel.
- Light Mode: the "+" buttons now use the same cyan as a court's Done button.

## [4.32.0] - 2026-07-17

### Added
- A newly created match eases into the queue instead of appearing abruptly.

### Fixed
- The queue now reliably scrolls to the very bottom when a match is added. It
  had been scrolling only until the new card was "nearest" to view, which often
  stopped short of the end; it now drives the list to its full extent.
- Adding a player to the last empty match no longer creates the next match
  underneath an animation still in flight — the new match is held back until the
  card has landed.

### Changed
- The outer glow on a match returned from a court is subtler in Light and Dark
  (Neon keeps its own, stronger treatment).
- Light Mode: smart-matched players glow orange rather than pale yellow, which is
  far more visible against a white card.
- Light Mode: the "+" buttons use a deeper blue — the create-new-player toggle in
  both pickers, and the Available section's own "+" — so every add-a-player
  control shares one colour.

## [4.31.1] - 2026-07-17

### Fixed
- **The court timer is now actually preserved.** The code that remembers who was
  on a court had been added to the wrong function — it went into the Done
  handler rather than Return to Queue — so nothing was ever recorded for a
  returned match and the timer always restarted.
- Reverted 4.31.0's softening of the returned-match glow.

### Changed
- A match returned from a court now pulses its background in step with its
  border. It's driven by the same animation, so the two can't drift apart, and
  Neon Mode gets a deeper red wash to suit its darker panel.
- A match that resumes its timer keeps its place in the court order by how long
  it has been running, instead of being sent to the bottom as a fresh
  assignment.

## [4.31.0] - 2026-07-17

### Fixed
- The courts panel now really does scroll to the bottom when a court is
  assigned. The scroll waits for the reorder to start, but the flag driving it
  was being cleared after half a second — before the scroll ran — which
  cancelled it. The flag is now held long enough.

### Changed
- The red glow on a match just returned from a court is more subtle. It had a
  hard 5px ring that read as a solid expanding band; it's now a soft two-layer
  glow with a lighter border.

### Added
- A match sent back to the queue and then straight onto the same court keeps its
  original timer, instead of restarting from zero. This applies when at least
  half the original players return, and only within five minutes of leaving —
  after that, or with a mostly different group, it counts as a new match and the
  timer resets.

## [4.30.6] - 2026-07-17

### Changed
- After a court is assigned, the courts panel now scrolls all the way to the
  bottom to follow it. The scroll is timed to begin as the card starts moving, so
  the two travel together.
- Player cards moving from Available or Not Present into the Match Queue take a
  little longer (780ms) and every flight uses a gentler easing curve.
- Court names in a match's "Waiting for:" label are shown in capitals — e.g.
  "Waiting for: COURT 14".
- "Clear Timers" now requires the reset password. ("Remove Duplicates" already
  did.)

## [4.30.4] - 2026-07-17

### Changed
- Reverted the single-column court players from 4.30.2 — a court shows its four
  players in 2x2 again, at every panel width.
- The green on a newly assigned court is stronger (the card wash rose from 16% to
  24%, with a brighter halo on the status dot), and now holds fully green for
  about 30% of each pulse, down from 45%. The cycle length and 30-second window
  are unchanged.

## [4.30.3] - 2026-07-17

### Changed
- A newly assigned court holds fully green for about 45% of each pulse, down
  from 56%, with a correspondingly longer fade either side. The cycle length and
  the 30-second window are unchanged. All three cues — card wash, status strip
  and status dot — were adjusted together.

## [4.30.2] - 2026-07-17

### Added
- Moving a player between Not Present and Available is now animated in both
  directions, matching the other moves — the card flies from its old position to
  its new one and only appears there as it lands.

### Changed
- When the courts panel is wide enough to show courts in two columns, each
  court now lists its four players in a single column instead of 2x2. The court
  cards are half as wide in that mode, so the players had very little room each.

## [4.30.1] - 2026-07-17

### Changed
- A newly assigned court is green for 30 seconds again (it had been raised to 90
  by a misreading of the last request).
- Within each pulse, the court now *holds* on green rather than only touching it
  at the peak: green occupies about 56% of the cycle, with a short fade either
  side. The cycle length is unchanged at 1.5 seconds. The card wash, status strip
  and status dot were all reshaped together so they stay in step.

## [4.30.0] - 2026-07-17

### Changed
- **Smart Match on an empty match now always favours the longest-waiting
  players, even if that leaves the match short.** Two things had been overriding
  wait time:
  - The format was chosen by a 60/40 coin flip between regular and mixed
    doubles, which could land on a format that excluded whoever had waited
    longest. It's now decided by the two longest-waiting players — same gender
    gives regular doubles, different gives mixed — so neither can be passed over.
  - The preference for Advanced males reordered the pool ahead of wait time. It
    now only applies to a match that already has players in it; on an empty
    match, wait time alone decides the order.
- A partly filled match is accepted rather than skipping someone who has waited
  longer to complete a set.
- Where the longest-waiting player is an Expert, their own format is still used,
  since Experts are excluded from the mixed fallback.

## [4.29.15] - 2026-07-17

### Fixed
- Neon Mode: the theme toggle no longer glows. It was included in the rule that
  lights up a search field on focus, so it stayed lit after being clicked.

### Changed
- A newly assigned court stays green for 90 seconds, up from 30. The pulse itself
  is unchanged at 1.5 seconds per cycle — only how long it runs.

## [4.29.14] - 2026-07-17

### Changed
- A newly assigned court now signals in green rather than yellow. All four cues
  changed together, so the court reads as one signal: the card's breathing wash,
  the status strip and status dot (which pulse cyan to green instead of cyan to
  yellow), and the light-mode border.
  - The yellow used by smart-matched players and the wait-time bands is
    untouched — with the court cue now green, those two no longer compete.

## [4.29.13] - 2026-07-17

### Changed
- Light Mode: player names in the Not Present list are darker, for better
  contrast against the now-white card. Dark Mode is unchanged, and the names keep
  their light font weight.

## [4.29.12] - 2026-07-17

### Changed
- Light Mode: Not Present player cards have a white background, matching the
  Available and Not In Pool cards. They had picked up a grey fill when the
  section was switched to a grey theme; the grey border and header remain.

## [4.29.11] - 2026-07-17

### Changed
- Player names in the Not Present section look lighter. They were already at
  normal weight, so this drops them to a true light weight — Inter's 300 weight
  is now loaded, since only 400 and above were before — and softens their colour
  a step, which was much of what made them read as heavy.

## [4.29.10] - 2026-07-17

### Changed
- Licence expiry warnings now escalate inside a fortnight:
  - 15-30 days remaining: an amber warning, "License expires in N days"
  - Under 15 days: a red critical alert with the same wording, urging a prompt
    renewal
  - Expiring today and already expired remain critical, as before
- About & License now turns the days-remaining figure red under 15 days (it was
  7), matching the notification bell.

## [4.29.9] - 2026-07-17

### Fixed
- The courts, matches and player cards are centred in their panels again. Each
  panel had been permanently holding space for its scrollbar, which pushed the
  contents off-centre even when no scrollbar was showing. That space is no longer
  reserved — the browser now narrows the content area only when a scrollbar is
  actually needed, and the section resizes to accommodate it.

## [4.29.8] - 2026-07-17

### Changed
- Reverted 4.29.7 — the scrollbar gutters are back to being reserved on the
  scrolling edge only, as they were in 4.29.6.

## [4.29.7] - 2026-07-17

### Fixed
- The courts, matches and player cards sit centred in their panels again. Each
  panel reserves space for its scrollbar so the contents can't shift sideways
  when one appears — but that space was only being held on the right, pushing
  everything left of centre. It's now reserved on both sides, so the contents
  stay centred whether a scrollbar is showing or not.
  - The match list was also reserving a gutter inside a container that already
    had one, insetting those cards twice; that duplicate is gone.

## [4.29.6] - 2026-07-17

### Fixed
- Creating a court no longer flickers. The court was being marked as "new" in an
  effect, which runs *after* the first paint — so it appeared at full size for a
  frame, then jumped back to the start of its animation and eased in again. That
  double-appearance is the flicker. Newness is now worked out while rendering, so
  the animation starts on the very first frame.
  - Player cards entering the pool and Not Present used the same pattern and had
    the same flash, so they're fixed too.

## [4.29.5] - 2026-07-17

### Fixed
- Moving a match up or down now carries its court preferences with it. The swap
  exchanged the players and reservations between the two cards but left the
  "waiting for court" setting behind, so the preferences stayed with the position
  instead of the players. The smart-match highlight now travels with them too,
  for the same reason.

### Changed
- The court selection dropdown has smaller text and tighter rows.
- It also expands downward when opened and collapses on the way out, instead of
  appearing and vanishing instantly.

## [4.29.4] - 2026-07-17

### Changed
- "Clear Timers" now sits directly above "Reset Day" in the More menu, below the
  divider — grouping the two clearing actions together and separating them from
  the windows above.

## [4.29.3] - 2026-07-17

### Changed
- "Clear Timers" has moved out of the player pool and into the More menu,
  alongside the other app-level actions. It still asks for confirmation, and is
  greyed out when the pool is empty — the same condition that used to disable the
  button. This also frees up space in the pool's header.

## [4.29.2] - 2026-07-17

### Changed
- Dark Mode: the check and remove (✕) buttons on Not Present cards are brighter —
  they were sitting too dark against the card.
- The "Not In Pool" search section now uses a red theme (header, dot and count)
  in Light, Dark and Neon, distinguishing it from the grey Not Present section.
- In "Not In Pool", the check button is now blue to match Available, and the "+"
  button grey to match Not Present — so each button's colour matches the section
  it sends the player to.

## [4.29.1] - 2026-07-17

### Changed
- The Not Present section now uses a grey theme instead of red — header text,
  status dot, count badge, the "+" picker button, and the border and background
  of the player cards. Neon Mode follows suit with a grey glow in place of the
  red one.
  - The red remove (✕) button on each card is unchanged, since it's a
    destructive action rather than part of the section's identity.

## [4.29.0] - 2026-07-17

### Added
- A bouncing arrow now points at the player when a pool search narrows to a
  unique match, making them easier to spot. It runs on the same 1.4s cycle as the
  green glow and reaches full extension at the same point, so the two pulse
  together.
  - It appears wherever the highlight does — the Available and Not Present cards,
    the player's slot in the match queue, and their row on a court — and is
    drawn as part of the highlight itself, so all four stay in step.
  - The card makes room for it, so it never covers the player's name, and it
    clears the gender accent bar on a queue slot.

## [4.28.5] - 2026-07-17

### Fixed
- The drop highlight no longer flickers when dragging a player over the Available
  or Not Present sections. Moving the cursor from a section onto one of the cards
  inside it counts as leaving that section, so the highlight was being cleared and
  immediately restored, over and over. It's now only cleared once the cursor has
  genuinely left the section.
  - The match cards in the queue had the same problem — moving over a player slot
    cleared the card's highlight — so that's fixed too.
  - Dragging also no longer updates state on every mouse movement, only when the
    target actually changes.

## [4.28.4] - 2026-07-17

### Added
- Moving a player between Not Present and the Match Queue is now animated in
  both directions, matching the other moves.
  - Dragging a Not Present player onto a match: their card had no flight because
    Not Present cards weren't registered as animation targets, so the animation
    silently gave up. They're now tagged like pool cards.
  - Dragging a player from a match to Not Present: this had no animation at all,
    and now flies the card from the match slot down to the Not Present list.
  - Both follow the same rule as the rest: the player only appears at the
    destination as the card lands.

## [4.28.3] - 2026-07-17

### Fixed
- Moving a player to another match no longer shifts the remaining players left.
  A match stores its players as a plain list, so removing one pulled everyone
  after them into the vacated slot. The queue now remembers which slot each
  player is drawn in, so the others stay put and the gap is filled by whoever
  joins next.
- **Exporting a report no longer freezes the app until the print dialog is
  closed** (most noticeable in Edge). The report window was opened with a link
  back to CueMii, which meant the two shared a process — so the print dialog
  blocked both. The report is now opened as a detached tab with no link back, and
  prints in its own context while CueMii stays usable.

## [4.28.2] - 2026-07-17

### Fixed
- The green search glow no longer misses a unique match when the search ends in
  a space. The pool filtered on the untrimmed text, so typing a full name plus a
  trailing space filtered out the very player being searched for.
- Moving a player between matches now animates from the slot they were in, not
  from their card in the pool list.
- Deleting a match animates its players back to the pool, like clearing one
  already did.

### Added
- Players added to Not Present now settle in with the same animation as the
  pool, instead of appearing instantly.

### Changed
- An empty match no longer shows "Need 4 players to assign court". The card keeps
  exactly the same height, so it doesn't grow when the first player is added.
- "Clear All" in the Match Queue no longer asks for the reset password.
- PDF exports print with proper top and bottom margins. The page margins were
  increased, and padding is applied as well so there's still breathing room if
  the print dialog is set to no margins.

## [4.28.1] - 2026-07-17

### Fixed
- Players no longer appear at their destination at the *start* of a flight. The
  previous fix hid the destination on the next animation frame, but React renders
  it as soon as the state updates — before that frame — so it flashed into view,
  vanished, then came back at the end.
  - Travelling players are now hidden by a live stylesheet keyed on the player's
    id, which applies the instant the element appears rather than after it has
    already been drawn. Batched moves hide everyone up front, so staggered
    flights don't flash either.
  - Applies to every move: pool to match, match to pool, match to court, court to
    pool, and clearing or undoing a match.
  - Several safeguards ensure a player can never be left invisible if a flight is
    skipped or interrupted.

## [4.28.0] - 2026-07-17

### Fixed
- A player no longer appears at their destination while their card is still
  flying there. The destination renders the moment the state updates, so the
  player was visible at both ends for the whole trip. The destination is now
  held back and fades in as the card lands — for every move: pool to match,
  match to pool, match to court and back.

### Added
- The More menu unrolls from the top when opened and collapses on the way out.
- A newly created court eases into place instead of popping in.
- Searching the pool now also pulses the matching player's card green in the
  Available and Not Present sections when the search narrows to one player,
  alongside the existing highlight in the Match Queue and Courts panels.

### Changed
- Light Mode: the court-assign buttons now sit on the light tint that used to be
  their hover state, with a slightly darker tint on hover.
- The "Clear Timers" button now matches the "Clear All" button in the Match
  Queue, including turning red on hover.

## [4.27.7] - 2026-07-17

### Changed
- Player cards flying between the pool and the queue move more slowly and stay
  easier to follow: the flight is longer, arcs higher, and the card now stays
  solid for most of the trip instead of fading out from halfway. The ghost itself
  is more substantial too, with a heavier border and shadow.
- Light Mode: the court-assign buttons are now white with a coloured edge and
  label, filling with a light tint on hover, instead of a flat pastel block that
  read as disabled. The amber preferred/contested variants match. Dark and Neon
  are unchanged.

## [4.27.6] - 2026-07-17

### Fixed
- An empty match in the queue is now the same height as one with players. The
  footer was hidden entirely while a match had nobody in it, so the card grew the
  moment the first player was added. It now always shows "Need 4 players to
  assign court" until the match is full, keeping the card a constant height.

## [4.27.5] - 2026-07-17

### Fixed
- **Crash on startup: "useMemo is not defined".** The search-highlight added in
  4.27.1 used `useMemo` in App.js without it being imported. The production build
  had been run with warnings suppressed, which reduced the undefined-variable
  error to a warning and let it through. Verified by rebuilding with warnings
  treated as errors, and by auditing every file for React hooks used but not
  imported (none others found).

## [4.27.4] - 2026-07-17

### Changed
- Assigning a match to a court is now a clearer, sequenced animation:
  - **The players move individually.** Instead of one "Match #12" label flying
    across, each player travels from their slot to their place on the court, one
    after another — so it reads as four people walking on.
  - **The court fills before it moves.** The courts panel now holds its cards in
    place until the players have arrived, then reorders — rather than the court
    sliding away while they're still in transit.
  - **The reorder is slower**, so the court moving to the bottom is easy to
    follow.

## [4.27.3] - 2026-07-17

### Changed
- Light Mode: the yellow border on smart-matched players is more prominent
  (50% -> 90% opacity). Dark and Neon are unchanged.

## [4.27.2] - 2026-07-17

### Added
- Clearing or undoing a match now animates its players returning to the pool.
  This covers all four actions: "Clear match", "Clear all matches", "Undo Smart
  Match" and "Undo Smart Queue All" — each flies the affected players from their
  slot back to their card in the pool, staggered so a group reads as leaving
  together.

## [4.27.1] - 2026-07-17

### Changed
- The green search highlight moved to where it's actually useful. When a pool
  search narrows to one player, that player now pulses green **in the Match Queue
  and Courts panels** — in the slot they're really occupying — rather than on
  their card in the player pool's own In Match Queue / In Court lists. Searching
  a name now points at where the player physically is.

## [4.27.0] - 2026-07-17

### Added
- **Searching for a player who's already playing now points them out.** When a
  pool search narrows to exactly one player and that player is in the match queue
  or on a court, their card pulses green so you can see at a glance where they
  are. The highlight also lifts that card's washed-out styling, so the one you
  searched for stands out from the rest of the section.
  - Only the In Match Queue and In Court sections light up — an available player
    is easy enough to find in the list above.
  - The pulse stops if the search widens to more than one match.

## [4.26.4] - 2026-07-17

### Fixed
- Player Database rows no longer change height when you edit a player. The name
  cell in the normal row still carried a stray 56px height from an earlier
  change, making that row taller than the edit row. Every cell in both rows now
  shares one explicit height.
- The fingerprint icon is properly centred in its row. The icons sat on the
  cell's text baseline rather than its centre line, which showed most on the
  greyed-out "no fingerprint" icon since it has nothing beside it. All cells now
  centre their contents vertically.

## [4.26.3] - 2026-07-17

### Fixed
- Opening the "New player" panel no longer makes the A-Z list shake or resize.
  The popup's rendered width came from state that updated a frame *after* the
  layout changed, so for one frame the panel was still narrow while holding both
  columns and the left one squeezed. The width is now applied directly, both
  columns are pinned against shrinking, and repositioning happens before the
  browser paints.

### Changed
- Neon Mode: the smart-match glow is now the same strength as in Dark Mode (it
  was noticeably brighter, with an extra outer halo).
- The yellow border on smart-matched players is less prominent in all themes.

## [4.26.2] - 2026-07-17

### Fixed
- In Light Mode, cards in the In Court and In Match Queue sections now look
  faded rather than dimmed. Lowering their opacity blended a white card toward
  the panel behind it — which is darker than white — so they appeared to darken.
  Light Mode now washes them toward white instead; Dark and Neon keep the opacity
  fade, which is the right effect against a dark page.

### Changed
- Neon Mode: smart-matched slots glow more strongly and keep the yellow border
  they have in Dark Mode.
- Player Database rows are shorter (58px -> 46px, with tighter cell padding). The
  edit controls still fit, so the row height stays constant when editing.

## [4.26.1] - 2026-07-17

### Added
- The "New player" panel in the Available / Not Present pickers now slides in
  when opened, has an ✕ button to close it, and fades out on the way back. The
  popup only shrinks once the panel has finished animating away.

### Changed
- Smart-matched players now glow from within the card, the same way a newly
  assigned court does, instead of casting an outer glow.
- Neon Mode: player cards are tinted by section — red for Not Present, yellow for
  In Match Queue, green for In Court — and the in-play cards no longer light up on
  hover, since they can't be acted on.
- Neon Mode: the selected level in the new-player form is darker than the "Add
  player" button, so the two no longer look like the same control.
- Light Mode: the "Welcome back" fingerprint notification now uses a light green
  theme instead of the dark gradient carried over from Dark Mode.

### Fixed
- **All** player cards in the In Match Queue and In Court sections are now washed
  out. The wash-out was bundled into a border style that a card with a wait-time
  colour replaced outright, so those cards stayed fully saturated. It's now a
  property of being in play, independent of the border.
- Editing a player in the Player Database no longer makes the row taller — the
  row has a fixed height and the edit controls are sized to fit it.

## [4.26.0] - 2026-07-17

### Added
- **Create a player without leaving the pool.** The "+" beside the search box in
  the Available / Not Present pickers opens a panel to the right for a new
  player: name, gender and level. Adding them saves the player to the database
  and drops them straight into whichever section the picker belongs to, then
  clears the form and refocuses it so several can be added in a row. The popup
  widens to fit and re-places itself so it still can't run off the screen.
- Removing a player from a match now animates their card flying from its slot in
  the queue back to the pool.

## [4.25.12] - 2026-07-17

### Changed
- The match swap animation no longer uses cloned copies — the real cards now
  move. Both cards are measured before the swap, then each starts at the other's
  old position and slides home, so you see the actual cards exchanging places
  rather than ghosts flying over them.
  - Note the court panel's reordering already animated the real court cards;
    this was the one place that used clones.

## [4.25.11] - 2026-07-17

### Fixed
- Assigning a match now flies the card to where the court actually ends up.
  Assigning also reorders the courts, and the target court is mid-slide at the
  moment the destination is measured — `getBoundingClientRect()` includes that
  in-flight transform, so it reported the court's *old* position and the ghost
  flew to the wrong place. Destinations are now measured as layout positions,
  with any current transform subtracted.

### Added
- Expanding the "In Match Queue" or "In Court" sections in the player pool
  scrolls them into view, so their contents aren't left below the fold.
- Creating a match scrolls the queue to the new card.

## [4.25.10] - 2026-07-17

### Changed
- Moving a match up or down now animates the **whole match card** swapping places
  with its neighbour, instead of the individual player names flying across. A
  copy of each card flies to the other's position and fades out on arrival, by
  which point the real cards already show the swapped contents — so the match
  itself appears to have moved.
  - The buttons still swap the players between two fixed cards, as before; only
    the animation changed.

## [4.25.9] - 2026-07-17

### Added
- Courts now animate when they reorder. They're ordered by when their match was
  assigned, so assigning a match genuinely moves the cards around — they now
  glide to their new positions instead of jumping. Both axes animate, since the
  courts are a grid rather than a single column.
- The courts panel also reserves its scrollbar space, so gaining or losing the
  scrollbar can't shift the cards sideways.

## [4.25.8] - 2026-07-17

### Changed
- **Rewrote the queue's slide-up animation around a stricter rule: only a change
  in the list's order is animated.** The previous version animated any change in
  position, so every content-driven layout shift became its own little animation
  — a card growing a "preferred courts" banner, its footer swapping between a
  message and buttons, the list gaining or losing a scrollbar. Those kept landing
  on top of the real reorder as a twitch. Cards that were merely pushed by a
  neighbour resizing now settle silently; only cards that actually changed place
  animate.
- A short settle window after each animation absorbs the follow-up layout changes
  that arrive a frame or two behind the state change, so they can't start a
  second, competing animation.
- The preferred-courts banner on a match card is now a fixed height, so showing
  or hiding it can't resize the card. That's the third such fix — the same class
  of problem as the footer message heights.

## [4.25.7] - 2026-07-17

### Fixed
- The sideways twitch at the end of the queue's slide-up is gone. Removing a
  match can take the list below the height that needs a scrollbar; the scrollbar
  disappears, the content gets wider, and every card shifts horizontally. The
  queue (and the pool) now reserve the scrollbar's space so the width never
  changes, and the queue's animation only moves cards vertically — it's a
  vertical list, so sideways movement is never meaningful there.

### Changed
- "Reset All Data" is now called **Reset Day**, which better describes what it
  does: it clears the session (pool, matches, courts) while keeping the player
  database and match history. The confirmation wording was updated to match.

## [4.25.6] - 2026-07-17

### Fixed
- The player pool now always shows the Available and Not Present sections, even
  when empty, instead of replacing them with a "No players in pool" message. They
  stay usable as drop targets and keep their "+" pickers.
- A match card no longer changes height when a court frees up. The "No courts
  available" message was 24px tall while the court buttons that replace it are
  20px, so every card shrank slightly the moment a court opened. Both states are
  now the same height — the same mismatch that caused the assignment twitch.

### Added
- Returning a match to the queue animates: the players fly off the court back
  into their slots.
- Undoing a finished match animates too, with the players flying back onto the
  court they came from.

## [4.25.5] - 2026-07-17

### Fixed
- The downward twitch when assigning the top match is gone, and this time the
  cause is confirmed: a match card's footer is 24px tall while it says "Need 4
  players" but only 20px once the court buttons appear. Assigning a match also
  shuffles players between the remaining matches, so a card flipping between
  complete and incomplete resized by 4px and nudged everything below it. The
  footer is now a fixed height in both states.

### Added
- Moving a match up or down is now animated. It swaps the *players* between two
  cards rather than moving the cards, so nothing appeared to happen — both groups
  of players now fly across to the opposite card.
- The Available / Not Present pickers ease closed as well as open, mirroring the
  direction they opened from.

## [4.25.4] - 2026-07-17

### Fixed
- The downward twitch after assigning a court is gone. It wasn't a rendering
  glitch: when a match leaves the queue the app also swaps a reserved match down
  the list, and the new animation was faithfully showing that second move. The
  swap is now applied instantly while the slide-up animates, so only the
  meaningful motion is shown.

### Added
- Dropdown panels ease open instead of appearing instantly — the Available /
  Not Present player pickers and the themed dropdowns (level filter, date
  selectors, Manage Players fields). A panel that opens upward grows from its
  bottom edge rather than its top.

## [4.25.3] - 2026-07-17

### Fixed
- The queue no longer twitches downward at the end of the slide-up. The browser's
  scroll anchoring was nudging the scroll position as the assigned match was
  removed; anchoring is now disabled on the queue list.
- The glow on smart-matched players is back. The new slot-fill animation was
  landing on the same element, and since `animation` is a single CSS property it
  replaced the glow outright. Slots that were just smart-matched now skip the
  fill animation and keep their glow.

### Changed
- A player flying into a match now lands on the **exact slot** they occupy,
  rather than the middle of the match card. The destination is resolved after
  the re-render by finding the slot that now holds them.
- **Finishing a match sends the players home.** Pressing Done flies each of the
  four players from their place on the court back to their card in the pool,
  staggered so they read as a group leaving.
- Staggered flights now measure their starting positions up front. Previously
  the later ones in a batch found nothing to fly from, because the original card
  had already been removed by the time they started.

## [4.25.2] - 2026-07-17

### Fixed
- Assigning a match to a court now animates the queue correctly — the matches
  below slide **up** to close the gap, instead of appearing to fall downward.
  Two measurement problems were inverting the direction:
  - Positions were read as viewport coordinates, so any scrolling of the queue
    between renders corrupted the deltas. They're now read relative to the list
    itself, which scrolling can't affect.
  - Positions were only re-measured when a tracked value changed, leaving stale
    coordinates behind. They're now refreshed after every render, so the stored
    layout always matches what was last on screen.

## [4.25.1] - 2026-07-17

### Fixed
- **The pool reorder animation no longer flickers.** The player cards were
  defined as components *inside* the pool component, which makes them a brand-new
  component type on every render — so React tore down and rebuilt every card,
  and with the match timers ticking that happened every second. That restarted
  the card animations constantly and destroyed the element identity the reorder
  animation depends on. The cards are now rendered inline, so the DOM nodes
  survive between renders and the pool glides into its new order.
  - As a side benefit, the pool no longer rebuilds its whole card list once a
    second, which is easier on a kiosk machine.
- The reorder animation itself is smoother: a gentler easing curve over a
  slightly longer 340ms, sub-pixel movement ignored so tiny layout shifts can't
  trigger a twitch, and a second move now cancels the first instead of fighting
  it.

## [4.25.0] - 2026-07-17

### Added
- **Motion, in three layers.**
  - *Settle animations* — a player card scales and fades in when it appears in
    the pool, and a match slot pops as it's filled.
  - *Flying card* — moving a player renders a ghost of their card that flies from
    where they were to where they land: pool to match, match to match, and each
    Smart Match / Smart All pick (staggered, so filling four slots reads as a
    sequence). Assigning a match flies its card onto the court.
  - *FLIP layout animation* — when the pool or queue reorders, the remaining
    cards glide to their new positions instead of jumping.
- All of it honours `prefers-reduced-motion`: the settle animations and flying
  card are skipped entirely for users who ask for less movement.

### Notes
- Tier 3 uses the FLIP technique directly rather than a layout-animation library,
  so no dependency was added and the components didn't need restructuring.
- The flying card is rendered into `<body>`; the panels use backdrop-filter with
  hidden overflow, which would otherwise trap and clip it.
- Elements opt in through `data-player-card` / `data-match-card` /
  `data-court-card` attributes, so no refs had to be threaded through the tree.

## [4.24.3] - 2026-07-17

### Fixed
- The BADDIXX logo no longer has a greyish outline in Dark and Neon Mode. Its
  anti-aliased edge pixels still carried the white they were originally blended
  against — averaging a pale (230,191,204) versus the logo's (215,52,94) core —
  so on a dark page they showed as a light halo. Those edge pixels now take the
  colour of the nearest solid pixel, so the edge fades in the logo's own pink
  instead of grey. The soft edge itself is kept, so the logo doesn't look
  cut out.

## [4.24.2] - 2026-07-17

### Fixed
- The BADDIXX logo looked red in Dark and Neon Mode but magenta in Light. Most of
  the artwork was only 70-85% opaque, so it blended with whatever was behind it —
  toward light magenta on a white page, toward dark crimson on a dark one. The
  logo now bakes in its light-mode colour and is fully opaque through the body,
  so it reads the same magenta in all three themes (its composited colour now
  varies by at most 12/255 between Light and Dark, down from about 59).

## [4.24.1] - 2026-07-17

### Fixed
- The enclosed counter inside the "e" of the CueMii logo stayed white instead of
  showing the app background. Flood-filling from the image edges only removes
  background that touches the border, so the hole in the letter was left behind.
  Enclosed background-coloured regions in the wordmark are now cleared too —
  restricted to the wordmark so the mascot's white body is untouched.

## [4.24.0] - 2026-07-17

### Changed
- **New CueMii logo.** The pink "CueMii App" text in the header is replaced with
  the shuttlecock-mascot logo, and the "Created by ..." line now sits to its
  right. The same logo replaces the banner and title in the About & License
  window.
- The logo's background was keyed out so it sits on any app background — Light,
  Dark and Neon. Because the mascot itself is white, a brightness key would have
  eaten it, so the background was removed by flood-filling inward from the edges
  and feathering the leftover fringe.

## [4.23.7] - 2026-07-17

### Fixed
- Fingerprint check-in now shows through while another window is open. Scanning
  was never blocked — the "Welcome back" notification simply sat at the same
  stacking level as the windows, which render later and covered it. The
  notification and the assign-player dialog are now layered above every window,
  so a scan still greets the player, and an unrecognised finger still opens the
  search / assign dialog on top of Reports, History, Manage Players or About.

### Changed
- Player Database: more left padding on the fingerprint cells (rows only — the
  column header is unchanged).

## [4.23.6] - 2026-07-17

### Changed
- Player Database: the fingerprint icon is larger and sits on the row's centre
  line (its wrappers are now flex, so the glyph no longer rides the text
  baseline).
- Neon Mode: the Match History rows now follow the theme. Each entry drops to a
  deep base with a lit edge — green for completed, red for deleted — and the
  match number, status marker and player chips inside become outlined and lit
  rather than washed-out tinted blocks. Empty player slots stay quiet with a
  faint cyan dashed edge.

## [4.23.5] - 2026-07-17

### Fixed
- Player Database: rows no longer show through the sticky "Actions" header while
  scrolling. The background was set on `<thead>`, which browsers don't paint
  reliably for a sticky table section, and it had no stacking order — the
  background now sits on each header cell and the header is raised above the
  rows.

### Changed
- Player Database: the Fingerprint column now shows a fingerprint icon instead of
  a "Stored" / "None" pill — coloured green when one is enrolled, greyed out when
  not. The delete action on an enrolled fingerprint is unchanged.

## [4.23.4] - 2026-07-17

### Changed
- The Levels filter and the Match History / Reports date selectors were shrunk
  too far in 4.23.3. They're a step larger again: wider controls, the row padding
  and chevron back to normal, and only the label a touch smaller than default.
  Their dropdown lists were eased back up to match.

## [4.23.3] - 2026-07-17

### Changed
- The player pool's Levels filter and the Match History / Reports date selectors
  are smaller — tighter padding, smaller label and chevron, and narrower controls.
  Their dropdown lists shrank to match (smaller rows, lower minimum width and a
  shorter maximum height).
- ThemedSelect gained a `compact` size for this, so the dropdowns elsewhere (the
  Manage Players and fingerprint enrolment fields) keep their current size.

## [4.23.2] - 2026-07-17

### Fixed
- The Available / Not Present picker could still leave the screen while it was
  open, because scrolling the pool moves the button it's anchored to — far enough
  that the button's own position goes negative. The panel position is now clamped
  into the viewport unconditionally on every reposition, not only when neither
  side fits.
- The picker's scrollbar now matches the app's. It's rendered through a portal
  into <body>, which sits outside the app's root element and so was missing the
  dark/neon scoped styling; the theme classes are now mirrored onto <body>.

### Changed
- Picker: shows up to 8 names (was 6), with tighter rows and a smaller level
  letter.
- Neon Mode: the picker now carries neon styling — deep panel with a cyan-tinted
  glowing edge, darkened search field, lit active letter and a cyan hover wash.
- Reverted the left padding on player names in the Available / In Court / In
  Match Queue cards.

## [4.23.1] - 2026-07-17

### Changed
- The Available / Not Present pickers are now a fixed size: the list shows six
  player rows and scrolls beyond that, and the A-Z index stays visible while
  searching so the panel height never changes.
- Because the panel's height is now known up front, it can always be placed fully
  on screen: below the button when there's room, above it when there isn't, and
  clamped into the viewport otherwise — so it can't hang off the top or bottom no
  matter how far the pool is scrolled.
- Player names on the Available, In Court and In Match Queue cards are indented
  slightly so they line up with the level badge's text beneath them.
- Neon Mode: the player card border fades further at the upper-right and
  lower-left corners, with softer shoulders so the fade is more gradual.
- The pulse on newly assigned courts now peaks at 15% (was 11%).

## [4.23.0] - 2026-07-17

### Changed
- The Available / Not Present pickers now list **every** player in the database.
  Players are no longer removed from the list once added, and a coloured dot shows
  where each one currently sits — cyan for Available, red for Not Present, amber
  for in a match — with a small legend above the list.
- The pickers now stay on screen wherever the "+" button happens to be: the panel
  opens downward when there's room and flips upward when there isn't, is clamped
  to the viewport horizontally, and caps its own height so it can't run past the
  top or bottom edge no matter how the pool is scrolled.
- Level letters are all the same width, in both the pickers and the match queue
  cards (a narrow glyph like "I" made its pill narrower than the others).
- Modal backdrops use a stronger blur and a slightly lighter dim, so the
  background blur is actually visible — including the Settings window.

## [4.22.9] - 2026-07-17

### Fixed
- Neon Mode: the In Pool / Not In Pool pill in the Player Database now gets the
  neon treatment like the Stored / None pills. It was the one pill whose classes
  differed slightly, so it had been missed when the others were hooked up.

## [4.22.8] - 2026-07-17

### Changed
- The background pulse on a newly assigned court is very slightly brighter
  (peak tint 7.5% -> 11%).

## [4.22.7] - 2026-07-17

### Changed
- Neon Mode, Player Database: the add / edit / delete action buttons now sit on a
  near-black base that blends with the panel, with a bright outline and a lit
  icon, rather than the lighter tinted fills they used before.
- Neon Mode, Player Database: the Stored / None and In Pool / Not In Pool pills
  now follow the neon treatment too — near-black fill with a lit outline in each
  pill's own colour.

## [4.22.6] - 2026-07-17

### Changed
- Neon Mode: the Not Present header text now uses the same red as the dot beside
  it (it was a lighter shade).

## [4.22.5] - 2026-07-17

### Changed
- Newly assigned courts no longer give off an outer glow. Instead the card's
  background breathes with a very faint yellow wash. Implemented as a large
  inset shadow, so the tint sits above the card background but below its content
  — the player names and buttons stay unaffected — and the card keeps its normal
  elevation shadow while animating. The yellow top strip and the synced status
  dot are unchanged.

## [4.22.4] - 2026-07-17

### Changed
- Neon Mode: the Available header and its dot now use the cyan of the "+" button
  beside them, and the Not Present header and dot use that section's red — so each
  header, dot and add button read as one colour group. Light and Dark are
  unchanged.

## [4.22.3] - 2026-07-17

### Changed
- The remove (✕) button on Not Present cards now matches the check button beside
  it — same size and filled style — and follows the neon theme in Neon Mode
  (deep red fill, bright outline, halo and lit icon).
- In the Available / Not Present pickers, each player's level is now shown as a
  bordered coloured letter, matching the level badges on the match queue cards.

## [4.22.2] - 2026-07-17

### Changed
- Player pool: a card whose border has changed for wait time now carries a very
  subtle wash of the same colour across its background.
  - Light and Dark apply it as a faint translucent layer over the card's existing
    background, so the card doesn't lose its normal surface.
  - Neon tints the card's surface colour instead, since its border is a gradient
    painted through the background layers.

## [4.22.1] - 2026-07-17

### Changed
- Neon Mode: the waiting-player gradient border now runs corner to corner —
  brightest at the upper-left and lower-right, dimming toward the upper-right and
  lower-left. The dim sections no longer fade to nothing, so the full outline
  stays visible while the fade is still clear.

## [4.22.0] - 2026-07-17

### Changed
- **Player pool wait indicator is now a static border instead of a pulsing glow.**
  A waiting player's card takes a solid border colour by band — green from 5
  minutes, yellow from 10, red from 15 — so the pool no longer animates
  continuously.
- **Neon Mode gets a fading gradient border** for the same bands: the wait-time
  colour is strongest at one corner and fades out around the card, matching the
  reference. Built with stacked background layers (surface inside the padding
  box, gradient on the border box) so no extra markup was needed.

## [4.21.5] - 2026-07-17

### Changed
- The A-Z index hover delay in the player pickers is now 200ms (was 250ms).

## [4.21.4] - 2026-07-17

### Added
- In the Available / Not Present pickers, pressing Enter selects the player when
  the search has narrowed to exactly one match — so you can add someone entirely
  from the keyboard. The search then clears and refocuses as usual, ready for the
  next name.

## [4.21.3] - 2026-07-17

### Changed
- In the Available / Not Present pickers, clicking a name now clears the search
  box and puts the cursor back in it, so you can type the next name straight
  away.

## [4.21.2] - 2026-07-17

### Changed
- The Available / Not Present "+" pickers now stay open after you click a name,
  so you can add several players in a row. The chosen player drops out of the
  list as confirmation, and the menu closes on an outside click or Escape.

## [4.21.1] - 2026-07-17

### Changed
- The "+" player pickers on the Available and Not Present sections are now
  right-aligned in their section headers.
- Neon Mode: the Not Present picker button is red, matching that section's
  identity, instead of inheriting the cyan add-button styling.

### Fixed
- The A-Z index in the pickers no longer changes letter as the mouse passes over
  other letters on the way down to the player list. Hovering now needs a short
  dwell (250ms) before the letter switches, and leaving a letter or the grid
  cancels a pending switch. Clicking a letter still switches instantly.

## [4.21.0] - 2026-07-17

### Added
- **Type anywhere to search the player pool.** On the main interface you can just
  start typing a name and it goes into the pool search — no need to click the
  field first. Backspace deletes, Escape clears. It stays out of the way while a
  window or dialog is open, or while you're typing in any other field, and single
  keys like F1 still work as shortcuts.
- **"+" player pickers on the Available and Not Present sections.** Each opens a
  dropdown indexed A-Z: hover (or click) a letter to see the players whose name
  starts with it, then click a player to drop them straight into that section.
  Letters with no players are dimmed, and there's a search box for when typing is
  quicker than browsing.
  - The Available picker offers anyone not already in the pool; the Not Present
    picker offers anyone not in the pool or already waiting.
  - The list is portal-rendered, so it isn't clipped by the panel.

## [4.20.2] - 2026-07-17

### Changed
- Neon Mode: the check buttons on the Not Present and "Not In Pool" cards now
  follow the neon theme — deep fill, bright green outline, halo and a lit icon.
  The adjacent "+" button on the Not In Pool cards got the same treatment in cyan,
  so the pair stays consistent.

## [4.20.1] - 2026-07-17

### Changed
- The "✓-In" button on Not Present cards is now a plain check icon button,
  identical to the one on the "Not In Pool" cards (same size, colour and hover),
  with a tooltip naming the player.

## [4.20.0] - 2026-07-17

### Added
- **Drag a Not Present player straight onto a match.** They're moved into the
  Available group automatically and placed in the match in one action (previously
  the drop was silently ignored).
- **"Not In Pool" search results are now draggable** — onto a match (they join
  Available and go straight in), onto the Available section, or onto Not Present.
- **A check button on each "Not In Pool" card**, to the left of the "+", that puts
  the player straight into Available. The "+" still adds them to Not Present, so
  the two buttons now have distinct destinations.

### Fixed
- Player Database: reverted the extra left padding on the column headers — it now
  applies only to the data cells, as intended.

## [4.19.1] - 2026-07-17

### Changed
- Player Database: the Name, Gender, Level, Fingerprint and Status cells (and
  their headers, so they stay aligned) now have a little more left padding.
- Player Database: the Name column is narrower (30% -> 26%); the freed width went
  to Gender and Level.

## [4.19.0] - 2026-07-17

### Added
- **"Not In Pool" section in the player pool.** When you search, a new section
  appears below In Court listing players from the database who aren't in the pool
  (or in Not Present). Each shows just the player's name with a "+" button that
  adds them straight to the pool and clears the search. The header is light grey
  with a count badge, matching the other sections.
  - It also appears when the pool is completely empty, which is exactly when
    you'd search to add the first players.

## [4.18.2] - 2026-07-17

### Changed
- Neon Mode: the outline on the amber buttons — "Return to Queue" and "Undo" —
  is brighter (lighter amber at near-full opacity), with a slightly stronger
  glow and lighter label. The preferred/contested court buttons share this
  styling and were brightened with them.

## [4.18.1] - 2026-07-17

### Changed
- Neon Mode: the Player Pool, Courts and Match Queue headers now have a lit
  top-left corner. The header icon becomes a glowing tile — bright border, inner
  and outer halo, and the icon itself lit — and a soft light source bleeds in
  from the panel's top-left corner behind the title. The Match Queue keeps its
  amber identity while the other two use cyan.

## [4.18.0] - 2026-07-17

### Added
- **Click outside a window to close it.** Player Database, About & License,
  Settings, Match History and Reports now close when you click the dimmed area
  outside them. Clicks inside a window are unaffected, and Player Database still
  runs its usual cleanup on close.

### Changed
- The Player Database window's scrollbar is a little thicker (14px), since its
  table is the longest scrolling list in the app.

## [4.17.8] - 2026-07-17

### Changed
- Reports (Individual): the "Search players" field is smaller — tighter padding,
  smaller text and a thinner focus ring — leaving more room for the player list.

## [4.17.7] - 2026-07-17

### Removed
- The "Manual" column has been removed from the Player Statistics report (header
  and data cell), leaving 13 aligned columns. The underlying figure is still
  calculated, so the column can be restored later if needed.

## [4.17.6] - 2026-07-17

### Changed
- Reports: the Level Combinations and Smart Match Usage sections are taller
  (192px -> 288px) and Daily Statistics is taller still (256px -> 384px), so more
  rows are visible before scrolling. All three now use the themed scrollbar.

## [4.17.5] - 2026-07-17

### Changed
- The Reports window is narrower (max 980px, was a fixed 1100px). It now also
  caps at 92% of the viewport, so it can't end up wider than the screen on a
  smaller display.

## [4.17.4] - 2026-07-17

### Changed
- Reverted the bar-graph conversion for "Players by gender", "Gender
  Combinations" and "Level Combinations" — they're back to their previous count
  boxes and labelled list. Skill mix, wait-time spread and match-length spread
  keep their bars.
- The three reverted sections stay inside the titled cards so they still match
  the rest of the report.

## [4.17.3] - 2026-07-17

### Changed
- Player pool: the count badges on the Available, Not Present, In Match Queue and
  In Court section headers are smaller (smaller number and a tighter pill around
  it).

## [4.17.2] - 2026-07-17

### Changed
- Reports: the "Export PDF" and "Clear All" buttons are smaller (tighter padding,
  smaller label and icons).

## [4.17.1] - 2026-07-17

### Changed
- Reports (Overall): "Players by gender", "Gender combinations" and "Level
  combinations" are now proportion bars as well, so every distribution in the
  report is read the same way. Level combinations keep their per-level colour
  coding in the labels.

### Fixed
- PDF export now fits a portrait page. The print window had no `@page` rule, so
  the browser used its own default while the content was laid out at 800px wide —
  wider than the printable area, which cut off the Player Statistics table.
  Export now sets portrait with 10mm margins, fits the content to the page width,
  scales tables down with wrapped cell text, repeats table headers across pages,
  and avoids splitting rows and cards mid-break.

## [4.17.0] - 2026-07-17

### Changed
- **Reports (Overall) reorganised for clarity.**
  - The four summary boxes are now a compact five-metric headline row —
    Matches, Players, Avg Wait, Games and Smart — with small uppercase labels
    above large values, so the key figures read at a glance.
  - Every section is now a consistently framed card with its own title bar,
    instead of loose panels with inline headings.
  - Distributions are drawn as proportion bars rather than grids of numbers:
    skill mix, wait-time spread and match-length spread are now instantly
    comparable.
  - Wait-time and match-length spreads sit side by side, making better use of
    the window's width instead of stacking down a single column.
  - Average match length moved into its card's header rather than being tucked
    beside the section title.

## [4.16.5] - 2026-07-17

### Fixed
- Neon Mode: removed the static grey glow around the player pool search bar. The
  level-badge glow rule was matching any rounded-full bordered element, which
  included the search input, so it picked up a halo in the input's grey text
  colour. The rule now applies only to the badges.

## [4.16.4] - 2026-07-17

### Changed
- Player pool: two-column layout now holds down to 375px (was 390px).

## [4.16.3] - 2026-07-17

### Changed
- Player pool: the two-column layout now holds until the panel is narrower than
  390px (was 430px), so the panel can be squeezed further before dropping to a
  single column.

## [4.16.2] - 2026-07-17

### Changed
- The Light/Dark/Neon toggle now uses the same neutral grey styling as the
  notification bell in all three modes, instead of changing colour per theme
  (amber in light, yellow in dark, cyan-outlined in neon). Only the icon changes.

## [4.16.1] - 2026-07-17

### Fixed
- The Notifications and More dropdowns appeared behind the panels. The header
  had no stacking order of its own, so the content below it painted on top; the
  header now sits above the panels (and still below modals).
- Player pool: the games counter no longer wraps under its own icon when the
  panel is narrowed. The pool switches from two columns to one sooner (below
  430px instead of 350px), and the level badge, wait time and games counter are
  kept on one line.

### Changed
- The More menu now sits to the right of the Manage Players button.
- Court header text is very slightly smaller.

## [4.16.0] - 2026-07-17

### Added
- **Header overflow menu.** Reports, Match History, Settings, About & License and
  Reset All Data have moved into a dropdown menu (with icons) to the right of
  Manage Players, clearing the header clutter. Reset is separated below a divider
  and styled as a destructive action.
- **Notification bell.** A new bell in the header shows a coloured badge with the
  number of things needing attention, and lists them with severity icons:
  - License expired / expires today / expires within 30 days (with a shortcut to
    open the License window)
  - Player seats running low or exhausted, against the licensed limit
  - A newer app version being available (checked on start and hourly)
  - Fingerprint service or reader offline
  - No internet connection, or a failed cloud sync
- Shared version-check helper so the bell and the About window can't disagree
  about whether an update exists.

### Changed
- The About & License button no longer carries the licence warning styling — the
  bell handles notifications now.
- Fixed the sun icon in the theme toggle, which rendered as a dot because an
  outline path was being filled instead of stroked.

## [4.15.1] - 2026-07-17

### Changed
- Player pool cards: a little more space between the player's name and the level
  badge row beneath it.

## [4.15.0] - 2026-07-17

### Changed
- **A reserved slot now stays put when other players are added.** Dropping a
  player into a match no longer pushes the "Waiting for ..." marker to the
  right — the new player goes into the next slot that isn't reserved, and the
  reservation keeps the position it was made on.
  - The queue now lays the four slots out by placing reservations at their own
    slot and flowing players around them, so a player's position in the match
    list no longer dictates which slot they appear in.
  - When the reserved player finally joins, they land on their reserved slot
    rather than at the end of the row.
  - Adding and moving players, Smart Match and Smart All all count reservations
    the same way, and still refuse once every free slot is spoken for.

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
