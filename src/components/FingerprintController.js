import React, { useCallback, useEffect, useRef, useState } from 'react';
import useFingerprintService, { READER_STATUS } from '../hooks/useFingerprintService';
import { startEnroll, cancelEnroll, importEnrollments, getEnrollments, reconnectReader, REQUIRED_ENROLLMENT_SAMPLES } from '../utils/fingerprintService';
import FingerprintModal from './FingerprintModal';

/**
 * FingerprintController (direct-capture)
 * --------------------------------------
 * The reader is owned by the local service; this polls it for events.
 *
 *   checkin  -> onCheckIn(playerId)            (adds to Available pool)   [req #3]
 *   unknown  -> open assign modal              [req #2]
 *   (in modal) pick player -> startEnroll() -> scan Nx -> enrolled -> onEnroll()
 *
 * Props: players, enrolledPlayerIds, getPlayerById, onCheckIn, onEnroll,
 *        enabled, isDarkMode
 */
const FingerprintController = ({
  players = [],
  enrollments = {},
  enrolledPlayerIds = [],
  getPlayerById = () => null,
  onCheckIn = () => {},
  onEnroll = () => {},
  onServiceEnrollments = () => {},
  onAddPlayer = () => 0,
  enabled = true,
  isDarkMode = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState('select'); // 'select' | 'capturing'
  const [capturedCount, setCapturedCount] = useState(0);
  const [toast, setToast] = useState(null);
  const modalOpenRef = useRef(false);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((text, tone = 'success') => {
    // Cancel any pending dismissal so a new scan restarts the timer instead of
    // inheriting the previous notification's countdown.
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    // The id changes every time so React remounts the element and the fade
    // animation restarts from the beginning for the new person.
    setToast({ text, tone, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  // TEST HELPER: press F1 to simulate a fingerprint scan for a random player.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      if (!players || players.length === 0) return;
      const p = players[Math.floor(Math.random() * players.length)];
      onCheckIn(p.id);
      showToast(p.name, 'welcome');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [players, onCheckIn, showToast]);

  const resetModal = useCallback(() => {
    modalOpenRef.current = false;
    setModalOpen(false);
    setPhase('select');
    setCapturedCount(0);
  }, []);

  const handleEvent = useCallback(
    (ev) => {
      switch (ev.type) {
        case 'checkin': {
          const cid = Number(ev.playerId);
          const playerId = Number.isNaN(cid) ? ev.playerId : cid;
          const p = getPlayerById(playerId);
          if (p) {
            onCheckIn(playerId);
            showToast(p.name, 'welcome');
          } else {
            showToast('Fingerprint recognized, but player data is missing — sync to restore', 'error');
          }
          break;
        }
        case 'unknown': {
          if (!modalOpenRef.current) {
            modalOpenRef.current = true;
            setModalOpen(true);
            setPhase('select');
            setCapturedCount(0);
          }
          break;
        }
        case 'enroll_progress': {
          if (modalOpenRef.current) {
            setPhase('capturing');
            setCapturedCount(ev.captured || 0);
          }
          break;
        }
        case 'enrolled': {
          const eid = Number(ev.playerId);
          const playerId = Number.isNaN(eid) ? ev.playerId : eid;
          onEnroll(playerId, ev.template || null);
          const p = getPlayerById(playerId);
          showToast(`Fingerprint assigned to ${p ? p.name : 'player'}`, 'success');
          resetModal();
          break;
        }
        case 'enroll_error': {
          showToast('Enrollment failed — try again', 'error');
          resetModal();
          break;
        }
        default:
          break;
      }
    },
    [getPlayerById, onCheckIn, onEnroll, showToast, resetModal]
  );

  const { status, error } = useFingerprintService({ onEvent: handleEvent, enabled });

  // Seed the local service with our templates whenever it's online (regardless
  // of whether the app or the service started first) or when the set changes —
  // e.g. after pulling templates from Firebase on a new machine. /import merges,
  // so calling it repeatedly is safe.
  useEffect(() => {
    if (status === READER_STATUS.LISTENING || status === READER_STATUS.ENROLL) {
      importEnrollments(enrollments);
    }
  }, [status, enrollments]);

  // When the service is reachable, pull its actual enrollment list so the app's
  // "has fingerprint" state reflects what's really stored in the service
  // (enrollments.json), even if the app's local copy drifted.
  const onServiceEnrollmentsRef = useRef(onServiceEnrollments);
  useEffect(() => { onServiceEnrollmentsRef.current = onServiceEnrollments; }, [onServiceEnrollments]);
  useEffect(() => {
    if (status === READER_STATUS.LISTENING || status === READER_STATUS.ENROLL) {
      getEnrollments()
        .then(map => { if (map) onServiceEnrollmentsRef.current(map); })
        .catch(() => {});
    }
  }, [status]);

  const handleStartEnroll = async (playerId) => {
    try {
      setPhase('capturing');
      setCapturedCount(0);
      await startEnroll(playerId);
    } catch (e) {
      showToast(e.message || 'Could not start enrollment', 'error');
      resetModal();
    }
  };

  const handleCancel = async () => {
    try { await cancelEnroll(); } catch (_) { /* ignore */ }
    resetModal();
  };

  const handleReconnect = async () => {
    try {
      await reconnectReader();
      showToast('Reconnecting reader…', 'success');
    } catch (e) {
      showToast('Fingerprint service not reachable', 'error');
    }
  };

  const statusMeta = {
    [READER_STATUS.UNAVAILABLE]: { label: 'Reader: service offline', dot: 'bg-slate-400' },
    [READER_STATUS.ABSENT]: { label: 'Reader: not connected', dot: 'bg-yellow-400' },
    [READER_STATUS.LISTENING]: { label: 'Reader: listening', dot: 'bg-emerald-400 animate-pulse' },
    [READER_STATUS.ENROLL]: { label: 'Reader: enrolling', dot: 'bg-cyan-400 animate-pulse' },
    [READER_STATUS.ERROR]: { label: 'Reader: error', dot: 'bg-red-500' },
  }[status] || { label: 'Reader', dot: 'bg-slate-400' };

  if (!enabled) return null;

  return (
    <>
      <div
        className={`fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border ${
          isDarkMode ? 'bg-slate-900/90 border-slate-700 text-slate-300' : 'bg-white/90 border-slate-200 text-slate-600'
        }`}
        title={error || statusMeta.label}
      >
        <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
        {statusMeta.label}
        <button
          onClick={handleReconnect}
          title="Reconnect the fingerprint reader"
          className={`ml-1 w-4 h-4 flex items-center justify-center rounded-full transition-colors ${
            isDarkMode ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-700' : 'text-slate-500 hover:text-cyan-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {toast && (
        toast.tone === 'error' ? (
          <div key={toast.id} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-xl bg-red-600 text-white">
            {toast.text}
          </div>
        ) : (
          <div key={toast.id} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 pl-3 pr-6 py-3 rounded-2xl shadow-2xl border text-white animate-fade-in-out border-emerald-500/40 bg-gradient-to-r from-emerald-800 to-green-800">
            <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 ring-1 ring-white/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" />
                <path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" />
                <path d="M12 11v2a14 14 0 0 0 2.5 8" />
                <path d="M8 15a18 18 0 0 0 1.8 6" />
                <path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider text-emerald-50/90">Welcome back</div>
              <div className="text-xl font-bold text-white">{toast.text}</div>
            </div>
          </div>
        )
      )}

      <FingerprintModal
        isOpen={modalOpen}
        phase={phase}
        players={players}
        enrolledPlayerIds={enrolledPlayerIds}
        capturedCount={capturedCount}
        requiredCount={REQUIRED_ENROLLMENT_SAMPLES}
        onStartEnroll={handleStartEnroll}
        onAddPlayer={onAddPlayer}
        onCancel={handleCancel}
        isDarkMode={isDarkMode}
      />
    </>
  );
};

export default FingerprintController;
