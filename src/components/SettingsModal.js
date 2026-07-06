import React, { useState, useEffect } from 'react';

/**
 * Settings Modal - Configure warning thresholds
 */
const SettingsModal = ({ 
  isOpen, 
  onClose, 
  isDarkMode = true,
  warningSettings,
  onUpdateSettings
}) => {
  const [localSettings, setLocalSettings] = useState(warningSettings);

  // Sync local state when modal opens or settings change
  useEffect(() => {
    setLocalSettings(warningSettings);
  }, [warningSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    const defaults = {
      noviceOverMatchThreshold: 4,
      noviceToNoviceThreshold: 8,
      repeatPairingsThreshold: 4
    };
    setLocalSettings(defaults);
  };

  const updateSetting = (key, value) => {
    const numValue = parseInt(value) || 0;
    setLocalSettings(prev => ({ ...prev, [key]: Math.max(1, numValue) }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
            }`}>
              <svg className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Settings
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Configure warning thresholds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Section Header */}
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <h3 className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Manual Player Selection Warnings
            </h3>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-amber-400/70' : 'text-amber-600'}`}>
              Configure when warnings appear when manually adding players to matches
            </p>
          </div>

          {/* Novice Over-Matching Threshold */}
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Novice Over-Matching Threshold
            </label>
            <p className={`text-sm mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Warn when a non-novice player has already played with novices this many times
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="99"
                value={localSettings.noviceOverMatchThreshold}
                onChange={(e) => updateSetting('noviceOverMatchThreshold', e.target.value)}
                className={`w-20 px-3 py-2 rounded-lg text-center font-bold text-lg ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-slate-300 text-slate-800'
                } border focus:ring-2 focus:ring-pink-500 focus:border-transparent`}
              />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                times (default: 4)
              </span>
            </div>
          </div>

          {/* Novice-to-Novice Threshold */}
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Novice-to-Novice Threshold
            </label>
            <p className={`text-sm mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Warn when adding a novice to a match with novices, if they've played with this many novices
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="99"
                value={localSettings.noviceToNoviceThreshold}
                onChange={(e) => updateSetting('noviceToNoviceThreshold', e.target.value)}
                className={`w-20 px-3 py-2 rounded-lg text-center font-bold text-lg ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-slate-300 text-slate-800'
                } border focus:ring-2 focus:ring-pink-500 focus:border-transparent`}
              />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                times (default: 8)
              </span>
            </div>
          </div>

          {/* Repeat Pairings Threshold */}
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Repeat Pairings Threshold
            </label>
            <p className={`text-sm mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Warn when players have already played together this many times
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="99"
                value={localSettings.repeatPairingsThreshold}
                onChange={(e) => updateSetting('repeatPairingsThreshold', e.target.value)}
                className={`w-20 px-3 py-2 rounded-lg text-center font-bold text-lg ${
                  isDarkMode 
                    ? 'bg-slate-700 border-slate-600 text-white' 
                    : 'bg-white border-slate-300 text-slate-800'
                } border focus:ring-2 focus:ring-pink-500 focus:border-transparent`}
              />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                times (default: 4)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={handleReset}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-700' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
            }`}
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-md shadow-pink-500/25 transition-all"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
