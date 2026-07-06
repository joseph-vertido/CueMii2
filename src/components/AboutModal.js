import React, { useState, useEffect } from 'react';
import { APP_VERSION } from '../data/initialData';
import { SYNC_STATUS } from '../hooks/useCloudSync';
import { 
  validateLicense, 
  saveLicense, 
  formatExpirationDate,
  getLicenseStatus,
  getDaysUntilExpiration
} from '../utils/licenseUtils';

// GitHub repo for updates
const GITHUB_REPO = 'joseph-vertido/CueMii';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;
const GITHUB_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;

// Compare version strings (e.g., "4.0.8" vs "4.1.0")
const compareVersions = (current, latest) => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > curr) return 1;  // Update available
    if (lat < curr) return -1; // Current is newer
  }
  return 0; // Same version
};

/**
 * About Modal - Shows app info, license details, and allows license editing
 */
const AboutModal = ({ 
  isOpen, 
  onClose, 
  isDarkMode = true, 
  licenseInfo,
  onLicenseUpdate,
  playerDatabaseCount = 0,
  // Cloud Sync Props
  cloudSyncEnabled = false,
  setCloudSyncEnabled = () => {},
  syncStatus = 'idle',
  lastSyncDisplay = 'Never',
  syncError = null,
  isOnline = true,
  performSync = () => {},
  isFirebaseConfigured = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLicenseKey, setEditLicenseKey] = useState('');
  const [editError, setEditError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Update checking state
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, upToDate, error
  const [latestVersion, setLatestVersion] = useState(null);
  const [updateError, setUpdateError] = useState('');

  const getSyncStatusDisplay = () => {
    if (!isFirebaseConfigured) {
      return { text: 'Not Configured', color: 'text-slate-400', icon: '⚠️' };
    }
    if (!isOnline) {
      return { text: 'Offline', color: 'text-yellow-500', icon: '📴' };
    }
    switch (syncStatus) {
      case SYNC_STATUS.SYNCING:
        return { text: 'Syncing...', color: 'text-cyan-400', icon: '🔄' };
      case SYNC_STATUS.SUCCESS:
        return { text: 'Synced!', color: 'text-emerald-400', icon: '✓' };
      case SYNC_STATUS.ERROR:
        return { text: 'Error', color: 'text-red-400', icon: '✗' };
      default:
        return { text: 'Ready', color: 'text-slate-400', icon: '☁️' };
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await performSync();
    setIsSyncing(false);
  };

  const statusDisplay = getSyncStatusDisplay();

  // Check for updates function
  const checkForUpdates = async () => {
    setUpdateStatus('checking');
    setUpdateError('');
    
    try {
      const response = await fetch(GITHUB_RAW_URL, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch version info');
      }
      
      const packageJson = await response.json();
      const latest = packageJson.version;
      setLatestVersion(latest);
      
      const comparison = compareVersions(APP_VERSION, latest);
      if (comparison > 0) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdateStatus('error');
      setUpdateError('Unable to check for updates');
    }
  };

  // Auto-check for updates when modal opens
  useEffect(() => {
    if (isOpen && updateStatus === 'idle') {
      checkForUpdates();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUpdateStatus('idle');
      setLatestVersion(null);
      setUpdateError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const { expirationDate, maxPlayers, rawKey } = licenseInfo || {};
  const status = getLicenseStatus(expirationDate);
  const daysLeft = getDaysUntilExpiration(expirationDate);
  const remainingSlots = maxPlayers ? Math.max(0, maxPlayers - playerDatabaseCount) : 0;

  const handleStartEdit = () => {
    setEditLicenseKey(rawKey || '');
    setEditError('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditLicenseKey('');
    setEditError('');
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    setEditError('');

    // Validate new license
    const result = validateLicense(editLicenseKey);
    
    if (!result.isValid) {
      setEditError(result.error);
      return;
    }

    // Check if expired
    if (new Date() > result.expirationDate) {
      setEditError('This license has expired. Please enter a valid license.');
      return;
    }

    // Save and update
    saveLicense(editLicenseKey);
    onLicenseUpdate(result);
    setIsEditing(false);
    setEditLicenseKey('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl border w-full max-w-2xl shadow-2xl ${
        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b px-6 py-4 flex items-center justify-between rounded-t-2xl ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏸</span>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                BADDIXX CueMii
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Version {APP_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column - License & Creator */}
            <div className="space-y-4">
          {/* License Status Card */}
          <div className={`rounded-xl border p-4 ${
            isDarkMode 
              ? daysLeft < 0 ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-800/50 border-slate-700' 
              : daysLeft < 0 ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                License Information
              </h3>
              <span className={`font-semibold text-sm ${status.colorClass}`}>
                {status.text}
              </span>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    License Key
                  </label>
                  <input
                    type="text"
                    value={editLicenseKey}
                    onChange={(e) => setEditLicenseKey(e.target.value)}
                    placeholder="Enter license key"
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' 
                        : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                    } border focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                    autoFocus
                  />
                </div>
                
                {editError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2">
                    <p className="text-red-400 text-xs">{editError}</p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isDarkMode 
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>License Key:</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs truncate max-w-[150px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {rawKey ? `${rawKey.substring(0, 20)}...` : 'N/A'}
                    </span>
                    <button
                      onClick={handleStartEdit}
                      className={`p-1 rounded transition-colors ${
                        isDarkMode 
                          ? 'text-cyan-400 hover:bg-slate-700' 
                          : 'text-cyan-600 hover:bg-slate-200'
                      }`}
                      title="Edit license"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Expires:</span>
                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                    {formatExpirationDate(expirationDate)}
                  </span>
                </div>
                
                {daysLeft >= 0 && (
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Days Remaining:</span>
                    <span className={`font-semibold ${
                      daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {daysLeft}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Player Database Card */}
          <div className={`rounded-xl border p-4 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Player Database
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Current Players:</span>
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                  {Math.min(playerDatabaseCount, maxPlayers || playerDatabaseCount)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Maximum Allowed:</span>
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                  {maxPlayers || 'N/A'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Remaining Slots:</span>
                <span className={`font-semibold ${
                  remainingSlots === 0 
                    ? 'text-red-400' 
                    : remainingSlots <= 10 
                      ? 'text-amber-400' 
                      : 'text-emerald-400'
                }`}>
                  {remainingSlots}
                </span>
              </div>
              
              {/* Progress Bar */}
              {maxPlayers && (
                <div className="mt-3">
                  <div className={`h-2 rounded-full overflow-hidden ${
                    isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                  }`}>
                    <div 
                      className={`h-full rounded-full transition-all ${
                        playerDatabaseCount >= maxPlayers
                          ? 'bg-red-500'
                          : playerDatabaseCount / maxPlayers >= 0.9
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (playerDatabaseCount / maxPlayers) * 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {Math.round((Math.min(playerDatabaseCount, maxPlayers) / maxPlayers) * 100)}% used
                  </p>
                </div>
              )}
              
              {playerDatabaseCount > maxPlayers && (
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-2 mt-2">
                  <p className="text-amber-400 text-xs">
                    ⚠️ {playerDatabaseCount - maxPlayers} player(s) are hidden due to license limit
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Creator Info */}
          <div className={`rounded-xl border p-4 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Created By
            </h3>
            <div className="space-y-1">
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Joseph Vertido</p>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>jrvertido@gmail.com</p>
            </div>
          </div>
            </div>

            {/* Right Column - Version & Updates */}
            <div className="space-y-4">

          {/* Version & Updates - Compact */}
          <div className={`rounded-xl border p-3 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Version
              </span>
              <span className={`font-mono font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                v{APP_VERSION}
              </span>
            </div>
            
            {/* Update Status - Inline */}
            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {updateStatus === 'checking' && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking for updates...
                </span>
              )}
              {updateStatus === 'upToDate' && (
                <span className="text-cyan-400">✓ Up to date</span>
              )}
              {updateStatus === 'error' && (
                <span className="text-red-400">Unable to check for updates</span>
              )}
            </div>
            
            {/* Update Available */}
            {updateStatus === 'available' && (
              <div className="mt-2 pt-2 border-t border-green-500/30">
                <p className="text-green-400 text-xs font-medium mb-2">
                  🎉 Update available: v{latestVersion}
                </p>
                
                {/* Update Instructions */}
                <div className={`rounded p-2 mb-2 text-xs ${
                  isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'
                }`}>
                  <p className={`font-medium mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    To update:
                  </p>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    Run <code className={`px-1 rounded ${isDarkMode ? 'bg-slate-600 text-cyan-400' : 'bg-slate-200 text-cyan-600'}`}>update.bat</code> in your CueMii install directory.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <a
                    href={GITHUB_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium py-1.5 px-2 rounded text-center transition-colors"
                  >
                    Download
                  </a>
                  <a
                    href={`https://github.com/${GITHUB_REPO}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 text-xs font-medium py-1.5 px-2 rounded text-center transition-colors ${
                      isDarkMode 
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' 
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    GitHub
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync Card */}
          <div className={`rounded-xl border p-3 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                Cloud Sync
              </span>
              <button
                onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  cloudSyncEnabled 
                    ? 'bg-cyan-500' 
                    : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  cloudSyncEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            
            {/* Sync Status */}
            <div className={`flex items-center justify-between py-2 border-t ${
              isDarkMode ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <span className={`text-xs font-medium ${statusDisplay.color}`}>
                {statusDisplay.icon} {statusDisplay.text}
              </span>
              <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Last: {lastSyncDisplay}
              </span>
            </div>

            {/* Sync Error */}
            {syncError && (
              <div className={`mt-1 p-1.5 rounded text-xs ${
                isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
              }`}>
                {syncError}
              </div>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline || !isFirebaseConfigured}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg text-xs font-medium transition-all ${
                isSyncing || !isOnline || !isFirebaseConfigured
                  ? isDarkMode 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-500/25'
              }`}
            >
              {isSyncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
            {!isFirebaseConfigured && (
              <p className={`text-xs mt-1 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Firebase not configured
              </p>
            )}
            {!isOnline && isFirebaseConfigured && (
              <p className={`text-xs mt-1 text-center ${isDarkMode ? 'text-yellow-500' : 'text-yellow-600'}`}>
                Offline - will sync when connected
              </p>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t text-center ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            © 2025 BADDIXX CueMii App. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
