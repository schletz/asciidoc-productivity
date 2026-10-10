import * as vscode from 'vscode';
import EditorService from './EditorService';
import { tsvToMarkdownTable } from './tsvToMarkdownTable';

/**
 * Reads TSV data from the clipboard and inserts it as a Markdown table at the current cursor position.
 */
export async function insertMarkdownTable() {
    try {
        const editorService = new EditorService();

        const clipboardText = await vscode.env.clipboard.readText();
        if (!clipboardText || clipboardText.trim() === '') {
            vscode.window.showWarningMessage('Clipboard is empty.');
            return;
        }

        await editorService.insertAtCurrentPosition(`${tsvToMarkdownTable(clipboardText)}\n`);
    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
        }
    }
}
