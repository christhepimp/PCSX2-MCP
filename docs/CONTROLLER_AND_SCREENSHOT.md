# Controller Input + Screenshot Capture

This fork adds two new MCP tools on top of upstream PCSX2-MCP:

| Tool | Purpose |
|------|---------|
| `pcsx2_send_controller` | Inject DualShock / digital pad state |
| `pcsx2_get_screenshot` | Capture current frame (base64 PNG when hooked) |

## Button bitfield (PS2 style)

Active-low in real hardware; we use **1 = pressed** for the MCP API and convert in the C++ layer:

```
bit 0  Select
bit 1  L3
bit 2  R3
bit 3  Start
bit 4  Up
bit 5  Right
bit 6  Down
bit 7  Left
bit 8  L2
bit 9  R2
bit 10 L1
bit 11 R1
bit 12 Triangle
bit 13 Circle
bit 14 Cross (X)
bit 15 Square
```

Example — press Cross on port 0:

```json
{ "buttons": 16384, "lx": 128, "ly": 128, "rx": 128, "ry": 128, "port": 0 }
```

Analog sticks are 0–255 (128 = center).

## Implementation status

### MCP / TypeScript layer (done in this fork)
- Tool definitions in `pcsx2-mcp-server/src/index.ts`
- Client methods in `debug-server-client.ts`
- JSON protocol commands: `send_controller`, `get_screenshot`

### C++ DebugServer layer (stubs + guide)
The repo only ships the **DebugServer patch**, not full PCSX2 source.
Stubs for the two commands are in `pcsx2-plugin/DebugServer.cpp`.
They currently return a clear "not fully hooked" response so the MCP tools never crash.

To finish native injection you must build against upstream PCSX2:

1. Clone https://github.com/PCSX2/pcsx2
2. Copy `pcsx2-plugin/DebugServer.cpp` + `.h` into `pcsx2/DebugTools/`
3. Wire into CMake and call `DebugServer::Start()` from VM init
4. Implement the two command handlers using:

**Controller** — look at:
- `pcsx2/PAD/` and `pcsx2/USB/` (or Qt host input path)
- `Pad::Update` / virtual pad APIs used by the recording / TAS code
- SIO pad protocol if you inject at the lowest level

**Screenshot** — easier options first:
- Host-side: capture the Qt/OpenGL/Vulkan window (external OpenCV / DXGI / X11 grab) from the Node MCP process
- Native: read from GS backend present path (`GSRenderer` / `GSDevice`) after a frame is ready, encode PNG, base64 in the JSON response

## External screenshot fallback (no C++ rebuild)

If you only need screenshots without rebuilding PCSX2, the MCP tool can be extended to shell out to:
- Windows: DXGI desktop duplication or `nircmd` / PowerShell screenshot of the PCSX2 window
- Linux: `import` (ImageMagick) or `gnome-screenshot -w`

Keep that logic in the TypeScript layer so the AI still gets a `get_screenshot` tool.

## Testing

1. Run patched PCSX2 with DebugServer listening on 21512
2. `pcsx2_connect`
3. Load a simple game (e.g. Tekken 4 demo)
4. `pcsx2_send_controller` with Cross pressed
5. `pcsx2_get_screenshot` and verify base64 / note field

Until the C++ hooks land, tools still respond with structured status so agents can detect capability.
