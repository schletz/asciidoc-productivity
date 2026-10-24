import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';
import { parseTsv } from './parseTsv';

/**
 * Reads TSV data from the clipboard and inserts it as a table at the current cursor position.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 */
export async function insertTsvTable(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    if (!clipboardText || clipboardText.trim() === '') {
        vscode.window.showWarningMessage('Clipboard is empty.');
        return;
    }

    await editorService.insertAtCurrentPosition(syntax.table(parseTsv(clipboardText)));
}
