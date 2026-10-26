import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';
import { parseDelimited } from './parseDelimited';

/**
 * Converts the selected lines into a table. Every non-blank line becomes a row, a delimiter
 * entered by the user separates the cells and the first line becomes the header.
 * The table replaces the whole lines touched by the selection.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 */
export async function convertToTable(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const selectedLines = editorService.getSelectedLines();
    if (!selectedLines) {
        vscode.window.showWarningMessage('Please select the lines to convert first.');
        return;
    }

    const input = await vscode.window.showInputBox({
        prompt: 'Delimiter between the cells (\\t for tab)',
        placeHolder: 'e.g. ; or : or \\t',
        validateInput: value => value === '' ? 'Please enter a delimiter.' : undefined
    });
    if (input === undefined) {
        return;
    }

    // A tab cannot be typed into an input box, so the escape sequence stands for it.
    const delimiter = input === '\\t' ? '\t' : input;
    const lines = selectedLines.text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (!lines.some(line => line.includes(delimiter))) {
        vscode.window.showWarningMessage(`Delimiter "${input}" not found in the selection.`);
        return;
    }

    // replaceLines keeps the line break of the last line, so the table's final one is dropped.
    const table = syntax.table(parseDelimited(lines.join('\n'), delimiter)).replace(/\n$/, '');
    await editorService.replaceLines(selectedLines.startLine, selectedLines.endLine, table);
}
