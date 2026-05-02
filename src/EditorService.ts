import * as vscode from 'vscode';
import * as path from 'path';
import { Uri } from 'vscode';

/**
 * Service class that encapsulates common VS Code editor operations and utilities.
 * Provides a safe interface for interacting with the active text editor, file dialogs,
 * and path resolution within an extension context.
 */
export default class EditorService {
    private editor: vscode.TextEditor;

    /**
     * Initializes the service by capturing the currently active text editor.
     * @throws Error if no text editor is currently open in VS Code.
     */
    constructor() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            throw new Error('No editor open.');
        }
        this.editor = activeEditor;
    }

    /**
     * Executes a provided callback function against the current editor instance.
     * Useful for performing type-safe operations that require direct access to the editor object.
     * @param operations A function that receives the active editor and returns a result of type T.
     * @returns The return value of the executed callback.
     */
    public performEditorOperations<T>(operations: (editor: vscode.TextEditor) => T): T {
        return operations(this.editor);
    }

    /**
     * Inserts text at the current cursor position using VS Code's edit API.
     * @param block The string content to insert.
     * @returns True if the operation succeeded, false otherwise.
     */
    public async insertAtCurrentPosition(block: string): Promise<boolean> {
        return this.editor.edit(editBuilder => {
            editBuilder.insert(this.editor.selection.active, block);
        });
    }

    /**
     * Retrieves the directory URI for the current document or workspace fallback.
     * @param useWorkspaceAsDefault When true, returns the first workspace folder if the document is not a file. Defaults to true.
     * @returns The target URI, or undefined if no valid path can be resolved.
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
     * Opens a file selection dialog with the current document's directory as the default location.
     * @param options Optional VS Code open dialog configuration overrides.
     * @returns The filesystem path of the selected file, or undefined if cancelled.
     */
    public async showOpenDialog(options?: vscode.OpenDialogOptions): Promise<string | undefined> {
        const defaultOptions: vscode.OpenDialogOptions = { defaultUri: this.getDocumentPath() };
        const fileUris = await vscode.window.showOpenDialog({ ...defaultOptions, ...options });
        return fileUris && fileUris.length > 0 ? fileUris[0].fsPath : undefined;
    }

    /**
     * Opens a save-as dialog with the current document's directory as the default location.
     * @param options Optional VS Code save dialog configuration overrides.
     * @returns The filesystem path for saving, or undefined if cancelled.
     */
    public async showSaveDialog(options?: vscode.SaveDialogOptions): Promise<string | undefined> {
        const defaultOptions: vscode.SaveDialogOptions = { defaultUri: this.getDocumentPath() };
        const saveUri = await vscode.window.showSaveDialog({ ...defaultOptions, ...options });
        return saveUri ? saveUri.fsPath : undefined;
    }

    /**
     * Checks whether the current document is backed by a local file rather than an in-memory or remote resource.
     * @returns True if the document scheme is 'file', false otherwise (e.g., untitled, scratchpad, or remote).
     */
    public isDocumentSaved(): boolean {
        return this.editor.document.uri.scheme === 'file';
    }

    /**
     * Calculates a forward-slash relative path from the current document's directory to a target path.
     * Normalizes backslashes for AsciiDoc compatibility.
     * @param targetPath The absolute or relative path to resolve against the current document.
     * @returns The computed relative path string.
     */
    public getRelativeAsciiDocPath(targetPath: string): string {
        const docPath = path.dirname(this.editor.document.uri.fsPath);
        return path.relative(docPath, targetPath).replace(/\\/g, '/');
    }

    /**
     * Brings the current editor view to focus by re-showing its associated text document.
     * @returns A promise that resolves when the editor is focused.
     */
    public async focusEditor(): Promise<void> {
        if (this.editor && this.editor.document) {
            await vscode.window.showTextDocument(
                this.editor.document, this.editor.viewColumn, false);
        }
    }
}