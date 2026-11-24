#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
source = root / "Source"
out = source / "offline-source.js"
old = json.loads(out.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";"))
new = {
    "script": (source / "app.js").read_text(encoding="utf-8"),
    "style": (source / "style.css").read_text(encoding="utf-8"),
    "notesScript": (source / "notes.js").read_text(encoding="utf-8"),
    "notesStyle": (source / "notes.css").read_text(encoding="utf-8"),
    "logo": old["logo"],
    "reaction67": old["reaction67"],
}
out.write_text("window.DEVDEN_OFFLINE_SOURCE=" + json.dumps(new, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
