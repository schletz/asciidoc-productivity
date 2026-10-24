import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';
import { createMarkupSyntax } from './createMarkupSyntax';

/**
 * A command that edits the active AsciiDoc or Markdown document.
 * It throws on errors instead of reporting them; warnings it shows itself.
 */
export type MarkupCommandHandler<TArgs extends unknown[]> =
    (editorService: EditorService, syntax: MarkupSyntax, ...args: TArgs) => Promise<void>;

/**
 * Turns a markup command handler into a VS Code command callback. The syntax depends on
 * the document that is active when the command runs, so it is resolved per call instead of
 * at activation. Every error, including a missing editor or an unsupported language,
 * is shown as an error message.
 * @param handler The command implementation.
 * @returns The callback to pass to commands.registerCommand; VS Code arguments are forwarded.
 */
export function runMarkupCommand<TArgs extends unknown[]>(
    handler: MarkupCommandHandler<TArgs>
): (...args: TArgs) => Promise<void> {
    return async (...args: TArgs) => {
        try {
            const editorService = new EditorService();
            const syntax = createMarkupSyntax(editorService.performEditorOperations(editor => editor.document));
            await handler(editorService, syntax, ...args);
        } catch (error: unknown) {
            vscode.window.showErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
        }
    };
}
