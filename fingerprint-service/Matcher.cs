using System;
using System.Collections.Generic;
using DPUruNet;

namespace CueMiiFingerprintService
{
    /// <summary>
    /// Fingerprint matching for directly-captured fingerprints (no browser
    /// WebSDK). Works on FMDs (feature sets) extracted from captured Fids.
    /// </summary>
    public static class Matcher
    {
        // DigitalPersona dissimilarity threshold. Scores range 0 (identical) up
        // toward PROBABILITY_ONE (0x7fffffff). Divide by target FAR denominator;
        // 100000 => ~1e-5. Lower the divisor to be stricter.
        private const int PROBABILITY_ONE = 0x7fffffff;
        private const int Threshold = PROBABILITY_ONE / 100000;

        /// <summary>Extract an FMD (feature set) from a captured fingerprint image.</summary>
        public static Fmd FidToFmd(Fid fid)
        {
            DataResult<Fmd> r = FeatureExtraction.CreateFmdFromFid(fid, Constants.Formats.Fmd.ANSI);
            if (r.ResultCode != Constants.ResultCode.DP_SUCCESS || r.Data == null)
                throw new Exception("Feature extraction failed (" + r.ResultCode + ")");
            return r.Data;
        }

        /// <summary>Build one enrollment template from several captured FMDs.</summary>
        public static byte[] CreateEnrollment(IEnumerable<Fmd> fmds)
        {
            DataResult<Fmd> e = Enrollment.CreateEnrollmentFmd(Constants.Formats.Fmd.ANSI, fmds);
            if (e.ResultCode != Constants.ResultCode.DP_SUCCESS || e.Data == null)
                throw new Exception("Enrollment failed (" + e.ResultCode + ")");
            return e.Data.Bytes;
        }

        /// <summary>
        /// Compare a candidate FMD against all stored enrollment templates.
        /// Returns the best-matching playerId (or null) and its score.
        /// </summary>
        public static KeyValuePair<string, int> Identify(
            Fmd candidate, List<KeyValuePair<string, string>> enrollments)
        {
            string bestId = null;
            int bestScore = int.MaxValue;

            foreach (var kv in enrollments)
            {
                Fmd enrolled;
                try
                {
                    var imp = Importer.ImportFmd(
                        Convert.FromBase64String(kv.Value),
                        Constants.Formats.Fmd.ANSI,
                        Constants.Formats.Fmd.ANSI);
                    if (imp.ResultCode != Constants.ResultCode.DP_SUCCESS) continue;
                    enrolled = imp.Data;
                }
                catch { continue; }

                CompareResult cr = Comparison.Compare(candidate, 0, enrolled, 0);
                if (cr.ResultCode != Constants.ResultCode.DP_SUCCESS) continue;

                if (cr.Score < Threshold && cr.Score < bestScore)
                {
                    bestScore = cr.Score;
                    bestId = kv.Key;
                }
            }

            return new KeyValuePair<string, int>(bestId, bestId == null ? -1 : bestScore);
        }
    }
}
