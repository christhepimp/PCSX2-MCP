# Setup: Controller Input + Screenshot Tools

Fork of [hkmodd/PCSX2-MCP](https://github.com/hkmodd/PCSX2-MCP) with two new features.

## Your fork
https://github.com/christhepimp/PCSX2-MCP

## Quick apply (required once after clone)

```bash
git clone https://github.com/christhepimp/PCSX2-MCP.git
cd PCSX2-MCP

# 1) Rebuild DebugServer.cpp with C++ stubs
python3 pcsx2-plugin/apply_stubs.py

# 2) Inject MCP tools into the TypeScript server
python3 pcsx2-mcp-server/src/apply_extra_tools.py

# 3) Build MCP server
cd pcsx2-mcp-server
npm install
npm run build
cd ..
```

The TypeScript client methods (`sendController`, `getScreenshot`) are already in `debug-server-client.ts`.

## New MCP tools

| Tool | Description |
|------|-------------|
| `pcsx2_send_controller` | Inject pad state (buttons bitfield + analog sticks) |
| `pcsx2_get_screenshot` | Request frame capture (base64 when GS hooked) |

## Full native support

C++ stubs return structured "not hooked yet" until you:

1. Build PCSX2 from https://github.com/PCSX2/pcsx2 with this `DebugServer.cpp`
2. Implement pad injection via `Pad` / host input / SIO
3. Implement screenshot via GS present path or window capture

Details: [docs/CONTROLLER_AND_SCREENSHOT.md](docs/CONTROLLER_AND_SCREENSHOT.md)

## Button map (1 = pressed)

```
0 Select  1 L3  2 R3  3 Start
4 Up  5 Right  6 Down  7 Left
8 L2  9 R2  10 L1  11 R1
12 Triangle  13 Circle  14 Cross  15 Square
```
