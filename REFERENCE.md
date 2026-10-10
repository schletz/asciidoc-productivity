# asciidoc-productivity — Agent-Referenz

Referenz der VS-Code-Extension `schletz.asciidoc-productivity` (Version 1.0.26), damit Erweiterungen, Debugging und Refactoring ohne vorheriges vollständiges Lesen des Quellcodes möglich sind.

## Zweck

- Editor-Befehle für AsciiDoc: Clipboard als Source-Block/Tabelle einfügen, Bilder (Datei, Clipboard, URL) mit relativem Pfad einfügen, AsciiDoc-Tabelle als TSV kopieren, Datei als Source-Block einfügen.
- Markdown: Clipboard-TSV als ausgerichtete Markdown-Tabelle einfügen.
- Explorer-Befehle: Dateien/Ordner rekursiv als XML oder Markdown in die Zwischenablage (LLM-Kontext), PDF-Export per Docker, Dateien per LLM umschreiben und überschreiben.
- LLM-Befehle auf Selektion: Übersetzen, beliebiger System-Prompt. Anbindung an OpenAI-kompatible Endpunkte oder die native Anthropic Messages API.
- Live-Preview im Webview (asciidoctor.js im Browser, PlantUML über lokalen Kroki-Container, highlight.js, MathJax).

## Modulüberblick

| Datei | Zeilen | Verantwortung |
| --- | --- | --- |
| src/extension.ts | 112 | registriert alle Befehle, stoppt beim Deaktivieren den Kroki-Container |
| src/globals.ts | 286 | `sourceTypes`: Dateiendung → Source-Sprachkennung (260 Einträge) |
| src/ConfigurationService.ts | 153 | liest Settings `asciidoc-productivity.*`, mischt System-Prompts |
| src/EditorService.ts | 110 | kapselt aktiven Editor: Einfügen, Dialoge, relativer Pfad |
| src/bufferExtensions.ts | 36 | `Buffer.prototype.getStringWithEncodingDetection` (BOM-Erkennung) |
| src/LLMService.ts | 299 | HTTP-Aufruf an LLM, Provider-Erkennung, Normalisierung der Antwort |
| src/TemperatureSupport.ts | 89 | entscheidet, ob `temperature` mitgesendet wird |
| src/PreviewService.ts | 287 | Singleton: Webview-Panel, Include-Auflösung, Kroki-URL-Injektion |
| src/KrokiContainerManager.ts | 123 | startet/stoppt `yuzutech/kroki` per dockerode, Health-Check |
| src/showPreview.ts | 31 | Befehls-Wrapper für `PreviewService`; Kopfkommentar = Herkunft der lib/-Bundles |
| src/exportAsPdf.ts | 219 | Theme-Abfrage, Image-Build, `asciidoctor-pdf` im Container |
| src/copySourcesToClipboard.ts | 445 | Filter-UI, rekursives Sammeln, XML/Markdown-Ausgabe, docx/pdf-Extraktion |
| src/sendFilesToAi.ts | 187 | Dateien einzeln durchs LLM schicken und überschreiben |
| src/sendToAi.ts | 129 | Selektion durch gewählten System-Prompt ersetzen |
| src/translate.ts | 112 | Selektion übersetzen |
| src/insertSourceBlock.ts | 32 | Clipboard → `[source,lang]`-Block |
| src/insertImageBlock.ts | 56 | URL im Clipboard herunterladen, speichern, `image::` einfügen |
| src/insertImageFromClipboard.ts | 57 | Clipboard-Bild per PowerShell/osascript als PNG speichern |
| src/insertImageFromFile.ts | 30 | Bild wählen, `image::` mit relativem Pfad |
| src/insertFileAsSourceBlock.ts | 37 | Explorer-Datei als Source-Block mit Link-Titel |
| src/insertTsvTable.ts | 36 | Clipboard-TSV → AsciiDoc-Tabelle |
| src/insertMarkdownTable.ts | 26 | Clipboard-TSV → Markdown-Tabelle (Wrapper) |
| src/tsvToMarkdownTable.ts | 29 | reine Funktion TSV → Markdown-Tabelle |
| src/copyAsTsv.ts | 44 | selektierte AsciiDoc-Tabelle → TSV in Clipboard |
| src/ssh2-mock.js | 11 | Webpack-Alias-Stub für `ssh2` |
| lib/preview.js | 52 | Webview-Skript: rendert bei `update`-Nachricht |
| lib/preview.css | 249 | Preview-Styles, Fonts aus lib/fonts/ |

Vendor-Bundles in lib/ (nicht editieren, Herkunft im Kopfkommentar von src/showPreview.ts:1-21): `asciidoctor.min.js` (Asciidoctor.js 3.0.4, angepasst: exportiert `window.Asciidoctor` statt ES-Default-Export), `asciidoctor-kroki.js` (setzt `window.AsciidoctorKroki`), `highlight.min.js` + Themes `vs.min.css`/`vs2015.min.css`, `tex-mml-chtml.js` (MathJax 4).

Externe Abhängigkeiten (package.json): `dockerode` (Docker-API), `tar-stream` (In-Memory-Build-Kontext), `mammoth` (docx → Text), `pdfreader` (pdf → Text). Node-`fetch` (global) für alle HTTP-Aufrufe.

Build: webpack (webpack.config.js) bündelt src/extension.ts nach dist/extension.js (commonjs2, `vscode` extern). `ssh2` ist auf src/ssh2-mock.js aliasiert, weil dockerode/docker-modem es importiert, aber nur der lokale Docker-Daemon genutzt wird. dist/ ist in .gitignore; die gebaute `.vsix` liegt dagegen im Repo. `npm run compile` | `watch` | `package` (production). F5 startet den Extension-Host (preLaunchTask `npm: watch`).

## Schnittstelle

Alle IDs mit Präfix `asciidoc-productivity.`. Aktivierung implizit über `contributes.commands` (`activationEvents` ist leer).

| Befehl | Handler | Menü / Bedingung | Eingabe → Ausgabe |
| --- | --- | --- | --- |
| insertSourceBlock | `insertSourceBlock` (src/insertSourceBlock.ts:8) | editor/context, asciidoc | Clipboard + InputBox (Default `csharp`) → `[source,lang]\n----\n…\n----` |
| insertTsvTable | `insertTsvTable` (src/insertTsvTable.ts:7) | editor/context, asciidoc | Clipboard-TSV → Tabelle |
| insertMarkdownTable | `insertMarkdownTable` (src/insertMarkdownTable.ts:8) | editor/context, **markdown** | Clipboard-TSV → Markdown-Tabelle |
| insertImageBlock | `insertImageBlock` (src/insertImageBlock.ts:8) | editor/context, asciidoc | URL im Clipboard → Download, Save-Dialog → `.Source: url\nimage::rel[]` |
| insertImageFromFile | `insertImageFromFile` (src/insertImageFromFile.ts:8) | editor/context, asciidoc | Open-Dialog → `image::rel[]` |
| insertImageFromClipboard | `insertImageFromClipboard` (src/insertImageFromClipboard.ts:9) | editor/context, asciidoc | Save-Dialog (nur png) → PNG schreiben → `image::rel[]` |
| copyAsTsv | `copyAsTsv` (src/copyAsTsv.ts:6) | editor/context, asciidoc | Selektion → Clipboard |
| translate | `translate` (src/translate.ts:15) | editor/context, editorHasSelection | Selektion → Übersetzung ersetzt Selektion |
| sendToAi | `sendToAi` (src/sendToAi.ts:20) | editor/context, editorHasSelection | Selektion → LLM-Antwort ersetzt Selektion |
| insertFileAsSourceBlock | `insertFileAsSourceBlock` (src/insertFileAsSourceBlock.ts:10) | explorer/context | Datei → Block im aktiven Editor |
| copySourcesToClipboard | `copySourcesToClipboard` (src/copySourcesToClipboard.ts:399) | explorer/context, view/title des Explorers | Auswahl → Clipboard, optional Datei |
| sendFilesToAi | `sendFilesToAi` (src/sendFilesToAi.ts:51) | explorer/context | Auswahl → jede Datei mit LLM-Antwort **überschrieben** |
| exportAsPdf | `exportAsPdf` (src/exportAsPdf.ts:165) | explorer/context, `.adoc` | `<name>.adoc` → `<name>.pdf` im selben Ordner |
| showPreview | `showPreview` (src/showPreview.ts:30) | editor/title, asciidoc | Webview neben dem Editor |

Explorer-Befehle bekommen `(clickedUri, selectedUris)` von VS Code; aus der Befehlspalette sind beide `undefined`.

### Settings

| Key | Default | Getter |
| --- | --- | --- |
| includeExtensions | Pipe-Liste aller 260 `sourceTypes`-Schlüssel | `getIncludeExtensions` (src/ConfigurationService.ts:21), entfernt Whitespace |
| excludeDirectories | `["bin","obj","node_modules"]` | `getExcludedDirectories` (:36), lowercased |
| excludeFiles | `["package-lock.json"]` | `getExcludedFiles` (:49), lowercased |
| completionsUrl | `http://localhost:1234/v1/chat/completions` (LM Studio) | `getCompletionsUrl` (:61) |
| llm | `lmstudio-community/Qwen3.6-35B-A3B-GGUF` | `getLlm` (:73) |
| maxOutputTokens | 4096 | `getMaxOutputTokens` (:85) |
| apiKey | `""` | `getApiKey` (:109) |
| systemPrompts | siehe Kernkonzept LLM | `getSystemPrompts` (:119) |
| *(deklariert als* `getDefaultTargetLanguage`*)* | `en-US` | `getDefaultTargetLanguage` (:97) liest den Key **`defaultLanguage`** (:101), der in package.json nicht deklariert ist |

Jeder Default steht doppelt: in package.json (`contributes.configuration`) und als Fallback im Getter.

## Datenfluss

### LLM-Befehle

```
activate(context)                              src/extension.ts:25
 └─ je Aufruf: new ConfigurationService(), new LLMService(cs)
     ├─ translate(cs, llm, undefined)          src/translate.ts:15
     ├─ sendToAi(cs, llm)                      src/sendToAi.ts:20
     └─ sendFilesToAi(uri, uris, cs, llm)      src/sendFilesToAi.ts:51
          └─ collectFiles(...) rekursiv        src/sendFilesToAi.ts:24
 LLMService.sendPrompt(sys, user, temp, ch)    src/LLMService.ts:85
  ├─ detectProvider(url)                       :193  host enthält "anthropic.com" → anthropic
  ├─ temperatureSupport.isSupported(model)     src/TemperatureSupport.ts:37
  ├─ postCompletion → build*Request → fetch    :174
  ├─ [!ok && 400 && Body enthält "temperature"] rememberRejection, 1× Retry ohne temperature
  └─ parseAnthropicResponse / parseOpenAiResponse  :272 / :291
```

### Preview

```
showPreview(context)                           src/PreviewService.ts:38
 ├─ [kein Panel] createPanel(...)              :92
 │    ├─ html = getWebviewContent(libUri, baseUri)   :218
 │    ├─ setupEventListeners()  onDidChangeTextDocument → updateContent   :133
 │    ├─ setTimeout(updateContent, 500)        :119
 │    └─ onDidChangeViewState(visible) → updateContent; onDidDispose → dispose
 │  startKrokiInBackground()                   :63
 │    └─ KrokiContainerManager.start()         src/KrokiContainerManager.ts:20
 │         ├─ image inspect / pull yuzutech/kroki:latest
 │         ├─ createContainer (AutoRemove, 8000/tcp → HostPort 0) → port
 │         └─ waitForKroki(port)               :87
 │       danach updateContent(doc)
 └─ [Panel existiert] reveal + updateContent
updateContent(doc)                             :163
 ├─ resolveLocalIncludes(text, uri)            :196
 ├─ injectKrokiAttribute(text)                 :148
 └─ webview.postMessage({command:'update', text})
lib/preview.js  message 'update' → asciidoctor.convert → innerHTML → hljs.highlightAll → MathJax.typesetPromise
```

Reihenfolge-Invarianten:

1. **Panel vor Kroki.** Die Preview erscheint sofort; Diagramme werden erst nach dem Refresh am Ende von `startKrokiInBackground` (:84-88) gegen den lokalen Container gerendert.
2. **Erstes `updateContent` verzögert um 500 ms** (:119) — damit der lokale Kroki-Server im Container betriebsbereit ist (laut User). Zusätzlich gilt: `lib/preview.js` ist `defer` geladen und registriert den `message`-Listener erst nach den Vendor-Bundles; eine frühere Nachricht hat keinen Empfänger.
3. **Includes vor Kroki-Attribut.** `injectKrokiAttribute` sucht die Titelzeile im bereits aufgelösten Text.
4. **Script-Reihenfolge im Webview** (:276-280): asciidoctor → asciidoctor-kroki → highlight → MathJax → preview.js. `window.MathJax`-Konfiguration muss vor `tex-mml-chtml.js` stehen.

### PDF-Export

```
exportAsPdf(clickedUri)                        src/exportAsPdf.ts:165
 ├─ getThemeParameter(dirPath, baseName)       :18   Dialoge, ggf. Theme-Kopie
 └─ withProgress:
      docker.ping() → ensureDockerImage()      :71
      → runAsciidoctorContainer(...)           :113
      → .asciidoctor/ im Dokumentordner löschen   :193-196
      finally: temporäre Theme-Datei löschen   :210
```

## Kernkonzept: LLM-Anbindung

**Provider** (`detectProvider`, src/LLMService.ts:193): Host enthält `anthropic.com` → Anthropic, sonst OpenAI-Dialekt (auch bei unparsebarer URL).

| | Anthropic (`buildAnthropicRequest` :207) | OpenAI-kompatibel (`buildOpenAiRequest` :240) |
| --- | --- | --- |
| URL | `new URL('messages', base)`; `completionsUrl` muss die **Basis** sein, z. B. `https://api.anthropic.com/v1/` | `completionsUrl` unverändert, muss vollständiger Pfad sein |
| Auth | `x-api-key`, `anthropic-version: 2023-06-01` | `Authorization: Bearer <key>`, ohne Key `Bearer EMPTY` |
| System-Prompt | Feld `system` | Message mit `role: system` |
| Inhalt | alle `content`-Blöcke mit `type === 'text'` verkettet, getrimmt | `choices[0].message.content.trim()` |
| Abgeschnitten | `stop_reason === 'max_tokens'` | `finish_reason === 'length'` |

**Temperature** (`TemperatureSupport`, src/TemperatureSupport.ts:19): Regex `claude-(family)-(major)(-minor)?` (:30). Nicht gesendet bei major ≥ 5 und bei `opus` 4.7+; Nicht-Claude-IDs und datierte Claude-3-IDs (`claude-3-opus-…`) gelten als unterstützt. Laufzeit-Fallback: HTTP 400 mit „temperature“ im Body → Modell in `rejectedModels`, einmaliger Retry ohne Parameter. **Lebensdauer:** `LLMService` (und damit `TemperatureSupport`) wird pro Befehlsaufruf neu erzeugt (src/extension.ts:59, :68, :86); das Merken wirkt nur innerhalb eines Aufrufs, z. B. über mehrere Dateien von `sendFilesToAi`.

**Statistik:** `stats` ist `null`, wenn die Antwort keine `completionTokens` meldet (:150). Die Abschneide-Warnung in den Befehlen hängt an `stats.hasLengethExeeded` (Schreibfehler im Feldnamen, PromptStats :11) und entfällt damit ohne Usage-Angabe.

**System-Prompts** (`getSystemPrompts` :119): Nutzerliste aus `globalValue` **oder** (nur wenn global leer) `workspaceValue` — nicht gemischt. Danach werden die drei eingebauten Prompts (:122-138, „Check spelling and grammar“ 0.1, „Simplify text“ 0.2, „Cleanup and Comment codefile“ 0.1) angehängt, sofern kein Nutzer-Prompt denselben `name` trägt. Der Default in package.json (zwei Prompts ohne `temperature`) wird nie gelesen, weil `inspect` statt `get` verwendet wird. Fehlt `temperature` an einem Nutzer-Prompt, gilt 0.1 (src/sendToAi.ts:49, src/sendFilesToAi.ts:79).

**Translate-Prompt** (src/translate.ts:63-70): Text in `<text_to_translate>`-Tags, System-Prompt verbietet, Anweisungen im Text zu befolgen (Schutz gegen Prompt-Injection aus dem Dokument). Temperatur fest 0.1.

## Kernkonzept: Preview

- **Include-Auflösung** (`resolveLocalIncludes` :196): Regex `^include::([^\[]+)\[(.*?)\]` (multiline). Pfad relativ zum Dokumentordner, Datei wird synchron mit `fs.readFileSync(…, 'utf8')` komplett eingesetzt. Attribute in `[...]` (`tag=`, `lines=`, `leveloffset=`) und Attributreferenzen im Pfad werden ignoriert. Nur eine Ebene: `include::` im eingesetzten Text bleibt stehen. Fehlende Datei → Kommentarzeile `// ERROR: File not found: …`. Nur für `file:`-URIs.
- **Kroki-Attribut** (`injectKrokiAttribute` :148): Nur wenn `krokiManager.port` gesetzt ist. Beginnt der Text mit einer Zeile `=…`, wird `:kroki-server-url: http://localhost:<port>` direkt dahinter eingefügt, sonst samt Leerzeile vorangestellt. Ohne Port setzt die Extension kein Attribut; asciidoctor-kroki fällt dann auf seinen eigenen Default `https://kroki.io` zurück (lib/asciidoctor-kroki.js:20591).
- **Render-Optionen** (lib/preview.js:7-16): `safe: 'safe'`, `showtitle`, `icons: font`, `kroki-default-format: svg`, `source-highlighter: highlight.js`, `stem: latexmath`. MathJax: inline `\( \)` und `$ $`, display `\[ \]`, `startup.typeset: false`, Menü/Speech/Braille aus (src/PreviewService.ts:250-274).
- **Webview** (`createPanel` :92): `enableScripts`, `retainContextWhenHidden`. `localResourceRoots` = lib/ + alle Workspace-Ordner (ohne Workspace: Dokumentordner). `<base href>` = Dokumentordner, damit relative Bildpfade laden. CSP (:228) erlaubt `img-src https: http: data:` (nötig für Kroki), Skripte nur inline und aus lib/.
- **Singleton**: ein Panel für die gesamte Sitzung (`getInstance` :25). Erneutes `showPreview` aus einem anderen Editor setzt `sourceUri` um; das Panel folgt dann diesem Dokument.
- **Kroki-Lebenszyklus**: Container pro Panel. Start bei Panel-Erzeugung, `stop()` beim Schließen des Panels (`dispose` :174) und in `deactivate` (src/extension.ts:111). `start()` ist gegen parallele Aufrufe über `startupPromise` gesperrt (src/KrokiContainerManager.ts:20-33).

## Konstanten-Referenz

| Konstante | Ort | Wert / Bedeutung |
| --- | --- | --- |
| `sourceTypes` | src/globals.ts:5 | 260 Endungen → Sprach-ID. **Invariante:** Schlüsselmenge == Default von `includeExtensions` in package.json:26 und src/ConfigurationService.ts:25 (derzeit identisch, nicht abgeleitet) |
| `maxSourceFileSizeBytes` | src/copySourcesToClipboard.ts:90 | 51 200 B = 50 KiB, gilt für Endungen in `sourceTypes`; Erfahrungswert (laut User) |
| `maxFileSizeBytes` | src/copySourcesToClipboard.ts:89 | 10 485 760 B = 10 MiB, gilt für alle anderen Endungen (u. a. docx/pdf); Erfahrungswert (laut User) |
| `MAX_CHARS` | src/sendToAi.ts:35, src/translate.ts:45 | 16 384 Zeichen; nur Warnung, kein Abbruch. Schutz vor großem Tokenverbrauch bei API-Key und Cloud-Modell (laut User). Zwei unabhängige Kopien |
| Timeout erstes Rendern | src/PreviewService.ts:119 | 500 ms, Begründung siehe Invariante 2 (laut User) |
| `maxAttempts` × Pause | src/KrokiContainerManager.ts:89, :100 | 20 × 500 ms ≈ 10 s plus Fetch-Zeit; Erfahrungswert (laut User) |
| Kroki-Image | src/KrokiContainerManager.ts:37, :43, :65 | `yuzutech/kroki:latest`, Containerport 8000, Hostport zufällig (`'0'`) |
| PDF-Image | src/exportAsPdf.ts:73, :91 | `asciidoctor-pandoc` (lokal gebaut aus `asciidoctor/docker-asciidoctor` + `apk add pandoc`, :80-85) |
| `anthropic-version` | src/LLMService.ts:230 | `2023-06-01`, Pflicht-Header der Messages API |
| `printRawHtml` | src/PreviewService.ts:6 | `false`; Debug-Schalter, zeigt generiertes HTML als Text |
| Default-Sprache Source-Block | src/insertSourceBlock.ts:14 | `csharp` |

## Externe Systeme

| System | Aufruf | Details |
| --- | --- | --- |
| LLM-Endpunkt | `fetch` POST (src/LLMService.ts:182) | kein Timeout, kein Retry außer dem Temperature-Retry |
| Docker (Preview) | dockerode `new Docker()` mit Default-Socket/Named-Pipe | Image-Pull nur, wenn `inspect` fehlschlägt; keine Aktualisierung von `latest` |
| Kroki-Server | Browser lädt SVG über `http://localhost:<port>`; Health-Check `fetch('http://localhost:<port>/')` | ohne Port: öffentliches `https://kroki.io` (Diagrammquelltext verlässt den Rechner) |
| Docker (PDF) | `buildImage` aus In-Memory-Tar (tar-stream), dann `createContainer` | Mount `<Dokumentordner>:/documents`, `AutoRemove`, Logs per `demuxStream` ins Output-Channel; Exit-Code ≠ 0 → Fehler |
| asciidoctor-pdf | Cmd src/exportAsPdf.ts:120-130 | `[--theme X] -r asciidoctor-mathematical -r asciidoctor-diagram -a allow-uri-read -a stem -a mathematical-format=svg -o <name>.pdf <datei>`; pandoc ist im Image, wird aber nicht aufgerufen |
| Bild-Download | `fetch(url)` (src/insertImageBlock.ts:37) | nur `http://`/`https://`-Prefix geprüft |
| Clipboard-Bild | `child_process.exec` (src/insertImageFromClipboard.ts:43) | win32: PowerShell + System.Windows.Forms (:34); darwin: osascript `«class PNGf»` (:36); Linux: Fehlermeldung |

Output-Channels: „AsciiDoc Preview“ (src/KrokiContainerManager.ts:4, exportiert und von PreviewService mitbenutzt), „AsciiDoc PDF Export“ (src/exportAsPdf.ts:8), „LLM“ (translate), „LLM-SendToAi“, „LLM-SendFilesToAi“. Alle werden beim Modul-Import angelegt.

## Details

- **copySourcesToClipboard** (`SourceCopier`, src/copySourcesToClipboard.ts:81):
  - Ziele: `selectedUris` > `clickedUri` > erster Workspace-Ordner (:404-414).
  - Filter-QuickPick (`promptForFilters` :317): drei Filter, UND-verknüpft, jeder mit eigener Regex über Edit-Button. `extensions` → `^(…)$`, Flag `i`, gegen nackte Endung; `filenames` → Flag `i`, gegen relativen Pfad mit `/`; `content` → Flags `is`, gegen den gelesenen Inhalt (bei zu großen Dateien gegen den Platzhaltertext). Abgewählter Extensions-Filter = alle Endungen. Das `editing`-Flag (:351) verhindert, dass das temporäre Ausblenden während der InputBox als Abbruch gilt.
  - Verschachtelte Ziele (`execute` :147-153): Ist ein Ziel Vorfahre eines anderen gewählten Ziels, wird der **Vorfahre** verworfen und nur das innere Ziel verarbeitet. Zusätzlich verhindert `processedFilePaths` doppelte Dateien.
  - Ausschlüsse: Ordnernamen aus `excludeDirectories` und alle Ordner mit führendem `.` (auch als direkt gewähltes Ziel); Dateinamen aus `excludeFiles`. Vergleich case-insensitiv auf dem Basisnamen.
  - Relativer Pfad bezogen auf den ersten Workspace-Ordner; liegt die Datei außerhalb, nur Basisname.
  - Lesen: `.docx` → mammoth `extractRawText`, `.pdf` → pdfreader (Textstücke mit Leerzeichen verkettet); Fehler werden als `[Error extracting …]` in den Inhalt geschrieben. Alles andere → `getStringWithEncodingDetection`. docx/pdf stehen nicht im Default von `includeExtensions` und müssen im Filter ergänzt werden.
  - Ausgabe XML: `<documents root=… created=ISO>` + je Datei `<file path language><![CDATA[…]]></file>`. Markdown: `# root`, je Datei `## File pfad` + Codefence. `language` = `sourceTypes[ext] ?? ext`. Keinerlei Escaping (Attributwerte, `]]>` im Inhalt, ``` im Inhalt).
  - Danach Clipboard schreiben, Rückfrage „als Datei speichern?“ mit Save-Dialog.
- **AsciiDoc-Tabellenformat** (src/insertTsvTable.ts:20-28): `[%header,cols="a,a,…"]` (Spaltenzahl aus erster Zeile), jede Zelle auf eigener Zeile mit `|`, Zeilen durch Leerzeile getrennt. `copyAsTsv` (src/copyAsTsv.ts:22-28) ist die Umkehrung **genau dieses Formats**: entfernt `|===`-Zeilen, trennt Zeilen an ≥ 2 Zeilenumbrüchen, Zellen an `|`. Tabellen ohne Leerzeilen zwischen den Zeilen werden zu einer einzigen TSV-Zeile; `|` in Zellen wird nicht escaped (in beiden Richtungen).
- **Markdown-Tabelle** (`tsvToMarkdownTable`, src/tsvToMarkdownTable.ts:8): erste Zeile = Header, `|` → `\|`, Zellen getrimmt, Spaltenbreite = max(3, breiteste escapte Zelle), fehlende Zellen leer aufgefüllt; nur abschließende Zeilenumbrüche werden entfernt (Tabs am Ende bleiben leere Zellen). Leere Eingabe → `''`. Einzige reine, ohne VS Code testbare Funktion.
- **Encoding** (src/bufferExtensions.ts:13): BOM FF FE → UTF-16LE, FE FF → UTF-16BE via `swap16` (bei ungerader Länge UTF-8-Fallback; `swap16` verändert den Buffer in place), sonst UTF-8; führendes U+FEFF wird entfernt. Wirkt nur, weil src/extension.ts:2 das Modul seiteneffekthaft importiert. Ausgaben schreibt die Extension immer als UTF-8 ohne BOM.
- **Relative Pfade** (`getRelativeAsciiDocPath`, src/EditorService.ts:96): relativ zum Ordner des aktiven Dokuments, Backslashes → `/`.
- **insertFileAsSourceBlock** (src/insertFileAsSourceBlock.ts:29): `.link:rel[→ name]` als Blocktitel, `[source,lang]` aus `sourceTypes`, sonst `[source]`; danach Fokus zurück in den Editor.
- **sendFilesToAi** (src/sendFilesToAi.ts): sammelt **alle** Dateien rekursiv (nur Ordner mit führendem `.` übersprungen; `includeExtensions`/`exclude*` gelten nicht). Fortschritt proportional zur Dateigröße. Abbruch nur zwischen zwei Dateien. Entfernt eine umschließende Codefence aus der Antwort (:163-166). Bei abgeschnittener Antwort modale Warnung und Datei bleibt unverändert.
- **Theme-Auswahl PDF** (`getThemeParameter` :18): existiert `<name>.yml` neben der Datei → Rückfrage. Sonst optional Datei-Dialog; liegt das Theme unterhalb des Dokumentordners (case-insensitiver Präfixvergleich der Pfadstrings, :50), wird relativ referenziert, sonst als `.temp-theme-<timestamp>.yml` in den Dokumentordner kopiert und danach gelöscht.

## Fehlerbehandlung

| Situation | Verhalten |
| --- | --- |
| Kein aktiver Editor bei Insert-Befehlen | `EditorService`-Konstruktor wirft `No editor open.` → `showErrorMessage` |
| Dokument ungespeichert (Bild-Befehle) | Fehlermeldung, Abbruch (`isDocumentSaved`) — gilt nicht für `insertImageFromFile` und `insertFileAsSourceBlock` |
| Clipboard leer | Warnung, Abbruch |
| LLM HTTP-Fehler | `Error("API Error: Status … - <Body>")`; translate → ErrorMessage, sendToAi → WarningMessage, sendFilesToAi → Output-Channel + Zähler, Schlussmeldung |
| LLM-Antwort ohne `choices[0].message.content` (OpenAI) | TypeError, landet im jeweiligen catch |
| Docker nicht erreichbar | `error.syscall === 'connect'` → Hinweis auf `docker ps` (Preview: src/PreviewService.ts:72, PDF: src/exportAsPdf.ts:201) |
| Kroki-Start scheitert | ErrorMessage, Preview läuft weiter; ohne Port rendern Diagramme über kroki.io |
| Kroki-Health-Check läuft ab | `Error` nach ~10 s; Container und `port` bleiben gesetzt, bis das Panel geschlossen wird |
| PDF-Konvertierung Exit ≠ 0 | ErrorMessage mit Exit-Code, Details im Output-Channel |
| Include-Datei fehlt / unlesbar | `// ERROR: …`-Kommentar im gerenderten Text |
| Render-Fehler im Webview | rote Fehlermeldung im `#content` (lib/preview.js:45-52), MathJax-Fehler nur `console.error` |
| docx/pdf-Extraktion scheitert | Fehlertext wird als Dateiinhalt ausgegeben |
| Clipboard ohne Bild | `exec`-Fehler → „No image found in the clipboard.“ |
| Ungültige Regex im Copy-Filter | `RegExp`-Konstruktor wirft → „Error during copying: …“ |

Benutzermeldungen sind englisch; Ausnahme: Beschreibungen im Format-QuickPick von copySourcesToClipboard (deutsch, :418-419). Kein Logging-Framework, nur Output-Channels und `console.error`.

## Erweiterungspunkte

**Neuer Befehl** — `contributes.commands` in package.json, optional Eintrag unter `contributes.menus` (Kontext über `when`, Position über `group`), Handler-Datei in src/, `registerCommand` in `activate` (src/extension.ts:25) **und** in `context.subscriptions.push` (:91-105) aufnehmen. Explorer-Befehle erhalten `(clickedUri, selectedUris)`; Abhängigkeiten (`ConfigurationService`, `LLMService`) werden in der Lambda in extension.ts erzeugt und übergeben.

**Neues Setting** — Property in package.json (`contributes.configuration.properties`) **und** Getter mit identischem Key und Default in `ConfigurationService` (src/ConfigurationService.ts). Key-Namen exakt abgleichen; es gibt keine Prüfung.

**Neue Dateiendung / Sprache** — Eintrag in `sourceTypes` (src/globals.ts:5) **und** im `includeExtensions`-Default an zwei Stellen (package.json:26, src/ConfigurationService.ts:25), sonst wird die Endung von copySourcesToClipboard standardmäßig nicht erfasst. `sourceTypes` steuert außerdem die 50-KiB-Grenze (Endung bekannt) vs. 10 MiB.

**Neuer Extraktor für Binärformate** (z. B. xlsx) — Funktion nach dem Muster von `copyDocx` (src/copySourcesToClipboard.ts:33) und Eintrag in `parsers` (:73). Endung nicht in `sourceTypes` aufnehmen, sonst greift die 50-KiB-Grenze.

**Neuer eingebauter System-Prompt** — Array `defaultPrompts` (src/ConfigurationService.ts:122). Der Default in package.json wird zur Laufzeit nicht gelesen; nur aus Dokumentationsgründen mitpflegen.

**Neuer LLM-Provider-Dialekt** — `ApiProvider` (src/LLMService.ts:24) erweitern, `detectProvider` (:193), eigenes `build…Request` und `parse…Response`, Verzweigungen in `postCompletion` (:178) und `sendPrompt` (:142). Gemeinsames Rückgabeformat ist `CompletionData` (:29).

**Weitere Modelle ohne Temperature** — Regel in `isSupportedByModelId` (src/TemperatureSupport.ts:71). Der Laufzeit-Fallback fängt Unbekanntes ab, kostet aber je Befehlsaufruf einen Fehl-Request.

**Preview-Rendering anpassen** — Asciidoctor-Attribute in lib/preview.js:9-15, MathJax-Konfiguration in `getWebviewContent` (src/PreviewService.ts:250), Styles in lib/preview.css, Fonts in lib/fonts/. Neue externe Ressourcen müssen zur CSP (:228) passen und unter lib/ liegen (`localResourceRoots`). Vendor-Bundles neu beziehen nach der Anleitung in src/showPreview.ts:1-21; asciidoctor.js braucht dabei den Patch auf `window.Asciidoctor`.

**PDF-Export erweitern** — Kommandozeile in `runAsciidoctorContainer` (src/exportAsPdf.ts:120). Zusätzliche Pakete im Image: Dockerfile-String (:80); bestehende Images werden nicht neu gebaut, solange `asciidoctor-pandoc:latest` existiert — Nutzer müssen das Image manuell löschen.

**Release** — `version` in package.json erhöhen, `vsce package --allow-missing-repository` (README). Commit-Konvention im Repo: `Version 1.0.x: <Änderung>`.

## Fallstricke

- **Destruktiv:** `sendFilesToAi` überschreibt jede gesammelte Datei ohne Rückfrage oder Backup mit der LLM-Antwort — einschließlich Binärdateien und Inhalten von `node_modules`/`bin`, da keine Filter greifen. `exportAsPdf` überschreibt `<name>.pdf` und löscht den Ordner `.asciidoctor/` im Dokumentordner rekursiv. `insertImageBlock`/`insertImageFromClipboard` überschreiben die im Save-Dialog gewählte Datei.
- **`sendToAi` ist nicht in `context.subscriptions`** (src/extension.ts:91-105 enthält `sendToAiCmd` nicht); die Registrierung funktioniert, wird aber beim Deaktivieren nicht disposed.
- **`defaultLanguage` vs. `getDefaultTargetLanguage`:** Der in package.json deklarierte Key wird nie gelesen; wirksam ist nur ein manuell gesetztes `asciidoc-productivity.defaultLanguage`.
- **`translate` ersetzt die Selektion zum Antwortzeitpunkt** (`activeEditor.selection`, src/translate.ts:95), `sendToAi` dagegen die beim Start gemerkte Selektion (src/sendToAi.ts:111). Bewegt der Nutzer während der Anfrage den Cursor, landet die Übersetzung an der neuen Stelle. Der Datei-Zweig von `translate` (`clickedUri`) ist unbenutzt, extension.ts übergibt immer `undefined`.
- **Anthropic-URL:** `completionsUrl` muss auf `…/v1/` enden; ein vollständiger Pfad `…/v1/messages` ergibt `…/v1/messages/messages`.
- **Preview-Last:** Jeder Tastendruck schickt den gesamten Text, liest alle Includes synchron von der Platte und rendert komplett neu (kein Debounce).
- **Externe Diagrammdienste:** Solange kein lokaler Kroki-Port bekannt ist (Docker fehlt, Start läuft noch oder scheiterte vor `inspect`), gehen PlantUML-Quelltexte an `https://kroki.io`. Die Fehlermeldung spricht dagegen von „without PlantUML support“.
- **PDF-Mount:** Nur der Ordner der `.adoc`-Datei ist im Container sichtbar; Includes und Bilder außerhalb davon fehlen im PDF. `allow-uri-read` erlaubt Netzwerkzugriffe aus dem Dokument.
- **Clipboard-Bild Windows:** `savePath` wird in einen PowerShell-String in einfachen Anführungszeichen interpoliert (src/insertImageFromClipboard.ts:34); Pfade mit `'` brechen das Skript.
- **Plattform:** `insertImageFromClipboard` nur Windows/macOS. Docker-Funktionen setzen einen erreichbaren lokalen Daemon voraus.
- **Typunsicherheit:** `getStringWithEncodingDetection` wird teils über `(Buffer.from(...) as any)` aufgerufen; Antwort-JSON der LLMs ist `any`.
- **Keine Tests:** .vscode-test.mjs erwartet `out/test/**/*.test.js`, es existiert aber kein Testverzeichnis. Qualitätssicherung nur über `npm run lint` (eslint, wenige Regeln in eslint.config.mjs) und `tsc` im strict-Modus.
- **Kein Timeout/Retry** bei LLM-Requests und Bild-Downloads; ein hängender Endpunkt blockiert die Fortschrittsanzeige (bei translate/sendToAi nicht abbrechbar).
