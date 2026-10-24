import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Aligns the columns of the table under the cursor. With a selection, the active end of the
 * selection counts as cursor.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 * @throws Error if the syntax has no table formatting (AsciiDoc).
 */
export async function formatTable(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    if (!syntax.formatTableAt) {
        throw new Error('Formatting tables is only supported in Markdown documents.');
    }

    const { lines, line } = editorService.performEditorOperations(editor => ({
        lines: editor.document.getText().split(/\r?\n/),
        line: editor.selection.active.line
    }));

    const formatted = syntax.formatTableAt(lines, line);
    if (!formatted) {
        vscode.window.showWarningMessage('Place the cursor inside a Markdown table.');
        return;
    }

    await editorService.replaceLines(formatted.startLine, formatted.endLine, formatted.text);
}
