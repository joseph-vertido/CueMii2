import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ALERT_EVENT } from '../utils/appAlert';

/**
 * Centred, themed replacement for window.alert(), window.confirm() and
 * window.prompt().
 *
 * Listens for the event raised by showAlert()/showConfirm() and queues them so
 * a burst of dialogs is shown one after another rather than overwriting.
 *
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Theme mode
 */
const AlertDialog = ({ isDarkMode = true }) => {
  const [queue, setQueue] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);
  const current = queue[0];

  useEffect(() => {
    const onAlert = (e) => {
      const { kind, message, title, resolve, password } = e.detail || {};
      setQueue((prev) => [
        ...prev,
        { kind: kind || 'alert', message, title, resolve, password, id: Date.now() + Math.random() },
      ]);
    };
    window.addEventListener(ALERT_EVENT, onAlert);
    return () => window.removeEventListener(ALERT_EVENT, onAlert);
  }, []);

  // Settle the current dialog. For a confirm, resolve its promise first.
  const close = useCallback((confirmed) => {
    setQueue((prev) => {
      const [top, ...rest] = prev;
      if (top?.resolve) {
        if (top.kind === 'prompt') {
          top.resolve(confirmed ? inputValue : null);
        } else {
          top.resolve(confirmed);
        }
      }
      return rest;
    });
    setInputValue('');
  }, [inputValue]);
  const dismiss = useCallback(() => close(false), [close]);
  const accept = useCallback(() => close(true), [close]);

  // Focus the field when a prompt opens
  useEffect(() => {
    if (current?.kind === 'prompt') {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [current]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        accept();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, dismiss, accept]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      onClick={dismiss}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`neon-panel w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div
          className={`px-5 py-3 border-b flex items-center gap-2 ${
            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <svg
            className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z"
            />
          </svg>
          <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {current.title || (current.kind === 'confirm' ? 'Please confirm' : current.kind === 'prompt' ? 'Password required' : 'Notice')}
          </h3>
        </div>

        <div
          className={`px-5 py-4 text-sm whitespace-pre-line ${
            isDarkMode ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {current.message}
          {current.kind === 'prompt' && (
            <input
              ref={inputRef}
              type={current.password ? 'password' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); accept(); } }}
              className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
          )}
        </div>

        <div
          className={`px-5 py-3 flex justify-end border-t ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          {(current.kind === 'confirm' || current.kind === 'prompt') && (
            <button
              onClick={dismiss}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold mr-2 transition-colors ${
                isDarkMode
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              Cancel
            </button>
          )}
          <button
            onClick={accept}
            autoFocus
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
