import { useEffect, useRef, useState, useCallback } from 'react';
import { getHealth, getEvents } from '../utils/fingerprintService';

/**
 * useFingerprintService
 * ---------------------
 * Polls the local fingerprint service for reader status and scan events.
 * The service (fingerprint-service/) owns the reader and does capture +
 * matching; this hook just relays what happens to the app.
 *
 * onEvent receives each event: { type, playerId?, captured?, required?, template? }
 *   type: checkin | unknown | enroll_progress | enrolled | enroll_error | reader
 */
export const READER_STATUS = {
  UNAVAILABLE: 'unavailable', // service not reachable
  ABSENT: 'absent',           // service up, no reader plugged in
  LISTENING: 'listening',     // reader ready / waiting for a finger
  ENROLL: 'enroll',           // capturing enrollment scans
  ERROR: 'error',
};

export default function useFingerprintService({ onEvent, enabled = true, pollMs = 600 } = {}) {
  const [status, setStatus] = useState(READER_STATUS.UNAVAILABLE);
  const [error, setError] = useState(null);
  const lastSeqRef = useRef(0);
  const primedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  const mapReader = useCallback((reader) => {
    switch (reader) {
      case 'listening': return READER_STATUS.LISTENING;
      case 'enroll': return READER_STATUS.ENROLL;
      case 'absent': return READER_STATUS.ABSENT;
      case 'error': return READER_STATUS.ERROR;
      default: return READER_STATUS.UNAVAILABLE;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const health = await getHealth();
        if (cancelled) return;
        setError(null);
        setStatus(mapReader(health.reader));

        // If the service restarted (its seq counter reset below what we've seen),
        // re-establish the baseline instead of waiting for it to catch up.
        if (typeof health.seq === 'number' && health.seq < lastSeqRef.current) {
          primedRef.current = false;
        }

        if (!primedRef.current) {
          // Establish a baseline from the service's CURRENT events WITHOUT
          // processing them. This is the key to not replaying old scans on a
          // page reload (which would re-check-in players and reopen the assign
          // dialog). Only scans that arrive AFTER this baseline are acted on.
          const backlog = await getEvents(0);
          if (cancelled) return;
          if (Array.isArray(backlog) && backlog.length > 0) {
            lastSeqRef.current = backlog.reduce((m, e) => Math.max(m, e.seq), 0);
          } else if (typeof health.seq === 'number') {
            lastSeqRef.current = health.seq;
          } else {
            lastSeqRef.current = 0;
          }
          primedRef.current = true;
          return; // start acting on live scans from the next poll onward
        }

        const events = await getEvents(lastSeqRef.current);
        if (cancelled) return;
        if (Array.isArray(events)) {
          for (const ev of events) {
            if (ev.seq > lastSeqRef.current) lastSeqRef.current = ev.seq;
            if (onEventRef.current) onEventRef.current(ev);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus(READER_STATUS.UNAVAILABLE);
          setError('Fingerprint service not reachable. Is it running?');
        }
      } finally {
        if (!cancelled) timer = setTimeout(tick, pollMs);
      }
    };

    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [enabled, pollMs, mapReader]);

  return { status, error };
}
