#!/usr/bin/env node
/**
 * BADDIXX CueMii - Version Bump Script
 * ------------------------------------
 * Single source of truth is package.json's "version" field, but the app
 * also needs APP_VERSION in src/data/initialData.js to match (that's what
 * the UI displays and what the in-app update check compares against).
 *
 * This script updates BOTH in one step so they can never drift.
 *
 * Usage:
 *   node scripts/bump-version.js patch      -> 4.0.38 -> 4.0.39
 *   node scripts/bump-version.js minor      -> 4.0.38 -> 4.1.0
 *   node scripts/bump-version.js major      -> 4.0.38 -> 5.0.0
 *   node scripts/bump-version.js 4.2.0      -> set explicitly to 4.2.0
 *
 * Or via npm:
 *   npm run version:patch
 *   npm run version:minor
 *   npm run version:major
 *   npm run version:set 4.2.0
 *
 * After bumping, add a matching entry to CHANGELOG.md.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const INITIAL_DATA_PATH = path.join(ROOT, 'src', 'data', 'initialData.js');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function computeNextVersion(current, arg) {
  if (SEMVER_RE.test(arg)) return arg; // explicit version

  const [major, minor, patch] = current.split('.').map(Number);
  switch (arg) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      fail(
        `Unknown argument "${arg}". Use one of: patch, minor, major, or an explicit version like 4.2.0`
      );
  }
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    fail('Missing argument. Usage: node scripts/bump-version.js <patch|minor|major|x.y.z>');
  }

  // Read current version from package.json (source of truth).
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const current = pkg.version;
  if (!SEMVER_RE.test(current)) {
    fail(`package.json version "${current}" is not valid semver (x.y.z).`);
  }

  const next = computeNextVersion(current, arg);
  if (next === current) {
    fail(`Version is already ${current}; nothing to do.`);
  }

  // 1. Update package.json
  pkg.version = next;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Update APP_VERSION in initialData.js
  const initialData = fs.readFileSync(INITIAL_DATA_PATH, 'utf8');
  const appVersionRe = /(export const APP_VERSION = ')(\d+\.\d+\.\d+)(';)/;
  if (!appVersionRe.test(initialData)) {
    fail(`Could not find APP_VERSION declaration in ${INITIAL_DATA_PATH}`);
  }
  const updated = initialData.replace(appVersionRe, `$1${next}$3`);
  fs.writeFileSync(INITIAL_DATA_PATH, updated, 'utf8');

  console.log(`\n  ✓ Version bumped: ${current} -> ${next}`);
  console.log('    - package.json');
  console.log('    - src/data/initialData.js (APP_VERSION)');
  console.log('\n  Next steps:');
  console.log(`    1. Add a "## [${next}]" entry to CHANGELOG.md`);
  console.log('    2. Commit, e.g.  git commit -am "chore: release ' + next + '"');
  console.log(`    3. (optional) tag it:  git tag v${next}\n`);
}

main();
