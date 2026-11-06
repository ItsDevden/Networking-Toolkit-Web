#!/usr/bin/env python3
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parent
index = root / "index.html"
html = index.read_text(encoding="utf-8")
for filename in ("logo.png", "style.css", "offline-source.js", "app.js", "notes.js", "notes.css", "group.js", "group-config.js", "group-merge.js", "admin.js"):
    fingerprint = hashlib.sha256((root / filename).read_bytes()).hexdigest()[:12]
    html, count = re.subn(
        rf'(?<=")({re.escape(filename)})(?:\?v=[a-zA-Z0-9_-]+)?(?=")',
        lambda match: f"{filename}?v={fingerprint}",
        html,
    )
    if not count:
        raise RuntimeError(f"Missing asset reference in index.html: {filename}")
index.write_text(html, encoding="utf-8")
print("Updated asset fingerprints in index.html")
