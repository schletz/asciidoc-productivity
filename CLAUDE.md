# asciidoc-productivity

Vor Änderungen am Code (src/, lib/preview.js, lib/preview.css, package.json) zuerst REFERENCE.md lesen. Sie beschreibt Befehle, Settings, Datenfluss, Invarianten und Erweiterungspunkte, sodass der Quellcode nur noch gezielt nachgelesen werden muss.

## Nach jeder Änderung am Code

1. Patch-Version im Feld `version` der package.json um eins erhöhen (z. B. 1.0.26 → 1.0.27). So bekommt jeder Stand eine eigene VSIX (der Dateiname enthält die Version), und die Commit-Nachricht folgt der Konvention `Version 1.0.x: <Änderung>`.
2. Im Projektverzeichnis `vsce package --allow-missing-repository` ausführen. Das baut über `vscode:prepublish` das Production-Bundle und erzeugt `asciidoc-productivity-<version>.vsix`. Schlägt der Befehl fehl, ist die Änderung nicht fertig.
3. REFERENCE.md mit dem Skill document-software aktualisieren, damit Verweise und Aussagen gültig bleiben.
