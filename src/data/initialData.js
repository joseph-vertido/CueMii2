// App Version
// NOTE: Keep this in sync with the "version" field in package.json.
// Run `npm run version:patch|minor|major` (or node scripts/bump-version.js)
// to update both automatically. See CHANGELOG.md for release history.
export const APP_VERSION = '4.35.0';

// Player roster is sourced from cloud sync (Firebase), not seeded locally.
// Starting empty avoids seed-vs-cloud ID collisions that duplicated players.
export const initialPlayers = [];

// Initial courts
export const initialCourts = [
  { id: 15, name: 'Court 15', match: null, startTime: null },
  { id: 16, name: 'Court 16', match: null, startTime: null },
  { id: 17, name: 'Court 17', match: null, startTime: null },
  { id: 18, name: 'Court 18', match: null, startTime: null },
];

// Skill levels configuration
export const SKILL_LEVELS = ['Expert', 'Advanced', 'Intermediate', 'Novice'];

// Valid genders
export const VALID_GENDERS = ['male', 'female'];

// Level badge colors
export const LEVEL_COLORS = {
  Expert: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Advanced: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Intermediate: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Novice: 'bg-green-500/20 text-green-400 border-green-500/30'
};
