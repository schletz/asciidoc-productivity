import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Extracts the table in the active editor selection and copies it to the clipboard as TSV.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 */
export async function copyAsTsv(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const text = editorService.performEditorOperations(editor =>
        editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection));
    if (text === undefined) {
        vscode.window.showWarningMessage('Please select a table first.');
        return;
    }

    const tsvOutput = syntax.parseTable(text).map(cells => cells.join('\t')).join('\n');
    if (tsvOutput.trim() === '') {
        vscode.window.showWarningMessage('Could not extract table data.');
        return;
    }

    await vscode.env.clipboard.writeText(tsvOutput);
    vscode.window.showInformationMessage('Table copied to clipboard as TSV!');
}
