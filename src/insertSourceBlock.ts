import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Inserts clipboard content into the active editor as a formatted source block.
 * Prompts for a language identifier to enable syntax highlighting in the output.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 */
export async function insertSourceBlock(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const language = await vscode.window.showInputBox({
        prompt: 'Enter language for the source block (e.g., csharp, java, python)',
        value: 'csharp'
    }) ?? '';

    const clipboardText = await vscode.env.clipboard.readText();
    if (!clipboardText) {
        vscode.window.showWarningMessage('The clipboard is empty.');
        return;
    }

    await editorService.insertAtCurrentPosition(syntax.sourceBlock(clipboardText, language));
}
