import React, { useState, useRef, useEffect } from 'react';

const ICONS = {
  reports:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  history: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  about: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  reset: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  timers: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

/**
 * Header overflow menu — Reports, History, Settings, About & License and Reset.
 *
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Theme mode
 * @param {Function} props.onOpenReports
 * @param {Function} props.onOpenHistory
 * @param {Function} props.onOpenSettings
 * @param {Function} props.onOpenAbout
 * @param {Function} props.onClearTimers
 * @param {boolean} props.canClearTimers
 * @param {Function} props.onResetData
 */
const HeaderMenu = ({
  isDarkMode = true,
  onOpenReports,
  onOpenHistory,
  onOpenSettings,
  onOpenAbout,
  onClearTimers,
  canClearTimers = true,
  onResetData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Kept mounted briefly so the collapse can play out.
  const closeMenu = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 130);
  };
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const run = (fn) => {
    closeMenu();
    if (fn) fn();
  };

  const itemClass = `w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
    isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
  }`;

  const Item = ({ icon, label, onClick, danger, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        disabled
          ? `w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left cursor-not-allowed ${
              isDarkMode ? 'text-slate-600' : 'text-slate-300'
            }`
          : danger
          ? `w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
              isDarkMode ? 'text-red-300 hover:bg-red-500/15' : 'text-red-600 hover:bg-red-50'
            }`
          : itemClass
      }
    >
      <svg className="w-4 h-4 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => (isOpen ? closeMenu() : (setIsClosing(false), setIsOpen(true)))}
        title="More"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
          isDarkMode
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 border border-slate-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS.menu} />
        </svg>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute right-0 mt-2 w-52 rounded-lg shadow-xl border overflow-hidden z-50 ${
            isClosing ? 'animate-menu-collapse' : 'animate-menu-expand'
          } ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div className="py-1">
            <Item icon={ICONS.reports} label="Reports" onClick={() => run(onOpenReports)} />
            <Item icon={ICONS.history} label="Match History" onClick={() => run(onOpenHistory)} />
            <Item icon={ICONS.settings} label="Settings" onClick={() => run(onOpenSettings)} />
            <Item icon={ICONS.about} label="About & License" onClick={() => run(onOpenAbout)} />
          </div>
          <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <Item
              icon={ICONS.timers}
              label="Clear Timers"
              onClick={() => run(onClearTimers)}
              disabled={!canClearTimers}
            />
            <Item icon={ICONS.reset} label="Reset Day" onClick={() => run(onResetData)} danger />
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderMenu;
