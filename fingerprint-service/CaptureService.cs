using System;
using System.Collections.Generic;
using System.Threading;
using DPUruNet;

namespace CueMiiFingerprintService
{
    /// <summary>An event the browser polls for (check-in, unknown scan, enroll progress, etc).</summary>
    public class FpEvent
    {
        public long seq { get; set; }
        public string type { get; set; }        // checkin | unknown | enroll_progress | enrolled | enroll_error | reader
        public string playerId { get; set; }
        public int captured { get; set; }
        public int required { get; set; }
        public string status { get; set; }        // for reader events
        public string template { get; set; }      // for enrolled events (base64 FMD)
    }

    /// <summary>
    /// Owns the fingerprint reader and runs a continuous capture loop on a
    /// background thread. In IDENTIFY mode each scan is matched and produces a
    /// checkin/unknown event. In ENROLL mode scans are collected until enough
    /// are gathered to build a template.
    ///
    /// >>> VERIFY against your DPUruNet version <<<
    /// The device/capture calls below (ReaderCollection.GetReaders, Reader.Open,
    /// Reader.Capture, Capabilities.Resolutions, Reader.Dispose) follow the
    /// DigitalPersona .NET "CaptureForm" sample. If a name differs in your SDK
    /// build you'll get a CS error pointing right at it.
    /// </summary>
    public class CaptureService
    {
        private const int RequiredEnroll = 4;
        private const int CaptureTimeoutMs = 5000;

        private readonly Store _store;
        private readonly object _lock = new object();
        private readonly List<FpEvent> _events = new List<FpEvent>();
        private long _seq = 0;

        private Thread _thread;
        private volatile bool _running;
        private volatile bool _reconnectRequested;
        private Reader _reader;
        private int _resolution = 500;

        private volatile bool _enrolling;
        private string _enrollPlayerId;
        private readonly List<Fmd> _enrollFmds = new List<Fmd>();

        public string ReaderStatus { get; private set; } = "absent";
        public int Enrolled { get { return _store.Count; } }
        public string Mode { get { return _enrolling ? "enroll" : "identify"; } }
        // Latest event sequence number (so the app can start from "now" on load).
        public long CurrentSeq { get { lock (_lock) { return _seq; } } }

        // After a real finger is processed, ignore the reader briefly so a single
        // press produces one event (not one per captured frame). Also enforces a
        // lift-and-place gap between enrollment scans.
        private const int CooldownMs = 2000;
        // Enrolling asks for four presses in a row, so the long check-in
        // cooldown made each one feel unresponsive — you had to wait two
        // seconds between them. A short gap is still needed so a single press
        // isn't counted as several samples.
        private const int EnrollCooldownMs = 350;

        public CaptureService(Store store) { _store = store; }

        public void Start()
        {
            _running = true;
            _thread = new Thread(Loop) { IsBackground = true };
            _thread.Start();
        }

        public void Stop()
        {
            // The capture loop uses a finite timeout, so clearing _running lets
            // it exit within one capture interval.
            _running = false;
        }

        // Force the capture loop to drop and re-acquire the reader (manual reconnect).
        public void RequestReconnect()
        {
            _reconnectRequested = true;
        }

        private void Emit(FpEvent e)
        {
            lock (_lock)
            {
                e.seq = ++_seq;
                _events.Add(e);
                if (_events.Count > 200) _events.RemoveRange(0, _events.Count - 200);
            }
        }

        public List<FpEvent> EventsAfter(long after)
        {
            lock (_lock) { return _events.FindAll(e => e.seq > after); }
        }

        public void StartEnroll(string playerId)
        {
            lock (_lock)
            {
                _enrollFmds.Clear();
                _enrollPlayerId = playerId;
                _enrolling = true;
            }
            Emit(new FpEvent { type = "enroll_progress", playerId = playerId, captured = 0, required = RequiredEnroll });
        }

        public void CancelEnroll()
        {
            lock (_lock)
            {
                _enrolling = false;
                _enrollFmds.Clear();
                _enrollPlayerId = null;
            }
        }

        public int Required { get { return RequiredEnroll; } }

        private void Loop()
        {
            int consecutiveFailures = 0;
            while (_running)
            {
                try
                {
                    if (_reconnectRequested)
                    {
                        _reconnectRequested = false;
                        Console.WriteLine("[reader] manual reconnect requested - re-acquiring...");
                        CloseReader();
                        consecutiveFailures = 0;
                        ReaderStatus = "absent";
                        Emit(new FpEvent { type = "reader", status = "reconnecting" });
                        Thread.Sleep(500);
                    }

                    EnsureReader();
                    if (_reader == null) { ReaderStatus = "absent"; Thread.Sleep(1500); continue; }

                    ReaderStatus = _enrolling ? "enroll" : "listening";

                    CaptureResult cr = _reader.Capture(
                        Constants.Formats.Fid.ANSI,
                        Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT,
                        CaptureTimeoutMs,
                        _resolution);

                    // A healthy reader returns DP_SUCCESS even when idle, so
                    // repeated null / non-success results mean the device was lost
                    // (unplugged, or the handle went stale after sleep/wake).
                    // Release the reader so it is re-acquired fresh, which restores
                    // listening automatically once the device is back.
                    if (cr == null || cr.ResultCode != Constants.ResultCode.DP_SUCCESS)
                    {
                        consecutiveFailures++;
                        if (consecutiveFailures >= 3)
                        {
                            Console.WriteLine("[reader] lost (" + (cr == null ? "null" : cr.ResultCode.ToString()) + ") - re-acquiring...");
                            ReaderStatus = "absent";
                            Emit(new FpEvent { type = "reader", status = "disconnected" });
                            CloseReader();
                            consecutiveFailures = 0;
                            Thread.Sleep(1000);
                        }
                        continue;
                    }

                    consecutiveFailures = 0;
                    if (cr.Data == null) continue;

                    if (ProcessFid(cr.Data))
                    {
                        // Read after processing: the last sample clears the flag,
                        // so the full cooldown applies once enrolment finishes and
                        // a lingering finger can't immediately check in.
                        bool stillEnrolling;
                        lock (_lock) { stillEnrolling = _enrolling; }
                        Thread.Sleep(stillEnrolling ? EnrollCooldownMs : CooldownMs);
                    }
                }
                catch (Exception ex)
                {
                    ReaderStatus = "error";
                    Console.WriteLine("[error] " + ex.GetType().Name + ": " + ex.Message);
                    Emit(new FpEvent { type = "reader", status = "error" });
                    CloseReader();
                    consecutiveFailures = 0;
                    Thread.Sleep(1500);
                }
            }
            CloseReader();
        }

        private bool ProcessFid(Fid fid)
        {
            Fmd fmd;
            // Between real presses the loop grabs empty frames that fail
            // extraction (DP_INVALID_FID) — that's expected, so skip quietly.
            try { fmd = Matcher.FidToFmd(fid); }
            catch { return false; }

            if (_enrolling)
            {
                int count;
                lock (_lock) { _enrollFmds.Add(fmd); count = _enrollFmds.Count; }
                Emit(new FpEvent { type = "enroll_progress", playerId = _enrollPlayerId, captured = count, required = RequiredEnroll });

                if (count >= RequiredEnroll)
                {
                    try
                    {
                        List<Fmd> fmds;
                        string pid;
                        lock (_lock) { fmds = new List<Fmd>(_enrollFmds); pid = _enrollPlayerId; }
                        byte[] tmpl = Matcher.CreateEnrollment(fmds);
                        string b64 = Convert.ToBase64String(tmpl);
                        _store.Put(pid, b64);
                        lock (_lock) { _enrolling = false; _enrollFmds.Clear(); _enrollPlayerId = null; }
                        Emit(new FpEvent { type = "enrolled", playerId = pid, template = b64 });
                    }
                    catch (Exception)
                    {
                        lock (_lock) { _enrolling = false; _enrollFmds.Clear(); _enrollPlayerId = null; }
                        Emit(new FpEvent { type = "enroll_error" });
                    }
                }
            }
            else
            {
                var result = Matcher.Identify(fmd, _store.All());
                if (result.Key != null)
                    Emit(new FpEvent { type = "checkin", playerId = result.Key });
                else
                    Emit(new FpEvent { type = "unknown" });
            }
            return true; // a real finger was processed -> caller applies cooldown
        }

        private void EnsureReader()
        {
            if (_reader != null) return;
            ReaderCollection readers = ReaderCollection.GetReaders();
            if (readers == null || readers.Count == 0) { _reader = null; return; }
            _reader = readers[0];
            Constants.ResultCode rc = _reader.Open(Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE);
            if (rc != Constants.ResultCode.DP_SUCCESS)
            {
                Console.WriteLine("[reader] open failed: " + rc);
                CloseReader();
                return;
            }
            // Feature extraction expects 500 DPI. Reset first so a failed
            // capabilities query can't silently carry a previous reader's value
            // over — that was how the same machine could report 500 one run and
            // 508 the next.
            _resolution = 500;
            try
            {
                int[] resolutions = _reader.Capabilities.Resolutions;
                if (resolutions != null && resolutions.Length > 0)
                {
                    Console.WriteLine("[reader] advertised resolutions: " + string.Join(", ", resolutions));
                    if (Array.IndexOf(resolutions, 500) < 0)
                    {
                        // Pick the CLOSEST to 500 rather than the highest. Templates
                        // are only comparable when captured at a consistent scale,
                        // so straying as little as possible matters more than
                        // detail.
                        _resolution = resolutions[0];
                        foreach (int r in resolutions)
                            if (Math.Abs(r - 500) < Math.Abs(_resolution - 500)) _resolution = r;
                        Console.WriteLine("[reader] WARNING: 500 DPI not offered; using " + _resolution +
                                          ". Prints enrolled at a different resolution may match less reliably.");
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine("[reader] capabilities error: " + ex.Message + " (assuming 500 DPI)"); }
            Console.WriteLine("[reader] connected (resolution " + _resolution + ")");
            Emit(new FpEvent { type = "reader", status = "connected" });
        }

        private void CloseReader()
        {
            try { if (_reader != null) _reader.Dispose(); } catch { }
            _reader = null;
        }
    }
}
