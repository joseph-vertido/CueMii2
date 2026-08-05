import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getDaysUntilExpiration } from '../utils/licenseUtils';
import { fetchLatestVersion, compareVersions } from '../utils/versionCheck';
import { APP_VERSION } from '../data/initialData';

const SEVERITY = {
  critical: {
    dark: 'text-red-300 bg-red-500/15 border-red-500/30',
    light: 'text-red-700 bg-red-50 border-red-300',
    dot: 'bg-red-500',
  },
  warning: {
    dark: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    light: 'text-amber-800 bg-amber-50 border-amber-300',
    dot: 'bg-amber-500',
  },
  info: {
    dark: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
    light: 'text-cyan-800 bg-cyan-50 border-cyan-300',
    dot: 'bg-cyan-500',
  },
};

const ICONS = {
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1h6z',
  license: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  update: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  seats: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  offline: 'M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.002 4.002 0 003 15z',
};

/**
 * Notification bell — surfaces things the user should know about:
 * licence expiry, available updates, player seats running out, the fingerprint
 * reader being offline and cloud sync problems.
 *
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Theme mode
 * @param {Object} props.licenseInfo - { expirationDate, maxPlayers }
 * @param {number} props.playerCount - Players in the database
 * @param {string} props.readerStatus - Fingerprint reader status
 * @param {boolean} props.isOnline - Browser online state
 * @param {boolean} props.cloudSyncEnabled - Whether cloud sync is on
 * @param {string} props.syncStatus - Cloud sync status
 * @param {Function} props.onOpenAbout - Open About & License
 */
const NotificationBell = ({
  isDarkMode = true,
  licenseInfo,
  playerCount = 0,
  readerStatus = 'unknown',
  isOnline = true,
  cloudSyncEnabled = false,
  syncStatus = 'idle',
  onOpenAbout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const ref = useRef(null);

  // Check for a newer published version once on mount, then hourly.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const latest = await fetchLatestVersion();
      if (!cancelled) setLatestVersion(latest);
    };
    check();
    const id = setInterval(check, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const notifications = useMemo(() => {
    const list = [];

    // --- Licence -----------------------------------------------------------
    const daysLeft = licenseInfo?.expirationDate
      ? getDaysUntilExpiration(licenseInfo.expirationDate)
      : null;
    if (daysLeft !== null) {
      if (daysLeft < 0) {
        list.push({
          id: 'license-expired',
          severity: 'critical',
          icon: ICONS.license,
          title: 'License expired',
          body: 'Enter a new license key to keep using the app.',
          action: onOpenAbout,
          actionLabel: 'Open License',
        });
      } else if (daysLeft === 0) {
        list.push({
          id: 'license-today',
          severity: 'critical',
          icon: ICONS.license,
          title: 'License expires today',
          body: 'Renew it to avoid interruption.',
          action: onOpenAbout,
          actionLabel: 'Open License',
        });
      } else if (daysLeft < 15) {
        // Inside a fortnight this becomes urgent rather than advisory.
        list.push({
          id: 'license-urgent',
          severity: 'critical',
          icon: ICONS.license,
          title: `License expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          body: 'Renew it soon to avoid interruption.',
          action: onOpenAbout,
          actionLabel: 'Open License',
        });
      } else if (daysLeft <= 30) {
        list.push({
          id: 'license-soon',
          severity: 'warning',
          icon: ICONS.license,
          title: `License expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          body: 'Renew it when you get a chance.',
          action: onOpenAbout,
          actionLabel: 'Open License',
        });
      }
    }

    // --- Player seats ------------------------------------------------------
    const maxPlayers = licenseInfo?.maxPlayers;
    if (maxPlayers && Number.isFinite(maxPlayers)) {
      const remaining = maxPlayers - playerCount;
      if (remaining <= 0) {
        list.push({
          id: 'seats-full',
          severity: 'critical',
          icon: ICONS.seats,
          title: 'Player limit reached',
          body: `All ${maxPlayers} player slots are used. Remove players or upgrade your license.`,
        });
      } else if (remaining <= 10) {
        list.push({
          id: 'seats-low',
          severity: 'warning',
          icon: ICONS.seats,
          title: `Only ${remaining} player slot${remaining === 1 ? '' : 's'} left`,
          body: `You've used ${playerCount} of ${maxPlayers}.`,
        });
      }
    }

    // --- App update --------------------------------------------------------
    if (latestVersion && compareVersions(APP_VERSION, latestVersion) > 0) {
      list.push({
        id: 'update',
        severity: 'info',
        icon: ICONS.update,
        title: `Version ${latestVersion} is available`,
        body: `You're on ${APP_VERSION}. Run update.bat to install it.`,
      });
    }

    // --- Fingerprint reader ------------------------------------------------
    if (readerStatus === 'unavailable' || readerStatus === 'absent' || readerStatus === 'error') {
      list.push({
        id: 'reader',
        severity: 'warning',
        icon: ICONS.offline,
        title:
          readerStatus === 'unavailable'
            ? 'Fingerprint service offline'
            : 'Fingerprint reader not connected',
        body: 'Players can still be checked in manually.',
      });
    }

    // --- Connectivity / sync ----------------------------------------------
    if (!isOnline) {
      list.push({
        id: 'offline',
        severity: 'warning',
        icon: ICONS.offline,
        title: 'No internet connection',
        body: 'Changes are saved locally and will sync when you reconnect.',
      });
    } else if (cloudSyncEnabled && syncStatus === 'error') {
      list.push({
        id: 'sync',
        severity: 'warning',
        icon: ICONS.cloud,
        title: 'Cloud sync failed',
        body: 'Your data is safe locally. Try "Sync Now" in Settings.',
      });
    }

    return list;
  }, [licenseInfo, playerCount, latestVersion, readerStatus, isOnline, cloudSyncEnabled, syncStatus, onOpenAbout]);

  const count = notifications.length;
  const worst = notifications.some(n => n.severity === 'critical')
    ? 'critical'
    : notifications.some(n => n.severity === 'warning')
      ? 'warning'
      : 'info';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={count ? `${count} notification${count === 1 ? '' : 's'}` : 'No notifications'}
        aria-label={count ? `${count} notifications` : 'No notifications'}
        className={`relative p-2 rounded-lg font-semibold transition-all ${
          isDarkMode
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS.bell} />
        </svg>
        {count > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${SEVERITY[worst].dot}`}
          >
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-80 rounded-lg shadow-xl border overflow-hidden z-50 ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`px-3 py-2 border-b text-sm font-semibold ${
              isDarkMode ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-800'
            }`}
          >
            Notifications
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {count === 0 ? (
              <div className={`px-3 py-6 text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Nothing needs your attention.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b last:border-b-0 ${
                    isDarkMode ? 'border-slate-700/60' : 'border-slate-100'
                  }`}
                >
                  <div className="flex gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center border ${
                        isDarkMode ? SEVERITY[n.severity].dark : SEVERITY[n.severity].light
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon} />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                        {n.title}
                      </div>
                      <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {n.body}
                      </div>
                      {n.action && (
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            n.action();
                          }}
                          className={`mt-1.5 text-xs font-semibold ${
                            isDarkMode ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-800'
                          }`}
                        >
                          {n.actionLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
