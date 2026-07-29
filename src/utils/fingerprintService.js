/**
 * fingerprintService
 * ------------------
 * Client for the local CueMii fingerprint service (direct capture). The service
 * owns the reader and does capture + matching; the browser just polls it.
 *
 * Point SERVICE_BASE_URL at the running service (fingerprint-service/).
 */

export const SERVICE_BASE_URL = 'http://localhost:9001';
export const REQUIRED_ENROLLMENT_SAMPLES = 4;

async function get(path) {
  const res = await fetch(`${SERVICE_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${SERVICE_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json().catch(() => ({ ok: true }));
}

// { status, reader, enrolled, mode }
export const getHealth = () => get('/health');

// events with seq > after
export const getEvents = (after = 0) => get(`/events?after=${after}`);

// the service's current enrolled templates: { playerId: templateBase64 }
export const getEnrollments = () => get('/enrollments');

// begin server-side enrollment for a player
export const startEnroll = (playerId) => post('/enroll/start', { playerId });

export const cancelEnroll = () => post('/enroll/cancel');

// Force the service to drop and re-acquire the reader (manual reconnect).
export const reconnectReader = () => post('/reconnect');

/**
 * Seed the service with existing templates (e.g. pulled from Firebase).
 * map: { [playerId]: templateBase64 }  OR  { [playerId]: { template, player } }
 * The service only needs the raw templates.
 */
export async function importEnrollments(map) {
  if (!map || Object.keys(map).length === 0) return;
  const templates = {};
  for (const [id, entry] of Object.entries(map)) {
    const template = typeof entry === 'string' ? entry : (entry && entry.template);
    if (template) templates[id] = template;
  }
  if (Object.keys(templates).length === 0) return;
  try {
    await post('/import', { enrollments: templates });
  } catch (e) {
    console.warn('[fingerprintService] Could not seed service:', e.message);
  }
}

/**
 * Replace the service's entire template set (used for delete/reset). Pass the
 * full remaining map ({} to clear everything).
 */
export async function replaceEnrollments(map) {
  const templates = {};
  for (const [id, entry] of Object.entries(map || {})) {
    const template = typeof entry === 'string' ? entry : (entry && entry.template);
    if (template) templates[id] = template;
  }
  try {
    await post('/replace', { enrollments: templates });
  } catch (e) {
    console.warn('[fingerprintService] Could not replace enrollments:', e.message);
  }
}
