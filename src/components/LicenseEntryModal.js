import React, { useState } from 'react';
import { APP_VERSION } from '../data/initialData';
import { validateLicense, saveLicense, formatExpirationDate } from '../utils/licenseUtils';

/**
 * License Entry Modal - Shown when no valid license exists or license is expired
 */
const LicenseEntryModal = ({ onLicenseValid, isExpired = false }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    // Validate license
    const result = validateLicense(licenseKey);
    
    if (!result.isValid) {
      setError(result.error);
      setIsValidating(false);
      return;
    }

    // Check if expired
    if (new Date() > result.expirationDate) {
      setError('This license has expired. Please enter a valid license.');
      setIsValidating(false);
      return;
    }

    // Save license and notify parent
    saveLicense(licenseKey);
    onLicenseValid(result);
    setIsValidating(false);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl border border-cyan-500/30 w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-slate-700 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🏸</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">BADDIXX CueMii</h1>
              <p className="text-slate-400 text-sm">Version {APP_VERSION}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isExpired ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                License Expired
              </div>
              <p className="text-slate-400 text-sm mt-2">
                Your license has expired. Please enter a new valid license to continue using the application.
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">Welcome!</h2>
              <p className="text-slate-400 text-sm">
                Please enter your license key to activate the application.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                License Key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Enter your license key"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!licenseKey.trim() || isValidating}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold text-white transition-all shadow-lg shadow-cyan-500/25"
            >
              {isValidating ? 'Validating...' : 'Activate License'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-500">
            © 2025 BADDIXX CueMii App. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LicenseEntryModal;
