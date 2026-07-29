using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace CueMiiFingerprintService
{
    /// <summary>
    /// Local HTTP service for CueMii fingerprint check-in (DIRECT CAPTURE).
    /// The reader is owned here; the browser only polls for events. No browser
    /// WebSDK / agent involved.
    ///
    ///   GET  /health                       -> { status, reader, enrolled, mode }
    ///   GET  /events?after=<seq>           -> [ { seq, type, ... } ]
    ///   POST /enroll/start { playerId }     -> { ok, required }
    ///   POST /enroll/cancel                 -> { ok }
    ///   POST /import { enrollments:{id:b64}}-> { ok, count }   (seed from Firebase)
    ///
    /// Event types: checkin{playerId}, unknown, enroll_progress{captured,required},
    /// enrolled{playerId,template}, enroll_error, reader{status}.
    /// </summary>
    public class Program
    {
        private const string Prefix = "http://localhost:9001/";
        private const string AllowOrigin = "*"; // tighten to your app origin in production
        private static Store _store;
        private static CaptureService _capture;

        public static void Main(string[] args)
        {
            _store = new Store(Path.Combine(AppContext.BaseDirectory, "enrollments.json"));
            _capture = new CaptureService(_store);
            _capture.Start();

            var listener = new HttpListener();
            listener.Prefixes.Add(Prefix);
            listener.Start();
            Console.WriteLine("CueMii fingerprint service (direct capture) on " + Prefix);
            Console.WriteLine("Enrolled templates: " + _store.Count);

            while (true)
            {
                var ctx = listener.GetContext();
                Task.Run(() => Handle(ctx));
            }
        }

        private static void Handle(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            res.AddHeader("Access-Control-Allow-Origin", AllowOrigin);
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type");
            res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

            try
            {
                if (req.HttpMethod == "OPTIONS") { Write(res, 204, ""); return; }

                string path = req.Url.AbsolutePath.TrimEnd('/');

                if (req.HttpMethod == "GET" && path == "/health")
                {
                    WriteJson(res, 200, new
                    {
                        status = "ok",
                        reader = _capture.ReaderStatus,
                        enrolled = _capture.Enrolled,
                        mode = _capture.Mode,
                        seq = _capture.CurrentSeq
                    });
                    return;
                }

                if (req.HttpMethod == "GET" && path == "/events")
                {
                    long after = 0;
                    var q = req.QueryString["after"];
                    if (q != null) long.TryParse(q, out after);
                    WriteJson(res, 200, _capture.EventsAfter(after));
                    return;
                }

                if (req.HttpMethod == "GET" && path == "/enrollments")
                {
                    var map = new Dictionary<string, string>();
                    foreach (var kv in _store.All()) map[kv.Key] = kv.Value;
                    WriteJson(res, 200, map);
                    return;
                }

                if (req.HttpMethod == "POST" && path == "/enroll/start")
                {
                    var body = ReadJson(req);
                    string playerId = body.GetProperty("playerId").ToString();
                    _capture.StartEnroll(playerId);
                    WriteJson(res, 200, new { ok = true, required = _capture.Required });
                    return;
                }

                if (req.HttpMethod == "POST" && path == "/enroll/cancel")
                {
                    _capture.CancelEnroll();
                    WriteJson(res, 200, new { ok = true });
                    return;
                }

                if (req.HttpMethod == "POST" && path == "/reconnect")
                {
                    _capture.RequestReconnect();
                    WriteJson(res, 200, new { ok = true });
                    return;
                }

                if (req.HttpMethod == "POST" && path == "/import")
                {
                    var body = ReadJson(req);
                    var map = new Dictionary<string, string>();
                    foreach (var prop in body.GetProperty("enrollments").EnumerateObject())
                        map[prop.Name] = prop.Value.GetString();
                    _store.Import(map);
                    WriteJson(res, 200, new { ok = true, count = _store.Count });
                    return;
                }

                if (req.HttpMethod == "POST" && path == "/replace")
                {
                    var body = ReadJson(req);
                    var map = new Dictionary<string, string>();
                    foreach (var prop in body.GetProperty("enrollments").EnumerateObject())
                        map[prop.Name] = prop.Value.GetString();
                    _store.Replace(map);
                    WriteJson(res, 200, new { ok = true, count = _store.Count });
                    return;
                }

                WriteJson(res, 404, new { error = "not found" });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[error] " + ex.Message);
                WriteJson(res, 500, new { error = ex.Message });
            }
        }

        private static JsonElement ReadJson(HttpListenerRequest req)
        {
            using var sr = new StreamReader(req.InputStream, req.ContentEncoding);
            string raw = sr.ReadToEnd();
            return JsonDocument.Parse(raw).RootElement;
        }

        private static void WriteJson(HttpListenerResponse res, int status, object obj)
        {
            Write(res, status, JsonSerializer.Serialize(obj), "application/json");
        }

        private static void Write(HttpListenerResponse res, int status, string body, string contentType = "text/plain")
        {
            res.StatusCode = status;
            res.ContentType = contentType;
            byte[] buf = Encoding.UTF8.GetBytes(body ?? "");
            res.ContentLength64 = buf.Length;
            res.OutputStream.Write(buf, 0, buf.Length);
            res.OutputStream.Close();
        }
    }
}
