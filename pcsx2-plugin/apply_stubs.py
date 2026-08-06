#!/usr/bin/env python3
"""Restore DebugServer.cpp from upstream and inject controller/screenshot stubs."""
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "DebugServer.cpp"
STUB = ROOT / "controller_screenshot_stub.inc"

url = "https://raw.githubusercontent.com/hkmodd/PCSX2-MCP/main/pcsx2-plugin/DebugServer.cpp"
print("Downloading upstream DebugServer.cpp...")
text = urllib.request.urlopen(url).read().decode()
stub = STUB.read_text()

marker = "\t\t// ----- UNKNOWN COMMAND -----"
if marker not in text:
    raise SystemExit("marker not found in upstream file")
if "send_controller" not in text:
    text = text.replace(marker, stub + "\n" + marker)

old = '"is_valid_address", "clear_breakpoints"\n\t\t\t};'
new = '"is_valid_address", "clear_breakpoints",\n\t\t\t\t"send_controller", "get_screenshot"\n\t\t\t};'
if '"send_controller"' not in text:
    text = text.replace(old, new)

TARGET.write_text(text)
print(f"Wrote {TARGET} ({len(text)} bytes)")
print("Done. Rebuild PCSX2 with this DebugServer.cpp.")
