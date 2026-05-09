import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KrokiContainerManager, outputChannel } from './KrokiContainerManager';

const printRawHtml = false;

/**
 * Service to manage the AsciiDoc Preview Panel.
 * Encapsulates the webview state and ensures events are locked to the initial document.
 */
export class PreviewService {
    private static instance: PreviewService;
    private panel: vscode.WebviewPanel | undefined;
    private sourceUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];
    private krokiManager = new KrokiContainerManager();

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
     * Continues with limited functionality if Docker/Kroki fails.
     * @param context - The VS Code extension context.
     */
    public async showPreview(context: vscode.ExtensionContext): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.languageId !== 'asciidoc') {
            vscode.window.showInformationMessage('Please change the language of the current file to AsciiDoc to use the preview.');
            return;
        }

        this.sourceUri = editor.document.uri;

        if (!this.panel) {
            await vscode.window.withProgress({
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
                    // We catch the error to prevent double notifications and allow fallback preview.
                    outputChannel.appendLine(`[ERROR] Fallback mode: Preview will open without PlantUML support.`);
                }
            });

            this.createPanel(context, editor.document);
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside);
            this.updateContent(editor.document);
        }
    }

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
        setTimeout(() => this.updateContent(document), 500);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private setupEventListeners(): void {
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
            if (this.sourceUri && event.document.uri.toString() === this.sourceUri.toString()) {
                this.updateContent(event.document);
            }
        });

        this.disposables.push(changeDocumentSubscription);
    }

    /**
     * Injects Kroki server configuration or a warning message if unavailable.
     * @param text - The original AsciiDoc source.
     * @returns Source with injected attributes or warnings.
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

    private updateContent(document: vscode.TextDocument): void {
        if (!this.panel) {
            return;
        }

        let resolvedText = this.resolveLocalIncludes(document.getText(), document.uri);
        resolvedText = this.injectKrokiAttribute(resolvedText);

        this.panel.webview.postMessage({ command: 'update', text: resolvedText });
    }

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
         * Public teardown method to be called upon extension deactivation.
         * Ensures the Docker container is completely stopped when VS Code is closed.
         */
    public async shutdown(): Promise<void> {
        await this.krokiManager.stop();
    }

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