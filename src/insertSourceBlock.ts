import * as vscode from 'vscode';
import EditorService from './EditorService';

/**
 * Inserts clipboard content into the active editor as a formatted source block.
 * Prompts for a language identifier to enable syntax highlighting in the output.
 */
export async function insertSourceBlock(): Promise<void> {
    try {
        const editorService = new EditorService();

        const language = await vscode.window.showInputBox({
            prompt: 'Enter language for the source block (e.g., csharp, java, python)',
            value: 'csharp'
        }) ?? '';

        const clipboardText = await vscode.env.clipboard.readText();
        if (!clipboardText) {
            vscode.window.showWarningMessage('The clipboard is empty.');
            return;
        }

        const langDef = language.trim() !== '' ? `,${language.trim()}` : '';
        const block = `[source${langDef}]\n----\n${clipboardText}\n----\n`;
        await editorService.insertAtCurrentPosition(block);
    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
        }
    }
}