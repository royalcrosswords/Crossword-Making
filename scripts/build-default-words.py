#!/usr/bin/env python3
"""Embed the project's editable default.txt in src/default-words.js."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "default.txt"
output = ROOT / "src" / "default-words.js"
text = source.read_text(encoding="utf-8")
output.write_text(
    "/* Generated from ../default.txt by scripts/build-default-words.py. */\n"
    "window.GRIDWRIGHT_DEFAULT_TEXT = " + json.dumps(text, ensure_ascii=True) + ";\n",
    encoding="utf-8",
)
print(f"Embedded {len(text.splitlines())} lines from {source.name} into {output.relative_to(ROOT)} ({output.stat().st_size:,} bytes)")
