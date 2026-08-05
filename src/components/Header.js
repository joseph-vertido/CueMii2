import React from 'react';
import HeaderMenu from './HeaderMenu';
import NotificationBell from './NotificationBell';
import { APP_VERSION } from '../data/initialData';
import { getDaysUntilExpiration } from '../utils/licenseUtils';

/**
 * Application header with logo and manage players button
 * @param {Object} props
 * @param {Function} props.onOpenDatabase - Callback to open player database modal
 * @param {Function} props.onOpenHistory - Callback to open match history modal
 * @param {Function} props.onOpenAbout - Callback to open about modal
 * @param {Function} props.onOpenReports - Callback to open reports modal
 * @param {Function} props.onOpenSettings - Callback to open settings modal
 * @param {Function} props.onResetData - Callback to reset all application data
 * @param {boolean} props.isDarkMode - Current theme mode
 * @param {Function} props.toggleTheme - Callback to cycle theme
 * @param {string} props.theme - Active theme: 'light' | 'dark' | 'neon'
 * @param {object} props.licenseInfo - Current license information
 * @param {string} props.syncStatus - Cloud sync status
 * @param {boolean} props.isOnline - Online status
 * @param {boolean} props.cloudSyncEnabled - Whether cloud sync is enabled
 */
const Header = ({ 
  onOpenDatabase, 
  onOpenHistory, 
  onOpenAbout, 
  onOpenReports, 
  onOpenSettings, 
  onResetData, 
  isDarkMode, 
  toggleTheme, 
  theme = 'dark', 
  licenseInfo,
  syncStatus = 'idle',
  isOnline = true,
  cloudSyncEnabled = false,
  playerCount = 0,
  onClearTimers,
  canClearTimers = true,
  readerStatus = 'unknown'
}) => {
  const daysLeft = licenseInfo?.expirationDate ? getDaysUntilExpiration(licenseInfo.expirationDate) : null;
  const showWarning = daysLeft !== null && daysLeft <= 30;
  const isExpired = daysLeft !== null && daysLeft < 0;

  // Sync status indicator
  const getSyncIndicator = () => {
    if (!cloudSyncEnabled) return null;
    
    if (!isOnline) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20" title="Offline - will sync when connected">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span className="text-xs text-yellow-500 font-medium">Offline</span>
        </div>
      );
    }
    
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20" title="Syncing with cloud...">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
            <span className="text-xs text-cyan-500 font-medium">Syncing</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20" title="Synced successfully">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-emerald-500 font-medium">Synced</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20" title="Sync error">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs text-red-500 font-medium">Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-500/10 border border-slate-500/20" title="Cloud sync enabled">
            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
            <span className="text-xs text-slate-400 font-medium">Cloud</span>
          </div>
        );
    }
  };

  return (
    <header className={`relative border-b backdrop-blur-sm ${
      isDarkMode 
        ? 'bg-slate-900/90 border-slate-700/60' 
        : 'bg-slate-100 border-slate-300'
    }`}>
      <div className="max-w-[1920px] mx-auto px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/banner.png" 
            alt="Baddixx" 
            className="h-10 w-auto object-contain"
          />
          <div className={`h-8 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`} />
          <img
            src="/cuemii-logo.png"
            alt="CueMii"
            className="h-9 w-auto object-contain"
          />
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Created by Joseph Vertido (jrvertido@gmail.com) · v{APP_VERSION}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status Indicator */}
          {getSyncIndicator()}
          
          {/* Notifications */}
          <NotificationBell
            isDarkMode={isDarkMode}
            licenseInfo={licenseInfo}
            playerCount={playerCount}
            readerStatus={readerStatus}
            isOnline={isOnline}
            cloudSyncEnabled={cloudSyncEnabled}
            syncStatus={syncStatus}
            onOpenAbout={onOpenAbout}
          />

          {/* Theme Toggle: Light -> Dark -> Neon */}
          <button
            onClick={toggleTheme}
            className={`theme-toggle p-2 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              isDarkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
            }`}
            title={
              theme === 'light' ? 'Switch to Dark Mode'
                : theme === 'dark' ? 'Switch to Neon Mode'
                  : 'Switch to Light Mode'
            }
          >
            {theme === 'light' ? (
              /* moon: next is dark */
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : theme === 'dark' ? (
              /* lightning: next is neon */
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
              </svg>
            ) : (
              /* sun: next is light */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41M16.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>

          <button
            onClick={onOpenDatabase}
            className="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Manage Players
          </button>

          {/* Overflow menu: Reports, History, Settings, About, Reset */}
          <HeaderMenu
            isDarkMode={isDarkMode}
            onOpenReports={onOpenReports}
            onOpenHistory={onOpenHistory}
            onOpenSettings={onOpenSettings}
            onOpenAbout={onOpenAbout}
            onClearTimers={onClearTimers}
            canClearTimers={canClearTimers}
            onResetData={onResetData}
          />

        </div>
      </div>
    </header>
  );
};

export default Header;
