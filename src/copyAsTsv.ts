import * as vscode from 'vscode';

/**
 * Extracts an AsciiDoc table from the active editor selection and copies it to the clipboard as TSV.
 */
export async function copyAsTsv() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No editor open.');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select an AsciiDoc table first.');
            return;
        }

        // Extract selected text and isolate individual table rows
        const text = editor.document.getText(selection);
        const rows = text.replace(/^\|===/gm, '').trim().split(/(?:\r?\n){2,}/);

        // Convert each row to TSV format by stripping borders and joining cells with tabs
        const tsvRows = rows.map(row => {
            const cells = row.replace(/^\|/g, '').split('|').map(cell => cell.trim());
            return cells.join('\t').trim();
        });

        const tsvOutput = tsvRows.join('\n');
        if (!tsvOutput) {
            vscode.window.showWarningMessage('Could not extract table data.');
            return;
        }

        await vscode.env.clipboard.writeText(tsvOutput);
        vscode.window.showInformationMessage('Table copied to clipboard as TSV!');
    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
        }
    }
}