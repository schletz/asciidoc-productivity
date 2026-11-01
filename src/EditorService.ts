import * as vscode from 'vscode';
import * as path from 'path';
import { Uri } from 'vscode';

/**
 * Wraps the text editor that is active when the service is created. Markup commands use it
 * for edits, dialogs and paths relative to the document; the editor stays the same even if
 * the user switches tabs while a dialog is open.
 */
export default class EditorService {
    private editor: vscode.TextEditor;

    /**
     * @throws Error if no text editor is active.
     */
    constructor() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            throw new Error('No editor open.');
        }
        this.editor = activeEditor;
    }

    /**
     * Gives a callback direct access to the editor, for reads the service does not cover.
     * @param operations - Callback receiving the editor.
     * @returns The callback's result.
     */
    public performEditorOperations<T>(operations: (editor: vscode.TextEditor) => T): T {
        return operations(this.editor);
    }

    /**
     * Inserts text at the active end of the selection; a selection is not replaced.
     * @param block - Text to insert.
     * @returns True if the edit was applied.
     */
    public async insertAtCurrentPosition(block: string): Promise<boolean> {
        return this.editor.edit(editBuilder => {
            editBuilder.insert(this.editor.selection.active, block);
        });
    }

    /**
     * Gets the whole lines touched by the selection. A selection that ends at the start of a
     * line does not include that line; this happens when whole lines are selected.
     * @returns The zero-based, inclusive line range and its text, or undefined if nothing is selected.
     */
    public getSelectedLines(): { startLine: number; endLine: number; text: string } | undefined {
        const selection = this.editor.selection;
        if (selection.isEmpty) {
            return undefined;
        }

        const startLine = selection.start.line;
        const endLine = selection.end.character === 0 && selection.end.line > startLine
            ? selection.end.line - 1
            : selection.end.line;
        const document = this.editor.document;
        const text = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
        return { startLine, endLine, text };
    }

    /**
     * Replaces whole lines of the document. Unchanged text is not written, so the document
     * does not become dirty without a reason.
     * @param startLine - First line to replace, zero-based.
     * @param endLine - Last line to replace, zero-based and inclusive; its line break is kept.
     * @param text - Replacement text; VS Code converts its line breaks to the document's EOL.
     * @returns True if the text is in place, false if the edit was rejected.
     */
    public async replaceLines(startLine: number, endLine: number, text: string): Promise<boolean> {
        const document = this.editor.document;
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        if (document.getText(range).replace(/\r\n/g, '\n') === text) {
            return true;
        }
        return this.editor.edit(editBuilder => editBuilder.replace(range, text));
    }

    /**
     * Gets the folder that dialogs open in.
     * @param useWorkspaceAsDefault - Whether an unsaved document falls back to the first workspace folder.
     * @returns The document's folder, the fallback, or undefined.
     */
    public getDocumentPath(useWorkspaceAsDefault: boolean = true): Uri | undefined {
        if (this.editor.document.uri.scheme === 'file') {
            return vscode.Uri.file(path.dirname(this.editor.document.uri.fsPath));
        }
        return useWorkspaceAsDefault
            ? vscode.workspace.workspaceFolders?.[0]?.uri
            : undefined;
    }

    /**
     * Shows an open dialog in the document's folder.
     * @param options - Overrides for the dialog options.
     * @returns The path of the first selected file, or undefined if cancelled.
     */
    public async showOpenDialog(options?: vscode.OpenDialogOptions): Promise<string | undefined> {
        const defaultOptions: vscode.OpenDialogOptions = { defaultUri: this.getDocumentPath() };
        const fileUris = await vscode.window.showOpenDialog({ ...defaultOptions, ...options });
        return fileUris && fileUris.length > 0 ? fileUris[0].fsPath : undefined;
    }

    /**
     * Shows a save dialog in the document's folder.
     * @param options - Overrides for the dialog options.
     * @returns The chosen path, or undefined if cancelled.
     */
    public async showSaveDialog(options?: vscode.SaveDialogOptions): Promise<string | undefined> {
        const defaultOptions: vscode.SaveDialogOptions = { defaultUri: this.getDocumentPath() };
        const saveUri = await vscode.window.showSaveDialog({ ...defaultOptions, ...options });
        return saveUri ? saveUri.fsPath : undefined;
    }

    /**
     * Checks whether the document is a file on disk. Relative paths need a document folder;
     * untitled documents have none.
     * @returns True for the `file` scheme.
     */
    public isDocumentSaved(): boolean {
        return this.editor.document.uri.scheme === 'file';
    }

    /**
     * Computes the path from the document's folder to a target, with forward slashes as
     * AsciiDoc and Markdown expect them.
     * @param targetPath - Absolute path of the target.
     * @returns The relative path.
     */
    public getRelativePath(targetPath: string): string {
        const docPath = path.dirname(this.editor.document.uri.fsPath);
        return path.relative(docPath, targetPath).replace(/\\/g, '/');
    }

    /**
     * Moves the focus back to the editor, e.g. after an explorer command took it.
     */
    public async focusEditor(): Promise<void> {
        if (this.editor && this.editor.document) {
            await vscode.window.showTextDocument(
                this.editor.document, this.editor.viewColumn, false);
        }
    }
}
