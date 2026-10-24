# asciidoc-productivity — Agent-Referenz

Referenz der VS-Code-Extension `schletz.asciidoc-productivity` (Version 1.0.27), damit Erweiterungen, Debugging und Refactoring ohne vorheriges vollständiges Lesen des Quellcodes möglich sind.

## Zweck

- Editor-Befehle für AsciiDoc **und Markdown** (Markup-Befehle): Clipboard als Source-Block/Tabelle einfügen, Bilder (Datei, Clipboard, URL) mit relativem Pfad einfügen, Tabelle als TSV kopieren, Datei als Source-Block einfügen. Die Syntax wählt `MarkupSyntax` je Dokument. Nur Markdown: Spalten der Tabelle unter dem Cursor ausrichten (formatTable).
- Explorer-Befehle: Dateien/Ordner rekursiv als XML oder Markdown in die Zwischenablage (LLM-Kontext), PDF-Export per Docker, Dateien per LLM umschreiben und überschreiben.
- LLM-Befehle auf Selektion: Übersetzen, beliebiger System-Prompt. Anbindung an OpenAI-kompatible Endpunkte oder die native Anthropic Messages API.
- Live-Preview im Webview (asciidoctor.js im Browser, PlantUML über lokalen Kroki-Container, highlight.js, MathJax).

## Modulüberblick

| Datei | Zeilen | Verantwortung |
| --- | --- | --- |
| src/extension.ts | 116 | registriert alle Befehle, stoppt beim Deaktivieren den Kroki-Container |
| src/globals.ts | 286 | `sourceTypes`: Dateiendung → Source-Sprachkennung (260 Einträge) |
| src/ConfigurationService.ts | 153 | liest Settings `asciidoc-productivity.*`, mischt System-Prompts |
| src/EditorService.ts | 127 | kapselt aktiven Editor: Einfügen, Zeilen ersetzen, Dialoge, relativer Pfad |
| src/runMarkupCommand.ts | 33 | Wrapper für Markup-Befehle: EditorService + Syntax erzeugen, Fehler anzeigen |
| src/MarkupSyntax.ts | 76 | Interface der Markup-Erzeugung/-Analyse, Typen `TableRows`, `FormattedTable` |
| src/createMarkupSyntax.ts | 35 | Factory: languageId bzw. Dateiendung → Syntax |
| src/AsciidocSyntax.ts | 53 | AsciiDoc-Markup |
| src/MarkdownSyntax.ts | 88 | Markdown-Markup (CommonMark/GFM), Tabelle unter dem Cursor finden |
| src/MarkdownTable.ts | 134 | GFM-Tabelle: parsen inkl. Ausrichtung, ausgerichtet rendern |
| src/formatTable.ts | 29 | Befehl: Tabelle unter dem Cursor formatieren |
| src/parseTsv.ts | 20 | reine Funktion TSV → `TableRows` |
| src/tableCells.ts | 18 | Zellen an unescapten `\|` trennen, `|` escapen (beide Syntaxen) |
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
| src/insertSourceBlock.ts | 24 | Clipboard → Source-Block |
| src/insertImageBlock.ts | 44 | URL im Clipboard herunterladen, speichern, Bild mit Quelle einfügen |
| src/insertImageFromClipboard.ts | 48 | Clipboard-Bild per PowerShell/osascript als PNG speichern |
| src/insertImageFromFile.ts | 23 | Bild wählen, Bildreferenz mit relativem Pfad |
| src/insertFileAsSourceBlock.ts | 36 | Explorer-Datei als Source-Block mit Link |
| src/insertTsvTable.ts | 19 | Clipboard-TSV → Tabelle |
| src/copyAsTsv.ts | 26 | selektierte Tabelle → TSV in Clipboard |
| src/ssh2-mock.js | 11 | Webpack-Alias-Stub für `ssh2` |
| lib/preview.js | 52 | Webview-Skript: rendert bei `update`-Nachricht |
| lib/preview.css | 249 | Preview-Styles, Fonts aus lib/fonts/ |
| .vscode-test.mjs | 30 | Testkonfiguration: frischer Workspace je Lauf, Launch-Argumente, Mocha-Optionen |
| src/test/helpers/TestWorkspace.ts | 119 | Dateien/Editoren im Test-Workspace, Aktivierung, `runCommand` |
| src/test/helpers/CommandTestContext.ts | 41 | Mocha-Hooks je E2E-Suite: Aktivierung, Sandbox, Aufräumen |
| src/test/helpers/MockFileServer.ts | 41 | lokaler HTTP-Server mit festen Dateien (Bild-Download) |
| src/test/helpers/FakeClipboard.ts | 28 | ersetzt `vscode.env.clipboard` durch Speicher |
| src/test/helpers/MockLlmServer.ts | 153 | lokaler HTTP-Server im OpenAI-/Anthropic-Format, zeichnet Requests auf |
| src/test/helpers/TestSettings.ts | 35 | Settings je Test setzen und zurücksetzen |
| src/test/e2e/*.test.ts | 37–93 je Datei | je Markup-Befehl AsciiDoc + Markdown (insertSourceBlock, insertTsvTable, copyAsTsv, insertFileAsSourceBlock, insertImage, formatTable), Wrapper-Fehler (runMarkupCommand), sendToAi gegen OpenAI-/Anthropic-Mock |
| src/test/unit/*.test.ts | 24–104 je Datei | AsciidocSyntax, MarkdownSyntax, MarkdownTable, parseTsv, createMarkupSyntax ohne Extension Host |

Vendor-Bundles in lib/ (nicht editieren, Herkunft im Kopfkommentar von src/showPreview.ts:1-21): `asciidoctor.min.js` (Asciidoctor.js 3.0.4, angepasst: exportiert `window.Asciidoctor` statt ES-Default-Export), `asciidoctor-kroki.js` (setzt `window.AsciidoctorKroki`), `highlight.min.js` + Themes `vs.min.css`/`vs2015.min.css`, `tex-mml-chtml.js` (MathJax 4).

Externe Abhängigkeiten (package.json): `dockerode` (Docker-API), `tar-stream` (In-Memory-Build-Kontext), `mammoth` (docx → Text), `pdfreader` (pdf → Text). Node-`fetch` (global) für alle HTTP-Aufrufe. Nur für Tests (devDependencies): `@vscode/test-cli`, `@vscode/test-electron`, `@types/mocha`, `sinon`.

Build: webpack (webpack.config.js) bündelt src/extension.ts nach dist/extension.js (commonjs2, `vscode` extern). `ssh2` ist auf src/ssh2-mock.js aliasiert, weil dockerode/docker-modem es importiert, aber nur der lokale Docker-Daemon genutzt wird. dist/ ist in .gitignore; die gebaute `.vsix` liegt dagegen im Repo. `npm run compile` | `watch` | `package` (production). F5 startet den Extension-Host (preLaunchTask `npm: watch`). `npm test` → `pretest` (`tsc` nach out/, webpack nach dist/, eslint) → `vscode-test`. out/ und .vscode-test/ stehen in .gitignore und sind über .vscodeignore nicht in der VSIX.

## Schnittstelle

Alle IDs mit Präfix `asciidoc-productivity.`. Aktivierung implizit über `contributes.commands` (`activationEvents` ist leer).

| Befehl | Handler | Menü / Bedingung | Eingabe → Ausgabe |
| --- | --- | --- | --- |
| insertSourceBlock | `insertSourceBlock` (src/insertSourceBlock.ts:11) | editor/context, Markup | Clipboard + InputBox (Default `csharp`) → `sourceBlock` |
| insertTsvTable | `insertTsvTable` (src/insertTsvTable.ts:11) | editor/context, Markup | Clipboard-TSV → `parseTsv` → `table` |
| insertImageBlock | `insertImageBlock` (src/insertImageBlock.ts:11) | editor/context, Markup | URL im Clipboard → Save-Dialog → Download → `imageWithSource` |
| insertImageFromFile | `insertImageFromFile` (src/insertImageFromFile.ts:10) | editor/context, Markup | Open-Dialog → `image` |
| insertImageFromClipboard | `insertImageFromClipboard` (src/insertImageFromClipboard.ts:16) | editor/context, Markup | Save-Dialog (nur png) → PNG schreiben → `image` |
| copyAsTsv | `copyAsTsv` (src/copyAsTsv.ts:10) | editor/context, Markup | Selektion → `parseTable` → TSV in Clipboard |
| formatTable | `formatTable` (src/formatTable.ts:12) | editor/context, **Markdown** (`editorLangId == markdown || resourceExtname =~ /^\.(md|markdown)$/i`) | Cursorzeile (`selection.active`) → `formatTableAt` → Tabellenzeilen ersetzt |
| translate | `translate` (src/translate.ts:15) | editor/context, editorHasSelection | Selektion → Übersetzung ersetzt Selektion |
| sendToAi | `sendToAi` (src/sendToAi.ts:20) | editor/context, editorHasSelection | Selektion → LLM-Antwort ersetzt Selektion |
| insertFileAsSourceBlock | `insertFileAsSourceBlock` (src/insertFileAsSourceBlock.ts:14) | explorer/context | Datei → `fileSourceBlock` im aktiven Editor |
| copySourcesToClipboard | `copySourcesToClipboard` (src/copySourcesToClipboard.ts:399) | explorer/context, view/title des Explorers | Auswahl → Clipboard, optional Datei |
| sendFilesToAi | `sendFilesToAi` (src/sendFilesToAi.ts:51) | explorer/context | Auswahl → jede Datei mit LLM-Antwort **überschrieben** |
| exportAsPdf | `exportAsPdf` (src/exportAsPdf.ts:165) | explorer/context, `.adoc` | `<name>.adoc` → `<name>.pdf` im selben Ordner |
| showPreview | `showPreview` (src/showPreview.ts:30) | editor/title, asciidoc | Webview neben dem Editor |

Explorer-Befehle bekommen `(clickedUri, selectedUris)` von VS Code; aus der Befehlspalette sind beide `undefined`.

„Markup“ in der Menüspalte = `when`-Klausel `editorLangId =~ /^(asciidoc|markdown)$/ || resourceExtname =~ /^\.(adoc|asciidoc|asc|md|markdown)$/i` (package.json, sechs editor/context-Einträge). In der Befehlspalette sind alle Befehle immer sichtbar; Markup-Befehle melden in anderen Dokumenten einen Fehler.

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
| defaultLanguage | `en-US` | `getDefaultTargetLanguage` (:97); InputBox-Vorgabe von translate |

Jeder Default steht doppelt: in package.json (`contributes.configuration`) und als Fallback im Getter.

## Datenfluss

### LLM-Befehle

```
activate(context)                              src/extension.ts:26
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

### Markup-Befehle

```
activate(context)                              src/extension.ts:26
 └─ registerCommand(id, runMarkupCommand(handler))
runMarkupCommand(handler)(...vscodeArgs)       src/runMarkupCommand.ts:21
 ├─ new EditorService()                        wirft "No editor open."
 ├─ createMarkupSyntax(editor.document)        src/createMarkupSyntax.ts:26
 │    ├─ [languageId asciidoc ODER Endung .adoc/.asciidoc/.asc] → AsciidocSyntax
 │    ├─ [languageId markdown ODER Endung .md/.markdown]       → MarkdownSyntax
 │    └─ sonst Error "Only AsciiDoc and Markdown documents are supported."
 ├─ handler(editorService, syntax, ...vscodeArgs)
 │    └─ syntax.xyz(...) → editorService.insertAtCurrentPosition(text)
 └─ catch: jeder Error → showErrorMessage(message)
```

1. **Syntax pro Aufruf.** Sie hängt am beim Aufruf aktiven Dokument und kann deshalb nicht bei der Aktivierung injiziert werden.
2. **Fehler vs. Warnung.** Handler werfen bei Fehlern (Meldung = `Error.message`); Hinweise wie „Clipboard is empty.“ zeigen sie selbst per `showWarningMessage` und kehren normal zurück.
3. **Prüfung vor Dialog.** Handler prüfen Voraussetzungen (Dokument gespeichert, Plattform, URL) vor dem Save-Dialog; abgebrochene Dialoge enden ohne Meldung.

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

**Temperature** (`TemperatureSupport`, src/TemperatureSupport.ts:19): Regex `claude-(family)-(major)(-minor)?` (:30). Nicht gesendet bei major ≥ 5 und bei `opus` 4.7+; Nicht-Claude-IDs und datierte Claude-3-IDs (`claude-3-opus-…`) gelten als unterstützt. Laufzeit-Fallback: HTTP 400 mit „temperature“ im Body → Modell in `rejectedModels`, einmaliger Retry ohne Parameter. **Lebensdauer:** `LLMService` (und damit `TemperatureSupport`) wird pro Befehlsaufruf neu erzeugt (src/extension.ts:63, :72, :90); das Merken wirkt nur innerhalb eines Aufrufs, z. B. über mehrere Dateien von `sendFilesToAi`.

**Statistik:** `stats` ist `null`, wenn die Antwort keine `completionTokens` meldet (:150). Die Abschneide-Warnung in den Befehlen hängt an `stats.hasLengethExeeded` (Schreibfehler im Feldnamen, PromptStats :11) und entfällt damit ohne Usage-Angabe.

**System-Prompts** (`getSystemPrompts` :119): Nutzerliste aus `globalValue` **oder** (nur wenn global leer) `workspaceValue` — nicht gemischt. Danach werden die drei eingebauten Prompts (:122-138, „Check spelling and grammar“ 0.1, „Simplify text“ 0.2, „Cleanup and Comment codefile“ 0.1) angehängt, sofern kein Nutzer-Prompt denselben `name` trägt. Der Default in package.json (zwei Prompts ohne `temperature`) wird nie gelesen, weil `inspect` statt `get` verwendet wird. Fehlt `temperature` an einem Nutzer-Prompt, gilt 0.1 (src/sendToAi.ts:49, src/sendFilesToAi.ts:79).

**Translate-Prompt** (src/translate.ts:63-70): Text in `<text_to_translate>`-Tags, System-Prompt verbietet, Anweisungen im Text zu befolgen (Schutz gegen Prompt-Injection aus dem Dokument). Temperatur fest 0.1.

## Kernkonzept: MarkupSyntax

`MarkupSyntax` (src/MarkupSyntax.ts) ist ein Interface aus reinen String-Funktionen ohne `vscode`-Import; Implementierungen `AsciidocSyntax` (src/AsciidocSyntax.ts:7) und `MarkdownSyntax` (src/MarkdownSyntax.ts:8). Jede erzeugende Methode liefert den kompletten Einfügetext **mit abschließendem `\n`**. `TableRows` = `string[][]`, erste Zeile Header, alle Zeilen gleich lang, Zellen ohne Escaping.

| Methode | AsciiDoc | Markdown |
| --- | --- | --- |
| `sourceBlock(c, lang?)` | `[source,lang]` bzw. `[source]`, `----` … `----` | Fence ```` ```lang ````; Länge = max(3, längste Backtick-Folge am Zeilenanfang im Inhalt (≤ 3 Leerzeichen Einzug) + 1) |
| `fileSourceBlock(c, lang, rel, name)` | `.link:rel[→ name]` als Blocktitel + `sourceBlock` | Zeile `[→ name](rel)` + `sourceBlock` |
| `image(rel)` | `image::rel[]` | `![name](rel)`, `name` = Dateiname ohne Endung (`path.posix.parse`) |
| `imageWithSource(rel, url)` | `.Source: url` + `image` (sichtbare Bildunterschrift) | `image` + Leerzeile + `*Source: <url>*` |
| `table(rows)` | `[%header,cols="a,…"]` (Spaltenzahl = Zellen der ersten Zeile), `|===`, jede Zelle eigene Zeile `|zelle`, Zeilen durch Leerzeile getrennt | `MarkdownTable.render` ohne Ausrichtung |
| `parseTable(text)` | entfernt `|===`-Zeilen, trennt Zeilen an ≥ 2 Zeilenumbrüchen, Zellen an unescapten `|` | `MarkdownTable.parse(…).rows` |
| `formatTableAt?(lines, line)` | nicht implementiert (`undefined`) | siehe Markdown-Tabellen |

Gemeinsame Regeln:

- **Escaping:** `|` in Zellen → `\|` (`escapeTableCell`, src/tableCells.ts:16); `parseTable` trennt an unescapten `|` und entescaped (`splitTableCells`, :8). `table` und `parseTable` sind je Syntax zueinander invers (Unit-Tests).
- **TSV** (`parseTsv`, src/parseTsv.ts:10): nur abschließende Zeilenumbrüche entfernt (Tabs am Ende bleiben leere Zellen), LF/CRLF, Zellen getrimmt, kürzere Zeilen mit `''` aufgefüllt bis zur breitesten. Leere Eingabe → `[]`; `table([])` → `''`.
- **Markdown-Links:** Pfade mit Leerzeichen werden als `<rel>` geschrieben (CommonMark); `[` und `]` im Link-/Alt-Text werden mit `\` escaped. AsciiDoc escaped weder Pfade noch Dateinamen.
- **Sprach-IDs** in Source-Blöcken für beide Syntaxen aus `sourceTypes` (src/globals.ts:5).

### Markdown-Tabellen

`MarkdownTable` (src/MarkdownTable.ts) hält `rows` (unescaped) und je Spalte eine `ColumnAlignment` (`none|left|center|right`); `normalized` füllt Zeilen und Ausrichtungen auf die größte Spaltenzahl auf, die Tabelle ist also immer rechteckig.

- **`parse(lines)`** (:35): Zeilen getrimmt, nur Zeilen mit unescaptem `|` (`isRow` :52), äußere Pipes optional. Die erste Trennzeile (`delimiterRowPattern` :8) liefert die Ausrichtung (`:-` links, `-:` rechts, `:-:` zentriert), weitere Trennzeilen werden verworfen. Mehr Zellen als im Header → Header bekommt leere Zellen (GFM würde sie verwerfen).
- **`render(indent)`** (:70): Breite je Spalte = max(3, breiteste escapte Zelle) in **Codepoints** (Emoji/CJK sehen im Editor trotzdem versetzt aus); Inhalt nach Ausrichtung gepolstert, bei `center` das ungerade Leerzeichen rechts; Trennzeile `|:----|----:|` mit Breite + 2 Zeichen je Zelle. Ergebnis ohne abschließenden Zeilenumbruch, mit LF; jede Zeile mit `indent` präfixiert.
- **`formatTableAt(lines, line)`** (src/MarkdownSyntax.ts:54): Tabelle = Block zusammenhängender `isRow`-Zeilen um `line`, dessen **zweite** Zeile eine Trennzeile ist; sonst `undefined`. Einrückung der ersten Zeile wird für alle Zeilen übernommen. Fenced Code Blocks werden nicht erkannt: Pipe-Zeilen mit Trennzeile in einem Codeblock gelten als Tabelle.
- **Ersetzen** (`replaceLines`, src/EditorService.ts:54): ganze Zeilen `startLine..endLine` ohne den letzten Zeilenumbruch; identischer Text (CRLF normalisiert verglichen) wird nicht geschrieben, das Dokument bleibt dann unverändert/nicht dirty. VS Code wandelt die LF des Ersatztexts in das EOL des Dokuments.

## Kernkonzept: Preview

- **Include-Auflösung** (`resolveLocalIncludes` :196): Regex `^include::([^\[]+)\[(.*?)\]` (multiline). Pfad relativ zum Dokumentordner, Datei wird synchron mit `fs.readFileSync(…, 'utf8')` komplett eingesetzt. Attribute in `[...]` (`tag=`, `lines=`, `leveloffset=`) und Attributreferenzen im Pfad werden ignoriert. Nur eine Ebene: `include::` im eingesetzten Text bleibt stehen. Fehlende Datei → Kommentarzeile `// ERROR: File not found: …`. Nur für `file:`-URIs.
- **Kroki-Attribut** (`injectKrokiAttribute` :148): Nur wenn `krokiManager.port` gesetzt ist. Beginnt der Text mit einer Zeile `=…`, wird `:kroki-server-url: http://localhost:<port>` direkt dahinter eingefügt, sonst samt Leerzeile vorangestellt. Ohne Port setzt die Extension kein Attribut; asciidoctor-kroki fällt dann auf seinen eigenen Default `https://kroki.io` zurück (lib/asciidoctor-kroki.js:20591).
- **Render-Optionen** (lib/preview.js:7-16): `safe: 'safe'`, `showtitle`, `icons: font`, `kroki-default-format: svg`, `source-highlighter: highlight.js`, `stem: latexmath`. MathJax: inline `\( \)` und `$ $`, display `\[ \]`, `startup.typeset: false`, Menü/Speech/Braille aus (src/PreviewService.ts:250-274).
- **Webview** (`createPanel` :92): `enableScripts`, `retainContextWhenHidden`. `localResourceRoots` = lib/ + alle Workspace-Ordner (ohne Workspace: Dokumentordner). `<base href>` = Dokumentordner, damit relative Bildpfade laden. CSP (:228) erlaubt `img-src https: http: data:` (nötig für Kroki), Skripte nur inline und aus lib/.
- **Singleton**: ein Panel für die gesamte Sitzung (`getInstance` :25). Erneutes `showPreview` aus einem anderen Editor setzt `sourceUri` um; das Panel folgt dann diesem Dokument.
- **Kroki-Lebenszyklus**: Container pro Panel. Start bei Panel-Erzeugung, `stop()` beim Schließen des Panels (`dispose` :174) und in `deactivate` (src/extension.ts:116). `start()` ist gegen parallele Aufrufe über `startupPromise` gesperrt (src/KrokiContainerManager.ts:20-33).

## Kernkonzept: Tests

`vscode-test` (Konfiguration .vscode-test.mjs) lädt VS Code stable nach .vscode-test/vscode-*, startet es mit dem Projekt als `extensionDevelopmentPath` und führt `out/test/**/*.test.js` im Extension Host aus (Mocha, UI `tdd`: `suite`/`test`/`setup`/`teardown`). Die Extension läuft dabei aus dem Bundle dist/extension.js (package.json `main`), also derselbe Code wie in der VSIX. Läuft parallel zu einem geöffneten VS Code derselben Version.

- **E2E-Tests** (src/test/e2e/) rufen Befehle nur über `TestWorkspace.runCommand` (src/test/helpers/TestWorkspace.ts:116) bzw. `vscode.commands.executeCommand` auf und prüfen Dokumentinhalt, Clipboard-Fake, Mock-Requests und gestubbte Meldungen. `executeCommand` wartet auf das Promise des Handlers.
- **Unit-Tests** (src/test/unit/) importieren Module aus out/ (tsc-Ausgabe), nicht aus dem Bundle. Für zustandsbehaftete Module (`PreviewService`-Singleton, Output-Channels) entstünde eine zweite Instanz neben der der Extension; nur für reine Funktionen verwenden.

Warum Stubs wirken: Tests und Extension liegen im selben Extension-Verzeichnis und bekommen dasselbe `vscode`-API-Objekt. `sinon`-Stubs auf `vscode.window.*` (`showQuickPick`, `showInputBox`, `showWarningMessage`, `showSaveDialog`, …) sieht deshalb auch der Code der Extension. Ebenso teilen beide `globalThis.fetch` des Prozesses.

| Baustein | Ort | Verhalten |
| --- | --- | --- |
| Test-Workspace | .vscode-test.mjs:11-18 | `.vscode-test/workspace` wird bei **jedem Laden der Konfiguration** gelöscht und leer neu angelegt, mit `.vscode/settings.json` = `{"files.eol": "\n"}` |
| Launch-Argumente | .vscode-test.mjs:25 | `--disable-extensions` (keine fremden Extensions), `--disable-workspace-trust` |
| Mocha-Timeout | .vscode-test.mjs:28 | 20 000 ms je Test, pauschal gewählter Puffer, kein Messwert |
| `openDocument(path, content)` | src/test/helpers/TestWorkspace.ts:69 | schreibt die Datei in den Workspace und öffnet sie; Text zwischen `«` und `»` wird Selektion, `«»` setzt den Cursor, ohne Marker Cursor auf 0 |
| `openUntitledDocument(languageId)` | :93 | nie gespeichertes Dokument (Scheme `untitled`), für `isDocumentSaved`-Fälle |
| `closeAllEditors()` | :101 | revertiert zuerst alle dirty Dokumente, sonst blockiert der modale Speichern-Dialog den Lauf |
| `FakeClipboard` | src/test/helpers/FakeClipboard.ts:26 | `sandbox.replaceGetter(vscode.env, 'clipboard', …)`; Inhalt im Feld `text` |
| `MockLlmServer` | src/test/helpers/MockLlmServer.ts:38 | `127.0.0.1`, freier Port; Pfad endet auf `/messages` → Anthropic-Format, sonst OpenAI (:126); Usage immer 10/20 Tokens, damit `stats` gesetzt ist; `respondWith(content, truncated)` / `respondWithError(status, body)` gelten für alle folgenden Requests |
| `interceptAnthropic(sandbox)` | :87 | stubbt `globalThis.fetch` und leitet `https://api.anthropic.com/v1/` auf den Mock um |
| `CommandTestContext.register()` | src/test/helpers/CommandTestContext.ts:22 | registriert `suiteSetup` (Aktivierung), `setup` (Sandbox), `teardown` (`restore`, `closeAllEditors`); `context.sandbox` nur innerhalb eines Tests |
| `MockFileServer.start(files)` | src/test/helpers/MockFileServer.ts:15 | `127.0.0.1`, freier Port, feste Bodies je Pfad, sonst 404 |
| `TestSettings` | src/test/helpers/TestSettings.ts:17 | schreibt mit `ConfigurationTarget.Workspace`, `restore()` setzt die vorherigen Workspace-Werte zurück |

Invarianten:

1. **Ein Dateipfad pro Test.** VS Code hält geschlossene Dokumente im Speicher; `openDocument` auf einen schon benutzten Pfad kann den alten Inhalt liefern.
2. **Zeilenende.** Leere und neue Dokumente bekommen durch `files.eol` LF; Dokumente mit Inhalt behalten das erkannte Zeilenende. CRLF-Fälle testet man mit CRLF im Inhalt.
3. **Clipboard nur über das Fake.** `vscode.env.clipboard` selbst ist eingefroren (`sandbox.stub(clipboard, 'readText')` wirft); ohne `FakeClipboard` schreiben Tests in die echte Zwischenablage des Rechners.
4. **Anthropic nur per Fetch-Umleitung.** `detectProvider` (src/LLMService.ts:193) verlangt `anthropic.com` im Host, eine localhost-URL landet immer im OpenAI-Zweig.
5. **Settings im Workspace-Ziel.** `getSystemPrompts` liest `globalValue || workspaceValue`; ein Test-`systemPrompts` im Workspace greift nur, solange im Test-Profil (.vscode-test/user-data, bleibt zwischen Läufen erhalten) kein globaler Wert steht.
6. **Sandbox je Test.** Stubs nur über `context.sandbox` (bzw. eine eigene Sandbox mit `restore()` in `teardown`); ein nicht zurückgesetzter Stub auf `vscode.window` wirkt in allen folgenden Suites.
7. **`.adoc` ist `plaintext`.** Wegen `--disable-extensions` testen E2E-Tests für AsciiDoc den Endungs-Fallback von `createMarkupSyntax`, Markdown dagegen die languageId `markdown` der eingebauten Extension.

Nicht abgedeckt durch die Umgebung: Kontextmenüs und `when`-Klauseln (es werden nur Befehle ausgeführt; außerdem registriert ohne AsciiDoc-Extension niemand die Sprach-ID `asciidoc`, `.adoc` öffnet als `plaintext`), Inhalt des Preview-Webviews, Docker-Funktionen (Kroki, PDF-Export), native Dialoge ohne Stub.

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
| `asciidocExtensions`, `markdownExtensions` | src/createMarkupSyntax.ts:16-17 | `.adoc .asciidoc .asc` / `.md .markdown`. **Invariante:** dieselbe Liste steht als Regex in den sechs editor/context-`when`-Klauseln der package.json (nicht abgeleitet) |

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
- **AsciiDoc-`parseTable`** (src/AsciidocSyntax.ts:45) liest **nur das eigene Format** von `table`: Tabellen ohne Leerzeilen zwischen den Zeilen (`|a |b` auf einer Zeile) werden zu einer einzigen TSV-Zeile; eine mitselektierte Attributzeile `[%header,…]` landet als Zelleninhalt im TSV.
- **copyAsTsv** (src/copyAsTsv.ts:10): Zellen mit `\t`, Zeilen mit `\n` verbunden; Ergebnis nur aus Whitespace → Warnung „Could not extract table data.“, Clipboard bleibt.
- **Encoding** (src/bufferExtensions.ts:13): BOM FF FE → UTF-16LE, FE FF → UTF-16BE via `swap16` (bei ungerader Länge UTF-8-Fallback; `swap16` verändert den Buffer in place), sonst UTF-8; führendes U+FEFF wird entfernt. Wirkt nur, weil src/extension.ts:2 das Modul seiteneffekthaft importiert. Ausgaben schreibt die Extension immer als UTF-8 ohne BOM.
- **Relative Pfade** (`getRelativePath`, src/EditorService.ts:113): relativ zum Ordner des aktiven Dokuments, Backslashes → `/`; gilt für beide Syntaxen.
- **insertFileAsSourceBlock** (src/insertFileAsSourceBlock.ts:14): Sprache aus `sourceTypes`, unbekannte Endung → ohne Sprache; danach Fokus zurück in den Editor.
- **insertImageFromClipboard** (src/insertImageFromClipboard.ts:16): wartet auf das Ende des PowerShell-/osascript-Prozesses (`promisify(exec)`), erst dann wird eingefügt.
- **sendFilesToAi** (src/sendFilesToAi.ts): sammelt **alle** Dateien rekursiv (nur Ordner mit führendem `.` übersprungen; `includeExtensions`/`exclude*` gelten nicht). Fortschritt proportional zur Dateigröße. Abbruch nur zwischen zwei Dateien. Entfernt eine umschließende Codefence aus der Antwort (:163-166). Bei abgeschnittener Antwort modale Warnung und Datei bleibt unverändert.
- **Theme-Auswahl PDF** (`getThemeParameter` :18): existiert `<name>.yml` neben der Datei → Rückfrage. Sonst optional Datei-Dialog; liegt das Theme unterhalb des Dokumentordners (case-insensitiver Präfixvergleich der Pfadstrings, :50), wird relativ referenziert, sonst als `.temp-theme-<timestamp>.yml` in den Dokumentordner kopiert und danach gelöscht.

## Fehlerbehandlung

| Situation | Verhalten |
| --- | --- |
| Kein aktiver Editor bei Markup-Befehlen | `EditorService`-Konstruktor wirft `No editor open.` → `runMarkupCommand` → `showErrorMessage` |
| Dokument weder AsciiDoc noch Markdown | `createMarkupSyntax` wirft → ErrorMessage, Dokument unverändert |
| Markup-Befehl wirft beliebigen Error | `runMarkupCommand` zeigt `error.message`, sonst „An unknown error occurred.“ |
| Dokument ungespeichert (`insertImageBlock`, `insertImageFromClipboard`) | ErrorMessage „Please save the document first …“ vor dem Save-Dialog (`isDocumentSaved`) — gilt nicht für `insertImageFromFile` und `insertFileAsSourceBlock` |
| formatTable in AsciiDoc (Befehlspalette) | ErrorMessage „Formatting tables is only supported in Markdown documents.“ |
| formatTable, Cursor nicht in einer Tabelle | WarningMessage „Place the cursor inside a Markdown table.“, Dokument unverändert |
| insertFileAsSourceBlock ohne Uri (Befehlspalette) | ErrorMessage „This command must be called from the file explorer.“ |
| Bild-Download HTTP ≠ 2xx | ErrorMessage mit Status; die Zieldatei wird nicht geschrieben |
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
| Clipboard ohne Bild | Exit-Code ≠ 0 → ErrorMessage „Error: No image found in the clipboard.“; auf Linux ErrorMessage vor dem Save-Dialog |
| Ungültige Regex im Copy-Filter | `RegExp`-Konstruktor wirft → „Error during copying: …“ |

Benutzermeldungen sind englisch; Ausnahme: Beschreibungen im Format-QuickPick von copySourcesToClipboard (deutsch, :418-419). Kein Logging-Framework, nur Output-Channels und `console.error`.

## Erweiterungspunkte

**Neuer Befehl** — `contributes.commands` in package.json, optional Eintrag unter `contributes.menus` (Kontext über `when`, Position über `group`), Handler-Datei in src/, `registerCommand` in `activate` (src/extension.ts:26) **und** in `context.subscriptions.push` (:95-109) aufnehmen. Explorer-Befehle erhalten `(clickedUri, selectedUris)`; Abhängigkeiten (`ConfigurationService`, `LLMService`) werden in der Lambda in extension.ts erzeugt und übergeben.

**Neuer Markup-Befehl** (für AsciiDoc und Markdown) — Handler mit Signatur `(editorService, syntax, ...vscodeArgs)` (`MarkupCommandHandler`, src/runMarkupCommand.ts:10), Fehler werfen statt melden, registrieren mit `runMarkupCommand(handler)`. Neue Syntax-Ausgabe als Methode in `MarkupSyntax` **und** in beiden Implementierungen; Menüeintrag mit der Markup-`when`-Klausel (siehe Schnittstelle).

**Tabellenformatierung für AsciiDoc** — `formatTableAt` in `AsciidocSyntax` implementieren; `formatTable` (src/formatTable.ts:12) prüft nur, ob die Methode existiert. Danach die `when`-Klausel von formatTable in package.json auf die Markup-Klausel erweitern. `AsciidocSyntax.parseTable` liest nur das Layout von `table` (Details) und taugt für von Hand geschriebene Tabellen nicht.

**Neue Markup-Sprache** (z. B. reStructuredText) — Klasse `implements MarkupSyntax`, Zweig in `createMarkupSyntax` (src/createMarkupSyntax.ts:26) mit languageId und Endungsliste, dieselben Endungen in die Regex aller sechs Markup-`when`-Klauseln in package.json. Unit-Test nach dem Muster von src/test/unit/MarkdownSyntax.test.ts.

**Neues Setting** — Property in package.json (`contributes.configuration.properties`) **und** Getter mit identischem Key und Default in `ConfigurationService` (src/ConfigurationService.ts). Key-Namen exakt abgleichen; es gibt keine Prüfung.

**Neue Dateiendung / Sprache** — Eintrag in `sourceTypes` (src/globals.ts:5) **und** im `includeExtensions`-Default an zwei Stellen (package.json:26, src/ConfigurationService.ts:25), sonst wird die Endung von copySourcesToClipboard standardmäßig nicht erfasst. `sourceTypes` steuert außerdem die 50-KiB-Grenze (Endung bekannt) vs. 10 MiB.

**Neuer Extraktor für Binärformate** (z. B. xlsx) — Funktion nach dem Muster von `copyDocx` (src/copySourcesToClipboard.ts:33) und Eintrag in `parsers` (:73). Endung nicht in `sourceTypes` aufnehmen, sonst greift die 50-KiB-Grenze.

**Neuer eingebauter System-Prompt** — Array `defaultPrompts` (src/ConfigurationService.ts:122). Der Default in package.json wird zur Laufzeit nicht gelesen; nur aus Dokumentationsgründen mitpflegen.

**Neuer LLM-Provider-Dialekt** — `ApiProvider` (src/LLMService.ts:24) erweitern, `detectProvider` (:193), eigenes `build…Request` und `parse…Response`, Verzweigungen in `postCompletion` (:178) und `sendPrompt` (:142). Gemeinsames Rückgabeformat ist `CompletionData` (:29).

**Weitere Modelle ohne Temperature** — Regel in `isSupportedByModelId` (src/TemperatureSupport.ts:71). Der Laufzeit-Fallback fängt Unbekanntes ab, kostet aber je Befehlsaufruf einen Fehl-Request.

**Preview-Rendering anpassen** — Asciidoctor-Attribute in lib/preview.js:9-15, MathJax-Konfiguration in `getWebviewContent` (src/PreviewService.ts:250), Styles in lib/preview.css, Fonts in lib/fonts/. Neue externe Ressourcen müssen zur CSP (:228) passen und unter lib/ liegen (`localResourceRoots`). Vendor-Bundles neu beziehen nach der Anleitung in src/showPreview.ts:1-21; asciidoctor.js braucht dabei den Patch auf `window.Asciidoctor`.

**PDF-Export erweitern** — Kommandozeile in `runAsciidoctorContainer` (src/exportAsPdf.ts:120). Zusätzliche Pakete im Image: Dockerfile-String (:80); bestehende Images werden nicht neu gebaut, solange `asciidoctor-pandoc:latest` existiert — Nutzer müssen das Image manuell löschen.

**Neuer Test** — Datei `src/test/e2e/<befehl>.test.ts` nach dem Muster von src/test/e2e/insertImage.test.ts: im Suite-Body `const context = CommandTestContext.register()` (Aktivierung, Sandbox je Test, Aufräumen), im Test Stubs für alle Dialoge des Befehls über `context.sandbox`; mit Settings zusätzlich `settings.restore()` im eigenen `teardown` (Muster src/test/e2e/sendToAi.test.ts). Markup-Befehle je einmal mit `.adoc` und `.md` testen. Explorer-Befehle bekommen den Uri als Argument: `runCommand('x', vscode.Uri.file(TestWorkspace.writeFile(...)))`. Nicht-modale Meldungen (`showInformationMessage`) stubben, sobald der Test ihren Aufruf prüft; modale Meldungen (`{ modal: true }`) **müssen** gestubbt werden, sonst wartet der Befehl. Neue Mock-Antwortformate in `MockLlmServer.handle` (src/test/helpers/MockLlmServer.ts:107).

**Release** — `version` in package.json erhöhen, `vsce package --allow-missing-repository` (README). Commit-Konvention im Repo: `Version 1.0.x: <Änderung>`.

## Fallstricke

- **Destruktiv:** `sendFilesToAi` überschreibt jede gesammelte Datei ohne Rückfrage oder Backup mit der LLM-Antwort — einschließlich Binärdateien und Inhalten von `node_modules`/`bin`, da keine Filter greifen. `exportAsPdf` überschreibt `<name>.pdf` und löscht den Ordner `.asciidoctor/` im Dokumentordner rekursiv. `insertImageBlock`/`insertImageFromClipboard` überschreiben die im Save-Dialog gewählte Datei.
- **`sendToAi` ist nicht in `context.subscriptions`** (src/extension.ts:95-109 enthält `sendToAiCmd` nicht); die Registrierung funktioniert, wird aber beim Deaktivieren nicht disposed.
- **`translate` ersetzt die Selektion zum Antwortzeitpunkt** (`activeEditor.selection`, src/translate.ts:95), `sendToAi` dagegen die beim Start gemerkte Selektion (src/sendToAi.ts:111). Bewegt der Nutzer während der Anfrage den Cursor, landet die Übersetzung an der neuen Stelle. Der Datei-Zweig von `translate` (`clickedUri`) ist unbenutzt, extension.ts übergibt immer `undefined`.
- **Anthropic-URL:** `completionsUrl` muss auf `…/v1/` enden; ein vollständiger Pfad `…/v1/messages` ergibt `…/v1/messages/messages`.
- **Preview-Last:** Jeder Tastendruck schickt den gesamten Text, liest alle Includes synchron von der Platte und rendert komplett neu (kein Debounce).
- **Externe Diagrammdienste:** Solange kein lokaler Kroki-Port bekannt ist (Docker fehlt, Start läuft noch oder scheiterte vor `inspect`), gehen PlantUML-Quelltexte an `https://kroki.io`. Die Fehlermeldung spricht dagegen von „without PlantUML support“.
- **PDF-Mount:** Nur der Ordner der `.adoc`-Datei ist im Container sichtbar; Includes und Bilder außerhalb davon fehlen im PDF. `allow-uri-read` erlaubt Netzwerkzugriffe aus dem Dokument.
- **Clipboard-Bild Windows:** `savePath` wird in einen PowerShell-String in einfachen Anführungszeichen interpoliert (src/insertImageFromClipboard.ts:24); Pfade mit `'` brechen das Skript.
- **Plattform:** `insertImageFromClipboard` nur Windows/macOS. Docker-Funktionen setzen einen erreichbaren lokalen Daemon voraus.
- **Typunsicherheit:** `getStringWithEncodingDetection` wird teils über `(Buffer.from(...) as any)` aufgerufen; Antwort-JSON der LLMs ist `any`.
- **Testabdeckung:** Tests existieren für alle Markup-Befehle und formatTable (insertImageFromClipboard nur der Fall „Dokument ungespeichert“, weil das Bild aus der echten Zwischenablage kommt), sendToAi und die Syntax-Schicht (Kernkonzept Tests). translate, sendFilesToAi, copySourcesToClipboard, exportAsPdf und showPreview sind ungetestet; daneben `npm run lint` (eslint, wenige Regeln in eslint.config.mjs) und `tsc` im strict-Modus. `npm test` öffnet ein sichtbares VS-Code-Fenster und lädt beim ersten Lauf VS Code herunter.
- **Kein Timeout/Retry** bei LLM-Requests und Bild-Downloads; ein hängender Endpunkt blockiert die Fortschrittsanzeige (bei translate/sendToAi nicht abbrechbar).
