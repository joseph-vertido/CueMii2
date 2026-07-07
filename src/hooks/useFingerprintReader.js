import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useFingerprintReader
 * --------------------
 * Listens for DigitalPersona U.are.U fingerprint readers (e.g. 4500) and
 * surfaces scan samples to the app.
 *
 * HOW IT TALKS TO THE HARDWARE
 *   The browser can't access a USB reader directly. Two pieces are involved:
 *     1. HID "Authentication Device Client" (a free local Windows service)
 *        installed on the machine. Download: https://crossmatch.hid.gl/lite-client
 *     2. HID's WebSdk + Fingerprint browser libraries. These now come from npm
 *        (@digitalpersona/websdk + @digitalpersona/fingerprint) - no manual
 *        file copy. Their dist scripts are copied into public/websdk/ and
 *        loaded via <script> tags in public/index.html, which expose the global
 *        `Fingerprint` namespace (and `WebSdk` it depends on).
 *
 *   Run `npm run setup:fingerprint` (or setup-fingerprint.bat) to install and
 *   stage those scripts.
 *
 * WHAT THIS HOOK DOES
 *   - Connects to the reader (Fingerprint.WebApi) and starts continuous
 *     acquisition (listening).
 *   - Reports connection status for a live UI indicator.
 *   - Calls `onSample(sample)` for each scan (base64 feature set).
 *
 * If the scripts aren't loaded yet, `window.Fingerprint` is undefined and the
 * status becomes 'unavailable' - the app keeps working normally.
 */

export const READER_STATUS = {
  UNAVAILABLE: 'unavailable', // WebSdk/Fingerprint scripts not loaded
  DISCONNECTED: 'disconnected', // ready, no reader plugged in
  CONNECTED: 'connected', // reader plugged in
  LISTENING: 'listening', // actively waiting for a finger
  ERROR: 'error',
};

export default function useFingerprintReader({ onSample, enabled = true } = {}) {
  const [status, setStatus] = useState(READER_STATUS.UNAVAILABLE);
  const [error, setError] = useState(null);
  const readerRef = useRef(null);
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const stop = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return;
    try {
      reader.stopAcquisition && reader.stopAcquisition();
    } catch (_) {
      /* ignore */
    }
    try {
      reader.off && reader.off();
    } catch (_) {
      /* ignore */
    }
    readerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    // The global exposed by @digitalpersona/fingerprint's script.
    const Fingerprint = typeof window !== 'undefined' ? window.Fingerprint : undefined;
    if (!Fingerprint || !Fingerprint.WebApi) {
      setStatus(READER_STATUS.UNAVAILABLE);
      setError('Fingerprint scripts not loaded. Run setup:fingerprint.');
      return;
    }

    let cancelled = false;
    const sampleFormat = Fingerprint.SampleFormat
      ? Fingerprint.SampleFormat.Intermediate
      : 2;

    let reader;
    try {
      reader = new Fingerprint.WebApi();
    } catch (e) {
      setStatus(READER_STATUS.ERROR);
      setError('Could not initialize fingerprint reader. Is the local client running?');
      return;
    }
    readerRef.current = reader;

    const startListening = async () => {
      try {
        await reader.startAcquisition(sampleFormat);
        if (!cancelled) setStatus(READER_STATUS.LISTENING);
      } catch (e) {
        if (!cancelled) {
          setStatus(READER_STATUS.ERROR);
          setError('Failed to start listening for scans.');
        }
      }
    };

    reader.on('DeviceConnected', () => {
      if (cancelled) return;
      setError(null);
      setStatus(READER_STATUS.CONNECTED);
      startListening();
    });

    reader.on('DeviceDisconnected', () => {
      if (!cancelled) setStatus(READER_STATUS.DISCONNECTED);
    });

    reader.on('CommunicationFailed', () => {
      if (!cancelled) {
        setStatus(READER_STATUS.ERROR);
        setError('Lost connection to the fingerprint client. Is it still running?');
      }
    });

    reader.on('ErrorOccurred', () => {
      if (!cancelled) {
        setStatus(READER_STATUS.ERROR);
        setError('A fingerprint reader error occurred.');
      }
    });

    reader.on('SamplesAcquired', (event) => {
      if (cancelled) return;
      try {
        let samples = event && event.samples;
        if (typeof samples === 'string') {
          try {
            samples = JSON.parse(samples);
          } catch (_) {
            /* leave as string */
          }
        }
        const sample = Array.isArray(samples) ? samples[0] : samples;
        if (sample && onSampleRef.current) {
          onSampleRef.current(sample);
        }
      } catch (e) {
        setError('Could not read the captured fingerprint sample.');
      }
    });

    // Probe already-connected devices and start if one is present.
    (async () => {
      try {
        const list = await reader.enumerateDevices();
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setStatus(READER_STATUS.CONNECTED);
          startListening();
        } else if (!cancelled) {
          setStatus(READER_STATUS.DISCONNECTED);
        }
      } catch (e) {
        // Scripts loaded but the local client likely isn't running.
        if (!cancelled) setStatus(READER_STATUS.DISCONNECTED);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop]);

  return { status, error };
}
