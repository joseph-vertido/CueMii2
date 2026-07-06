# BADDIXX CueMii App

**Version 4.0.37**

A comprehensive badminton queuing and court management system built with React and Tailwind CSS.

**Created by Joseph Vertido**

## Features

- **Player Database Management**: Add, edit, delete players with CSV import/export
- **Player Pool**: Searchable and filterable player waiting area with wait time tracking
- **Match Queue**: Create matches and add players manually or use Smart Match
- **Smart Match Algorithm**: Automatically selects players based on wait time and skill level
- **Court Management**: Create, rename, delete courts with active match tracking
- **Gender & Skill Indicators**: Visual indicators for player gender and skill level
- **Persistent State**: All data is saved to localStorage and persists across browser refreshes
- **Reset Function**: Easily reset all data to defaults with the Reset button

## Project Structure

```
baddixx-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── index.js              # Component exports
│   │   ├── Header.js             # App header with logo
│   │   ├── PlayerDatabaseModal.js # Player management modal
│   │   ├── PlayerPool.js         # Player pool section
│   │   ├── MatchQueue.js         # Match creation/management
│   │   ├── CourtsPanel.js        # Courts panel
│   │   ├── LevelBadge.js         # Skill level badge component
│   │   └── GenderIcon.js         # Gender icon component
│   ├── data/
│   │   └── initialData.js        # Initial data and constants
│   ├── hooks/
│   │   ├── useCurrentTime.js     # Custom hook for time updates
│   │   └── useLocalStorage.js    # Custom hook for localStorage persistence
│   ├── utils/
│   │   ├── formatters.js         # Time formatting utilities
│   │   └── csvUtils.js           # CSV import/export utilities
│   ├── App.js                    # Main application component
│   ├── index.js                  # React entry point
│   └── index.css                 # Tailwind CSS + custom styles
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Installation

1. Navigate to the project directory:
   ```bash
   cd baddixx-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Managing Players
1. Click "Manage Players" to open the database modal
2. Add new players with name, gender, and skill level
3. Import players via CSV (columns: name, gender, level)
4. Export player database to CSV

### Using the Player Pool
1. Add players to the pool from the database modal
2. Search and filter players by level
3. Remove players from pool using the X button

### Creating Matches
1. Click "Create Match" to start a new match
2. Select a match and click players to add them
3. Use "Smart Match" to auto-fill based on wait time and skill
4. Move completed matches to available courts

### Managing Courts
1. Add new courts with custom names
2. Rename or delete courts as needed
3. End active matches to return players to pool

## Smart Match Algorithm

The Smart Match feature selects players with the following priority:

1. **Longest Idle Time**: Players waiting longest are prioritized first
2. **Expert Male Exclusivity**: Expert male players can ONLY be grouped with other Expert male players
3. **Expert Female Exclusivity**: Expert female players can ONLY be grouped with other Expert female players
4. **Advanced Male Preference**: Advanced male players prefer to be grouped with other Advanced male players
5. **Mixed Skill Levels**: For non-Expert matches, the algorithm prefers mixing Advanced, Intermediate, and Novice players together
6. **Gender Mode (70/30)**: 70% of the time matches are single-gender (all male or all female), 30% mixed
7. **Gender Balance in Mixed**: When mixed gender, prefers even split (2 male + 2 female)
8. **Skill Level Balance**: Even distribution across skill levels
9. **Leave Empty for Experts**: If not enough Expert players of the same gender available, slots stay empty

### Advanced-Novice Pairing Rules:

- **Advanced 3-match cooldown**: If an Advanced player is matched with a Novice, they cannot be matched with ANY Novice for the next 3 matches
- **Novice 3-match cooldown**: If a Novice player is matched with an Advanced, they cannot be matched with ANY Advanced for the next 3 matches
- **No repeat pairings**: Advanced and Novice players who have been matched together cannot be matched again (ever)

### How it works:

- **Expert matches**: Determined by longest-waiting player or existing players. Expert males only with expert males, expert females only with expert females.
- **Advanced male matches**: When building a male match, Advanced males are prioritized to group together
- **Non-expert matches**: Uses random chance to determine gender mode (30% mixed, 70% single-gender)
- **Mixed gender**: Alternates picks to achieve 2M+2F balance
- **Single gender**: Picks from the same gender as the longest-waiting player

### Example Scenarios:

- **Expert male waiting longest**: Only selects other Expert male players, leaves slots empty if insufficient
- **Expert female in match**: Only adds Expert female players
- **Advanced male in male match**: Prefers other Advanced males before considering other skill levels
- **Advanced matched with Novice**: Both get a 3-match cooldown before they can be matched with Advanced/Novice again

## CSV Format

For importing players, use this CSV format:
```
name,gender,level
John Doe,male,Advanced
Jane Smith,female,Expert
```

- **name** (required): Player name
- **gender** (optional): male/female (default: male)
- **level** (optional): Expert/Advanced/Intermediate/Novice (default: Intermediate)

## Technologies

- React 18
- Tailwind CSS 3
- ES6+ JavaScript

## Data Persistence

All application data is automatically saved to your browser's localStorage:

- **baddixx_players**: Player database
- **baddixx_pool**: Current player pool
- **baddixx_matches**: Queued matches
- **baddixx_courts**: Court configurations and active matches

Data persists across browser refreshes and sessions. Use the **Reset** button in the header to clear all saved data and restore defaults.

## Version History

- **v4.0.37** - Move Cloud Sync to About Modal
- **v4.0.36** - Firebase Cloud Sync
  - Added: Two-way cloud sync for player database using Firebase Firestore
  - Added: Auto-sync when online (configurable)
  - Added: Manual "Sync Now" button in Settings
  - Added: Sync status indicator in header (Syncing/Synced/Offline/Error)
  - Added: Offline support with pending sync when reconnected

- **v4.0.35** - Remove Voice Search
  - Removed: Voice search feature (will revisit with better offline solution)

- **v4.0.34** - Hold-to-Listen Voice Search
  - Changed: Microphone button now uses hold-to-listen (release to stop)
  - Added: Touch support for mobile devices

- **v4.0.33** - License Improvements
  - Added: Day pass license option

- **v4.0.32** - Voice Search in Manage Players
  - Added: Microphone button for voice-to-text search in Manage Players modal
  - Uses Web Speech API (works in Chrome, Edge, Safari)
  - Visual feedback with pulsing red when listening

- **v4.0.31** - Pulsing Glow for Long Wait Times
  - Added: Player cards pulse with colored glow when waiting 10+ minutes
  - Green glow (10-25 min), Yellow glow (25-40 min), Red glow (40+ min)
  - Faster pulse rate as wait time increases

- **v4.0.30** - Prevent Duplicate Court Names
  - Added: Cannot create or rename courts with duplicate names (case-insensitive)

- **v4.0.29** - Responsive Courts Grid
  - Changed: Courts switch to 2 columns when panel is resized above 380px

- **v4.0.28** - Responsive Player Pool Grid
  - Changed: Player cards switch to 1 column when panel is resized below 350px

- **v4.0.27** - Resizable Panels
  - Added: Draggable resize handles between Player Pool, Match Queue, and Courts
  - Panel widths are saved to localStorage and persist across sessions

- **v4.0.26** - Timer Display 1h+
  - Changed: Match queue timers show "1h+" when over 60 minutes
  - Changed: Court timers show "1h+" when over 60 minutes

- **v4.0.25** - Top Button Color
  - Changed: "Top" button in Match Queue from blue to orange

- **v4.0.24** - Search Clear on Mouseup
  - Changed: Search bar clears on mouseup (release) instead of mousedown

- **v4.0.23** - Search Auto-Clear
  - Added: Search bar clears automatically when clicking outside of it

- **v4.0.22** - Split In Match Sections
  - Split "In Match" into "In Match Queue" (yellow) and "In Court" (green)
  - Auto-expand sections when searching if there are matches
  - Auto-collapse when search is cleared

- **v4.0.21** - Simplified Update Instructions
  - Simplified update message to just show instructions
  - Removed folder path configuration and open folder button

- **v4.0.20** - Auto-Scroll to Court
  - Added: Courts panel auto-scrolls to the court when a match is assigned

- **v4.0.19** - Open Folder Button
  - Added: "Open Folder" button to navigate to CueMii folder
  - Added: Editable CueMii folder path (saved to localStorage)
  - Shows folder path in update instructions

- **v4.0.18** - Update Instructions
  - Removed: Self-update button (not possible in browser)
  - Added: Instructions to run update.bat when update is available

- **v4.0.17** - Duplicate Name Handling in Courts
  - Added: Courts panel now shows "LastName F." for players with duplicate first names

- **v4.0.16** - About Modal Improvements
  - Changed: Wider modal with two-column layout
  - Changed: License & Creator info on left, Version & Updates on right
  - Removed: Browser mode check from self-update

- **v4.0.15** - Court Sorting Fix
  - Changed: Courts only re-order when a new match is assigned to a court
  - Clicking "Done" no longer changes court order

- **v4.0.14** - Self Update Button
  - Added: "Attempt Self Update" button when update is available
  - Attempts to run update.bat automatically
  - Shows error with instructions if auto-update fails

- **v4.0.13** - Auto Update Check
  - Changed: Version section now auto-checks for updates when opened
  - Changed: More compact version info display
  - Removed: Manual "Check for Updates" button

- **v4.0.12** - Manage Players Auto-Focus
  - Added: Search box auto-focuses when opening Manage Players

- **v4.0.11** - Update Scripts
  - Added: `update.bat` for Windows - auto-downloads and updates from GitHub
  - Added: `update.sh` for Mac/Linux - auto-downloads and updates from GitHub

- **v4.0.10** - Courts Sorted by Duration
  - Changed: Courts panel now sorted by duration time (longest at top)
  - Active courts appear above empty courts

- **v4.0.9** - Update Checker
  - Added: "Check for Updates" feature in About modal
  - Checks latest version from GitHub repository
  - Shows download link when update is available
  - Direct link to GitHub releases page

- **v4.0.8** - Manage Players Reset Fix
  - Fixed: "Add New Player" section now resets to hidden every time Manage Players is opened

- **v4.0.7** - Manage Players UI Improvement
  - Changed: Add New Player section is now hidden by default (collapsible)
  - Click "+ Add New Player" to expand/collapse the form

- **v4.0.6** - Duplicate Name Handling
  - Added: Players with same "FirstName L." now display as "LastName F." in Match Queue to differentiate them

- **v4.0.5** - Clear Button for Reservations
  - Added: Clear button now appears when a match has reservations (even with no players)

- **v4.0.4** - Reservation Duplicate Prevention
  - Fixed: Players already reserved in one match cannot be reserved in another match

- **v4.0.3** - Warning Threshold Adjustments
  - Changed: Novice Over-Matching Threshold default to 4
  - Changed: Repeat Pairings Threshold default to 4
  - Fixed: "Reset to Defaults" button now uses correct default values (4, 8, 4)

- **v4.0.2** - Updated Warning Thresholds
  - Changed: Novice Over-Matching Threshold default to 6
  - Changed: Novice-to-Novice Threshold default to 8
  - Changed: Repeat Pairings Threshold default to 8
  - Settings now show updated default values

- **v4.0.1** - Reservation Queue Fix
  - Fixed: When top match goes to court and next match has reservations, now properly swaps with empty matches (not just matches with players)
  - Reserved matches will always stay at position 2 or below until all reserved slots are filled

- **v4.0.0** - Major Release
  - Player Reservation System: Click empty slots to reserve players
  - Reserved slot protection with error messages
  - Undo End Match: Restore players, timer, and reports
  - Up/down arrows move reservations with players
  - Reserved matches cannot be at top of queue
  - Auto-reorder when top match has reservations
  - Updated default thresholds: Novice Over-Matching (4), Novice-to-Novice (6), Repeat Pairings (6)
  - Daily Warning Counters (auto-reset each day)
  - Match Queue to Not Present drag & drop
  - Updated player database (149 players)
  - UI/UX improvements throughout

- **v3.3.36** - Reservation Improvements & Undo End Match
  - Changed: Reservation display shows "Waiting for: FirstName L." format
  - Fixed: Clear match button also clears reservations
  - Added: Block adding player to reserved slot (shows error with reserved player name)
  - Added: Undo button after pressing Done on a court
    - Restores players back to the court
    - Restores the court timer
    - Removes the match from history/reports

- **v3.3.35** - Player Reservation System
  - Added: Click empty slot in match to reserve a player
  - Shows "Waiting: [Player Name]" in reserved slots
  - Click X to clear reservation
  - Reservations auto-clear when match moves to court or is deleted
  - Search functionality in reservation dropdown

- **v3.3.34** - Match Reports Name Color Fix
  - Changed: Player names in Match Reports (Individual Player Reports) now use neutral color
  - Changed: Gender indicator dot (●) remains blue/pink colored

- **v3.3.33** - Daily Warning Counters
  - Changed: Warning counters now only consider matches from the current day
  - Novice pairing warnings reset automatically each day
  - Repeat pairing warnings reset automatically each day
  - Match History is preserved but only today's matches count for warnings

- **v3.3.32** - Updated Player Database & Match Queue Drag to Not Present
  - Updated: Default player database now uses baddixx_players_20260211.csv (149 players)
  - Added: 12 new players (Drix Banzuela, Jason Yu, Jet Santos, Jia Chen, Kay Joson, Mark Bal, Carmelo Arada, Renz, Salah, Sazid Chowdhury, Renz Cruz, Mark Abellon)
  - Added: Can drag player cards from Match Queue directly to Not Present section

- **v3.3.31** - Check-In Button Text Update
  - Removed: Checkmark (✓) from Check-In button

- **v3.3.30** - Not Present 2-Column Layout
  - Changed: Player cards in Not Present section now display in 2 columns

- **v3.3.29** - Not Present Section Alphabetical Grouping
  - Removed: Gender icon from Not Present cards
  - Changed: Names now use single neutral color instead of pink/blue
  - Added: Names grouped by first letter with section headers (A, B, C, etc.)
  - Only letters with players are shown

- **v3.3.28** - Not Present Section Redesign
  - Changed: Single column layout instead of 2 columns
  - Removed: Player level from Not Present cards
  - Changed: Player Name, Check-In button, and X button all on one line
  - Names displayed in alphabetical order

- **v3.3.27** - Player Database UI Polish
  - Added: Separator line between Add New Player and Search sections
  - Changed: Search bar is now smaller (more compact)
  - Changed: "Search" label is now more prominent (cyan color, bold)

- **v3.3.26** - Player Edit Propagation
  - Fixed: Editing a player's name, gender, or level in the Database now automatically updates:
    - Player Pool (Available players)
    - Not Present section
    - Match Queue (players in pending matches)
    - Courts (players in active matches on courts)

- **v3.3.25** - New Player Highlight Behavior
  - Changed: When a newly added player is added to the pool, they are no longer highlighted or shown at the top
  - Player is treated like other players in the database after being added to pool

- **v3.3.24** - Player Name Formatting
  - Added: New player names are automatically converted to Title Case (e.g., "john smith" → "John Smith")
  - Added: Letter filter resets to "All" after adding a new player

- **v3.3.23** - Multiple UI/UX Improvements
  - Reports: Auto-selects today's date if data exists, otherwise "All Time"
  - Match History: Auto-selects today's date if data exists, otherwise "All Dates"
  - Player Database: Clears search bar after adding a new player
  - Player Database: Reordered Add Player section (Gender → Level → Name → Add)
  - Player Pool: Added clear button (X) for search bar
  - Player Pool: Press Enter in search to check-in player if only 1 match in Not Present

- **v3.3.22** - Quick Add to Pool with Enter Key
  - Added: Press Enter in Player Database search to add player if exactly 1 match
  - Only works if the player is not already in the pool
  - Search bar clears automatically after successful add

- **v3.3.21** - Match Queue UI Adjustments
  - Changed: Select button now appears before Courts dropdown in Match Queue
  - Updated: Average wait time color thresholds:
    - Gray: Less than 20 minutes
    - Yellow: 20-29 minutes
    - Orange: 30-39 minutes
    - Red: 40+ minutes

- **v3.3.20** - Match Average Wait Time Fix v2
  - Fixed: Average wait time now correctly looks up player's joinedAt from pool
  - Position: Average wait time (⏱ Xm) now appears before player count (3/4)

- **v3.3.19** - Match Average Wait Time Fix
  - Fixed: Average wait time now correctly uses player's joinedAt timestamp
  - Changed: Average wait time now appears before player count (⏱ 15m then 3/4)

- **v3.3.18** - Match Average Wait Time
  - Added: Each match now shows the average combined wait time for all players in that match
  - Displayed as "⏱ Xm" next to the player count (e.g., "3/4 ⏱ 15m")
  - Color-coded: gray (<10m), yellow (10-19m), orange (20-29m), red (30m+)

- **v3.3.17** - Match History Name Filter
  - Added: Player name filter in Match History - search by name to show only matches with that person
  - Shows filtered match count when filters are active
  - Fixed: Add/Remove to Pool no longer resets the A-Z letter filter

- **v3.3.16** - A-Z Filter Improvements
  - Changed: A-Z letter filter now fits in one line (smaller gaps/widths)
  - Changed: Clicking an already-selected letter now deselects it (shows all)
  - Changed: "All" button is now wider for better visibility

- **v3.3.15** - Player Database UX Enhancements
  - Added: Search bar auto-focuses after Add/Remove to Pool
  - Changed: Add New Player section now has cyan/teal gradient background
  - Added: "New" label to the left of the new player name text box
  - Added: A-Z letter filter buttons below the search bar
  - Clicking a letter filters to show only players whose names start with that letter

- **v3.3.14** - Player Database UI Improvements
  - Fixed: Table headers now vertically centered
  - Added: "Search" label on the left of the search bar
  - Changed: Clicking Add/Remove to Pool now clears the search bar
  - Fixed: Editing a player no longer skews column widths (fixed column widths)

- **v3.3.13** - Auto-Reset on New Day
  - Added: Session data automatically resets at the start of a new day
  - Clears: Player Pool, Not Present, Matches, Courts, Wait Time History
  - Preserves: Player Database, Match History, Settings

- **v3.3.12** - Match Queue Names Uppercase
  - Changed: Player names in Match Queue section are now displayed in ALL CAPS

- **v3.3.11** - Collapsible In Match Section
  - Added: "In Match" section in Player Pool is now collapsible
  - Changed: Collapsed by default to save space

- **v3.3.10** - Match History Date Display
  - Added: Date now shown for each match in Match History (e.g., "Jan 27")
  - Improved: Cleaner time display format (start → end)

- **v3.3.9** - Settings Modal
  - Added: Settings button in header (gear icon)
  - Added: Settings modal to configure warning thresholds:
    - Novice Over-Matching Threshold (default: 2)
    - Novice-to-Novice Threshold (default: 3)
    - Repeat Pairings Threshold (default: 3)
  - Settings are persisted in localStorage

- **v3.3.8** - Novice-to-Novice Warning
  - Added: When adding a novice to a match with an existing novice, warns if the novice being added has played with 3+ novices already

- **v3.3.7** - Smart Match Highlight Duration
  - Changed: Smart match glowing highlight for players reduced from 3 minutes to 30 seconds

- **v3.3.6** - Return Button Size Adjustment
  - Changed: Return to Queue button is now 1/5 width (icon only), Done button takes remaining 4/5

- **v3.3.5** - Return Button Size Adjustment
  - Changed: Return to Queue button is now 1/4 width (icon only), Done button takes remaining space

- **v3.3.4** - Reports Graphs & UI Improvements
  - Added: Daily charts in Overall Reports showing Unique Players, Total Matches, and Avg Wait Time per day
  - Changed: Moved "Return to Queue" button next to "Done" button in courts
  - Fixed: Returning match from court to queue no longer creates unnecessary new match
  - Changed: Minimum average wait time now 15 minutes (was 20)
  - Changed: "Clear All Timers" now also resets average wait time to 15 minutes

- **v3.3.3** - Repeat Pairings Warning
  - Added: "REPEAT PAIRINGS" warning when a player being added/moved has played with existing match players 3+ times
  - Shows list of players and how many times they've played together

- **v3.3.2** - Move Player Warning
  - Added: Novice over-matching warnings now also apply when moving players between matches

- **v3.3.1** - Warning Header Update
  - Changed: Novice warning dialogs now show "⚠️ NOVICE OVER-MATCHING ⚠️" as the header

- **v3.3.0** - Novice Pairing Warnings
  - Added: When adding a novice player, warns if any existing players in match have played with 2+ novices
  - Added: When adding a non-novice player to a match with novices, warns if that player has played with 2+ novices already

- **v3.2.9** - Removed Manual Selection Warnings
  - Removed: Repeat Pairings warning
  - Removed: Played with Novice >2 times warning
  - Removed: Players with 2+ novices warning

- **v3.2.8** - Manual Selection Warning Enhancement
  - Added: Warning when selecting players showing if any players already in the match have played with 2+ unique novices
  - Shows which novice players they have played with

- **v3.2.7** - Reports Time Tracking Clarification
  - Fixed: Player Statistics time columns (<20m, 20-30, 30-40, >40m) now correctly track wait time (time in pool before getting on court)
  - Added: Court Timer Duration section showing match duration distribution with counts for <20m, 20-30m, 30-40m, >40m ranges
  - Added: Average court duration display in the section header

- **v3.2.6** - Overall Report Enhancements
  - Added: Gender breakdown showing Male/Female player counts
  - Added: Level breakdown showing Expert/Advanced/Intermediate/Novice player counts
  - Fixed: Player Statistics time columns (<20m, 20-30, 30-40, >40m) now track match duration (time on court) instead of wait time

- **v3.2.5** - Advanced-Novice 3-Match Cooldown Fix
  - Fixed: Advanced-Novice 3-match cooldown now works correctly
  - Previously checked `lastNoviceMatchAt > 0` which failed when first novice match was at playCount=0
  - Now uses `pairedNovices.length > 0` to detect if player has ever matched with novice
  - Same fix applied to Novice-Advanced cooldown check

- **v3.2.4** - Bug Fixes
  - Fixed: Player names in Individual Report match lists now colored blue/pink based on gender
  - Fixed: Intermediate-Novice 2-in-a-row restriction now works correctly (was allowing consecutive novice matches)
  - Fixed: Wait time of 0 minutes now correctly counted in <20m column (was being excluded)

- **v3.2.3** - Smart Match Fixes & Intermediate-Novice Rules
  - Fixed: Smart match player tracking now stored directly on matches (not lost when players leave)
  - Fixed: Advanced-Novice 3-match cooldown now works correctly
  - Added: Intermediate-Novice restrictions:
    - Cannot match with any novice more than twice total
    - Cannot match with the same novice twice
    - Cannot match with novice 2 times in a row
  - Added: Manual selection alerts:
    - Warns if adding player who has played with match players 2+ times
    - Warns if player has played with any novice more than 2 times

- **v3.2.2** - Reports Enhancements
  - Player Statistics table: added wait time columns (<20m, 20-30m, 30-40m, >40m) with color coding
  - Level Combinations: now color coded (Expert=purple, Advanced=orange, Intermediate=blue, Novice=green)

- **v3.2.1** - Simplified Match Queue Slots
  - Reverted to simple minimum of 7 match slots
  - Auto-creates a new match whenever the last match has at least 1 player assigned
  - Removed complex dynamic formula that was causing issues

- **v3.2.0** - Dynamic Queue Slots Race Condition Fix
  - Fixed race condition causing extra matches when assigning to courts or clicking Done
  - Added debounce (150ms) to let state settle before calculating minimum slots
  - Added re-entrancy guard to prevent multiple concurrent match creations
  - Uses matches.length instead of full matches array for more stable dependency tracking

- **v3.1.9** - Dynamic Queue Slots Fix
  - Fixed: Match queue slots now correctly count players on courts when calculating minimum slots
  - Previously only counted players in pool + matches, now includes players actively playing on courts

- **v3.1.8** - Reports Level Display Updates
  - Individual Reports: level badge now appears before the player name in the sidebar
  - Player Statistics table: level badge removed from name, added as separate sortable column

- **v3.1.7** - Level Badges & Dynamic Queue Slots
  - Player Statistics table: level badge (E/A/I/N) now shown next to player names
  - Individual Reports: level badge shown next to player names in the left sidebar
  - Match Queue slots: minimum now calculated as ceil((totalPlayers/4) - totalCourts + 2) instead of fixed 7

- **v3.1.6** - Reports Enhancements
  - Player Statistics table: all columns now sortable (click header to sort)
  - Overall Report: added average wait time to summary stats
  - Overall Report: added Wait Time Distribution section (<20m, 20-30m, 30-40m, >40m)
  - Overall Report: Daily Statistics now shows for selected date (not hidden)
  - Individual Player: added max wait time to daily statistics
  - Individual Player: added Activity Timeline graph showing playing vs waiting periods

- **v3.1.5** - PDF Export Always Light Mode
  - PDF exports now always render in light mode regardless of app theme
  - Dark mode classes are converted to light mode equivalents when exporting
  - Produces clean, readable PDFs with white backgrounds and dark text

- **v3.1.4** - PDF Export Using Browser Print
  - Switched to browser's native print function for PDF export (better text rendering)
  - PDF export now opens print dialog - select "Save as PDF" to save
  - Full report content is captured with proper text positioning
  - Selected player in Match Reports uses level color with yellow border

- **v3.1.3** - PDF Export Improvements & Player Highlight Fix
  - PDF export now captures full report content (not just visible area)
  - PDF export expands all scrollable sections for complete capture
  - Selected player in Match Reports now uses level color with yellow border (instead of purple)

- **v3.1.2** - Reports Color Updates & PDF Export
  - Updated level colors in reports: Expert=purple, Advanced=orange, Intermediate=blue, Novice=green
  - Smart Match Usage by Player now shows player level identifier
  - Added PDF export for Overall Reports
  - Added PDF export for Individual Player Reports
  - Gender Combinations section now shows blue for male, pink for female in labels
  - Individual Player Gender Combinations uses blue/pink gender colors

- **v3.1.1** - Reports Enhancements & Match History Improvements
  - Match History now shows both start and end times for completed matches
  - Reports: Date filter now applies to Individual Player stats
  - Reports: Player list only shows players with data for selected date
  - Reports: Daily reports only show for selected date when filtered
  - Reports: Individual Player Daily Reports show player levels with colors
  - Reports: Daily reports show start and end times for each match
  - Reports: Added player statistics table when specific date is selected (check-in time, games, smart/manual matches, level breakdown)
  - Reports: Smart Match Usage by Player now colors names by gender (blue/pink)
  - Reports: People Played With section now colors names by gender (blue/pink)
  - Reports: Played with Levels section uses consistent level colors

- **v3.1.0** - Reports Section
  - Added Reports button in header
  - Reports modal with date filtering (all time or specific date)
  - Clear all reports button
  - Overall Reports tab:
    - Summary stats (total matches, unique players, smart matches used)
    - Gender combinations count (e.g., 4M/0F, 2M/2F)
    - Level combinations count
    - Daily statistics (games per day, players with X games that day)
    - Smart Match usage per player
  - Individual Player Reports tab:
    - Player selection list with search
    - Overall statistics:
      - Total games, average wait time, smart match count
      - Times played with each level
      - Gender combinations played
      - People played with and frequency
    - Daily reports:
      - Matches played each day
      - Wait times between matches
      - Smart match usage per day

- **v3.0.3** - UI Improvements & Smart Match Algorithm v23
  - Made floating Up arrow in Match Queue more visible (larger, colorful, bouncing animation)
  - Average wait time color coding: green (20-30m), yellow (30-40m), red (40m+)
  - Smart Match Algorithm v23:
    - Increased mixed doubles rate from 30% to 40%
    - Expert players now only do Regular Doubles unless match already has mixed genders
    - If longest-waiting player is an Expert, forces Regular Doubles for that match

- **v3.0.2** - Bug Fixes & UI Improvements
  - Fixed bug with up/down arrows not working correctly for returned matches
  - Not Present players now have subtle red border
  - "Not Present" text is now red
  - Added floating Up arrow button when Match Queue is scrolled
  - High Priority Match warning now scrolls to top and highlights eligible matches with pulsating green border for 10 seconds when cancelled
  - Average wait time shows "1h+" when over 60 minutes
  - Duplicate player names are no longer allowed in database

- **v3.0.1** - Encoded License Keys
  - License keys are now encoded strings
  - No format hints shown to users
  - Simplified license input UI

- **v3.0.0** - Licensing System
  - Added license key requirement on first app launch
  - License saved to browser localStorage
  - About section showing license info with edit capability
  - License expiration check - app becomes unusable when expired
  - Player database limit enforced by license
  - CSV import respects license player limit
  - Hidden players warning when database exceeds license limit

- **v2.9.12** - Auto-scroll to Returned Match
  - Match Queue now automatically scrolls to show a match when it's returned from a court

- **v2.9.11** - Match Validation & Returned Match Highlight
  - Cannot assign a match to court if less than 4 players
  - Shows "Need 4 players to assign court" message for incomplete matches
  - Player counter (x/4) shows bold red with "✗" if players > 0 but < 4
  - Matches returned from courts have pulsating red border for 30 seconds

- **v2.9.10** - Brighter Court Highlight
  - Made court pulsating highlight a brighter yellow color
  - Added glow effect to court highlight for better visibility

- **v2.9.9** - Smart Match Pulsating Highlight
  - Smart matched players now have a pulsating golden glow animation
  - Animation lasts for 3 minutes after smart matching

- **v2.9.8** - Match Queue Management Improvements
  - Delete match now shows confirmation warning with player names
  - Added "Clear All" button in Match Queue header to clear all players from all matches (with confirmation)
  - Added up/down arrows on each match to swap players with adjacent matches

- **v2.9.7** - Removed Match Drag & Drop Feature

- **v2.9.4** - Match History Export Simplified
  - Simplified Excel export columns: Match #, Status, Court, Player 1-4 (names only), Start Time, End Time, Duration

- **v2.9.3** - Match History Export
  - Added "Export Excel" button to Match History modal
  - Exports match history to Excel spreadsheet (.xlsx)
  - Each date gets its own tab/worksheet

- **v2.9.2** - Player Database UX Improvement
  - After adding a new player, the player list automatically scrolls to the top

- **v2.9.1** - Player Database Visual Feedback
  - Newly added players now have a yellow background highlight
  - Newly added players appear at the top of the list (most recent first)
  - When the Player Database modal is closed, highlighting and sorting reset to default

- **v2.9.0** - Court Assignment Visual Feedback
  - Newly assigned courts now have a pulsating yellow border highlight for 30 seconds
  - Animation helps users quickly identify which court just received a match

- **v2.8.9** - Smart Match Algorithm Updates
  - New rule: If a Novice is matched with an Advanced, the Novice cannot match with ANY Advanced for 3 matches
  - New rule: If an Advanced is matched with a Novice, the Advanced cannot match with ANY Novice for 3 matches
  - Removed: Old "Advanced can pair with Novice once per 3 matches" rule
  - New preference: Advanced male players prefer to be grouped with other Advanced male players
  - Both Advanced and Novice now track their pairings to prevent repeat matches

- **v2.8.8** - Smart Match Adjustment
  - Changed mixed doubles probability from 25% to 30%

- **v2.8.7** - UI Revert
  - Reverted court button colors in Match Queue to original lighter shades

- **v2.8.6** - Smart Queue All Enhancement
  - Smart Queue All button no longer disabled when all matches are complete (only disabled when no available players)
  - Smart Queue All now creates new matches aggressively while players remain, even if existing incomplete matches couldn't be filled

- **v2.8.5** - UI & Smart Queue All Fixes
  - Light mode: Darker green and yellow for court buttons in Match Queue
  - Reset button now also clears "Not Present" section and wait time history
  - Smart Queue All now continues creating new matches until no players remain in Available section

- **v2.8.4** - Smart Queue All & Court Assignment Improvements
  - Fixed Smart Queue All to properly create new matches when all existing matches are full
  - Smart Match highlight timer changed from 2 to 3 minutes
  - Added warning when assigning a match to a court if a lower ID complete match can also use that court
  - Added average wait time display in Match Queue header (minimum 20 minutes)
  - Court timer now shows in bold when it turns red (35+ minutes)
  - Changed "Present" button text to "Check-In"

- **v2.8.3** - UI Improvements
  - Player Database modal now stretches to full screen height for better player list viewing
  - "Available" section header changed to brighter blue color
  - Not Present players now sorted alphabetically by name

- **v2.8.2** - UI Polish
  - Condensed "Add New Player" section in Player Database (single row, no labels)
  - Improved light mode colors in Player Pool (less washed out)
  - Not Present section player names now blue/pink for male/female
  - Court names in Match Queue changed from pastel teal to stronger green

- **v2.8.1** - Not Present Section Fixes
  - Player Database "Add to Pool" button now changes to "Remove" when player is in Not Present section
  - Not Present section moved between Available and In Match sections
  - Clear Pool button now counts both Available and Not Present players

- **v2.8.0** - Not Present Section & Smart Match Updates
  - Added "Not Present" section in Player Pool
    - Players added from database go to Not Present first
    - Click "Present" button or drag to move to Available
    - Players in Not Present have no timer/game count
    - Timer starts when moved to Available
    - Drag back to Not Present with confirmation warning
  - Smart Match highlight changed to yellow ring border (2 min duration)
  - Smart Queue All now clears all previous highlights
  - Smart Queue All creates new matches until no players left
  - Updated Advanced/Novice pairing rules:
    - Advanced can pair with Novice once per 3 matches
    - Advanced cannot pair with same Novice twice ever
    - Removed 2-in-a-row restriction
  - Creator/version text slightly larger and more visible
  - "Available" and "In Match" text more visible in light mode

- **v2.7.3** - Match History Bug Fix
  - Fixed "Rendered more hooks than during the previous render" error
  - Moved React hooks before early return in MatchHistoryModal component

- **v2.7.2** - Smart Queue All Feature
  - Added "Smart All" button in Match Queue header - runs Smart Match on all incomplete matches
  - Added "Undo All" button to undo Smart Queue All action
  - Players added via Smart Match now have a purple/pink gradient highlight for 5 minutes
  - After 5 minutes, highlight returns to normal blue/pink based on gender
  - Smart Queue All silently skips matches that can't be filled (no alerts)

- **v2.7.1** - Bug Fixes
  - Fixed: Players removed from pool while on court now also removed when match is returned to queue
  - Fixed: Court circle starts green when match is transferred (under 20 min)
  - Fixed: Court timer is green for matches under 20 min (consistent with circle)
  - Fixed: Match History modal display issue

- **v2.7.0** - Major UI/UX Improvements
  - Smaller header buttons (History, Reset, Manage Players, Theme toggle)
  - Added email to owner credits: jrvertido@gmail.com
  - Player Pool: Gray header in light mode, "X players total" text, smaller search/filter
  - Courts: Removed green highlight, yellow highlight at 20+ min, red at 35+ min
  - Courts: Return button moved to header as yellow arrow, End button now "Done" with checkmark
  - Courts: Removed blue/pink player backgrounds, narrower panel (280px)
  - Match Queue: Removed green highlight for completed matches, min matches now 7
  - Match Queue: Click outside to deselect match, idle time shows "1h+" for over 1 hour
  - Match History: Date filter replaces status filter, "Clear History" button text
  - Player Database: Smaller header
  - Reset button no longer clears Match History
  - Players removed from pool while on court don't return when match ends

- **v2.6.7** - UI Polish & Smaller Buttons
  - Made green (complete) and yellow (waiting) match highlights more subtle in light mode
  - Reduced Match Queue header button sizes (matchID, Select, Smart, Undo, Clear)
  - Changed "Smart Match" button text to just "Smart" for compactness
  - Reduced gaps between header elements
  - Smaller icons throughout header row

- **v2.6.6** - Comprehensive Light Mode Fixes
  - Fixed Match History: Match ID badge, time/duration text, player level indicators
  - Fixed Match Queue: Player count (4/4 ✓), undo button, assign-to-court buttons
  - Fixed Match Queue: Player cards with proper backgrounds and text colors
  - Fixed Match Queue: Select button with light mode styling
  - Fixed Player Pool: LevelBadge now uses dark text in light mode
  - Fixed Player Pool: Idle time uses darker colors in light mode
  - Added getWaitTimeColorLight utility for proper light mode time colors

- **v2.6.5** - Light Mode Text Readability Fixes
  - Fixed "Waiting for: Courts" text - now dark amber in light mode
  - Fixed Court header names - now dark text in light mode
  - Fixed Courts dropdown button and menu in Match Queue
  - Fixed player cards in Courts panel for light mode
  - Added text-white to Return/End buttons for consistency

- **v2.6.4** - More Vibrant Light Mode Colors
  - Stronger borders and shadows in light mode
  - More saturated gradient headers (cyan, orange, emerald tints)
  - Better contrast for player cards and match cards
  - Improved button states and inputs

- **v2.6.3** - Condensed Match History
  - Single-row layout for each match entry
  - Smaller player cards with abbreviated names (FirstName L.)
  - Compact filter tabs and header
  - Supports light/dark mode

- **v2.6.2** - Undo Button Cleanup
  - Clear button now removes the Undo button for that match
  - Delete button also removes the Undo button for that match

- **v2.6.1** - Clear Timers & Smart Match Undo
  - Clear Timers now also resets timers for players in the Match Queue
  - Added "Undo" button after Smart Match - appears on the matched card
  - Undo removes the players that were just added by Smart Match
  - Undo is available until another Smart Match is performed

- **v2.6.0** - Light/Dark Mode Toggle
  - Added theme toggle button in header (sun/moon icon)
  - Theme preference saved to localStorage
  - Light mode: Clean white/gray backgrounds with good contrast
  - Dark mode: Original dark slate backgrounds (default)
  - All panels (Player Pool, Match Queue, Courts) support both themes

- **v2.5.9** - Expert exclusion from mixed fallback (Algorithm v22)
  - Expert players are now excluded from mixed doubles fallback
  - When regular doubles can't complete and falls back to mixed, Experts are skipped
  - Experts can still be selected in initial regular doubles or random mixed matches

- **v2.5.8** - Improved mixed doubles fallback (Algorithm v21)
  - Mixed doubles fallback now works with existing players too
  - Example: Match has 2M → can't find more M → adds F to make 2M+2F
  - Only falls back if current composition allows (≤2 of each gender)
  - Example: Match has 3M → can't switch to mixed (would exceed 2M limit)

- **v2.5.7** - Smart Match mixed doubles fallback (Algorithm v20)
  - If regular doubles (4M or 4F) can't be completed, falls back to mixed doubles
  - Example: 3M found → switches to mixed → adds 1F to make 3M+1F
  - Still prioritizes longest idle time throughout
  - Only falls back for empty matches (mid-match composition stays fixed)

- **v2.5.6** - Simplified Smart Match Algorithm v19
  - ALWAYS prioritizes longest idle time - no exceptions
  - Picks players strictly in order of wait time
  - No fallback to alternate genders or modes
  - If no eligible players found, leaves rest of match blank
  - Much simpler and more predictable behavior

- **v2.5.5** - Improved Player Database UI
  - Add/Remove from Pool now proper buttons instead of text links
  - Larger click targets with background colors and borders
  - "+ Add to Pool" button in cyan
  - "− Remove" button in orange

- **v2.5.4** - Smart Match partial fill (Algorithm v18)
  - If match can't be completed, adds whoever is available and leaves rest blank
  - Tracks best result across all attempts (regular, alternate gender, mixed)
  - Shows "Partial Fill" info message explaining why match is incomplete
  - Only shows error if NO players could be added at all

- **v2.5.3** - Smart Match tries players with same queue time (Algorithm v17)
  - If first player is blocked by restrictions, tries other players who joined within 1 minute
  - Helps when Expert or Advanced with restrictions is first in queue
  - Falls back gracefully through: same-time alternatives → alternate gender → mixed doubles

- **v2.5.2** - Smart Match tries alternate gender (Algorithm v16)
  - When regular doubles fails with preferred gender, tries alternate gender
  - Order: Preferred gender (4M/4F) → Alternate gender (4F/4M) → Mixed (2M/2F)
  - Better handles cases where one gender has restrictions blocking matches

- **v2.5.1** - Smart Match improvements
  - Increased mixed doubles random rate from 20% to 25%
  - Added failure explanation popup when Smart Match cannot fill a match
  - Shows which modes were tried and specific reasons for failure
  - Displays available male/female counts

- **v2.5.0** - New Smart Match Algorithm v15 (MAJOR)
  - Complete rewrite of Smart Match algorithm
  - Rules:
    1. Higher idle time = higher priority
    2. Prefer Regular Doubles (4M or 4F) or Mixed Doubles (2M/2F)
    3. Regular doubles preferred over mixed doubles
    4. Randomly make ~20% of matches mixed doubles
    5. Expert players only with experts (unless non-experts already in match)
    6. Balance player levels (Expert > Advanced > Intermediate > Novice)
    7. Advanced can only pair with Novice max 2 times total
    8. Advanced cannot pair with Novice 2 times in a row
    9. If conditions can't be met, leave match blank
  - Added lastMatchedNovice tracking for rule 8

- **v2.4.5** - Improved Reset button
  - Clearer confirmation dialog listing what will be cleared
  - Clears: Player Pool, Matches, Courts, Match History
  - Preserves: Player Database
  - Also resets UI state (filters, selections)

- **v2.4.4** - Removed playCount prioritization (Algorithm v14)
  - Smart Match no longer prioritizes players with least game counts
  - Players are now sorted purely by idle time (longest wait first)
  - PlayCount is still tracked and displayed but not used for matching

- **v2.4.3** - Updated idle time color thresholds
  - 0-10 minutes: Gray
  - 10-25 minutes: Green
  - 25-40 minutes: Yellow
  - 40+ minutes: Red

- **v2.4.2** - Smart Match gender fallback (Algorithm v13)
  - If not enough players can be selected due to gender restrictions (mixed/same), 
    bypasses gender rules and fills match based on playCount/waitTime priority
  - Still respects Advanced+Novice restriction (Rule 8)

- **v2.4.1** - Idle time color coding
  - 0-10 minutes: Gray
  - 10-20 minutes: Green
  - 20-30 minutes: Yellow
  - 30+ minutes: Red
  - Applied to both Player Pool and Match Queue player cards

- **v2.4.0** - Court button warnings & badminton icon
  - Court buttons turn amber if higher matchID matches want that court
  - Added tooltip "Other matches are waiting for this court" for amber buttons
  - Changed game counter icon from 🎮 to 🏸 (badminton racket)

- **v2.3.9** - UI improvements
  - Creating new match no longer auto-selects it
  - Made remove player X button bigger (w-4 h-4 with padding)
  - Added hover background to X button for better visibility

- **v2.3.8** - Smart court assignment filtering
  - Matches with preferred courts only show those courts as options
  - Matches without preferences hide courts that lower-numbered matches are waiting for
  - Court buttons styled amber for preferred matches, teal for others
  - Shows "Preferred courts busy" or "No courts available" when no options

- **v2.3.7** - Fixed preferred court highlight color
  - Changed from teal to amber/yellow for better visibility
  - Preferred court matches now always show amber highlight (even when complete)
  - Label banner also updated to amber

- **v2.3.6** - Preferred court highlight color
  - Matches with preferred courts now have teal background/border
  - Selected matches with preferences show teal highlight instead of orange

- **v2.3.5** - Court assignment warnings
  - Warns when assigning match to non-preferred court (if preferences set)
  - Warns when assigning match to court that lower-numbered matches are waiting for
  - Shows list of players waiting for that court in warning

- **v2.3.4** - Added idle timer to match queue player cards
  - Shows wait time (⏱) next to play count on each player card in matches

- **v2.3.3** - Removed auto-select behavior
  - Smart Match no longer auto-selects next empty match
  - Clear no longer auto-selects the cleared match
  - Add player no longer auto-selects next empty match when match completes

- **v2.3.2** - Changed label from "Preferred" to "Waiting for"

- **v2.3.1** - Multiple Court Preferences
  - Can now select multiple preferred courts per match
  - Checkbox dropdown for court selection
  - Shows count of selected courts in button
  - Label displays all selected courts separated by commas
  - Click outside dropdown to close

- **v2.3.0** - Preferred Court Selection
  - Added dropdown to select preferred court for each match
  - Preferred court shows as teal label at top of match card
  - Click X to clear preference
  - Preference persists with match data

- **v2.2.2** - Fixed match history double logging bug
  - Refactored endMatch function to prevent duplicate entries

- **v2.2.1** - Reset button now clears match history

- **v2.2.0** - Match History Feature
  - New Match History popup accessible from header
  - Records all completed matches (with court name and duration)
  - Records all deleted matches
  - Filter by All, Completed, or Deleted
  - Shows player details, match number, timestamp
  - Clear History button to remove all history

- **v2.1.6** - Fixed court card heights
  - Empty and filled courts now have identical heights
  - Added fixed heights (h-7) to player slots
  - Added fixed height (h-6) to button/available area

- **v2.1.5** - Court layout consistency (initial attempt)

- **v2.1.4** - Increased minimum match queue from 4 to 6

- **v2.1.3** - Reverted button sizes on courts (Return and End same size)

- **v2.1.2** - UI Improvements & Auto-Create Matches
  - Return button on courts now smaller (just ↩ icon)
  - End Match button now larger and more prominent
  - Auto-creates matches to maintain minimum of 4 at all times
  - Matches auto-created on app load and after deletions

- **v2.1.1** - Match ID Visibility
  - Match ID now more visible with orange coloring
  - Increased text size from text-xs to text-sm
  - Added orange background and border styling

- **v2.1.0** - Drag and Drop Support
  - Drag player cards from Available pool to matches
  - Drag player cards from matches back to Player Pool
  - Drag player cards between different matches
  - Visual feedback when dragging over valid drop targets
  - Cursor changes to grab/grabbing during drag operations

- **v2.0.9** - Fixed Courts Layout Overlap
  - Added top padding to court content area (pt-1.5)
  - Increased court header padding (py-1.5)
  - Added subtle border between header and content
  - Increased status indicator dot size

- **v2.0.8** - Courts Text Size Adjustments
  - Court header "Courts" text increased to text-lg
  - Court count text increased to text-sm
  - Individual court names increased to text-sm
  - Player card names decreased to text-sm
  - Level initials decreased to text-xs
  - Slightly reduced player card padding

- **v2.0.7** - Larger Courts Player Cards
  - Increased player card padding (px-2.5 py-1.5)
  - Player name text increased to text-base
  - Level initial text increased to text-sm
  - Increased card gap to gap-1.5

- **v2.0.6** - Courts Player Card Improvements
  - Added level initials (E/A/I/N) back to player cards on courts
  - Level initials color-coded (purple/orange/cyan/green)
  - Player name text size increased from text-xs to text-sm

- **v2.0.5** - Ultra-Compact Courts (6 courts visible)
  - Minimized header to single line with inline add court
  - Player names shortened to "FirstName L." format
  - Removed gender icons, just colored text backgrounds
  - Removed button icons, text only
  - Minimal spacing throughout (1.5px gaps)
  - Empty courts show just "Available" text

- **v2.0.4** - Condensed Courts Section
  - Reduced header, padding, and spacing throughout courts panel
  - Smaller player cards with compact layout
  - Smaller action buttons (Return/End)
  - Empty courts take less vertical space
  - More courts visible on screen at once

- **v2.0.3** - Courts UI Improvements
  - Delete court now shows confirmation dialog
  - Removed level badges (E/A/I/N) from player cards on courts
  - Player cards on courts now have gender-colored backgrounds (blue/pink)

- **v2.0.2** - Game Counter Fix
  - PlayCount now only increments on End Match (not when moving to court)
  - Return to Queue does not increment playCount

- **v2.0.1** - Return Match to Queue
  - Added "Return" button on courts to send match back to queue
  - Match keeps the same ID when returned to queue
  - Players stay in the match (not returned to pool)

- **v2.0.0** - Major Version Update
  - Added sequential Match ID starting from #1 (ascending)
  - Match ID displayed in Match Queue header
  - Reset function now resets match counter to 1

- **v1.8.2** - Reverted level abbreviations back to single letters (E, A, I, N)

- **v1.8.1** - Match Queue Player Card Cleanup
  - Removed gender icon (♂/♀) from player cards in Match Queue
  - Changed level abbreviations from single letters to 3-letter: Exp, Adv, Int, Nov

- **v1.8.0** - Match Queue Player Card Colors
  - Male players now have blue background (bg-blue-900/60) with blue border
  - Female players now have pink background (bg-pink-900/60) with pink border
  - Player names are bolder (font-semibold)
  - Level badges are more prominent with borders and stronger colors

- **v1.7.9** - UI Improvements
  - Clear button on match now also selects that match
  - Player Pool now shows 2 columns of players for better visibility
  - Player cards made more compact to fit 2-column layout
  - Player Pool width increased from 350px to 450px

- **v1.7.8** - Auto-select First Incomplete Match
  - When a match becomes complete (4 players), automatically selects the first incomplete match
  - Works for both Smart Match and manual player additions
  - If no incomplete matches exist, selection is cleared

- **v1.7.7** - Smart Match Algorithm v12 (Bidirectional Gender Fallback)
  - Rule 15: If same-gender (4M/4F) not possible → try mixed (2M + 2F)
  - Rule 16: If mixed (2M + 2F) not possible → try same-gender (4M/4F)
  - Ensures maximum match creation regardless of player pool composition

- **v1.7.6** - Smart Match Algorithm v11 (Same-Gender Fallback)
  - NEW Rule 15: If same-gender match (4M or 4F) not possible, falls back to mixed-gender (2M + 2F)
  - Applies to both empty matches and matches with existing players
  - Example: If random selects "same-gender male" but only 2 males available, tries mixed instead

- **v1.7.5** - Smart Match Algorithm v10 (Real-time Gender Mode)
  - Rules 10 & 11 now use real-time random selection (50/50 chance)
  - Previously used static match ID to determine gender mode
  - Now each Smart Match call randomly decides same-gender vs mixed-gender

- **v1.7.4** - UI Improvements
  - Match Queue: Complete matches (4 players) now show green color scheme
  - Match Queue: Incomplete matches show default orange/slate color scheme
  - Renamed "Clear Idle" button to "Clear Timers"
  - Clear Timers now prompts for confirmation before resetting
  - Player Pool: Split into two sections - "Available" and "In Match"
  - Each section shows player count and has distinct visual styling

- **v1.7.3** - Create Match selects first empty match
  - When clicking Create Match, the first empty match in the list is automatically selected

- **v1.7.2** - Reverted v1.7.1 change
  - New matches are added at the end of the list (original behavior)

- **v1.7.1** - Create Match UX Improvement (reverted)

- **v1.7.0** - Smart Match Algorithm v9 + Clear Idle Times
  - **NEW: Clear Idle Times button** in Player Pool header
    - Resets all player idle times to current time
  - **Smart Match v9 (14 rules)**:
    - 1. Least game counts (primary)
    - 2. Longest idle time (secondary)
    - 3. **1M + 1F rule**: Must complete with another 1M + 1F
    - 4. Expert males only with expert males (EXCEPT rule 3)
    - 5. Expert females only with expert females (EXCEPT rule 3)
    - 6. If < 4 expert males → allow Advanced males
    - 7. If < 4 expert females → allow Advanced females
    - 8. Advanced + Novice only once per Advanced player
    - 9. Prefer mixing Advanced/Intermediate/Novice
    - 10. Half the time: same-gender (4M or 4F)
    - 11. Half the time: mixed-gender
    - 12. Balance by skill level
    - 13. Leave empty if not enough experts
    - 14. Leave empty if not enough players in pool
  - Rule 3 exception allows mixed-gender expert matches

- **v1.6.0** - Smart Match Algorithm v8 (Two-Part Logic)
  - Complete restructure with separate logic for empty vs. existing matches
  - **PART 1: Empty Match (13 rules)**
    - 1.1-1.2: Least game counts, longest idle time
    - 1.3-1.6: Expert gender segregation with Advanced fallback
    - 1.7: Advanced + Novice only once
    - 1.8: Mix Advanced/Intermediate/Novice
    - 1.9-1.10: 50% same-gender, 50% mixed-gender
    - 1.11-1.12: Level balance, mixed requires 2M/2F
    - 1.13: Leave empty if not enough experts
  - **PART 2: Match with Players (7 rules)**
    - 2.1-2.2: Least game counts, longest idle time
    - 2.3: Gender balance (4M, 4F, or 2M/2F only)
    - 2.4: Prefer same or similar levels
    - 2.5: AVOID Advanced + Novice together
    - 2.6: AVOID Advanced + Intermediate together
    - 2.7: Balance levels
  - Fallback: Relaxes level restrictions if no valid players found

- **v1.5.3** - Smart Match Algorithm v7 (Rule 3 as Exception)
  - Reordered rules: Exception rule is now Rule 3
  - Rule 3 EXCEPTION: If match has players, balance gender AND prioritize same/similar levels
    - Same level gets highest priority (+100 score)
    - Adjacent levels get secondary priority (+75, +50)
    - Still balances genders for mixed matches (2M + 2F)
  - Cleaner rule numbering: 4-14 apply to empty matches

- **v1.5.2** - Smart Match Algorithm v6 (Rule 13 as Exception)
  - Rule 13 now functions as an EXCEPTION to all other rules
  - When match already has players:
    - Algorithm first checks existing player composition
    - Prioritizes balancing genders AND levels based on what's already there
    - For expert matches with existing players: fills with same gender experts/advanced
    - For non-expert matches with existing players: balances both gender and level
  - When match is empty: applies normal rules (3-12, 14)
  - Clearer separation of logic between "match has players" and "empty match" scenarios

- **v1.5.1** - Smart Match Algorithm v5 (Refined Rules)
  - Rule 12 changed: Mixed-gender matches now REQUIRE even split (2M + 2F), not just prefer
  - Rule 13 enhanced: More explicit gender balancing based on existing players
  - If match has males only → mixed mode adds females to balance
  - If match has females only → mixed mode adds males to balance
  - Removes excess players if even gender split cannot be achieved

- **v1.5.0** - Smart Match Algorithm v4 (14 Rules)
  1. Players with the least amount of game counts (priority)
  2. Longest idle time (secondary priority)
  3. Expert male players only grouped with expert male players
  4. Expert female players only grouped with expert female players
  5. If < 4 expert males available, allow advanced males with expert males
  6. If < 4 expert females available, allow advanced females with expert females
  7. Advanced players can only match with Novice once (noviceMatchCount tracking)
  8. Prefer mixing Advanced, Intermediate, Novice together
  9. Half the time, prefer same-gender matches (all male or all female)
  10. Half the time, prefer mixed-gender matches
  11. If mixed-gender, prefer even split (2M + 2F)
  12. Balance by skill level
  13. If match has 2 players, prioritize balancing levels and genders
  14. If not enough experts available, leave match empty

- **v1.4.8** - Updated player database
  - Updated from baddixx_players.csv (137 players)
  - Changed: Eloisa Pineda (Intermediate → Novice)
  - Changed: Nina San (Advanced → Expert)
  - Added: Raina Pepito (female, Expert)

- **v1.4.7** - Match Queue stats size increase
  - Increased gender, game count, and level size to text-sm (14px)

- **v1.4.6** - Match Queue player card improvements
  - Made gender, game count, and level smaller (text-xs)
  - Aligned gender, game count, and level to the right side of player cards

- **v1.4.5** - Equal panel heights
  - All three panels (Player Pool, Match Queue, Courts) now have equal heights
  - Used flexbox layout to ensure consistent sizing across the UI

- **v1.4.4** - Consistent panel heights
  - Added sticky positioning to Match Queue section
  - All three panels (Player Pool, Match Queue, Courts) now have consistent height

- **v1.4.3** - Gender-colored player names
  - Player names now colored by gender (blue for male, pink for female)
  - Applied across all UI sections: Player Pool, Match Queue, Courts, Player Database

- **v1.4.2** - Gender icon visibility across all sections
  - Updated GenderIcon component with larger size and brighter colors
  - Consistent styling in Player Pool, Match Queue, and Courts

- **v1.4.1** - Improved gender icon visibility
  - Made gender icons (♂/♀) larger (text-lg, 18px)
  - Brighter colors (blue-300/pink-300) for better visibility

- **v1.4.0** - Match header improvements
  - Changed "Auto" button to "Smart Match"
  - Increased match header text size (Select, Smart Match, player count, Clear, delete icon)
  - Larger buttons and icons for better visibility

- **v1.3.9** - Match and court improvements
  - Added "Clear" button to matches (returns all players to pool)
  - Changed "Sel" button to show full "Select"/"Selected" text
  - Default courts changed to: Court 15, Court 16, Court 17, Court 18
  - Match player card font increased to 16px (text-base)

- **v1.3.8** - Header styling
  - Made "CueMii App" text larger (text-2xl, bold)
  - Combined creator credit and version on same line: "Created by Joseph Vertido · v1.3.8"

- **v1.3.7** - UI improvements
  - Increased font size for match player cards to 14px (text-sm)
  - Players assigned to matches now appear at bottom of Player Pool list
  - Available players sorted by wait time, matched players sorted separately below

- **v1.3.6** - Larger font for match player cards
  - Increased font size from 9px to 12px (text-xs)
  - Better readability while maintaining compact layout

- **v1.3.5** - Ultra-compact match cards
  - Each player displayed in single line: "Joseph V. ♂ 🎮3 E"
  - All 4 players in one horizontal row
  - Maximum vertical space efficiency

- **v1.3.4** - Horizontal player layout
  - All 4 players now displayed in a single horizontal row
  - Two-line format per player: Name on top, stats below
  - Single letter level indicator (E/A/I/N)
  - Remove button appears on hover
  - Maximum space efficiency for matches

- **v1.3.3** - Single-line player cards
  - Player cards in Match Queue now display in single line format
  - Format: "FirstName L. ♂ 🎮3 [Exp]" 
  - More compact vertical layout

- **v1.3.2** - Compact Match Queue UI
  - Condensed match cards to show more matches on screen
  - 4-column player layout (instead of 2x2 grid)
  - Smaller padding, fonts, and buttons
  - Shows first name only to save space
  - Abbreviated level badges (Exp, Adv, Int, Nov)
  - Hover to reveal remove button on players

- **v1.3.1** - UI improvement
  - Play counter (🎮) now displayed in Match Queue player cards

- **v1.3.0** - Smart Match Algorithm v3
  - Complete algorithm rewrite with 12 rules:
    1. Longest idle time priority
    2. Expert male players only with expert males
    3. Expert female players only with expert females
    4. Allow Advanced males with Expert males if < 4 Expert males available
    5. Allow Advanced females with Expert females if < 4 Expert females available
    6. Advanced players can only match with Novice players once (tracked via noviceMatchCount)
    7. Prefer mixing Advanced, Intermediate, and Novice together
    8. Half matches prefer same-gender (all male or all female)
    9. Half matches prefer mixed gender
    10. Mixed gender matches prefer 2M + 2F balance
    11. Skill level balancing across the match
    12. Leave match empty if not enough expert players available
  - Added noviceMatchCount tracking for Advanced players

- **v1.2.0** - Play counter feature
  - Added play counter for each player in the pool
  - Counter increments every time a player is sent to a court
  - Play count displayed with 🎮 icon in Player Pool
  - Play count persists when players return from matches

- **v1.1.4** - CSV import fix
  - Fixed bug where importing CSV caused duplicate entries in UI when sorting
  - Improved ID generation for imported players (unique sequential IDs)
  - Added stable sorting with ID tiebreaker

- **v1.1.3** - Data improvements
  - Restored default player database (136 players from baddixx_players.csv)
  - CSV export now only includes name, gender, and level (no id)

- **v1.1.2** - Clean slate
  - Removed default player database (app starts empty)
  - Import your players via CSV or add them manually

- **v1.1.1** - Bug fixes
  - Fixed bug where adding a player to pool could sometimes add duplicates
  - Improved state management with functional updates throughout the app
  
- **v1.1.0** - Smart Match algorithm overhaul
  - Expert males only with expert males
  - Expert females only with expert females
  - 50/50 single-gender vs mixed-gender matches
  - Improved gender and skill balancing
  - Added "Clear Pool" button in Player Database
  
- **v1.0.0** - Initial release
  - Player database management with 136 pre-loaded players
  - Player pool with idle time tracking
  - Smart Match algorithm with gender and skill balancing
  - Court management with match timer
  - CSV import/export
  - localStorage persistence
