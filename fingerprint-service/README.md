# CueMii Fingerprint Service (Direct Capture)

Owns the DigitalPersona U.are.U reader and does capture **and** matching via the
U.are.U SDK (DPUruNet). The React app polls this service for scan events — the
browser never touches the reader, so there's no WebSDK agent, certificate, or
handshake to deal with.

## Endpoints

| Method | Path             | Body                          | Returns                          |
|--------|------------------|-------------------------------|----------------------------------|
| GET    | `/health`        | —                             | `{ status, reader, enrolled, mode }` |
| GET    | `/events`        | `?after=<seq>`                | `[ { seq, type, ... } ]`         |
| POST   | `/enroll/start`  | `{ playerId }`                | `{ ok, required }`               |
| POST   | `/enroll/cancel` | —                             | `{ ok }`                         |
| POST   | `/import`        | `{ enrollments: { id: b64 } }`| `{ ok, count }` (seed from Firebase) |

Event types: `checkin{playerId}`, `unknown`, `enroll_progress{captured,required}`,
`enrolled{playerId,template}`, `enroll_error`, `reader{status}`.

Templates persist to `enrollments.json` next to the executable.

## Prerequisites

1. **U.are.U SDK** installed (provides `DPUruNet.dll` and the native runtime).
2. **DigitalPersona 4500 WBF driver** installed.
3. **.NET SDK 6.0+**.

## Setup & run

```bash
# Drop the SDK's managed DLL here:
mkdir libs
copy "C:\Program Files\DigitalPersona\U.are.U SDK\Windows\Lib\.NET\DPUruNet.dll" libs\

dotnet run
# -> CueMii fingerprint service (direct capture) on http://localhost:9001/
```

Leave it running while you use the app.

## Notes

- CORS is `*` for convenience — tighten `AllowOrigin` in `Program.cs` before any
  real deployment.
- The device/capture calls in `CaptureService.cs` (ReaderCollection, Reader.Open,
  Reader.Capture, Capabilities.Resolutions, Reader.Dispose) follow the
  DigitalPersona .NET CaptureForm sample. If a name differs in your SDK build,
  the compiler points right at it.
- If `DPUruNet.dll` targets .NET Framework, set `TargetFramework` to `net48` in
  `FingerprintService.csproj`.
