#!/usr/bin/env python3
"""Regression checks for desktop HTTP static files and animated themes."""
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
html=(root/"web/index.html").read_text(encoding="utf-8-sig")
host=(root/"LocalServer.cs").read_text(encoding="utf-8-sig")
animated=(root/"web/animated-themes.css").read_text(encoding="utf-8-sig")
core=(root/"web/core.js").read_text(encoding="utf-8-sig")
# Both apps serve files from explicit deny-by-default routes. Every local stylesheet
# referenced by index.html must appear in the C# allowlist, otherwise CSS quietly 404s.
sheets=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
assert sheets,"No stylesheet links found"
for path in sheets:
    assert path.startswith(tuple("abcdefghijklmnopqrstuvwxyz")),path
    assert "/"+path in host, f"Local host does not serve {path}; animation will not work"
assert "animated-themes.css" in sheets,"Animated stylesheet missing from HTML"
assert "text/css" in host,"Local host must send CSS MIME"
for theme in ("living-sunset","living-aurora","living-ocean","living-plum"):
    assert ('data-theme="'+theme+'"') in animated,theme
    assert theme in core, "Theme must exist in chooser: "+theme
assert "@keyframes fundivoice-gradient-drift" in animated
assert "background-position" in animated and "22s" in animated
assert 'body[data-motion="off"]' in animated
assert "prefers-reduced-motion" in animated
print("PASS: "+", ".join(sheets)+" served; four motion gradients selectable and animated")
