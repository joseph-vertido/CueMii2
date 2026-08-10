using System;
using System.Reflection;
using System.IO;
using Microsoft.Win32;
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
        // Kept short so the loop returns often enough to notice the reader
        // vanishing. A long timeout meant up to 15 seconds could pass before a
        // disconnect was acted on.
        private const int CaptureTimeoutMs = 1200;

        private readonly Store _store;
        private readonly object _lock = new object();
        private readonly List<FpEvent> _events = new List<FpEvent>();
        private long _seq = 0;

        private Thread _thread;
        private Thread _monitorThread;

        // The capture loop can get stuck inside the SDK's Capture call when the
        // device disappears mid-wait — that call may simply never return. The
        // loop marks each pass here so the monitor can spot a stall and start a
        // fresh loop; the generation number lets the stranded thread retire if it
        // ever does come back.
        private volatile int _loopGeneration = 0;
        private DateTime _lastLoopTick = DateTime.UtcNow;
        private const int LoopStallMs = 8000;
        private volatile bool _running;
        private volatile bool _reconnectRequested;
        private Reader _reader;
        private int _resolution = 500;

        private volatile bool _enrolling;
        private string _enrollPlayerId;
        private readonly List<Fmd> _enrollFmds = new List<Fmd>();

        public string ReaderStatus { get; private set; } = "absent";

        // Health is checked by asking the reader for its status, which talks to
        // the device without disturbing it. The reader is never re-opened as
        // part of a health check — doing that made it cycle off and on.
        private const int HealthCheckMs = 2000;
        // What the last health check actually saw, so a failure can be diagnosed
        // from the service window rather than guessed at.
        private string _lastHealthDetail = "";
        private object _lastSeenResultCode = null;
        // Set when the monitor decides the device has failed, cleared only by a
        // successful re-open. Without it the capture loop could re-assert
        // "listening" in the moment between the monitor closing the handle and
        // the loop noticing, making the pill flicker back.
        private volatile bool _deviceFaulted = false;
        private int _healthTicks = 0;

        /// Single place that changes reader status: prints a line and notifies
        /// the app, and only when the status actually changes.
        private void SetReaderStatus(string status, string reason = null)
        {
            if (ReaderStatus == status) return;
            ReaderStatus = status;
            Console.WriteLine("[reader] " + status + (string.IsNullOrEmpty(reason) ? "" : " - " + reason));
            Emit(new FpEvent { type = "reader", status = status });
        }

        /// Print the events DPUruNet actually exposes, once at startup.
        ///
        /// The U.are.U SDK (DPUruNet) is a different assembly from the older
        /// One Touch SDK (DPFP), which has the well-known OnReaderDisconnect
        /// event. Whether this one offers an equivalent varies by version, so
        /// rather than assume, the service reports what it finds and the
        /// disconnect handling can then be built on it.
        private static void LogSdkNotificationSurface()
        {
            try
            {
                Type[] types = new Type[] { typeof(Reader), typeof(ReaderCollection) };
                foreach (Type t in types)
                {
                    EventInfo[] events = t.GetEvents(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
                    if (events.Length == 0)
                    {
                        Console.WriteLine("[sdk] " + t.Name + ": no public events");
                        continue;
                    }
                    foreach (EventInfo e in events)
                    {
                        Console.WriteLine("[sdk] " + t.Name + " event: " + e.Name +
                                          "  handler=" + (e.EventHandlerType != null ? e.EventHandlerType.Name : "?"));
                    }
                }

                // Also report the health-related members, so if a build ever
                // objects to GetStatus/Status it's clear what this SDK offers.
                foreach (Type t in types)
                {
                    foreach (MethodInfo m in t.GetMethods(BindingFlags.Public | BindingFlags.Instance))
                    {
                        if (m.Name.IndexOf("Status", StringComparison.OrdinalIgnoreCase) >= 0)
                            Console.WriteLine("[sdk] " + t.Name + " method: " + m.Name + "() -> " + m.ReturnType.Name);
                    }
                    foreach (PropertyInfo pi in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                    {
                        if (pi.Name.IndexOf("Status", StringComparison.OrdinalIgnoreCase) >= 0)
                            Console.WriteLine("[sdk] " + t.Name + " property: " + pi.Name + " -> " + pi.PropertyType.Name);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[sdk] could not inspect SDK events: " + ex.Message);
            }
        }

        /// Ask the reader how it is. This queries the device rather than
        /// reading a cached property, so it notices an unplugged or failed
        /// reader without the cost of a reconnect.
        ///
        /// Cheap enough to run about once a second, which is what makes it a
        /// better primary check than re-opening the device.
        /// Is a DigitalPersona reader physically attached, according to Windows?
        ///
        /// Both DigitalPersona-provided answers keep reporting a reader that has
        /// been unplugged — GetStatus returns success and the SDK still
        /// enumerates it — because they are served by the DigitalPersona
        /// runtime, which caches. This looks at the device registry instead,
        /// which is maintained by Windows itself.
        ///
        /// The trick is that a device's entry under Enum\USB survives being
        /// unplugged (it records the driver installation), but its "Control"
        /// subkey exists only while the device is actually attached. So the
        /// presence of that subkey is the real answer.
        ///
        /// If the registry can't be read the result is "present", so an
        /// inaccessible key can never produce a false disconnect.
        /// Is a DigitalPersona reader physically attached, according to Windows?
        ///
        /// Both DigitalPersona answers survive an unplug — GetStatus returns
        /// success and the SDK keeps enumerating the reader — so Windows is
        /// asked instead.
        ///
        /// Presence is read from the driver's own device list at
        /// Services\&lt;driver&gt;\Enum, which lists the device instances currently
        /// handed to that driver and shrinks when hardware is removed. An earlier
        /// attempt used the device's "Control" subkey, but that key is normally
        /// readable only by SYSTEM, so a running service sees it as missing and
        /// concludes the reader is unplugged while it is sitting there working.
        ///
        /// Anything this can't establish counts as "present", so an unreadable
        /// key can never produce a false disconnect.
        private static bool UsbReaderAttached(out string detail)
        {
            string readerInstance = null;   // e.g. USB\VID_05BA&PID_000A\<serial>
            string readerService = null;
            string readerName = null;
            int scanned = 0;

            try
            {
                using (RegistryKey usb = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\USB"))
                {
                    if (usb == null) { detail = "USB enum key unavailable"; return true; }

                    foreach (string vidPid in usb.GetSubKeyNames())
                    {
                        try
                        {
                            using (RegistryKey model = usb.OpenSubKey(vidPid))
                            {
                                if (model == null) continue;
                                foreach (string instance in model.GetSubKeyNames())
                                {
                                    using (RegistryKey dev = model.OpenSubKey(instance))
                                    {
                                        if (dev == null) continue;
                                        scanned++;

                                        string desc = (dev.GetValue("DeviceDesc") as string) ?? "";
                                        string mfg = (dev.GetValue("Mfg") as string) ?? "";
                                        string svc = (dev.GetValue("Service") as string) ?? "";
                                        string hay = vidPid + "|" + desc + "|" + mfg + "|" + svc;

                                        bool looksLikeReader =
                                            hay.IndexOf("VID_05BA", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                            hay.IndexOf("U.are.U", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                            hay.IndexOf("DigitalPersona", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                            hay.IndexOf("dpersona", StringComparison.OrdinalIgnoreCase) >= 0;
                                        if (!looksLikeReader) continue;

                                        readerInstance = "USB" + Path.DirectorySeparatorChar + vidPid +
                                                         Path.DirectorySeparatorChar + instance;
                                        readerService = svc;
                                        readerName = desc;
                                    }
                                }
                            }
                        }
                        catch { /* inaccessible device key - try the next */ }
                    }
                }
            }
            catch (Exception ex)
            {
                detail = "registry probe failed: " + ex.Message;
                return true;
            }

            if (readerInstance == null)
            {
                detail = "reader entry not found among " + scanned + " USB devices - assuming present";
                return true;
            }

            if (string.IsNullOrEmpty(readerService))
            {
                detail = "no driver recorded for " + readerName + " - assuming present";
                return true;
            }

            // The driver's device list only holds hardware that is actually there.
            try
            {
                using (RegistryKey drvEnum = Registry.LocalMachine.OpenSubKey(
                    @"SYSTEM\CurrentControlSet\Services\" + readerService + @"\Enum"))
                {
                    if (drvEnum == null)
                    {
                        detail = "driver list for " + readerService + " unreadable - assuming present";
                        return true;
                    }

                    object countObj = drvEnum.GetValue("Count");
                    int count = (countObj is int) ? (int)countObj : -1;
                    if (count < 0)
                    {
                        detail = "driver list has no count - assuming present";
                        return true;
                    }

                    for (int i = 0; i < count; i++)
                    {
                        string listed = drvEnum.GetValue(i.ToString()) as string;
                        if (listed == null) continue;
                        if (string.Equals(listed, readerInstance, StringComparison.OrdinalIgnoreCase))
                        {
                            detail = "attached (" + readerName + ")";
                            return true;
                        }
                    }

                    detail = "not attached (" + readerName + ")";
                    return false;
                }
            }
            catch (Exception ex)
            {
                detail = "driver list check failed: " + ex.Message + " - assuming present";
                return true;
            }
        }

        private bool ReaderReportsHealthy()
        {
            if (_reader == null) { _lastHealthDetail = "no reader handle"; return false; }

            // Ask Windows whether any reader is still attached, as well as asking
            // the reader itself.
            //
            // GetStatus alone has proved unreliable: the SDK can answer from
            // state captured when the device was opened, and keep reporting
            // success after it has been unplugged. A fresh enumeration doesn't
            // go through that object, so it catches the case where the reader
            // insists it is fine.
            int enumerated = -1;
            try
            {
                ReaderCollection readers = ReaderCollection.GetReaders();
                enumerated = (readers == null) ? 0 : readers.Count;
            }
            catch (Exception ex)
            {
                _lastHealthDetail = "GetReaders threw: " + ex.Message;
                return false;
            }

            if (enumerated == 0)
            {
                _lastHealthDetail = "no readers enumerated";
                return false;
            }

            // Windows has the last word: the SDK's answers survive an unplug.
            string usbDetail;
            if (!UsbReaderAttached(out usbDetail))
            {
                _lastHealthDetail = "USB " + usbDetail;
                return false;
            }

            try
            {
                Constants.ResultCode result = _reader.GetStatus();

                // Print only when the answer changes, so the console shows what
                // the reader reports as it is unplugged without repeating every
                // two seconds.
                if (!result.Equals(_lastSeenResultCode))
                {
                    _lastSeenResultCode = result;
                    Console.WriteLine("[reader] GetStatus -> " + result);
                }

                // Healthy means the reader answered normally. Anything else is
                // treated as a fault.
                //
                // Listing which codes mean "broken" doesn't work — an unplugged
                // reader can answer with a code that isn't on the list, and it
                // then looks fine. Listing what's acceptable is safe in the other
                // direction: an unrecognised answer counts as a fault, and a
                // false alarm corrects itself as soon as the reader replies
                // normally again.
                //
                // The one non-success answer that is normal is "busy", which this
                // check meets constantly because it runs while a capture is in
                // progress. Matched by name so it works whatever the SDK calls
                // it.
                string codeName = result.ToString();
                bool busy = codeName.IndexOf("BUSY", StringComparison.OrdinalIgnoreCase) >= 0
                         || codeName.IndexOf("IN_USE", StringComparison.OrdinalIgnoreCase) >= 0;

                if (result != Constants.ResultCode.DP_SUCCESS && !busy)
                {
                    _lastHealthDetail = "GetStatus=" + codeName;
                    return false;
                }

                // Only meaningful once the query itself succeeded.
                if (result == Constants.ResultCode.DP_SUCCESS &&
                    _reader.Status.Status == Constants.ReaderStatuses.DP_STATUS_FAILURE)
                {
                    _lastHealthDetail = "Status=DP_STATUS_FAILURE";
                    return false;
                }

                _lastHealthDetail = "ok (GetStatus=" + codeName + ", readers=" + enumerated + ", usb=" + usbDetail + ")";
                return true;
            }
            catch (Exception ex)
            {
                // The native SDK can throw once the USB handle is gone.
                _lastHealthDetail = ex.GetType().Name + ": " + ex.Message;
                return false;
            }
        }

        // Check-in is no longer gated on a timer, so a second person can scan
        // immediately. Repeats are avoided by requiring the finger to be lifted
        // first, rather than by making everyone wait: the capture loop would
        // otherwise report a resting finger over and over.
        private bool _fingerDown = false;
        // Enrolling asks for four presses in a row, so the long check-in
        // cooldown made each one feel unresponsive — you had to wait two
        // seconds between them. A short gap is still needed so a single press
        // isn't counted as several samples.
        private const int EnrollCooldownMs = 350;

        /// How many templates are enrolled. Reported by /health.
        public int Enrolled { get { return _store.Count; } }

        /// What the service is currently doing: "enroll" while capturing
        /// enrollment samples, otherwise "identify". Reported by /health.
        public string Mode { get { lock (_lock) { return _enrolling ? "enroll" : "identify"; } } }

        /// Sequence number of the most recent event. The app uses this to notice
        /// a service restart and to avoid replaying events it has already seen.
        public long CurrentSeq { get { lock (_lock) { return _seq; } } }

        public CaptureService(Store store) { _store = store; }

        public void Start()
        {
            LogSdkNotificationSurface();
            _running = true;
            _thread = new Thread(Loop) { IsBackground = true };
            _thread.Start();

            // Health runs on its own thread. Checking inside the capture loop
            // only worked while captures kept returning — and an unplugged
            // reader can leave that call blocked, which is exactly when the
            // check is needed most. A separate thread always gets to run.
            _monitorThread = new Thread(MonitorLoop) { IsBackground = true };
            _monitorThread.Start();
        }

        /// Asks the reader for its status every couple of seconds, whatever the
        /// capture loop is doing.
        private void MonitorLoop()
        {
            while (_running)
            {
                Thread.Sleep(HealthCheckMs);
                if (!_running) break;

                RestartLoopIfStalled();

                if (_reader == null) continue; // nothing open yet; the loop is acquiring

                if (ReaderReportsHealthy())
                {
                    // A periodic line proving the check is running and showing
                    // what it sees — so if a disconnect goes unnoticed it's clear
                    // whether the check isn't running or the reader is lying.
                    if (++_healthTicks % 10 == 0)
                    {
                        Console.WriteLine("[reader] health " + _lastHealthDetail);
                    }
                    continue;
                }

                // Acted on immediately. A second opinion was needed back when a
                // "busy" reply counted as a failure; busy is now recognised as
                // normal, so a failure here is a real fault and waiting another
                // two seconds only delays the app finding out.
                Console.WriteLine("[reader] health check failed - " + _lastHealthDetail);
                _deviceFaulted = true;
                SetReaderStatus("absent", "reader not responding - " + _lastHealthDetail);
                Emit(new FpEvent { type = "reader", status = "disconnected" });
                // Closing the handle should also free a capture waiting on a
                // device that is no longer there.
                CloseReader();
            }
        }

        /// Replace the capture loop when it stops making progress.
        ///
        /// Disposing the handle usually frees a blocked capture, but not always —
        /// and a loop stuck in the SDK never reaches the code that re-acquires
        /// the reader, which is why plugging the device back in appeared to do
        /// nothing. Starting a fresh loop restores it regardless.
        private void RestartLoopIfStalled()
        {
            if (!_running) return;
            if ((DateTime.UtcNow - _lastLoopTick).TotalMilliseconds < LoopStallMs) return;

            Console.WriteLine("[reader] capture loop stalled - restarting it");
            _loopGeneration++;          // retires the stuck thread if it ever returns
            _lastLoopTick = DateTime.UtcNow;
            CloseReader();
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
            int myGeneration = _loopGeneration;
            int consecutiveFailures = 0;
            while (_running)
            {
                // A newer loop has taken over; this one is the stranded thread.
                if (myGeneration != _loopGeneration) return;
                _lastLoopTick = DateTime.UtcNow;
                try
                {
                    if (_reconnectRequested)
                    {
                        _reconnectRequested = false;
                        Console.WriteLine("[reader] manual reconnect requested - re-acquiring...");
                        CloseReader();
                        consecutiveFailures = 0;
                        SetReaderStatus("absent", "manual reconnect");
                        Emit(new FpEvent { type = "reader", status = "reconnecting" });
                        Thread.Sleep(500);
                    }

                    EnsureReader();
                    if (_reader == null)
                    {
                        SetReaderStatus("absent", "no reader detected");
                        Thread.Sleep(1500);
                        continue;
                    }

                    // The reader is open and about to be used, so this is where
                    // it counts as working — unless the monitor has just declared
                    // it faulty and the re-open hasn't happened yet.
                    if (!_deviceFaulted)
                    {
                        SetReaderStatus(_enrolling ? "enroll" : "listening");
                    }

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
                        if (consecutiveFailures >= 2)
                        {
                            SetReaderStatus("absent", "lost (" + (cr == null ? "null" : cr.ResultCode.ToString()) + ") - re-acquiring");
                            Emit(new FpEvent { type = "reader", status = "disconnected" });
                            CloseReader();
                            consecutiveFailures = 0;
                            Thread.Sleep(1000);
                        }
                        continue;
                    }

                    consecutiveFailures = 0;
                    if (cr.Data == null)
                    {
                        // An empty frame means nothing is on the reader, so the
                        // next press counts as a new one.
                        _fingerDown = false;
                        continue;
                    }

                    if (ProcessFid(cr.Data))
                    {
                        // Read after processing: the last sample clears the flag,
                        // so the full cooldown applies once enrolment finishes and
                        // a lingering finger can't immediately check in.
                        bool stillEnrolling;
                        lock (_lock) { stillEnrolling = _enrolling; }
                        if (stillEnrolling) Thread.Sleep(EnrollCooldownMs);
                    }
                }
                catch (Exception ex)
                {
                    // An exception here usually means the device went away
                    // mid-capture, so report it as unplugged rather than a fault.
                    Console.WriteLine("[error] " + ex.GetType().Name + ": " + ex.Message);
                    if (!ReaderReportsHealthy())
                    {
                        SetReaderStatus("absent", "device unplugged");
                        Emit(new FpEvent { type = "reader", status = "disconnected" });
                    }
                    else
                    {
                        SetReaderStatus("error", ex.Message);
                    }
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
            // It's also the dependable sign that nothing is on the reader, so
            // it's what clears the "already handled this press" flag.
            try { fmd = Matcher.FidToFmd(fid); }
            catch { _fingerDown = false; return false; }

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
                        // The finger is probably still on the reader as enrolment
                        // ends. Treat it as already handled so it has to be lifted
                        // before it counts as a check-in.
                        _fingerDown = true;
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
                // One event per press: further frames from the same finger are
                // ignored until it has been lifted.
                if (_fingerDown) return true;
                _fingerDown = true;

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
            try
            {
                int[] resolutions = _reader.Capabilities.Resolutions;
                // Feature extraction needs 500 DPI. Prefer 500, else the highest.
                _resolution = 500;
                if (Array.IndexOf(resolutions, 500) < 0 && resolutions.Length > 0)
                {
                    _resolution = resolutions[0];
                    foreach (int r in resolutions) if (r > _resolution) _resolution = r;
                }
            }
            catch (Exception ex) { Console.WriteLine("[reader] capabilities error: " + ex.Message); }
            // A successful open is the only thing that clears a fault.
            _deviceFaulted = false;
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
