import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Marks the selection inside document content passed to {@link TestWorkspace.openDocument}. */
const selectionStart = '«';
const selectionEnd = '»';

/**
 * Prepares files and editors in the workspace folder of the test instance and
 * activates the extension under test. The folder is recreated empty by .vscode-test.mjs
 * before every run, so tests may write freely into it.
 */
export default class TestWorkspace {
    public static readonly extensionId = 'schletz.asciidoc-productivity';

    /**
     * Absolute path of the workspace folder opened by the test instance.
     * @throws AssertionError if the instance was started without a workspace folder.
     */
    public static get rootPath(): string {
        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'The test instance has no workspace folder.');
        return folder.uri.fsPath;
    }

    /**
     * Activates the extension under test. Activation is implicit via the contributed
     * commands, but awaiting it up front keeps activation time out of the first test.
     */
    public static async activateExtension(): Promise<void> {
        const extension = vscode.extensions.getExtension(TestWorkspace.extensionId);
        assert.ok(extension, `Extension ${TestWorkspace.extensionId} is not loaded.`);
        await extension.activate();
    }

    /**
     * Writes a file below the workspace folder, creating missing directories.
     * @param relativePath Path relative to the workspace folder, using forward slashes.
     * @param content File content, written as UTF-8.
     * @returns The absolute path of the written file.
     */
    public static writeFile(relativePath: string, content: string | Buffer): string {
        const absolutePath = path.join(TestWorkspace.rootPath, relativePath);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, content);
        return absolutePath;
    }

    /**
     * Reads a file below the workspace folder as UTF-8.
     * @param relativePath Path relative to the workspace folder.
     */
    public static readFile(relativePath: string): string {
        return fs.readFileSync(path.join(TestWorkspace.rootPath, relativePath), 'utf8');
    }

    /**
     * Saves the content as a file in the workspace and shows it in the active editor.
     * The text between « and » becomes the selection; «» alone sets the cursor.
     * Without markers the cursor is placed at the start of the document.
     * Use a distinct path per test: VS Code may keep a closed document in memory and
     * would then return the stale content instead of the newly written file.
     * @param relativePath Path relative to the workspace folder; the extension decides the language id.
     * @param content Document content, optionally with selection markers.
     * @returns The editor showing the document.
     */
    public static async openDocument(relativePath: string, content: string): Promise<vscode.TextEditor> {
        const start = content.indexOf(selectionStart);
        const end = content.indexOf(selectionEnd);
        assert.ok((start < 0) === (end < 0) && start <= end, 'Selection markers must appear as a « … » pair.');

        // Offsets refer to the content without markers; the end marker shifts by one.
        const plainContent = content.replace(selectionStart, '').replace(selectionEnd, '');
        const filePath = TestWorkspace.writeFile(relativePath, plainContent);

        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
        if (start >= 0) {
            editor.selection = new vscode.Selection(
                document.positionAt(start), document.positionAt(end - 1));
        }
        return editor;
    }

    /**
     * Shows a new, never saved document (scheme untitled) in the active editor.
     * @param languageId Language of the document, e.g. 'markdown'.
     * @param content Initial content.
     * @returns The editor showing the document.
     */
    public static async openUntitledDocument(languageId: string, content: string = ''): Promise<vscode.TextEditor> {
        const document = await vscode.workspace.openTextDocument({ language: languageId, content });
        return vscode.window.showTextDocument(document);
    }

    /**
     * Closes all editors without saving, so the next test starts without an active editor.
     */
    public static async closeAllEditors(): Promise<void> {
        // Closing a dirty editor opens a modal save prompt that would block the test run,
        // so modified documents are reverted first.
        for (const document of vscode.workspace.textDocuments.filter(d => d.isDirty)) {
            await vscode.window.showTextDocument(document);
            await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
        }
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    /**
     * Executes a command contributed by the extension under test.
     * @param name Command name without the extension prefix, e.g. 'insertSourceBlock'.
     * @param args Arguments passed to the handler, e.g. the clicked URI for explorer commands.
     */
    public static async runCommand(name: string, ...args: unknown[]): Promise<void> {
        await vscode.commands.executeCommand(`asciidoc-productivity.${name}`, ...args);
    }
}
