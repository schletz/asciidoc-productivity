// =================================================================================================
// showPreview.ts
// Renders a preview for AsciiDoc documents in VS Code.
// This file uses a customized version of asciidoctor.js:
//     git clone https://github.com/asciidoctor/asciidoctor.js.git
//     cd asciidoctor.js
//     npm install
//     cd packages/core
//     npm install
//     
//     In packages/core/src/template-asciidoctor-browser.js change 
//     export default function Asciidoctor(moduleConfig)
//     to
//     window.Asciidoctor = function Asciidoctor(moduleConfig)
//
// Download asciidoctor-kroki for PlantUML Rendering from
// https://github.com/asciidoctor/asciidoctor-kroki/blob/master/dist/browser/asciidoctor-kroki.js
//
// Download highlight.js from https://highlightjs.org/download and copy min.js and theme to lib.
// Download MathJax from https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js to lib.
// =================================================================================================
const printRawHtml = false;

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Service to manage the AsciiDoc Preview Panel.
 * Encapsulates the webview state and ensures events are locked to the initial document.
 */
export class PreviewService {
    private static instance: PreviewService;
    private panel: vscode.WebviewPanel | undefined;
    private sourceUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];

    private constructor() { }

    /**
     * Retrieves the singleton instance of the PreviewService.
     * @returns The active PreviewService instance.
     */
    public static getInstance(): PreviewService {
        if (!PreviewService.instance) {
            PreviewService.instance = new PreviewService();
        }
        return PreviewService.instance;
    }

    /**
     * Initializes and shows the preview panel for the currently active AsciiDoc editor.
     * @param context - The VS Code extension context.
     */
    public showPreview(context: vscode.ExtensionContext): void {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.languageId !== 'asciidoc') {
            vscode.window.showInformationMessage('Please change the language of the current file to AsciiDoc to use the preview.');
            return;
        }

        // Lock the preview to the specific file that was active when called
        this.sourceUri = editor.document.uri;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            this.updateContent(editor.document);
            return;
        }

        this.createPanel(context, editor.document);
    }

    /**
     * Bootstraps the Webview panel and its dependencies.
     * @param context - The VS Code extension context.
     * @param document - The document to render initially.
     */
    private createPanel(context: vscode.ExtensionContext, document: vscode.TextDocument): void {
        const documentDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
        const localResourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(context.extensionUri, 'lib')];

        if (vscode.workspace.workspaceFolders) {
            localResourceRoots.push(...vscode.workspace.workspaceFolders.map(f => f.uri));
        } else {
            localResourceRoots.push(documentDir);
        }

        this.panel = vscode.window.createWebviewPanel(
            'asciidocPreview',
            'AsciiDoc Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: localResourceRoots
            }
        );

        const libUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'lib'));
        const baseUri = this.panel.webview.asWebviewUri(documentDir);

        this.panel.webview.html = this.getWebviewContent(libUri, baseUri);

        this.setupEventListeners();

        // Delay initial render to ensure the webview is fully initialized
        setTimeout(() => this.updateContent(document), 500);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Registers workspace events scoped to the currently managed preview document.
     */
    private setupEventListeners(): void {
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
            // Strict check: only update if the modified document matches our locked source URI
            if (this.sourceUri && event.document.uri.toString() === this.sourceUri.toString()) {
                this.updateContent(event.document);
            }
        });

        this.disposables.push(changeDocumentSubscription);
    }

    /**
     * Resolves dependencies and posts the updated text to the Webview.
     * @param document - The updated document to process.
     */
    private updateContent(document: vscode.TextDocument): void {
        if (!this.panel) {
            return;
        }

        const resolvedText = this.resolveLocalIncludes(document.getText(), document.uri);
        this.panel.webview.postMessage({ command: 'update', text: resolvedText });
    }

    /**
     * Cleans up resources when the panel is closed.
     */
    private dispose(): void {
        this.panel = undefined;
        this.sourceUri = undefined;

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Resolves local include directives synchronously using the Node.js backend.
     * @param text - The AsciiDoc source text.
     * @param documentUri - The URI of the current document.
     * @returns The resolved text with includes expanded or error placeholders.
     */
    private resolveLocalIncludes(text: string, documentUri: vscode.Uri): string {
        if (documentUri.scheme !== 'file') {
            return text;
        }

        const baseDir = path.dirname(documentUri.fsPath);
        const includeRegex = /^include::([^\[]+)\[(.*?)\]/gm;

        return text.replace(includeRegex, (match: string, filePath: string) => {
            try {
                const fullPath = path.join(baseDir, filePath);
                if (fs.existsSync(fullPath)) {
                    return fs.readFileSync(fullPath, 'utf8');
                } else {
                    return `\n// ERROR: File not found: ${filePath}\n`;
                }
            } catch (e: any) {
                return `\n// ERROR: Could not load ${filePath} (${e.message})\n`;
            }
        });
    }

    /**
     * Generates the HTML content for the preview webview.
     * @param libUri - The webview URI pointing to extension library assets.
     * @param baseUri - The webview URI pointing to the document's directory.
     * @returns The complete HTML string for the preview panel.
     */
    private getWebviewContent(libUri: vscode.Uri, baseUri: vscode.Uri): string {
        const baseHref = baseUri.toString().endsWith('/') ? baseUri.toString() : baseUri.toString() + '/';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <base href="${baseHref}">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${libUri.scheme}: vscode-resource: vscode-webview-resource: data:; img-src ${libUri.scheme}: vscode-resource: vscode-webview-resource: https: http: data:; style-src 'unsafe-inline' ${libUri.scheme}: vscode-resource: vscode-webview-resource:; script-src 'unsafe-inline' ${libUri.scheme}: vscode-resource: vscode-webview-resource:; worker-src blob:;">
                <title>AsciiDoc Preview</title>
                <link rel="stylesheet" id="hljs-theme" href="">
                <link rel="stylesheet" href="${libUri}/preview.css">
                <script>
                    const lightThemeUri = "${libUri}/vs.min.css";
                    const darkThemeUri = "${libUri}/vs2015.min.css";

                    function updateHljsTheme() {
                        const isDark = document.body.classList.contains('vscode-dark') || 
                                    document.body.classList.contains('vscode-high-contrast');
                        document.getElementById('hljs-theme').href = isDark ? darkThemeUri : lightThemeUri;
                    }
                    window.addEventListener('DOMContentLoaded', () => {
                        updateHljsTheme();
                        const observer = new MutationObserver(updateHljsTheme);
                        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
                    });
                </script>            
                <script>
                    const printRawHtml = ${printRawHtml};

                    window.MathJax = {
                        tex: {
                            inlineMath: [['\\\\(', '\\\\)'], ['\\\\$', '\\\\$']],
                            displayMath: [['\\\\[', '\\\\]']],
                            processEscapes: true
                        },
                        startup: {
                            typeset: false
                        },
                        options: {
                            enableMenu: false,
                            enableSpeech: false,
                            enableBraille: false,
                            enableEnrichment: false,
                            menuOptions: {
                                settings: {
                                enrich: false,         // true to enable semantic-enrichment
                                collapsible: false,   // true to enable collapsible math
                                speech: false,         // true to enable speech generation
                                braille: false,        // true to enable Braille generation
                                assistiveMml: false,  // true to enable assistive MathML
                                }
                            }                        
                        }                    
                    };                
                </script>
                <script src="${libUri}/asciidoctor.min.js"></script>
                <script src="${libUri}/asciidoctor-kroki.js"></script>
                <script src="${libUri}/highlight.min.js"></script>
                <script src="${libUri}/tex-mml-chtml.js"></script>
                <script src="${libUri}/preview.js" defer></script>
            </head>
            <body>
                <div id="content">Loading Asciidoctor preview...</div>
            </body>
            </html>
        `;
    }
}

/**
 * Entry point for the show preview command.
 * Wraps the PreviewService singleton call to maintain compatibility with extension.ts exports.
 * @param context - The VS Code extension context.
 */
export function showPreview(context: vscode.ExtensionContext): void {
    PreviewService.getInstance().showPreview(context);
}