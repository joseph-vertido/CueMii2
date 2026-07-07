/**
 * fingerprintMatcher
 * ------------------
 * The @digitalpersona/devices library ONLY captures fingerprints. Turning a
 * captured sample into a player identity (1:N identify) or enrolling a new
 * finger requires a matching engine. HID gives two supported options:
 *
 *   (A) HID DigitalPersona Authentication Server + @digitalpersona/authentication
 *       -> full infrastructure, does identify() out of the box.
 *   (B) Your own matching engine — for a club app, typically a small local
 *       companion service (Node/Windows) wrapping the free U.are.U SDK.
 *
 * Either way, the app talks to that engine over HTTP. This module is that seam:
 * point MATCHER_BASE_URL at your engine and implement two endpoints:
 *
 *   POST {BASE}/identify   body: { sample }                 -> { playerId: <id|null> }
 *   POST {BASE}/enroll     body: { playerId, samples: [] }  -> { ok: true, template? }
 *
 * If no engine is configured, identify() returns null and enroll() throws a
 * clear error, so the UI degrades gracefully instead of pretending to match.
 *
 * Swapping backend (A) vs (B) only changes this file.
 */

// Set to your matching service, e.g. 'http://localhost:9001' for the local
// companion service (fingerprint-service/), or your DP Auth Server proxy.
// Empty = not configured (scans treated as unassigned).
export const MATCHER_BASE_URL = 'http://localhost:9001';

// DigitalPersona enrollment normally needs several captures of the same finger.
export const REQUIRED_ENROLLMENT_SAMPLES = 4;

export const isMatcherConfigured = () => Boolean(MATCHER_BASE_URL);

/**
 * identify(sample) -> playerId | null
 * Sends a single captured sample to the engine and returns the matched
 * player id, or null if the finger isn't enrolled to anyone.
 */
export async function identify(sample) {
  if (!isMatcherConfigured()) {
    // No backend yet: treat every scan as "unknown" so the assign flow runs.
    console.warn(
      '[fingerprintMatcher] No matching engine configured (MATCHER_BASE_URL is empty). ' +
        'Scans will be treated as unassigned.'
    );
    return null;
  }
  const res = await fetch(`${MATCHER_BASE_URL}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample }),
  });
  if (!res.ok) {
    throw new Error(`Identify failed (${res.status})`);
  }
  const data = await res.json();
  if (!data || data.playerId == null) return null;
  // Player ids are numeric in CueMii; coerce so equality checks match.
  const n = Number(data.playerId);
  return Number.isNaN(n) ? data.playerId : n;
}

/**
 * enroll(playerId, samples) -> void
 * Registers a set of captures for a player with the engine. Store any returned
 * template alongside the player if your engine is stateless.
 */
export async function enroll(playerId, samples) {
  if (!isMatcherConfigured()) {
    throw new Error(
      'No fingerprint matching engine is configured. Set MATCHER_BASE_URL in ' +
        'src/utils/fingerprintMatcher.js and run your enroll/identify service.'
    );
  }
  const res = await fetch(`${MATCHER_BASE_URL}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, samples }),
  });
  if (!res.ok) {
    throw new Error(`Enroll failed (${res.status})`);
  }
  return res.json().catch(() => ({ ok: true }));
}

/**
 * importEnrollments(map) -> void
 * Seeds the local matching service with existing templates (e.g. pulled from
 * Firebase), so a fresh machine can identify players enrolled elsewhere.
 * map: { [playerId]: templateBase64 }
 */
export async function importEnrollments(map) {
  if (!isMatcherConfigured() || !map || Object.keys(map).length === 0) return;
  try {
    await fetch(`${MATCHER_BASE_URL}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollments: map }),
    });
  } catch (e) {
    console.warn('[fingerprintMatcher] Could not seed local service:', e.message);
  }
}
