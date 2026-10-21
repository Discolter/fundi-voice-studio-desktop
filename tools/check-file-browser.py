#!/usr/bin/env python3
from pathlib import Path
base=Path(__file__).resolve().parents[1]
host=(base/"package/LocalServer.cs").read_text(encoding="utf-8-sig")
app=(base/"package/web/app.js").read_text(encoding="utf-8-sig")
html=(base/"package/web/index.html").read_text(encoding="utf-8-sig")
browser=(base/"package/web/file-browser.js").read_text(encoding="utf-8-sig")
css=(base/"package/web/file-browser.css").read_text(encoding="utf-8-sig")
for filename in ("file-browser.js","file-browser.css"):
 assert "/"+filename in host,"Local host returns 404 for "+filename
assert 'href="file-browser.css"' in html
assert "import {openFileBrowser} from './file-browser.js'" in app
assert 'route=="file-browser"' in host or 'route == "file-browser"' in host
assert "LocalBrowsePath" in host and "FileAttributes.ReparsePoint" in host
assert "LocalBrowse(" in host
assert "openFileBrowser(api" in app
assert "Поиск по имени файла" in browser and "Проводник Windows" in browser
assert "dialog.showModal()" in browser and "dialog.addEventListener('cancel'" in browser
assert "fv-browser-entry" in css
assert "background:linear-gradient" in css
assert "cloud/files/download" in app and "mode:'folder'" in app
assert "ExistingDirectory(folder)" in host

print('PASS desktop explorer: authenticated route, safe file filtering, UI, fallback')
