import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KrokiContainerManager, outputChannel } from './KrokiContainerManager';

/** Debug switch: shows the generated HTML as text instead of rendering it. */
const printRawHtml = false;

/**
 * Owns the single AsciiDoc preview panel of the session. The panel shows the document from
 * which the preview was last opened; switching to another editor tab keeps it on that
 * document, so the preview stays visible while the user copies from other files.
 * Rendering happens in the webview (lib/preview.js); this class only sends the text.
 */
export class PreviewService {
    private static instance: PreviewService;
    private panel: vscode.WebviewPanel | undefined;
    private sourceUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];
    private krokiManager = new KrokiContainerManager();

    private constructor() { }

    /**
     * @returns The instance shared by the command and deactivate().
     */
    public static getInstance(): PreviewService {
        if (!PreviewService.instance) {
            PreviewService.instance = new PreviewService();
        }
        return PreviewService.instance;
    }

    /**
     * Shows the preview of the active editor's document, creating the panel and starting
     * Kroki on first use. An existing panel switches to the active document.
     * @param context - Extension context; provides the path of lib/.
     */
    public async showPreview(context: vscode.ExtensionContext): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.languageId !== 'asciidoc') {
            vscode.window.showInformationMessage('Please change the language of the current file to AsciiDoc to use the preview.');
            return;
        }

        this.sourceUri = editor.document.uri;

        if (!this.panel) {
            // The panel opens at once; diagrams appear after the refresh that follows the Kroki start.
            this.createPanel(context, editor.document);
            this.startKrokiInBackground();
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside);
            this.updateContent(editor.document);
        }
    }

    /**
     * Starts Kroki behind a progress notification and re-renders once it answers, so the
     * diagram URLs point to the local server. Until then, or if the start fails, no
     * `:kroki-server-url:` is set and asciidoctor-kroki uses the public kroki.io. This is
     * intended: offline the diagrams are missing, online kroki.io bridges the startup time.
     */
    private startKrokiInBackground(): void {
        void vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Starting local Kroki container for rendering...',
            cancellable: false
        }, async () => {
            try {
                await this.krokiManager.start();
            } catch (error: any) {
                if (error.syscall === 'connect') {
                    vscode.window.showErrorMessage(
                        "Unable to access docker. Preview will open without PlantUML support. Run 'docker ps' in the terminal to check if docker is running and if you have the necessary permissions."
                    );
                } else {
                    vscode.window.showErrorMessage('Failed to start local Kroki container. Preview will open without PlantUML support. ' + error.message);
                }
                outputChannel.appendLine(`[ERROR] Fallback mode: Preview will open without PlantUML support.`);
                return;
            }

            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.sourceUri?.toString());
            if (doc) {
                this.updateContent(doc);
            }
        });
    }

    /**
     * Creates the webview beside the editor. Local resources are limited to lib/ and the
     * workspace folders (or the document's folder without a workspace), so images and
     * includes of the document can load.
     * @param context - Extension context; provides the path of lib/.
     * @param document - Document shown first; its folder is the base URL for relative paths.
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
        // The Kroki container needs time to start, and preview.js registers its message
        // listener only after all scripts have loaded; an earlier message would be lost.
        setTimeout(() => this.updateContent(document), 500);

        // Re-sends the document whenever the panel becomes visible again, e.g. after it was
        // moved into a new window, so the preview keeps showing the source document.
        this.panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.sourceUri?.toString());
                if (doc) {
                    this.updateContent(doc);
                }
            }
        }, null, this.disposables);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Re-renders on every change of the source document; changes to other documents,
     * including the one in the active tab, are ignored on purpose.
     */
    private setupEventListeners(): void {
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
            if (this.sourceUri && event.document.uri.toString() === this.sourceUri.toString()) {
                this.updateContent(event.document);
            }
        });

        this.disposables.push(changeDocumentSubscription);
    }

    /**
     * Points asciidoctor-kroki to the local container by setting `:kroki-server-url:` right
     * after the document title, where header attributes must be. Without a running container
     * the text is returned unchanged.
     * @param text - AsciiDoc source with includes already resolved.
     * @returns The source with the attribute.
     */
    private injectKrokiAttribute(text: string): string {
        if (!this.krokiManager.port) {
            return text;
        }

        const krokiAttr = `:kroki-server-url: http://localhost:${this.krokiManager.port}\n`;
        const titleRegex = /^=[^\n]+\n/;

        if (titleRegex.test(text)) {
            return text.replace(titleRegex, `$&${krokiAttr}`);
        }

        return `${krokiAttr}\n${text}`;
    }

    /**
     * Sends the prepared source to the webview, which renders it completely.
     * @param document - Document to show.
     */
    private updateContent(document: vscode.TextDocument): void {
        if (!this.panel) {
            return;
        }

        let resolvedText = this.resolveLocalIncludes(document.getText(), document.uri);
        resolvedText = this.injectKrokiAttribute(resolvedText);

        this.panel.webview.postMessage({ command: 'update', text: resolvedText });
    }

    /**
     * Cleans up after the user closed the panel and stops the container.
     */
    private dispose(): void {
        this.panel = undefined;
        this.sourceUri = undefined;

        this.krokiManager.stop().catch(e => console.error(e));

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Stops the Kroki container; called on deactivation.
     */
    public async shutdown(): Promise<void> {
        await this.krokiManager.stop();
    }

    /**
     * Replaces `include::` lines with the file content, because asciidoctor.js in the webview
     * has no file access. Only one level is resolved, and attributes such as `tag=` or
     * `lines=` are ignored.
     * @param text - Document source.
     * @param documentUri - Document location; paths are relative to its folder.
     * @returns The source with includes inlined, or an `// ERROR:` comment line per failed include.
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
     * Builds the webview HTML. The script order matters: the MathJax configuration must
     * precede tex-mml-chtml.js, and preview.js needs all libraries loaded. The highlight.js
     * theme follows the VS Code theme. `img-src` allows http(s) for the Kroki images.
     * @param libUri - Webview URI of lib/.
     * @param baseUri - Webview URI of the document's folder, used as base for relative image paths.
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
                                enrich: false,
                                collapsible: false,
                                speech: false,
                                braille: false,
                                assistiveMml: false,
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
