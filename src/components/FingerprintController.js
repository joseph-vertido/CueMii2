import React, { useCallback, useEffect, useRef, useState } from 'react';
import useFingerprintService, { READER_STATUS } from '../hooks/useFingerprintService';
import { startEnroll, cancelEnroll, importEnrollments, getEnrollments, REQUIRED_ENROLLMENT_SAMPLES } from '../utils/fingerprintService';
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
  enabled = true,
  isDarkMode = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState('select'); // 'select' | 'capturing'
  const [capturedCount, setCapturedCount] = useState(0);
  const [toast, setToast] = useState(null);
  const modalOpenRef = useRef(false);

  const showToast = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

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
            showToast(`Checked in: ${p.name}`, 'success');
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
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-xl ${
            toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      <FingerprintModal
        isOpen={modalOpen}
        phase={phase}
        players={players}
        enrolledPlayerIds={enrolledPlayerIds}
        capturedCount={capturedCount}
        requiredCount={REQUIRED_ENROLLMENT_SAMPLES}
        onStartEnroll={handleStartEnroll}
        onCancel={handleCancel}
        isDarkMode={isDarkMode}
      />
    </>
  );
};

export default FingerprintController;
