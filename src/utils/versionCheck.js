/**
 * Shared version-check helpers.
 *
 * Used by both the About & License window and the notification bell, so the
 * two can't drift apart on how "an update is available" is decided.
 */
const GITHUB_REPO = 'joseph-vertido/CueMii2';
export const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;

/**
 * Compare two semver-ish version strings.
 * @returns {number} 1 if latest is newer, -1 if current is newer, 0 if equal
 */
export const compareVersions = (current, latest) => {
  const currentParts = String(current).split('.').map(Number);
  const latestParts = String(latest).split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > curr) return 1;
    if (lat < curr) return -1;
  }
  return 0;
};

/**
 * Fetch the published version from the repo.
 * @returns {Promise<string|null>} the latest version, or null if unavailable
 */
export const fetchLatestVersion = async () => {
  try {
    const response = await fetch(GITHUB_RAW_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const pkg = await response.json();
    return pkg?.version || null;
  } catch (e) {
    return null;
  }
};
