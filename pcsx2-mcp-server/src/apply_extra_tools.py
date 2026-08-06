#!/usr/bin/env python3
"""Inject pcsx2_send_controller + pcsx2_get_screenshot tools into index.ts"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.ts"

NEW_TOOLS = r'''
// ==========================================================
//  TOOL: pcsx2_send_controller  (Controller Input API)
// ==========================================================
server.tool('pcsx2_send_controller',
  'Inject DualShock/digital pad state into PCSX2. buttons bitfield (1=pressed): bit0=Select,1=L3,2=R3,3=Start,4=Up,5=Right,6=Down,7=Left,8=L2,9=R2,10=L1,11=R1,12=Triangle,13=Circle,14=Cross,15=Square. Analogs 0-255 (128=center). See docs/CONTROLLER_AND_SCREENSHOT.md.',
  {
    buttons: z.number().int().min(0).max(0xffff).default(0),
    lx: z.number().int().min(0).max(255).default(128),
    ly: z.number().int().min(0).max(255).default(128),
    rx: z.number().int().min(0).max(255).default(128),
    ry: z.number().int().min(0).max(255).default(128),
    port: z.number().int().min(0).max(1).default(0),
    slot: z.number().int().min(0).max(1).default(0),
  },
  async ({ buttons, lx, ly, rx, ry, port, slot }) => {
    if (!hasDebug()) {
      return { content: [{ type: 'text' as const, text: 'Error: DebugServer not connected. Call pcsx2_connect first.' }], isError: true };
    }
    try {
      const resp = await debugServer!.sendController({ buttons, lx, ly, rx, ry, port, slot });
      if (resp.ok === false) {
        return { content: [{ type: 'text' as const, text: `Controller reached DebugServer but pad hook not complete.\n${resp.error || resp.message || JSON.stringify(resp)}\nSee docs/CONTROLLER_AND_SCREENSHOT.md` }] };
      }
      return { content: [{ type: 'text' as const, text: `Controller sent (port ${port}): buttons=0x${buttons.toString(16)} lx=${lx} ly=${ly} rx=${rx} ry=${ry}` }] };
    } catch (e: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ==========================================================
//  TOOL: pcsx2_get_screenshot  (Frame Capture)
// ==========================================================
server.tool('pcsx2_get_screenshot',
  'Capture current emulator frame as base64 PNG when GS hook exists; otherwise returns status. See docs/CONTROLLER_AND_SCREENSHOT.md.',
  {
    max_width: z.number().int().min(160).max(1920).default(640),
    format: z.enum(['png', 'raw']).default('png'),
  },
  async ({ max_width, format }) => {
    if (!hasDebug()) {
      return { content: [{ type: 'text' as const, text: 'Error: DebugServer not connected.' }], isError: true };
    }
    try {
      const resp = await debugServer!.getScreenshot({ max_width, format });
      if (resp.data) {
        return { content: [{ type: 'text' as const, text: `Screenshot ${resp.width}x${resp.height}\ndata:image/png;base64,${resp.data.slice(0, 64)}...` }] };
      }
      return { content: [{ type: 'text' as const, text: `Screenshot: ${resp.note || resp.error || JSON.stringify(resp)}` }] };
    } catch (e: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
    }
  }
);

'''

text = INDEX.read_text()
if "pcsx2_send_controller" in text:
    print("Tools already present")
else:
    marker = "// ===== MAIN ====="
    if marker not in text:
        raise SystemExit("MAIN marker not found")
    text = text.replace(marker, NEW_TOOLS + marker)
    INDEX.write_text(text)
    print(f"Updated {INDEX}")
print("Done. Run: cd pcsx2-mcp-server && npm install && npm run build")
